import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X,
  Clock,
  User,
  ShoppingBag,
  Building2,
  Calendar,
  Layers,
  Send,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Package,
  Truck,
  ArrowRight,
  Trash2,
  Copy,
  Check,
  Printer,
  ChevronRight,
  RotateCcw,
  Edit3,
  Phone,
  MapPin,
  Loader2,
} from "lucide-react";
import { InvoiceOrder, InvoiceDetailResponse, OrderStatus, SalesChannel, Channel, OrderStatusMaster, OrderNote } from "../types";
import { api, formatRupiah, formatDate, parseDateToTimestamp } from "../lib/api";
import { wsClient } from "../lib/ws";
import { getChannelColor, getStatusColor, getDynamicBadgeStyle } from "../lib/colorUtils";
import { ConfirmModal } from "./ConfirmModal";
import { InputOrderForm } from "./InputOrderForm";
import { SalesPerson, Product, Brand, Customer } from "../types";

interface OrderDetailSidebarProps {
  invoiceNumber: string | null;
  isOpen: boolean;
  onClose: () => void;
  onRefreshData?: (silent?: boolean) => void;
  onUpdateStatusOptimistic?: (no_invoice: string, newStatus: OrderStatus) => void;
  userRole?: string;
  channels?: Channel[];
  orderStatuses?: OrderStatusMaster[];
  salesPersons?: SalesPerson[];
  products?: Product[];
  brands?: Brand[];
  customers?: Customer[];
}

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; bg: string; text: string; dot: string; nextLabel?: string }
> = {
  "Input Orderan": {
    label: "Input Orderan",
    bg: "bg-amber-50 border-amber-200 text-amber-800",
    text: "text-amber-800",
    dot: "bg-amber-500",
    nextLabel: "Proses Pesanan →",
  },
  "Diproses": {
    label: "Diproses",
    bg: "bg-blue-50 border-blue-200 text-blue-800",
    text: "text-blue-800",
    dot: "bg-blue-500",
    nextLabel: "Selesai Packing →",
  },
  "Selesai Packing": {
    label: "Selesai Packing",
    bg: "bg-emerald-50 border-emerald-200 text-emerald-800",
    text: "text-emerald-800",
    dot: "bg-emerald-500",
    nextLabel: undefined,
  },
  "Batal": {
    label: "Batal",
    bg: "bg-rose-50 border-rose-200 text-rose-800",
    text: "text-rose-800",
    dot: "bg-rose-500",
    nextLabel: undefined,
  },
  "Retur": {
    label: "Retur",
    bg: "bg-purple-50 border-purple-200 text-purple-800",
    text: "text-purple-800",
    dot: "bg-purple-500",
    nextLabel: undefined,
  },
};

const CHANNEL_BADGES: Record<SalesChannel, string> = {
  Tokopedia: "bg-emerald-50 text-emerald-700 border-emerald-200",
  TikTok: "bg-zinc-900 text-white border-zinc-900",
  Shopee: "bg-orange-50 text-orange-700 border-orange-200",
  Lazada: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Offline: "bg-slate-100 text-slate-700 border-slate-300",
};

