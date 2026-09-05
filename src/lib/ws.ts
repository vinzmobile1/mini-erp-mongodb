type EventCallback = (event: { type: string; payload: any }) => void;

class RealtimeClient {
  private ws: WebSocket | null = null;
  private eventSource: EventSource | null = null;
  private listeners: Set<EventCallback> = new Set();
  private statusListeners: Set<(status: "connected" | "connecting" | "disconnected") => void> = new Set();
  private reconnectTimeout: any = null;
  private pingInterval: any = null;
  private pollingInterval: any = null;
  private processedEvents = new Map<string, number>(); // _eventId -> timestamp for deduplication
  public status: "connected" | "connecting" | "disconnected" = "disconnected";

  constructor() {
    this.setupWindowListeners();
    this.connect();
  }

  private setupWindowListeners() {
    if (typeof window === "undefined") return;

    // Suppress benign Vite HMR & WebSocket disconnection noisy logs in preview/Cloud Run
    window.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason?.message || String(event.reason || "");
      if (reason.includes("WebSocket closed without opened") || reason.includes("failed to connect to websocket")) {
        event.preventDefault();
      }
    });

    // Auto sync when user switches tabs or window becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        this.notifyListeners({ type: "sync:refresh", payload: { reason: "tab_visible" } });
        if (this.status !== "connected") {
          this.connect();
        }
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);
    window.addEventListener("online", () => {
      this.connect();
    });
  }

  public connect() {
    if (typeof window === "undefined") return;

    const apiBase = import.meta.env.VITE_API_BASE_URL
      ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")
      : (typeof window !== "undefined" ? window.location.origin : "");

    const isVercel = apiBase.includes("vercel.app");

    // Vercel Serverless does not support persistent WebSockets or long-lived SSE streams.
    // Use background sync directly to maintain synchronization without console errors.
    if (isVercel) {
      this.setStatus("connected");
      this.startBackgroundSync();
      return;
    }

    // 1. Connect via Server-Sent Events (SSE)
    this.connectSSE(apiBase);

    // 2. Also try WebSocket if supported
    this.connectWS(apiBase);

    // 3. Start background sync fallback
    this.startBackgroundSync();
  }

  private connectSSE(apiBase: string) {
    if (typeof EventSource === "undefined") return;
    if (this.eventSource && this.eventSource.readyState !== EventSource.CLOSED) {
      return;
    }

    try {
      const sseUrl = `${apiBase}/api/events`;
      this.eventSource = new EventSource(sseUrl);

      this.eventSource.onopen = () => {
        this.setStatus("connected");
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingEvent(data);
        } catch {
          // ignore non-json messages
        }
      };

      this.eventSource.onerror = () => {
        // If SSE fails (e.g. serverless Vercel returns HTML or fails stream), close gracefully to avoid error spam
        if (this.eventSource) {
          try {
            this.eventSource.close();
          } catch {}
          this.eventSource = null;
        }
        if (this.status !== "connected") {
          this.setStatus("connecting");
        }
      };
    } catch (err) {
      // SSE init error
    }
  }

  private connectWS(apiBase: string) {
    if (typeof WebSocket === "undefined") return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    let wsUrl = "";
    if (apiBase.startsWith("https://")) {
      wsUrl = apiBase.replace("https://", "wss://") + "/api/ws";
    } else if (apiBase.startsWith("http://")) {
      wsUrl = apiBase.replace("http://", "ws://") + "/api/ws";
    } else if (typeof window !== "undefined") {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      wsUrl = `${protocol}//${window.location.host}/api/ws`;
    }

    if (!wsUrl) return;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.setStatus("connected");
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingEvent(data);
        } catch {
          // ignore non-json messages
        }
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        if (!this.eventSource || this.eventSource.readyState !== EventSource.OPEN) {
          this.setStatus("connecting");
        }
      };

      this.ws.onerror = () => {
        if (this.ws) {
          try {
            this.ws.close();
          } catch {}
          this.ws = null;
        }
      };
    } catch {
      // WS failed, background polling handles sync
    }
  }

  private handleIncomingEvent(data: any) {
    if (!data || typeof data !== "object") return;

    // Deduplicate events that might arrive through both SSE and WS
    const eventId = data._eventId || `${data.type}-${JSON.stringify(data.payload || {})}`;
    const now = Date.now();

    // Clean old processed events (> 10s)
    for (const [id, time] of this.processedEvents) {
      if (now - time > 10000) {
        this.processedEvents.delete(id);
      }
    }

    if (this.processedEvents.has(eventId)) {
      return; // Already processed this event instance
    }
    this.processedEvents.set(eventId, now);

    this.setStatus("connected");
    this.notifyListeners(data);
  }

  private setStatus(newStatus: "connected" | "connecting" | "disconnected") {
    if (this.status === newStatus) return;
    this.status = newStatus;
    for (const listener of this.statusListeners) {
      try {
        listener(newStatus);
      } catch (err) {
        console.error("Realtime status listener error:", err);
      }
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: "ping" }));
        } catch {}
      }
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private startBackgroundSync() {
    if (this.pollingInterval) return;
    // Periodic silent sync every 12 seconds ONLY if connection dropped completely (fallback)
    this.pollingInterval = setInterval(() => {
      if (document.visibilityState === "visible" && this.status !== "connected") {
        this.notifyListeners({ type: "sync:refresh", payload: { reason: "periodic" } });
      }
    }, 12000);
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, 3000);
  }

  private notifyListeners(data: { type: string; payload: any }) {
    for (const listener of this.listeners) {
      try {
        listener(data);
      } catch (err) {
        console.error("Realtime listener error:", err);
      }
    }
  }

  public subscribe(callback: EventCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public onStatusChange(callback: (status: "connected" | "connecting" | "disconnected") => void): () => void {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => {
      this.statusListeners.delete(callback);
    };
  }
}

export const wsClient = new RealtimeClient();
export const realtimeClient = wsClient;

