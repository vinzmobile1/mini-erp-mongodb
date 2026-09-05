import {
  Channel,
  Customer,
  Divisi,
  SalesPerson,
  Brand,
  ItemGroup,
  Category,
  Product,
  OrderStatusMaster,
  SalesOrder,
  InvoiceOrder,
  InvoiceDetailResponse,
  OrderNote,
  CreateOrderPayload,
  AnalyticsSummary,
  DbStatusInfo,
  StatusHistory,
} from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, "")}/api`
  : "/api";

async function request<T>(endpoint: string, options?: RequestInit, retries = 2): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
      ...options,
    });

    const text = await res.text();

    if (!res.ok) {
      // If server returned 503 (database connection still warming up) and method is GET, retry
      if (res.status === 503 && retries > 0 && (!options?.method || options.method === "GET")) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return request<T>(endpoint, options, retries - 1);
      }

      let errorMsg = `HTTP Error ${res.status}: ${res.statusText || ""}`.trim();
      try {
        const data = JSON.parse(text);
        errorMsg = data.error || data.message || errorMsg;
      } catch {
        if (text.includes("<title>")) {
          const titleMatch = text.match(/<title>(.*?)<\/title>/i);
          if (titleMatch && titleMatch[1]) {
            errorMsg = `Server ${res.status}: ${titleMatch[1]}`;
          }
        } else if (text.trim()) {
          errorMsg = `Server ${res.status}: ${text.slice(0, 150)}`;
        }
      }
      throw new Error(errorMsg);
    }

    try {
      return JSON.parse(text) as T;
    } catch (err: any) {
      throw new Error(`Format respons server tidak valid: ${text.slice(0, 100)}`);
    }
  } catch (err: any) {
    // If network error (e.g. server restarting or transient glitch) on a GET request, retry
    if (
      retries > 0 &&
      (!options?.method || options.method === "GET") &&
      (err.name === "TypeError" || err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError"))
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return request<T>(endpoint, options, retries - 1);
    }
    throw err;
  }
}

export const api = {
  // DB status, Clear & Seeder
  getDbStatus: () => request<DbStatusInfo>("/db-status"),
  clearAllData: () => request<{ ok: boolean; message: string }>("/clear-all", { method: "POST" }),
  clearTransactions: () => request<{ ok: boolean; message: string }>("/clear-transactions", { method: "POST" }),
  reseedDatabase: () => request<{ ok: boolean; message: string }>("/reseed", { method: "POST" }),

  
  // Channel
  getChannels: () => request<Channel[]>("/channel"),
  createChannel: (payload: { nama_channel: string; color?: string } | string) => {
    const body = typeof payload === "string" ? { nama_channel: payload } : payload;
    return request<Channel>("/channel", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  updateChannel: (id: number, payload: { nama_channel: string; color?: string } | string) => {
    const body = typeof payload === "string" ? { nama_channel: payload } : payload;
    return request<Channel>(`/channel/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },
  deleteChannel: (id: number) =>
    request<{ ok: boolean; id: number }>(`/channel/${id}`, { method: "DELETE" }),

  // Order Status (Status Nota) Master Data
  getOrderStatuses: () => request<OrderStatusMaster[]>("/order-status"),
  createOrderStatus: (payload: {
    nama_status: string;
    color?: string;
    urutan?: number;
    is_final?: boolean;
    next_status?: string;
  }) =>
    request<OrderStatusMaster>("/order-status", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateOrderStatusMaster: (
    id: number,
    payload: {
      nama_status: string;
      color?: string;
      urutan?: number;
      is_final?: boolean;
      next_status?: string;
    }
  ) =>
    request<OrderStatusMaster>(`/order-status/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteOrderStatus: (id: number) =>
    request<{ ok: boolean; id: number }>(`/order-status/${id}`, { method: "DELETE" }),

  // Divisi

  getDivisi: () => request<Divisi[]>("/divisi"),
  createDivisi: (nama_divisi: string) =>
    request<Divisi>("/divisi", {
      method: "POST",
      body: JSON.stringify({ nama_divisi }),
    }),
  updateDivisi: (id: number, nama_divisi: string) =>
    request<Divisi>(`/divisi/${id}`, {
      method: "PUT",
      body: JSON.stringify({ nama_divisi }),
    }),
  deleteDivisi: (id: number) =>
    request<{ ok: boolean; id: number }>(`/divisi/${id}`, { method: "DELETE" }),

  // Sales Person
  getSalesPersons: () => request<SalesPerson[]>("/sales-person"),
  createSalesPerson: (payload: { nama_sales: string; divisi_id: number }) =>
    request<SalesPerson>("/sales-person", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateSalesPerson: (id: number, payload: { nama_sales: string; divisi_id: number }) =>
    request<SalesPerson>(`/sales-person/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteSalesPerson: (id: number) =>
    request<{ ok: boolean; id: number }>(`/sales-person/${id}`, { method: "DELETE" }),

  // Brand
  getBrands: () => request<Brand[]>("/brand"),
  createBrand: (nama_brand: string) =>
    request<Brand>("/brand", {
      method: "POST",
      body: JSON.stringify({ nama_brand }),
    }),
  updateBrand: (id: number, nama_brand: string) =>
    request<Brand>(`/brand/${id}`, {
      method: "PUT",
      body: JSON.stringify({ nama_brand }),
    }),
  deleteBrand: (id: number) =>
    request<{ ok: boolean; id: number }>(`/brand/${id}`, { method: "DELETE" }),

  // Item Group
  getItemGroups: () => request<ItemGroup[]>("/item-group"),
  createItemGroup: (nama_group: string) =>
    request<ItemGroup>("/item-group", {
      method: "POST",
      body: JSON.stringify({ nama_group }),
    }),
  updateItemGroup: (id: number, nama_group: string) =>
    request<ItemGroup>(`/item-group/${id}`, {
      method: "PUT",
      body: JSON.stringify({ nama_group }),
    }),
  deleteItemGroup: (id: number) =>
    request<{ ok: boolean; id: number }>(`/item-group/${id}`, { method: "DELETE" }),

  // Category
  getCategories: () => request<Category[]>("/category"),
  createCategory: (nama_kategori: string) =>
    request<Category>("/category", {
      method: "POST",
      body: JSON.stringify({ nama_kategori }),
    }),
  updateCategory: (id: number, nama_kategori: string) =>
    request<Category>(`/category/${id}`, {
      method: "PUT",
      body: JSON.stringify({ nama_kategori }),
    }),
  deleteCategory: (id: number) =>
    request<{ ok: boolean; id: number }>(`/category/${id}`, { method: "DELETE" }),

  // Products
  getProducts: () => request<Product[]>("/products"),
  createProduct: (payload: {
    sku: string;
    item_name: string;
    item_group?: string | null;
    category?: string | null;
    brand_id: number;
  }) =>
    request<Product>("/products", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateProduct: (
    sku: string,
    payload: {
      item_name: string;
      item_group?: string | null;
      category?: string | null;
      brand_id: number;
    }
  ) =>
    request<Product>(`/products/${encodeURIComponent(sku)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteProduct: (sku: string) =>
    request<{ ok: boolean; sku: string }>(`/products/${encodeURIComponent(sku)}`, { method: "DELETE" }),

  // Customers
  getCustomers: () => request<Customer[]>("/customers"),
  createCustomer: (payload: {
    nama_customer: string;
    no_telepon?: string;
    alamat?: string;
    kota?: string;
    email?: string;
    catatan?: string;
  }) =>
    request<Customer>("/customers", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCustomer: (
    id: number,
    payload: {
      nama_customer: string;
      no_telepon?: string;
      alamat?: string;
      kota?: string;
      email?: string;
      catatan?: string;
    }
  ) =>
    request<Customer>(`/customers/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteCustomer: (id: number) =>
    request<{ ok: boolean; id: number }>(`/customers/${id}`, { method: "DELETE" }),

  // Grouped Invoices (One row per invoice, multi-item support with cursor pagination)
  getInvoices: async (params?: {
    status?: string;
    channel?: string;
    search?: string;
    invoice?: string;
    customer?: string;
    sales?: string;
    divisi?: string;
    sku?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    cursor?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.status && params.status !== "ALL") query.set("status", params.status);
    if (params?.channel && params.channel !== "ALL") query.set("channel", params.channel);
    if (params?.search) query.set("search", params.search);
    if (params?.invoice) query.set("invoice", params.invoice);
    if (params?.customer) query.set("customer", params.customer);
    if (params?.sales) query.set("sales", params.sales);
    if (params?.divisi) query.set("divisi", params.divisi);
    if (params?.sku) query.set("sku", params.sku);
    if (params?.startDate) query.set("startDate", params.startDate);
    if (params?.endDate) query.set("endDate", params.endDate);
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.cursor) query.set("cursor", params.cursor);
    const qs = query.toString();
    const res = await request<any>(`/invoices${qs ? `?${qs}` : ""}`);
    if (Array.isArray(res)) {
      return {
        data: res as InvoiceOrder[],
        nextCursor: null,
        hasMore: false,
        count: res.length,
      };
    }
    return res as {
      data: InvoiceOrder[];
      nextCursor: string | null;
      hasMore: boolean;
      count: number;
    };
  },

  getInvoicesSummary: (params?: {
    startDate?: string;
    endDate?: string;
    search?: string;
    channel?: string;
    status?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.startDate) query.set("startDate", params.startDate);
    if (params?.endDate) query.set("endDate", params.endDate);
    if (params?.search) query.set("search", params.search);
    if (params?.channel && params.channel !== "ALL") query.set("channel", params.channel);
    if (params?.status && params.status !== "ALL") query.set("status", params.status);
    const qs = query.toString();
    return request<{
      total: number;
      statusCounts: Record<string, number>;
      channelCounts: Record<string, number>;
    }>(`/invoices-summary${qs ? `?${qs}` : ""}`);
  },

  getInvoiceDetail: (no_invoice: string) =>
    request<InvoiceDetailResponse>(`/invoices/${encodeURIComponent(no_invoice)}`),

  updateInvoiceStatus: (no_invoice: string, status: string, author?: string) =>
    request<{ ok: boolean; no_invoice: string; status: string; oldStatus: string }>(
      `/invoices/${encodeURIComponent(no_invoice)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status, author }),
      }
    ),

  advanceInvoiceStatus: (no_invoice: string, author?: string) =>
    request<{ ok: boolean; no_invoice: string; status: string; oldStatus: string }>(
      `/invoices/${encodeURIComponent(no_invoice)}/advance`,
      {
        method: "POST",
        body: JSON.stringify({ author }),
      }
    ),

  addInvoiceNote: (no_invoice: string, note: string, author?: string) =>
    request<OrderNote>(`/invoices/${encodeURIComponent(no_invoice)}/notes`, {
      method: "POST",
      body: JSON.stringify({ note, author }),
    }),

  deleteInvoice: (no_invoice: string) =>
    request<{ ok: boolean; no_invoice: string }>(`/invoices/${encodeURIComponent(no_invoice)}`, {
      method: "DELETE",
    }),

  // Orders (raw flat items)
  getOrders: (params?: { status?: string; channel?: string; search?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.channel) query.set("channel", params.channel);
    if (params?.search) query.set("search", params.search);
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return request<SalesOrder[]>(`/orders${qs ? `?${qs}` : ""}`);
  },

  createOrder: (payload: CreateOrderPayload) =>
    request<{ ok: boolean; message: string; orders: SalesOrder[] }>("/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateInvoice: (no_invoice: string, payload: CreateOrderPayload) =>
    request<{ ok: boolean; orders: SalesOrder[] }>(`/invoices/${no_invoice}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  updateOrderStatus: (id: number, status: string) =>
    request<{ ok: boolean; order: SalesOrder }>(`/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  advanceOrderStatus: (id: number) =>
    request<{ ok: boolean; order: SalesOrder }>(`/orders/${id}/advance`, {
      method: "POST",
    }),

  getOrderHistory: (id: number) => request<StatusHistory[]>(`/orders/${id}/history`),

  deleteOrder: (id: number) =>
    request<{ ok: boolean; id: number }>(`/orders/${id}`, { method: "DELETE" }),

  // Analytics with date range filters
  getAnalytics: (
    paramsOrRange?: { range?: string; start_date?: string; end_date?: string } | string,
    start_date?: string,
    end_date?: string
  ) => {
    const query = new URLSearchParams();
    if (typeof paramsOrRange === "string") {
      if (paramsOrRange) query.set("range", paramsOrRange);
      if (start_date) query.set("start_date", start_date);
      if (end_date) query.set("end_date", end_date);
    } else if (paramsOrRange) {
      if (paramsOrRange.range) query.set("range", paramsOrRange.range);
      if (paramsOrRange.start_date) query.set("start_date", paramsOrRange.start_date);
      if (paramsOrRange.end_date) query.set("end_date", paramsOrRange.end_date);
    }
    const qs = query.toString();
    return request<AnalyticsSummary>(`/analytics/summary${qs ? `?${qs}` : ""}`);
  },

  // Bulk Excel Import Endpoints
  importMasterData: (payload: any) =>
    request<{
      ok: boolean;
      message: string;
      counts: {
        divisi: number;
        sales_person: number;
        brand: number;
        item_group: number;
        category: number;
        channel: number;
        order_status: number;
        customers: number;
        products: number;
      };
      durationMs: number;
    }>("/import/master", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  importOrders: (payload: { orders: any[]; skipDuplicateInvoice?: boolean }) =>
    request<{
      ok: boolean;
      message: string;
      importedInvoicesCount: number;
      importedItemsCount: number;
      totalImportedAmount: number;
      skippedInvoices: string[];
      durationMs: number;
    }>("/import/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export function formatRupiah(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Returns YYYY-MM-DD string in Asia/Jakarta (UTC+7) timezone
 */
export function getJakartaDateString(dateVal: Date | number | string = new Date()): string {
  if (!dateVal) return "";
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);
  } catch {
    return d.toISOString().substring(0, 10);
  }
}

export function parseDateToTimestamp(dateVal: string | number | Date | undefined | null): number {
  if (!dateVal) return 0;
  if (typeof dateVal === "number") return dateVal;
  if (dateVal instanceof Date) return dateVal.getTime();
  const str = String(dateVal).trim();
  if (!str) return 0;
  // If string has date & time without timezone offset (e.g. "2026-09-02 08:42:00" or "2026-09-02T08:42:00"), treat as UTC+7 (Jakarta)
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(str)) {
    const parsed = new Date(str.replace(" ", "T") + "+07:00").getTime();
    if (!isNaN(parsed)) return parsed;
  }
  const parsed = new Date(str).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

export function formatDate(
  dateString: string | number | Date | undefined | null,
  options?: { showTime?: boolean; showSeconds?: boolean; showTz?: boolean }
): string {
  if (!dateString) return "-";
  try {
    const str = String(dateString).trim();
    if (!str) return "-";

    // Pure date string (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [year, month, day] = str.split("-").map(Number);
      const d = new Date(Date.UTC(year, (month || 1) - 1, day || 1, 0, 0, 0));
      return new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(d);
    }

    let d: Date;
    if (dateString instanceof Date) {
      d = dateString;
    } else if (typeof dateString === "number") {
      d = new Date(dateString);
    } else if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(str)) {
      // If datetime string without timezone offset, treat as UTC+7 (Jakarta)
      d = new Date(str.replace(" ", "T") + "+07:00");
    } else {
      d = new Date(str);
    }

    if (isNaN(d.getTime())) {
      d = new Date(str);
    }
    if (isNaN(d.getTime())) return str;

    const showTime = options?.showTime !== false;
    const showTz = options?.showTz !== false;

    const formatted = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      year: "numeric",
      ...(showTime
        ? {
            hour: "2-digit",
            minute: "2-digit",
            ...(options?.showSeconds ? { second: "2-digit" } : {}),
            hour12: false,
          }
        : {}),
    }).format(d);

    if (showTime && showTz) {
      return `${formatted} WIB`;
    }
    return formatted;
  } catch {
    return String(dateString);
  }
}
