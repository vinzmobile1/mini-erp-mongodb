import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X,
  Clock,
  User,
  ShoppingBag,
  Building2,
  Layers,
  Send,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Package,
  ArrowRight,
  Trash2,
  Copy,
  Check,
  RotateCcw,
  Edit3,
  Phone,
  MapPin,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  InvoiceOrder,
  InvoiceDetailResponse,
  OrderStatus,
  SalesChannel,
  Channel,
  OrderStatusMaster,
  OrderNote,
  SalesPerson,
  Product,
  Brand,
  Customer,
} from "../types";
import { api, formatRupiah, formatDate, parseDateToTimestamp } from "../lib/api";
import { wsClient } from "../lib/ws";
import { getChannelColor, getStatusColor, getDynamicBadgeStyle } from "../lib/colorUtils";
import { ConfirmModal } from "./ConfirmModal";
import { InputOrderForm } from "./InputOrderForm";

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

interface TimelineEvent {
  type: "create" | "status" | "note";
  id: string;
  timestamp: string;
  title: string;
  description?: string;
  author?: string;
  icon: any;
  color: string;
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

// 1. Memoized Backdrop Component to isolate paint operations
const Backdrop = React.memo<{ onClick: () => void }>(({ onClick }) => (
  <div
    className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
    onClick={onClick}
  />
));
Backdrop.displayName = "Backdrop";

// 2. Memoized Status Selector Component
interface StatusSelectorProps {
  currentStatus: OrderStatus;
  createdAt?: string;
  orderStatuses?: OrderStatusMaster[];
  statusColorMap: Map<string, { hex: string; badgeStyle: { backgroundColor: string; color: string; borderColor: string } }>;
  updatingStatus: boolean;
  onUpdateStatus: (status: OrderStatus) => void;
  onAdvanceStatus: () => void;
  nextTarget: string | null;
}

const StatusSelectorSection = React.memo<StatusSelectorProps>(({
  currentStatus,
  createdAt,
  orderStatuses,
  statusColorMap,
  updatingStatus,
  onUpdateStatus,
  onAdvanceStatus,
  nextTarget,
}) => {
  const sortedStatuses = useMemo(() => {
    if (!orderStatuses || orderStatuses.length === 0) return [];
    return [...orderStatuses].sort((a, b) => (a.urutan || 99) - (b.urutan || 99));
  }, [orderStatuses]);

  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Status Nota Saat Ini
        </span>
        <span className="text-xs text-slate-400">
          {createdAt ? formatDate(createdAt) : ""}
        </span>
      </div>

      {/* Status Stepper / Selector */}
      <div className="space-y-2">
        {sortedStatuses.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {sortedStatuses.map((st, idx) => {
              const isCurrent = currentStatus === st.nama_status;
              const colorInfo = statusColorMap.get(st.nama_status) || {
                hex: "#3b82f6",
                badgeStyle: { backgroundColor: "#eff6ff", color: "#1e40af", borderColor: "#bfdbfe" },
              };

              return (
                <button
                  key={st.id || st.nama_status}
                  type="button"
                  onClick={() => !isCurrent && onUpdateStatus(st.nama_status as OrderStatus)}
                  disabled={updatingStatus || isCurrent}
                  title={isCurrent ? `Posisi Status Saat Ini: ${st.nama_status}` : `Ubah status ke ${st.nama_status}`}
                  className={`relative flex flex-col items-start p-2.5 rounded-lg border text-left transition-all ${
                    isCurrent
                      ? "ring-2 shadow-xs cursor-default font-bold"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 cursor-pointer"
                  }`}
                  style={
                    isCurrent
                      ? {
                          backgroundColor: colorInfo.badgeStyle.backgroundColor,
                          borderColor: colorInfo.hex,
                          color: colorInfo.badgeStyle.color,
                        }
                      : undefined
                  }
                >
                  <div className="flex items-center gap-1.5 w-full">
                    <span
                      className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shrink-0"
                      style={
                        isCurrent
                          ? { backgroundColor: colorInfo.hex, color: "#ffffff" }
                          : { backgroundColor: "#e2e8f0", color: "#475569" }
                      }
                    >
                      {isCurrent ? (
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
                        color: colorInfo.hex,
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full animate-pulse"
                        style={{ backgroundColor: colorInfo.hex }}
                      />
                      <span>Posisi Saat Ini</span>
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
                const isCurrent = currentStatus === st;
                const isPast =
                  (currentStatus === "Diproses" && st === "Input Orderan") ||
                  (currentStatus === "Selesai Packing" && (st === "Input Orderan" || st === "Diproses"));

                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => !isCurrent && onUpdateStatus(st)}
                    disabled={updatingStatus || isCurrent}
                    title={isCurrent ? `Posisi Status Saat Ini: ${st}` : `Ubah status ke ${st}`}
                    className={`relative flex flex-col items-start p-2.5 rounded-lg border text-left transition-all ${
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
                        {isCurrent ? (
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
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                        <span>Posisi Saat Ini</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Batal & Retur Fast Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => currentStatus !== "Batal" && onUpdateStatus("Batal")}
                disabled={updatingStatus || currentStatus === "Batal"}
                title={currentStatus === "Batal" ? "Posisi status saat ini: Batal" : "Tandai pesanan Batal"}
                className={`p-2 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  currentStatus === "Batal"
                    ? "bg-rose-100 border-rose-500 text-rose-950 ring-2 ring-rose-400/30 cursor-default shadow-xs"
                    : "bg-white hover:bg-rose-50/80 border-rose-200 text-rose-700 cursor-pointer"
                }`}
              >
                {currentStatus === "Batal" ? (
                  <Check className="w-3.5 h-3.5 text-rose-700 stroke-[3]" />
                ) : (
                  <X className="w-3.5 h-3.5" />
                )}
                <span>{currentStatus === "Batal" ? "Batal (Posisi Saat Ini)" : "Tandai Batal"}</span>
              </button>

              <button
                type="button"
                onClick={() => currentStatus !== "Retur" && onUpdateStatus("Retur")}
                disabled={updatingStatus || currentStatus === "Retur"}
                title={currentStatus === "Retur" ? "Posisi status saat ini: Retur" : "Tandai pesanan Retur"}
                className={`p-2 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  currentStatus === "Retur"
                    ? "bg-purple-100 border-purple-500 text-purple-950 ring-2 ring-purple-400/30 cursor-default shadow-xs"
                    : "bg-white hover:bg-purple-50/80 border-purple-200 text-purple-700 cursor-pointer"
                }`}
              >
                {currentStatus === "Retur" ? (
                  <Check className="w-3.5 h-3.5 text-purple-700 stroke-[3]" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                <span>{currentStatus === "Retur" ? "Retur (Posisi Saat Ini)" : "Tandai Retur"}</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Advance Button */}
      {nextTarget && (
        <div className="pt-1">
          <button
            onClick={onAdvanceStatus}
            disabled={updatingStatus}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-xs transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>Lanjutkan ke: {nextTarget}</span>
          </button>
        </div>
      )}
    </div>
  );
});
StatusSelectorSection.displayName = "StatusSelectorSection";

// 3. Memoized Transaction Information Component
interface InfoSectionProps {
  invoice: InvoiceOrder;
  channelColorMap: Map<string, { hex: string; badgeStyle: { backgroundColor: string; color: string; borderColor: string } }>;
  onStartEdit: () => void;
}

const TransactionInfoSection = React.memo<InfoSectionProps>(({
  invoice,
  channelColorMap,
  onStartEdit,
}) => {
  const channelInfo = channelColorMap.get(invoice.channel) || {
    hex: "#64748b",
    badgeStyle: { backgroundColor: "#f1f5f9", color: "#334155", borderColor: "#cbd5e1" },
  };

  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs relative">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Informasi Transaksi
        </h3>
        <button
          onClick={onStartEdit}
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
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border"
            style={{
              backgroundColor: channelInfo.badgeStyle.backgroundColor,
              color: channelInfo.badgeStyle.color,
              borderColor: channelInfo.badgeStyle.borderColor,
            }}
          >
            {invoice.channel}
          </span>
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
  );
});
TransactionInfoSection.displayName = "TransactionInfoSection";

// 4. Memoized Items Breakdown Component with Pagination Chunking (Fix Bottleneck #5)
interface ItemsBreakdownProps {
  items: any[];
  itemCount: number;
  totalQty: number;
  totalAmount: number;
}

const ItemsBreakdownSection = React.memo<ItemsBreakdownProps>(({
  items,
  itemCount,
  totalQty,
  totalAmount,
}) => {
  const [showAllItems, setShowAllItems] = useState(false);
  const CHUNK_SIZE = 15;
  const displayedItems = useMemo(() => {
    if (showAllItems || items.length <= CHUNK_SIZE) {
      return items;
    }
    return items.slice(0, CHUNK_SIZE);
  }, [items, showAllItems]);

  const hasMore = items.length > CHUNK_SIZE && !showAllItems;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Daftar Produk ({itemCount} Item / {totalQty} Pcs)
          </h3>
        </div>
        <span className="text-xs font-bold text-slate-900">
          Total: {formatRupiah(totalAmount)}
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {displayedItems.map((item, idx) => (
          <div key={item.id || idx} className="p-3.5 hover:bg-slate-50/70 transition-colors flex items-start justify-between gap-3">
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

      {/* Chunking / Load More Toggle */}
      {hasMore && (
        <div className="p-2.5 bg-slate-50/80 border-t border-slate-100 text-center">
          <button
            type="button"
            onClick={() => setShowAllItems(true)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors inline-flex items-center gap-1"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            Tampilkan {items.length - CHUNK_SIZE} produk lainnya ({items.length} total)
          </button>
        </div>
      )}

      {showAllItems && items.length > CHUNK_SIZE && (
        <div className="p-2 bg-slate-50/50 border-t border-slate-100 text-center">
          <button
            type="button"
            onClick={() => setShowAllItems(false)}
            className="text-[11px] font-medium text-slate-500 hover:text-slate-800 transition-colors inline-flex items-center gap-1"
          >
            <ChevronUp className="w-3.5 h-3.5" />
            Ciutkan daftar produk
          </button>
        </div>
      )}

      {/* Items Footer Total */}
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
        <span className="text-slate-500 font-medium">
          Subtotal ({totalQty} unit produk)
        </span>
        <span className="text-sm font-bold text-indigo-700">
          {formatRupiah(totalAmount)}
        </span>
      </div>
    </div>
  );
});
ItemsBreakdownSection.displayName = "ItemsBreakdownSection";

// 5. Memoized Timeline Section with Chunking & Fast Virtualized Rendering (Fix Bottlenecks #1, #2)
interface TimelineSectionProps {
  events: TimelineEvent[];
  newNote: string;
  noteAuthor: string;
  isAddingNote: boolean;
  onNewNoteChange: (val: string) => void;
  onNoteAuthorChange: (val: string) => void;
  onAddNote: (e: React.FormEvent) => void;
}

const TimelineSection = React.memo<TimelineSectionProps>(({
  events,
  newNote,
  noteAuthor,
  isAddingNote,
  onNewNoteChange,
  onNoteAuthorChange,
  onAddNote,
}) => {
  const [showAllEvents, setShowAllEvents] = useState(false);
  const MAX_EVENTS = 25;

  const displayedEvents = useMemo(() => {
    if (showAllEvents || events.length <= MAX_EVENTS) {
      return events;
    }
    // Show the first 25 events (oldest to recent or newest)
    return events.slice(0, MAX_EVENTS);
  }, [events, showAllEvents]);

  const hasMoreEvents = events.length > MAX_EVENTS && !showAllEvents;

  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Timeline & Riwayat Pesanan ({events.length})
          </h3>
        </div>
      </div>

      {/* Chronological Timeline Stream */}
      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {displayedEvents.map((evt) => {
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

              <div className="bg-slate-50/80 rounded-lg p-2.5 border border-slate-200/80">
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

      {hasMoreEvents && (
        <div className="text-center pt-1">
          <button
            type="button"
            onClick={() => setShowAllEvents(true)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors inline-flex items-center gap-1"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            Tampilkan Seluruh Timeline ({events.length} Peristiwa)
          </button>
        </div>
      )}

      {/* Add Note Form */}
      <form onSubmit={onAddNote} className="pt-2 border-t border-slate-100 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
            Tambah Catatan Internal / Gudang
          </label>
          <select
            value={noteAuthor}
            onChange={(e) => onNoteAuthorChange(e.target.value)}
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
            disabled={isAddingNote}
            onChange={(e) => onNewNoteChange(e.target.value)}
            placeholder="Tulis catatan (misal: Packing kayu, resi kurir, catatan pembeli)..."
            className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={isAddingNote || !newNote.trim()}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            Simpan
          </button>
        </div>
      </form>
    </div>
  );
});
TimelineSection.displayName = "TimelineSection";

// Main OrderDetailSidebar Component
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
    staleTime: 1000 * 60 * 5, // 5 mins cache to avoid unnecessary network hops
  });

  const error = queryErr ? (queryErr as Error).message || "Gagal memuat detail pesanan." : null;

  const invoice = data?.invoice;
  const items = data?.items || [];
  const history = data?.history || [];
  const notes = data?.notes || [];

  // Fix Bottleneck #4: Memoize color mappings to eliminate inline render loops
  const statusColorMap = useMemo(() => {
    const map = new Map<string, { hex: string; badgeStyle: { backgroundColor: string; color: string; borderColor: string } }>();
    if (orderStatuses) {
      orderStatuses.forEach((st) => {
        const hex = getStatusColor(st.nama_status, orderStatuses);
        map.set(st.nama_status, {
          hex,
          badgeStyle: getDynamicBadgeStyle(hex),
        });
      });
    }
    return map;
  }, [orderStatuses]);

  const channelColorMap = useMemo(() => {
    const map = new Map<string, { hex: string; badgeStyle: { backgroundColor: string; color: string; borderColor: string } }>();
    if (channels) {
      channels.forEach((ch) => {
        const hex = getChannelColor(ch.nama_channel, channels);
        map.set(ch.nama_channel, {
          hex,
          badgeStyle: getDynamicBadgeStyle(hex),
        });
      });
    }
    return map;
  }, [channels]);

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

  // Fix Bottleneck #3: No Query Invalidation on Every Status/Note Change - Update queryClient with setQueryData directly
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
    onSuccess: (savedNote: any, { noInvoice }) => {
      if (savedNote) {
        queryClient.setQueryData<InvoiceDetailResponse>(["invoiceDetail", noInvoice], (prev) => {
          if (!prev) return prev;
          const currentNotes = prev.notes || [];
          const tempIdx = currentNotes.findIndex(
            (n) => String(n.id).startsWith("temp-") && n.note === savedNote.note
          );
          if (tempIdx !== -1) {
            const updated = [...currentNotes];
            updated[tempIdx] = savedNote;
            return { ...prev, notes: updated };
          }
          if (!currentNotes.some((n) => String(n.id) === String(savedNote.id))) {
            return { ...prev, notes: [...currentNotes, savedNote] };
          }
          return prev;
        });
      }
    },
    onError: (err: any, { noInvoice }, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(["invoiceDetail", noInvoice], context.previousDetail);
      }
      alert(`Gagal menambahkan catatan: ${err?.message || err}`);
    },
    // Avoid queryClient.invalidateQueries! Eliminates network jitter, scroll resets, and drawer flicker.
  });

  // Status Mutations with setQueryData cache synchronization
  const updateStatusMutation = useMutation({
    mutationFn: async ({ noInvoice, status, author }: { noInvoice: string; status: OrderStatus; author?: string }) => {
      return await api.updateInvoiceStatus(noInvoice, status, author);
    },
    onMutate: async ({ noInvoice, status }) => {
      await queryClient.cancelQueries({ queryKey: ["invoiceDetail", noInvoice] });
      const previousDetail = queryClient.getQueryData<InvoiceDetailResponse>(["invoiceDetail", noInvoice]);

      if (previousDetail && previousDetail.invoice) {
        queryClient.setQueryData<InvoiceDetailResponse>(["invoiceDetail", noInvoice], {
          ...previousDetail,
          invoice: { ...previousDetail.invoice, status },
          items: previousDetail.items.map((it) => ({ ...it, status })),
        });
      }
      onUpdateStatusOptimistic?.(noInvoice, status);
      return { previousDetail };
    },
    onSuccess: (data: any, { noInvoice, status }) => {
      if (data) {
        queryClient.setQueryData<InvoiceDetailResponse>(["invoiceDetail", noInvoice], (prev) => {
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
      if (context?.previousDetail) {
        queryClient.setQueryData(["invoiceDetail", noInvoice], context.previousDetail);
        if (context.previousDetail.invoice) {
          onUpdateStatusOptimistic?.(noInvoice, context.previousDetail.invoice.status);
        }
      }
      alert(`Gagal memperbarui status: ${err?.message || err}`);
    },
    onSettled: () => {
      onRefreshData?.(true); // Silent grid sync without refetching active invoiceDetail
    },
  });

  const advanceStatusMutation = useMutation({
    mutationFn: async ({ noInvoice, author }: { noInvoice: string; author?: string }) => {
      return await api.advanceInvoiceStatus(noInvoice, author);
    },
    onMutate: async ({ noInvoice }) => {
      await queryClient.cancelQueries({ queryKey: ["invoiceDetail", noInvoice] });
      const previousDetail = queryClient.getQueryData<InvoiceDetailResponse>(["invoiceDetail", noInvoice]);

      let nextStatus: OrderStatus | null = null;
      if (previousDetail?.invoice?.status === "Input Orderan") nextStatus = "Diproses";
      else if (previousDetail?.invoice?.status === "Diproses") nextStatus = "Selesai Packing";

      if (previousDetail && previousDetail.invoice && nextStatus) {
        queryClient.setQueryData<InvoiceDetailResponse>(["invoiceDetail", noInvoice], {
          ...previousDetail,
          invoice: { ...previousDetail.invoice, status: nextStatus },
          items: previousDetail.items.map((it) => ({ ...it, status: nextStatus })),
        });
        onUpdateStatusOptimistic?.(noInvoice, nextStatus);
      }
      return { previousDetail };
    },
    onSuccess: (data: any, { noInvoice }) => {
      if (data) {
        queryClient.setQueryData<InvoiceDetailResponse>(["invoiceDetail", noInvoice], (prev) => {
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
      if (context?.previousDetail) {
        queryClient.setQueryData(["invoiceDetail", noInvoice], context.previousDetail);
        if (context.previousDetail.invoice) {
          onUpdateStatusOptimistic?.(noInvoice, context.previousDetail.invoice.status);
        }
      }
      alert(`Gagal memajukan status: ${err?.message || err}`);
    },
    onSettled: () => {
      onRefreshData?.(true); // Silent grid sync
    },
  });

  const updatingStatus = updateStatusMutation.isPending || advanceStatusMutation.isPending;

  const handleUpdateStatus = useCallback((newStatus: OrderStatus) => {
    const targetInvoice = invoice?.no_invoice || invoiceNumber;
    if (!targetInvoice || updateStatusMutation.isPending) return;
    if (invoice?.status === newStatus) return;
    updateStatusMutation.mutate({ noInvoice: targetInvoice, status: newStatus, author: userRole });
  }, [invoice?.no_invoice, invoice?.status, invoiceNumber, updateStatusMutation, userRole]);

  const handleAdvanceStatus = useCallback(() => {
    const targetInvoice = invoice?.no_invoice || invoiceNumber;
    if (!targetInvoice || advanceStatusMutation.isPending) return;
    advanceStatusMutation.mutate({ noInvoice: targetInvoice, author: userRole });
  }, [invoice?.no_invoice, invoiceNumber, advanceStatusMutation, userRole]);

  const handleAddNote = useCallback((e: React.FormEvent) => {
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
  }, [newNote, invoice?.no_invoice, invoiceNumber, addNoteMutation, noteAuthor]);

  const handleCopySummary = useCallback(() => {
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
  }, [invoice, items]);

  const handleDeleteInvoice = useCallback(async () => {
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
  }, [invoiceNumber, onClose, onRefreshData]);

  // Fix Bottleneck #1: Memoize timeline events compilation and sorting at top-level
  const timelineEvents = useMemo(() => {
    if (!invoice) return [];

    const events: TimelineEvent[] = [];

    // 1. Order creation event
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

    // 2. Status change & edit history
    history.forEach((h, idx) => {
      const authorName = h.author
        ? h.author
        : h.status_lama === "Import System"
        ? "Import Excel"
        : userRole || "Admin";

      const getStatusIcon = (st: string) => {
        if (st === "Selesai Packing") return CheckCircle2;
        if (st === "Batal") return X;
        if (st === "Retur") return RotateCcw;
        if (st === "Diproses") return Package;
        return Clock;
      };

      const colorData = statusColorMap.get(h.status_baru);
      const hex = colorData?.hex || getStatusColor(h.status_baru, orderStatuses);

      const isEditEvent = h.status_lama === "Edit Nota" || h.status_lama?.startsWith("Edit");

      events.push({
        type: "status",
        id: `event-status-${h.id || idx}`,
        timestamp: h.updated_at,
        title: isEditEvent ? `Perubahan Data: ${h.status_baru}` : `Perubahan Status: ${h.status_lama} → ${h.status_baru}`,
        author: authorName,
        icon: isEditEvent ? Edit3 : getStatusIcon(h.status_baru),
        color: isEditEvent ? "#3b82f6" : hex,
      });
    });

    // 3. User notes
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
    return events.sort((a, b) => {
      const timeA = parseDateToTimestamp(a.timestamp);
      const timeB = parseDateToTimestamp(b.timestamp);
      return timeA - timeB;
    });
  }, [invoice, history, notes, userRole, orderStatuses, statusColorMap]);

  // Compute next target label for status advance button
  const nextTargetLabel = useMemo(() => {
    if (!invoice) return null;
    const currentMaster = orderStatuses?.find((s) => s.nama_status === invoice.status);
    const canAdvance = orderStatuses && orderStatuses.length > 0
      ? !currentMaster?.is_final && currentMaster?.next_status
      : invoice.status !== "Selesai Packing" && invoice.status !== "Batal" && invoice.status !== "Retur";

    if (!canAdvance) return null;
    return currentMaster?.next_status || STATUS_CONFIG[invoice.status]?.nextLabel || "Lanjutkan Status";
  }, [invoice, orderStatuses]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Fix Bottleneck #6: Isolated Memoized Backdrop */}
      <Backdrop onClick={onClose} />

      {/* Slide-over Right Drawer */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col border-l border-slate-200">
          
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
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
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
                  {/* Status Progress & Quick Advance (Memoized Component) */}
                  <StatusSelectorSection
                    currentStatus={invoice.status}
                    createdAt={invoice.created_at}
                    orderStatuses={orderStatuses}
                    statusColorMap={statusColorMap}
                    updatingStatus={updatingStatus}
                    onUpdateStatus={handleUpdateStatus}
                    onAdvanceStatus={handleAdvanceStatus}
                    nextTarget={nextTargetLabel}
                  />

                  {/* Transaction Info (Memoized Component) */}
                  <TransactionInfoSection
                    invoice={invoice}
                    channelColorMap={channelColorMap}
                    onStartEdit={() => setIsEditingMode(true)}
                  />

                  {/* Items Breakdown Table (Memoized Component with Chunking) */}
                  <ItemsBreakdownSection
                    items={items}
                    itemCount={invoice.item_count}
                    totalQty={invoice.total_qty}
                    totalAmount={invoice.total_amount}
                  />

                  {/* History & Notes Timeline (Memoized Component with Chunking) */}
                  <TimelineSection
                    events={timelineEvents}
                    newNote={newNote}
                    noteAuthor={noteAuthor}
                    isAddingNote={addNoteMutation.isPending}
                    onNewNoteChange={setNewNote}
                    onNoteAuthorChange={setNoteAuthor}
                    onAddNote={handleAddNote}
                  />

                  {/* Footer Danger Actions */}
                  <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
                    <span>Nota ID: #{invoiceNumber}</span>
                    <button
                      type="button"
                      onClick={() => setIsDeleteModalOpen(true)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 cursor-pointer"
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

// Fix Bottleneck #7: Export memoized component to avoid unnecessary re-renders from parent
export const OrderDetailSidebar = React.memo(OrderDetailSidebarComponent);