const OrderDetailSidebarComponent: React.FC<OrderDetailSidebarProps> = ({
  invoiceNumber,
  isOpen,
  onClose,
  onRefreshData,
  onUpdateStatusOptimistic,
  userRole = "Admin",
  channels,
  orderStatuses,
  salesPersons = [],
  products = [],
  brands = [],
  customers = [],
}) => {
  const queryClient = useQueryClient();

  const [isEditingMode, setIsEditingMode] = useState(false);

  // Note form state
  const [newNote, setNewNote] = useState("");
  const [noteAuthor, setNoteAuthor] = useState(userRole || "Admin");

  useEffect(() => {
    if (userRole) {
      setNoteAuthor(userRole);
    }
  }, [userRole, isOpen]);

  // Status updating state
  const [copied, setCopied] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Instant 0ms optimistic status state for ultra-responsive UI feedback
  const [optimisticStatus, setOptimisticStatus] = useState<OrderStatus | null>(null);
  const [isSubmittingStatus, setIsSubmittingStatus] = useState<OrderStatus | null>(null);

  // 1. Fetch invoice details using React Query
  const {
    data,
    isLoading: loading,
    error: queryErr,
  } = useQuery({
    queryKey: ["invoiceDetail", invoiceNumber],
    queryFn: async () => {
      if (!invoiceNumber) return null;
      return await api.getInvoiceDetail(invoiceNumber);
    },
    enabled: !!isOpen && !!invoiceNumber,
    staleTime: 30 * 1000,
  });

  // Reset optimistic state when invoiceNumber or underlying server status changes
  useEffect(() => {
    setOptimisticStatus(null);
    setIsSubmittingStatus(null);
  }, [invoiceNumber, data?.invoice?.status]);

  const error = queryErr ? (queryErr as Error).message || "Gagal memuat detail pesanan." : null;

  // 2. Realtime WebSocket listener to sync notes or updates live
  useEffect(() => {
    if (!isOpen || !invoiceNumber) return;
    const unsubscribe = wsClient.subscribe((event) => {
      if (event.type === "invoice:note" && event.payload?.no_invoice === invoiceNumber) {
        const incomingNote: OrderNote = event.payload.note;
        queryClient.setQueryData<InvoiceDetailResponse>(["invoiceDetail", invoiceNumber], (prev) => {
          if (!prev) return prev;
          const currentNotes = prev.notes || [];
          const tempIdx = currentNotes.findIndex(
            (n) => String(n.id).startsWith("temp-") && n.note === incomingNote.note && n.author === incomingNote.author
          );
          if (tempIdx !== -1) {
            const updated = [...currentNotes];
            updated[tempIdx] = incomingNote;
            return { ...prev, notes: updated };
          }
          const exists = currentNotes.some((n) => String(n.id) === String(incomingNote.id));
          if (exists) return prev;
          return { ...prev, notes: [...currentNotes, incomingNote] };
        });
      }
    });
    return () => unsubscribe();
  }, [isOpen, invoiceNumber, queryClient]);

  // 3. React Query Mutation for Notes with 0ms Optimistic Update
  const addNoteMutation = useMutation({
    mutationFn: async ({ noInvoice, note, author }: { noInvoice: string; note: string; author?: string }) => {
      return await api.addInvoiceNote(noInvoice, note, author);
    },
    onMutate: async ({ noInvoice, note, author }) => {
      await queryClient.cancelQueries({ queryKey: ["invoiceDetail", noInvoice] });
      const previousDetail = queryClient.getQueryData<InvoiceDetailResponse>(["invoiceDetail", noInvoice]);

      const tempNote: OrderNote = {
        id: `temp-${Date.now()}`,
        no_invoice: noInvoice,
        note,
        author: author || "Admin",
        created_at: new Date().toISOString(),
      };

      if (previousDetail) {
        queryClient.setQueryData<InvoiceDetailResponse>(["invoiceDetail", noInvoice], {
          ...previousDetail,
          notes: [...(previousDetail.notes || []), tempNote],
        });
      }

      return { previousDetail };
    },
    onError: (err: any, { noInvoice }, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(["invoiceDetail", noInvoice], context.previousDetail);
      }
      alert(`Gagal menambahkan catatan: ${err?.message || err}`);
    },
    onSettled: (_data, _error, { noInvoice }) => {
      queryClient.invalidateQueries({ queryKey: ["invoiceDetail", noInvoice] });
    },
  });

  const invoice = data?.invoice;
  const items = data?.items || [];
  const history = data?.history || [];
  const notes = data?.notes || [];

  // Effective status: immediately uses optimisticStatus if available for 0ms visual responsiveness
  const effectiveStatus: OrderStatus = (optimisticStatus || invoice?.status || "Input Orderan") as OrderStatus;

  // Next status resolver based on master order status settings or default workflow
  const getNextStatus = (currStatus?: string): OrderStatus | null => {
    if (!currStatus) return null;
    if (orderStatuses && orderStatuses.length > 0) {
      const currentMaster = orderStatuses.find((s) => s.nama_status === currStatus);
      if (currentMaster?.next_status && !currentMaster.is_final) {
        return currentMaster.next_status as OrderStatus;
      }
    }
    if (currStatus === "Input Orderan") return "Diproses";
    if (currStatus === "Diproses") return "Selesai Packing";
    return null;
  };

  // 4. React Query Mutations for Status Updates (Non-blocking background sync)
  const updateStatusMutation = useMutation({
    mutationFn: async ({ noInvoice, status, author }: { noInvoice: string; status: OrderStatus; author?: string }) => {
      return await api.updateInvoiceStatus(noInvoice, status, author);
    },
    onMutate: async ({ noInvoice }) => {
      // Cancel background refetches without blocking synchronous frame
      const targetKey = ["invoiceDetail", invoiceNumber || noInvoice];
      queryClient.cancelQueries({ queryKey: targetKey });
      const previousDetail = queryClient.getQueryData<InvoiceDetailResponse>(targetKey);
      return { previousDetail };
    },
    onSuccess: (data: any, { noInvoice, status }) => {
      setIsSubmittingStatus(null);
      const targetKey = ["invoiceDetail", invoiceNumber || noInvoice];
      if (data) {
        queryClient.setQueryData<InvoiceDetailResponse>(targetKey, (prev) => {
          if (!prev) return prev;
          const updatedStatus = data.status || status || prev.invoice.status;
          return {
            ...prev,
            invoice: {
              ...prev.invoice,
              status: updatedStatus,
            },
            history: data.history || prev.history,
            items: prev.items.map((it) => ({ ...it, status: updatedStatus })),
          };
        });
      }
    },
    onError: (err: any, { noInvoice }, context) => {
      setIsSubmittingStatus(null);
      setOptimisticStatus(null);
      const targetKey = ["invoiceDetail", invoiceNumber || noInvoice];
      if (context?.previousDetail) {
        queryClient.setQueryData(targetKey, context.previousDetail);
        if (context.previousDetail.invoice) {
          onUpdateStatusOptimistic?.(noInvoice, context.previousDetail.invoice.status);
        }
      }
      alert(`Gagal memperbarui status: ${err?.message || err}`);
    },
    onSettled: () => {
      setIsSubmittingStatus(null);
      onRefreshData?.(true);
    },
  });

  const advanceStatusMutation = useMutation({
    mutationFn: async ({ noInvoice, author }: { noInvoice: string; author?: string }) => {
      return await api.advanceInvoiceStatus(noInvoice, author);
    },
    onMutate: async ({ noInvoice }) => {
      const targetKey = ["invoiceDetail", invoiceNumber || noInvoice];
      queryClient.cancelQueries({ queryKey: targetKey });
      const previousDetail = queryClient.getQueryData<InvoiceDetailResponse>(targetKey);
      return { previousDetail };
    },
    onSuccess: (data: any, { noInvoice }) => {
      setIsSubmittingStatus(null);
      const targetKey = ["invoiceDetail", invoiceNumber || noInvoice];
      if (data) {
        queryClient.setQueryData<InvoiceDetailResponse>(targetKey, (prev) => {
          if (!prev) return prev;
          const updatedStatus = data.status || prev.invoice.status;
          return {
            ...prev,
            invoice: {
              ...prev.invoice,
              status: updatedStatus,
            },
            history: data.history || prev.history,
            items: prev.items.map((it) => ({ ...it, status: updatedStatus })),
          };
        });
      }
    },
    onError: (err: any, { noInvoice }, context) => {
      setIsSubmittingStatus(null);
      setOptimisticStatus(null);
      const targetKey = ["invoiceDetail", invoiceNumber || noInvoice];
      if (context?.previousDetail) {
        queryClient.setQueryData(targetKey, context.previousDetail);
        if (context.previousDetail.invoice) {
          onUpdateStatusOptimistic?.(noInvoice, context.previousDetail.invoice.status);
        }
      }
      alert(`Gagal memajukan status: ${err?.message || err}`);
    },
    onSettled: () => {
      setIsSubmittingStatus(null);
      onRefreshData?.(true);
    },
  });

  const updatingStatus = Boolean(isSubmittingStatus) || updateStatusMutation.isPending || advanceStatusMutation.isPending;

  // Ultra-responsive Instant 0ms Status Change Handler
  const handleUpdateStatus = (newStatus: OrderStatus) => {
    const targetInvoice = invoice?.no_invoice || invoiceNumber;
    if (!targetInvoice) return;
    if (effectiveStatus === newStatus) return;

    // 1. INSTANT 0ms visual state change (no latency, zero lag)
    setOptimisticStatus(newStatus);
    setIsSubmittingStatus(newStatus);

    // 2. Optimistic update parent table row immediately
    onUpdateStatusOptimistic?.(targetInvoice, newStatus);

    // 3. Immediately update React Query cache synchronously
    const cacheKey = ["invoiceDetail", invoiceNumber || targetInvoice];
    queryClient.setQueryData<InvoiceDetailResponse>(cacheKey, (prev) => {
      if (!prev || !prev.invoice) return prev;
      return {
        ...prev,
        invoice: { ...prev.invoice, status: newStatus },
        items: prev.items.map((it) => ({ ...it, status: newStatus })),
      };
    });

    // 4. Trigger mutation
    updateStatusMutation.mutate({ noInvoice: targetInvoice, status: newStatus, author: userRole });
  };

  // Ultra-responsive Instant 0ms Status Advance Handler
  const handleAdvanceStatus = () => {
    const targetInvoice = invoice?.no_invoice || invoiceNumber;
    if (!targetInvoice) return;
    const nextSt = getNextStatus(effectiveStatus);
    if (!nextSt) return;

    // 1. INSTANT 0ms visual state change
    setOptimisticStatus(nextSt);
    setIsSubmittingStatus(nextSt);

    // 2. Parent table row instant update
    onUpdateStatusOptimistic?.(targetInvoice, nextSt);

    // 3. Synchronously update cache
    const cacheKey = ["invoiceDetail", invoiceNumber || targetInvoice];
    queryClient.setQueryData<InvoiceDetailResponse>(cacheKey, (prev) => {
      if (!prev || !prev.invoice) return prev;
      return {
        ...prev,
        invoice: { ...prev.invoice, status: nextSt },
        items: prev.items.map((it) => ({ ...it, status: nextSt })),
      };
    });

    // 4. Trigger mutation
    advanceStatusMutation.mutate({ noInvoice: targetInvoice, author: userRole });
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    const noteText = newNote.trim();
    const targetInvoice = invoice?.no_invoice || invoiceNumber;
    if (!noteText || !targetInvoice || addNoteMutation.isPending) return;

    // Synchronously clear input field INSTANTLY
    setNewNote("");

    addNoteMutation.mutate({
      noInvoice: targetInvoice,
      note: noteText,
      author: noteAuthor,
    });
  };

  const handleCopySummary = () => {
    if (!invoice) return;
    const itemsList = items
      .map((it, idx) => `${idx + 1}. ${it.item_name} (${it.sku}) - ${it.qty} pcs @ ${formatRupiah(it.amount)}`)
      .join("\n");
    const summary = `*RINGKASAN PESANAN - ${invoice.no_invoice}*\n` +
      `Customer: ${invoice.nama_customer}\n` +
      `Channel: ${invoice.channel}\n` +
      `Status: ${invoice.status}\n` +
      `Sales: ${invoice.nama_sales} (${invoice.nama_divisi})\n` +
      `Tanggal: ${formatDate(invoice.created_at)}\n` +
      `---------------------------------\n` +
      `*Daftar Produk (${invoice.item_count} Item / ${invoice.total_qty} pcs):*\n` +
      `${itemsList}\n` +
      `---------------------------------\n` +
      `*Total Tagihan: ${formatRupiah(invoice.total_amount)}*`;

    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteInvoice = async () => {
    if (!invoiceNumber) return;
    setIsDeleting(true);
    try {
      await api.deleteInvoice(invoiceNumber);
      setIsDeleteModalOpen(false);
      onClose();
      onRefreshData?.();
    } catch (err: any) {
      alert(`Gagal menghapus invoice: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Compile Unified Timeline (memoized to prevent expensive calculation & sorting on every render)
  // 1. Order creation event
  // 2. Status change events
  // 3. User notes
  const timelineEvents = useMemo(() => {
    if (!invoice) return [];

    const events: {
      type: "create" | "status" | "note";
      id: string;
      timestamp: string;
      title: string;
      description?: string;
      author?: string;
      icon: any;
      color: string;
    }[] = [];

    // 1. Creation event
    events.push({
      type: "create",
      id: "event-create",
      timestamp: invoice.created_at,
      title: "Pesanan Dibuat (Input Orderan)",
      description: `Diinput oleh Sales: ${invoice.nama_sales} (${invoice.nama_divisi}) via ${invoice.channel} dengan ${invoice.item_count} item produk.`,
      author: invoice.nama_sales,
      icon: ShoppingBag,
      color: "bg-amber-100 text-amber-700 border-amber-300",
    });

    // 2. Status & Edit history
    const getStatusIcon = (st: string) => {
      if (st === "Selesai Packing") return CheckCircle2;
      if (st === "Batal") return X;
      if (st === "Retur") return RotateCcw;
      if (st === "Diproses") return Package;
      return Clock;
    };

    const getStatusColorCls = (st: string) => {
      return getStatusColor(st, orderStatuses);
    };

    history.forEach((h, idx) => {
      const authorName = h.author
        ? h.author
        : h.status_lama === "Import System"
        ? "Import Excel"
        : userRole || "Admin";

      const isEditEvent = h.status_lama === "Edit Nota" || h.status_lama?.startsWith("Edit");

      events.push({
        type: "status",
        id: `event-status-${h.id || idx}`,
        timestamp: h.updated_at,
        title: isEditEvent ? `Perubahan Data: ${h.status_baru}` : `Perubahan Status: ${h.status_lama} → ${h.status_baru}`,
        author: authorName,
        icon: isEditEvent ? Edit3 : getStatusIcon(h.status_baru),
        color: isEditEvent ? "#3b82f6" : getStatusColorCls(h.status_baru),
      });
    });

    // 3. Instant Optimistic Status Event (if user just clicked a status)
    if (optimisticStatus && optimisticStatus !== invoice.status) {
      events.push({
        type: "status",
        id: "event-status-optimistic",
        timestamp: new Date().toISOString(),
        title: `Perubahan Status: ${invoice.status} → ${optimisticStatus} (Menyimpan...)`,
        author: userRole || "Admin",
        icon: getStatusIcon(optimisticStatus),
        color: getStatusColorCls(optimisticStatus),
      });
    }

    // 4. Notes
    notes.forEach((n) => {
      events.push({
        type: "note",
        id: `event-note-${n.id}`,
        timestamp: n.created_at,
        title: `Catatan dari ${n.author}`,
        description: n.note,
        author: n.author,
        icon: MessageSquare,
        color: "bg-indigo-100 text-indigo-700 border-indigo-300",
      });
    });

    // Sort chronologically (oldest to newest for natural timeline story)
    events.sort((a, b) => {
      const timeA = parseDateToTimestamp(a.timestamp);
      const timeB = parseDateToTimestamp(b.timestamp);
      return timeA - timeB;
    });

    return events;
  }, [invoice, history, notes, orderStatuses, userRole, optimisticStatus]);

  const currentStatusConfig = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG["Input Orderan"];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop (solid tinted overlay with GPU acceleration, eliminating heavy backdrop-filter repaint on scroll) */}
      <div
        className="fixed inset-0 bg-slate-900/50 transition-opacity duration-200 will-change-opacity pointer-events-auto"
        onClick={onClose}
      />

      {/* Slide-over Right Drawer with dedicated GPU composite layer */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 pointer-events-none">
        <div 
          className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col border-l border-slate-200 pointer-events-auto transform-gpu will-change-transform"
          style={{ transform: "translate3d(0, 0, 0)" }}
        >
          
          {/* Header */}
          <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-amber-400">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white tracking-tight">
                    {invoiceNumber || "Detail Pesanan"}
                  </h2>
                  <button
                    onClick={handleCopySummary}
                    title="Salin Ringkasan Pesanan"
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-300">
                  Detail Nota & Timeline Perjalanan Transaksi
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body Content - Hardware accelerated smooth scrolling container */}
          <div 
            className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 overscroll-contain smooth-scroll-container"
            style={{ 
              WebkitOverflowScrolling: "touch",
              willChange: "scroll-position",
              contain: "paint layout",
            }}
          >
            {loading ? (
              <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
                <div className="w-8 h-8 border-3 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
                <span className="text-sm font-medium">Memuat rincian nota...</span>
              </div>
            ) : error ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            ) : invoice ? (
              isEditingMode ? (
                <div className="bg-[#F9F9F8] rounded-xl shadow-xs overflow-hidden">
                  <InputOrderForm
                    channels={channels}
                    customers={customers}
                    salesPersons={salesPersons}
                    products={products}
                    brands={brands}
                    orderStatuses={orderStatuses}
                    editingInvoice={invoice}
                    userRole={userRole}
                    onCancelEdit={() => setIsEditingMode(false)}
                    onOrderCreated={() => {
                      setIsEditingMode(false);
                      onRefreshData?.(true); // silent refresh grid
                      queryClient.invalidateQueries({ queryKey: ["invoiceDetail", invoiceNumber] });
                    }}
                    compact={true}
                  />
                </div>
              ) : (
              <>
                {/* Status Progress & Quick Advance */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Status Nota Saat Ini
                    </span>
                    <span className="text-xs text-slate-400">
                      {invoice.created_at ? formatDate(invoice.created_at) : ""}
                    </span>
                  </div>

                  {/* Status Stepper / Selector */}
                  <div className="space-y-2">
                    {orderStatuses && orderStatuses.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[...orderStatuses]
                          .sort((a, b) => (a.urutan || 99) - (b.urutan || 99))
                          .map((st, idx) => {
                            const isCurrent = effectiveStatus === st.nama_status;
                            const isPendingThis = isSubmittingStatus === st.nama_status;
                            const stColor = getStatusColor(st.nama_status, orderStatuses);
                            const badgeStyle = getDynamicBadgeStyle(stColor);

                            return (
                              <button
                                key={st.id || st.nama_status}
                                type="button"
                                onClick={() => !isCurrent && handleUpdateStatus(st.nama_status as OrderStatus)}
                                disabled={updatingStatus || isCurrent}
                                title={isCurrent ? `Posisi Status Saat Ini: ${st.nama_status}` : `Ubah status ke ${st.nama_status}`}
                                className={`relative flex flex-col items-start p-2.5 rounded-lg border text-left transition-colors duration-75 active:scale-98 ${
                                  isCurrent
                                    ? "ring-2 shadow-xs cursor-default font-bold"
                                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 cursor-pointer"
                                }`}
                                style={
                                  isCurrent
                                    ? {
                                        backgroundColor: badgeStyle.backgroundColor,
                                        borderColor: stColor,
                                        color: badgeStyle.color,
                                      }
                                    : undefined
                                }
                              >
                                <div className="flex items-center gap-1.5 w-full">
                                  <span
                                    className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shrink-0"
                                    style={
                                      isCurrent
                                        ? { backgroundColor: stColor, color: "#ffffff" }
                                        : { backgroundColor: "#e2e8f0", color: "#475569" }
                                    }
                                  >
                                    {isPendingThis ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : isCurrent ? (
                                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    ) : (
                                      st.urutan || idx + 1
                                    )}
                                  </span>
                                  <span className="text-xs truncate">
                                    {st.nama_status}
                                  </span>
                                </div>
                                {isCurrent && (
                                  <div
                                    className="mt-1.5 flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded"
                                    style={{
                                      backgroundColor: "rgba(255,255,255,0.7)",
                                      color: stColor,
                                    }}
                                  >
                                    {isPendingThis ? (
                                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                    ) : (
                                      <span
                                        className="w-1.5 h-1.5 rounded-full animate-pulse transform-gpu"
                                        style={{ backgroundColor: stColor }}
                                      />
                                    )}
                                    <span>{isPendingThis ? "Menyimpan..." : "Posisi Saat Ini"}</span>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          {(["Input Orderan", "Diproses", "Selesai Packing"] as OrderStatus[]).map((st, idx) => {
                            const isCurrent = effectiveStatus === st;
                            const isPendingThis = isSubmittingStatus === st;
                            const isPast =
                              (effectiveStatus === "Diproses" && st === "Input Orderan") ||
                              (effectiveStatus === "Selesai Packing" && (st === "Input Orderan" || st === "Diproses"));

                            return (
                              <button
                                key={st}
                                type="button"
                                onClick={() => !isCurrent && handleUpdateStatus(st)}
                                disabled={updatingStatus || isCurrent}
                                title={isCurrent ? `Posisi Status Saat Ini: ${st}` : `Ubah status ke ${st}`}
                                className={`relative flex flex-col items-start p-2.5 rounded-lg border text-left transition-colors duration-75 active:scale-98 ${
                                  isCurrent
                                    ? "bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/25 cursor-default shadow-xs"
                                    : isPast
                                    ? "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                                    : "bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-700 cursor-pointer"
                                }`}
                              >
                                <div className="flex items-center gap-1.5 w-full">
                                  <span
                                    className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                                      isCurrent
                                        ? "bg-indigo-600 text-white shadow-xs"
                                        : isPast
                                        ? "bg-emerald-600 text-white"
                                        : "bg-slate-200 text-slate-600"
                                    }`}
                                  >
                                    {isPendingThis ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : isCurrent ? (
                                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    ) : isPast ? (
                                      "✓"
                                    ) : (
                                      idx + 1
                                    )}
                                  </span>
                                  <span className={`text-xs font-semibold truncate ${isCurrent ? "text-indigo-950 font-bold" : ""}`}>
                                    {st}
                                  </span>
                                </div>
                                {isCurrent && (
                                  <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-100/90 px-1.5 py-0.5 rounded">
                                    {isPendingThis ? (
                                      <Loader2 className="w-2.5 h-2.5 animate-spin text-indigo-600" />
                                    ) : (
                                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse transform-gpu"></span>
                                    )}
                                    <span>{isPendingThis ? "Menyimpan..." : "Posisi Saat Ini"}</span>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Batal & Retur Fast Buttons */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {(() => {
                            const isBatal = effectiveStatus === "Batal";
                            const isBatalPending = isSubmittingStatus === "Batal";
                            return (
                              <button
                                type="button"
                                onClick={() => !isBatal && handleUpdateStatus("Batal")}
                                disabled={updatingStatus || isBatal}
                                title={isBatal ? "Posisi status saat ini: Batal" : "Tandai pesanan Batal"}
                                className={`p-2 rounded-lg border text-xs font-bold transition-colors duration-75 active:scale-98 flex items-center justify-center gap-1.5 ${
                                  isBatal
                                    ? "bg-rose-100 border-rose-500 text-rose-950 ring-2 ring-rose-400/30 cursor-default shadow-xs"
                                    : "bg-white hover:bg-rose-50/80 border-rose-200 text-rose-700 cursor-pointer"
                                }`}
                              >
                                {isBatalPending ? (
                                  <Loader2 className="w-3.5 h-3.5 text-rose-700 animate-spin" />
                                ) : isBatal ? (
                                  <Check className="w-3.5 h-3.5 text-rose-700 stroke-[3]" />
                                ) : (
                                  <X className="w-3.5 h-3.5" />
                                )}
                                <span>{isBatalPending ? "Menyimpan Batal..." : isBatal ? "Batal (Posisi Saat Ini)" : "Tandai Batal"}</span>
                              </button>
                            );
                          })()}

                          {(() => {
                            const isRetur = effectiveStatus === "Retur";
                            const isReturPending = isSubmittingStatus === "Retur";
                            return (
                              <button
                                type="button"
                                onClick={() => !isRetur && handleUpdateStatus("Retur")}
                                disabled={updatingStatus || isRetur}
                                title={isRetur ? "Posisi status saat ini: Retur" : "Tandai pesanan Retur"}
                                className={`p-2 rounded-lg border text-xs font-bold transition-colors duration-75 active:scale-98 flex items-center justify-center gap-1.5 ${
                                  isRetur
                                    ? "bg-purple-100 border-purple-500 text-purple-950 ring-2 ring-purple-400/30 cursor-default shadow-xs"
                                    : "bg-white hover:bg-purple-50/80 border-purple-200 text-purple-700 cursor-pointer"
                                }`}
                              >
                                {isReturPending ? (
                                  <Loader2 className="w-3.5 h-3.5 text-purple-700 animate-spin" />
                                ) : isRetur ? (
                                  <Check className="w-3.5 h-3.5 text-purple-700 stroke-[3]" />
                                ) : (
                                  <RotateCcw className="w-3.5 h-3.5" />
                                )}
                                <span>{isReturPending ? "Menyimpan Retur..." : isRetur ? "Retur (Posisi Saat Ini)" : "Tandai Retur"}</span>
                              </button>
                            );
                          })()}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Advance Button */}
                  {(() => {
                    const currentMaster = orderStatuses?.find((s) => s.nama_status === effectiveStatus);
                    const canAdvance = orderStatuses && orderStatuses.length > 0
                      ? !currentMaster?.is_final && currentMaster?.next_status
                      : effectiveStatus !== "Selesai Packing" && effectiveStatus !== "Batal" && effectiveStatus !== "Retur";

                    if (!canAdvance) return null;

                    const nextTarget = currentMaster?.next_status || currentStatusConfig?.nextLabel || "Lanjutkan Status";
                    const isAdvancePending = Boolean(isSubmittingStatus && isSubmittingStatus === nextTarget);

                    return (
                      <div className="pt-1">
                        <button
                          onClick={handleAdvanceStatus}
                          disabled={updatingStatus}
                          className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-xs transition-colors duration-75 active:scale-98 cursor-pointer disabled:opacity-80"
                        >
                          {isAdvancePending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ArrowRight className="w-4 h-4" />
                          )}
                          <span>{isAdvancePending ? `Menyimpan ke: ${nextTarget}...` : `Lanjutkan ke: ${nextTarget}`}</span>
                        </button>
                      </div>
                    );
                  })()}
                </div>

                {/* Info Card: Customer, Sales, Channel */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs relative">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Informasi Transaksi
                    </h3>
                    <button
                      onClick={() => setIsEditingMode(true)}
                      className="text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                      title="Edit Data Nota"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold">Edit Nota</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 block mb-0.5">Nama Customer</span>
                      <span className="font-semibold text-slate-800 flex items-center gap-1.5 text-sm">
                        <User className="w-4 h-4 text-slate-400" />
                        {invoice.nama_customer}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Channel Penjualan</span>
                      {(() => {
                        const hexColor = getChannelColor(invoice.channel, channels);
                        const badgeStyle = getDynamicBadgeStyle(hexColor);
                        return (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border"
                            style={{
                              backgroundColor: badgeStyle.backgroundColor,
                              color: badgeStyle.color,
                              borderColor: badgeStyle.borderColor,
                            }}
                          >
                            {invoice.channel}
                          </span>
                        );
                      })()}
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Sales Person (Snapshot)</span>
                      <span className="font-medium text-slate-800">
                        {invoice.nama_sales}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Divisi (Snapshot)</span>
                      <span className="font-medium text-slate-800 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {invoice.nama_divisi}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">No. Telepon</span>
                      <span className="font-medium text-slate-800 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {invoice.no_telepon || (invoice as any).customer_snapshot?.no_telepon || "-"}
                      </span>
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <span className="text-slate-400 block mb-0.5">Alamat</span>
                      <span className="font-medium text-slate-800 flex items-start gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="break-words">{invoice.alamat || (invoice as any).customer_snapshot?.alamat || "-"}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Items Breakdown Table (1 Nota Multi-Item) */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Daftar Produk ({invoice.item_count} Item / {invoice.total_qty} Pcs)
                      </h3>
                    </div>
                    <span className="text-xs font-bold text-slate-900">
                      Total: {formatRupiah(invoice.total_amount)}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {items.map((item, idx) => (
                      <div key={item.id || idx} className="p-3.5 hover:bg-slate-100/80 transition-colors flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-slate-900 leading-snug">
                              {item.item_name}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px]">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-medium">
                                {item.sku}
                              </span>
                              {item.nama_brand && item.nama_brand !== "-" && (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium">
                                  {item.nama_brand}
                                </span>
                              )}
                              {item.category && item.category !== "-" && (
                                <span className="text-slate-400">
                                  • {item.category}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className="text-xs font-bold text-slate-900 block">
                            {formatRupiah(item.amount)}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Qty: <strong className="text-slate-700">{item.qty}</strong>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Items Footer Total */}
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">
                      Subtotal ({invoice.total_qty} unit produk)
                    </span>
                    <span className="text-sm font-bold text-indigo-700">
                      {formatRupiah(invoice.total_amount)}
                    </span>
                  </div>
                </div>

                {/* History & Notes Timeline */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Timeline & Riwayat Pesanan ({timelineEvents.length})
                      </h3>
                    </div>
                  </div>

                  {/* Chronological Timeline Stream */}
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {timelineEvents.map((evt) => {
                      const IconComponent = evt.icon;
                      return (
                        <div key={evt.id} className="relative group">
                          {/* Dot / Icon */}
                          <div
                            className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${
                              !evt.color.startsWith("#") ? evt.color : ""
                            }`}
                            style={
                              evt.color.startsWith("#")
                                ? { backgroundColor: evt.color, borderColor: evt.color, color: "#ffffff" }
                                : undefined
                            }
                          >
                            <IconComponent className="w-3 h-3" />
                          </div>

                          <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs font-bold text-slate-800">
                                {evt.title}
                              </span>
                              <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                {formatDate(evt.timestamp)}
                              </span>
                            </div>
                            {evt.description && (
                              <p className="text-xs text-slate-600 leading-relaxed">
                                {evt.description}
                              </p>
                            )}
                            {evt.author && (
                              <span className="inline-block mt-1 text-[10px] font-medium text-slate-400">
                                Oleh: {evt.author}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add Note Form */}
                  <form onSubmit={handleAddNote} className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                        Tambah Catatan Internal / Gudang
                      </label>
                      <select
                        value={noteAuthor}
                        onChange={(e) => setNoteAuthor(e.target.value)}
                        className="text-[11px] bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-slate-600 focus:outline-none"
                      >
                        <option value="Admin">Sebagai: Admin</option>
                        <option value="Gudang">Sebagai: Gudang</option>
                        <option value="Sales">Sebagai: Sales</option>
                        <option value="Kurir">Sebagai: Kurir / Ekspedisi</option>
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newNote}
                        disabled={addNoteMutation.isPending}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Tulis catatan (misal: Packing kayu, resi kurir, catatan pembeli)..."
                        className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <button
                        type="submit"
                        disabled={addNoteMutation.isPending || !newNote.trim()}
                        className="px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Simpan
                      </button>
                    </div>
                  </form>
                </div>

                {/* Footer Danger Actions */}
                <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
                  <span>Nota ID: #{invoiceNumber}</span>
                  <button
                    type="button"
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1 rounded transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus Transaksi Nota
                  </button>
                </div>
              </>
              )
            ) : null}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Hapus Transaksi Nota"
        message={`Apakah Anda yakin ingin menghapus seluruh pesanan invoice ${invoiceNumber}? Tindakan ini tidak dapat dibatalkan.`}
        isLoading={isDeleting}
        confirmLabel="Ya, Hapus Nota"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={handleDeleteInvoice}
        onCancel={() => {
          if (!isDeleting) setIsDeleteModalOpen(false);
        }}
      />
    </div>
  );
};

export const OrderDetailSidebar = React.memo(OrderDetailSidebarComponent);

