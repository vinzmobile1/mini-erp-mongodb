import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Filter,
  ArrowRight,
  History,
  Trash2,
  CheckCircle,
  Clock,
  Package,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Layers,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Copy,
  Check,
  ShoppingBag,
  Eye,
  FileText,
  GripVertical,
  CheckSquare,
  Calendar,
  X,
} from "lucide-react";
import { SimpleTable, ReactColumnDef, ReactIconsConfig } from "@simple-table/react";
import { SalesOrder, InvoiceOrder, OrderStatus, SalesChannel, Channel, OrderStatusMaster } from "../types";
import { api, formatRupiah, formatDate } from "../lib/api";
import { getChannelColor, getStatusColor, getDynamicBadgeStyle } from "../lib/colorUtils";
import { OrderDetailSidebar } from "./OrderDetailSidebar";
import { ConfirmModal } from "./ConfirmModal";
import { SalesPerson, Product, Brand, Customer } from "../types";
import { QuickFilterGroup, QuickFilterOption } from "./QuickFilterGroup";

interface AdminDataGridProps {
  orders: InvoiceOrder[];
  loading: boolean;
  onRefresh: (silent?: boolean) => void;
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

const CHANNEL_BADGES: Record<string, string> = {
  Tokopedia: "bg-emerald-50 text-emerald-700 border-emerald-200",
  TikTok: "bg-zinc-900 text-white border-zinc-900",
  Shopee: "bg-orange-50 text-orange-700 border-orange-200",
  Lazada: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Offline: "bg-slate-100 text-slate-700 border-slate-300",
};

// Custom Lucide Icons matching app convention
const simpleTableIcons: ReactIconsConfig = {
  sortUp: <ArrowUp className="w-3.5 h-3.5 text-slate-700" />,
  sortDown: <ArrowDown className="w-3.5 h-3.5 text-slate-700" />,
  filter: <Filter className="w-3.5 h-3.5 text-slate-500" />,
  expand: <ChevronRight className="w-3.5 h-3.5 text-slate-500" />,
  headerCollapse: <ChevronDown className="w-3.5 h-3.5 text-slate-500" />,
  headerExpand: <ChevronRight className="w-3.5 h-3.5 text-slate-500" />,
  next: <ChevronRight className="w-3.5 h-3.5 text-slate-600" />,
  prev: <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />,
  drag: <GripVertical className="w-3.5 h-3.5 text-slate-400" />,
};

const PAGE_SIZE = 50;

export const AdminDataGrid: React.FC<AdminDataGridProps> = ({
  orders,
  loading,
  onRefresh,
  onUpdateStatusOptimistic,
  userRole = "Admin",
  channels,
  orderStatuses,
  salesPersons,
  products,
  brands,
  customers,
}) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [channelFilter, setChannelFilter] = useState<string>("ALL");
  const [advancingInvoice, setAdvancingInvoice] = useState<string | null>(null);

  // 1. State Pencarian Terpisah (Advanced Search)
  const [searchParams, setSearchParams] = useState({
    invoice: "",
    customer: "",
    sales: "",
    divisi: "",
    sku: "",
  });

  // Debounce untuk seluruh object pencarian
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchParams);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchParams]);

  // Handler untuk mengubah nilai input pencarian
  const handleSearchChange = (field: keyof typeof searchParams, value: string) => {
    setSearchParams((prev) => ({ ...prev, [field]: value }));
  };

  // Summary counts for QuickFilterGroup
  const [summaryCounts, setSummaryCounts] = useState<{
    total: number;
    statusCounts: Record<string, number>;
    channelCounts: Record<string, number>;
  }>({
    total: 0,
    statusCounts: {},
    channelCounts: {},
  });

  // Fetch summary counts for QuickFilterGroup based on active date range and search
  const fetchSummaryCounts = useCallback(async () => {
    try {
      const summary = await api.getInvoicesSummary({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        channel: channelFilter !== "ALL" ? channelFilter : undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
      });
      setSummaryCounts(summary);
    } catch (err) {
      console.error("Error fetching invoice summary counts:", err);
    }
  }, [startDate, endDate, channelFilter, statusFilter]); // Dependency ditambahkan
  useEffect(() => {
    fetchSummaryCounts();
  }, [fetchSummaryCounts]);

  // Detail Sidebar State
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Product Name lookup map
  const productsMap = useMemo(() => {
    const map = new Map<string, string>();
    if (products && products.length > 0) {
      for (const p of products) {
        if (p.sku) map.set(p.sku, p.item_name || p.sku);
      }
    }
    return map;
  }, [products]);

  // Server-side Cursor Pagination & Invoices State
  const [invoices, setInvoices] = useState<InvoiceOrder[]>(orders || []);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isFetchingFirstPage, setIsFetchingFirstPage] = useState(false);

  // Fetch Page 1 whenever filters or debounced search changes
  const fetchFirstPage = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsFetchingFirstPage(true);
    try {
    // Pada fungsi fetchFirstPage dan handleLoadMore, ubah argumen pemanggilannya menjadi:
      const res = await api.getInvoices({
        status: statusFilter,
        channel: channelFilter,
        invoice: debouncedSearch.invoice || undefined,
        customer: debouncedSearch.customer || undefined,
        sales: debouncedSearch.sales || undefined,
        divisi: debouncedSearch.divisi || undefined,
        sku: debouncedSearch.sku || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit: PAGE_SIZE,
        // khusus di handleLoadMore tambahkan: cursor: nextCursor,
      });
      setInvoices(res.data);
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
    } catch (err: any) {
      console.error("Error fetching invoices:", err);
    } finally {
      setIsFetchingFirstPage(false);
    }
  }, [statusFilter, channelFilter, debouncedSearch, startDate, endDate]);

  useEffect(() => {
    fetchFirstPage();
  }, [fetchFirstPage]);

  const hasActiveSearch = useMemo(() => {
    return Boolean(
      debouncedSearch.invoice ||
      debouncedSearch.customer ||
      debouncedSearch.sales ||
      debouncedSearch.divisi ||
      debouncedSearch.sku
    );
  }, [debouncedSearch]);

  // Sync initial orders prop if loaded externally and no active filters (preserve optimistic status changes)
  useEffect(() => {
    if (orders && orders.length > 0 && !hasActiveSearch && !startDate && !endDate && statusFilter === "ALL" && channelFilter === "ALL") {
      setInvoices((prev: InvoiceOrder[]) => {
        if (!prev || prev.length === 0) return orders;
        const prevMap = new Map<string, InvoiceOrder>(prev.map((i: InvoiceOrder) => [i.no_invoice, i]));
        return orders.map((ord: InvoiceOrder) => {
          const existing = prevMap.get(ord.no_invoice);
          return existing ? { ...ord, status: existing.status } : ord;
        });
      });
    }
  }, [orders, hasActiveSearch, startDate, endDate, statusFilter, channelFilter]);

  // True Server-Side Infinite Scroll via Cursor
  const handleLoadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || !nextCursor) return;
    setIsLoadingMore(true);
    try {
      const res = await api.getInvoices({
        status: statusFilter,
        channel: channelFilter,
        invoice: debouncedSearch.invoice || undefined,
        customer: debouncedSearch.customer || undefined,
        sales: debouncedSearch.sales || undefined,
        divisi: debouncedSearch.divisi || undefined,
        sku: debouncedSearch.sku || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit: PAGE_SIZE,
        cursor: nextCursor,
      });
      setInvoices((prev) => {
        const existingSet = new Set(prev.map((i) => i.no_invoice));
        const newRows = res.data.filter((i) => !existingSet.has(i.no_invoice));
        return [...prev, ...newRows];
      });
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
    } catch (err: any) {
      console.error("Error loading more invoices via cursor:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, nextCursor, statusFilter, channelFilter, debouncedSearch, startDate, endDate]);

  // Instant local optimistic status update for smooth UI
  const handleLocalUpdateStatusOptimistic = useCallback((no_invoice: string, newStatus: OrderStatus) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv.no_invoice === no_invoice ? { ...inv, status: newStatus } : inv))
    );
    queryClient.setQueryData<InvoiceOrder[]>(["invoices"], (old) => {
      if (!old) return [];
      return old.map((o) => (o.no_invoice === no_invoice ? { ...o, status: newStatus } : o));
    });
    onUpdateStatusOptimistic?.(no_invoice, newStatus);
  }, [onUpdateStatusOptimistic, queryClient]);

  // Custom Delete Modal State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
    isLoading?: boolean;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: async () => {},
    isLoading: false,
  });

  const handleOpenDetail = useCallback((no_invoice: string) => {
    setSelectedInvoice(no_invoice);
    setIsSidebarOpen(true);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  const handleSidebarRefreshData = useCallback((silent?: boolean) => {
    fetchFirstPage(silent);
    fetchSummaryCounts();
    onRefresh(silent);
  }, [fetchFirstPage, fetchSummaryCounts, onRefresh]);

  // TanStack Query Mutation with automatic optimistic update, rollback on error, and cache invalidation
  const advanceStatusMutation = useMutation({
    mutationFn: async ({ no_invoice }: { no_invoice: string; previousStatus: OrderStatus; nextStatus: OrderStatus }) => {
      return await api.advanceInvoiceStatus(no_invoice, userRole);
    },
    onMutate: async ({ no_invoice, nextStatus }) => {
      setAdvancingInvoice(no_invoice);
      // Save snapshot of previous invoices
      const previousInvoices = invoices;

      // Optimistically update local state immediately (0ms instant response)
      handleLocalUpdateStatusOptimistic(no_invoice, nextStatus);

      // Cancel outgoing refetches in background so they don't overwrite our optimistic update
      queryClient.cancelQueries({ queryKey: ["invoices"] });

      return { previousInvoices };
    },
    onError: (err: any, variables, context) => {
      // Safe Rollback to previous state on failure
      if (context?.previousInvoices) {
        setInvoices(context.previousInvoices);
      }
      alert(`Gagal memajukan status nota: ${err.message}`);
    },
    onSettled: () => {
      setAdvancingInvoice(null);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      onRefresh(true);
    },
  });

  const handleAdvanceStatus = useCallback((no_invoice: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const currentInv = invoices.find((inv) => inv.no_invoice === no_invoice);
    if (!currentInv) return;

    let nextStatus: OrderStatus | null = null;
    if (orderStatuses && orderStatuses.length > 0) {
      const currentMaster = orderStatuses.find((s) => s.nama_status === currentInv.status);
      if (currentMaster && currentMaster.next_status && !currentMaster.is_final) {
        nextStatus = currentMaster.next_status as OrderStatus;
      }
    } else {
      if (currentInv.status === "Input Orderan") nextStatus = "Diproses";
      else if (currentInv.status === "Diproses") nextStatus = "Selesai Packing";
    }

    if (nextStatus) {
      advanceStatusMutation.mutate({
        no_invoice,
        previousStatus: currentInv.status as OrderStatus,
        nextStatus,
      });
    }
  }, [invoices, orderStatuses, advanceStatusMutation]);

  const handleDeleteInvoice = useCallback((no_invoice: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeleteModal({
      isOpen: true,
      title: "Hapus Pesanan / Invoice",
      message: `Apakah Anda yakin ingin menghapus seluruh pesanan dengan invoice ${no_invoice}? Data transaksi, produk, dan catatan terkait akan dihapus secara permanen.`,
      isLoading: false,
      onConfirm: async () => {
        setDeleteModal((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.deleteInvoice(no_invoice);
          setInvoices((prev) => prev.filter((inv) => inv.no_invoice !== no_invoice));
          setDeleteModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          onRefresh();
          if (selectedInvoice === no_invoice) {
            setIsSidebarOpen(false);
          }
        } catch (err: any) {
          setDeleteModal((prev) => ({ ...prev, isLoading: false }));
          alert(`Gagal menghapus order: ${err.message}`);
        }
      },
    });
  }, [onRefresh, selectedInvoice]);

  const handleExportCSV = useCallback(() => {
    if (invoices.length === 0) {
      alert("Tidak ada data untuk diexport.");
      return;
    }
    const headers = [
      "No Invoice",
      "Customer",
      "Jumlah Item",
      "Total Qty",
      "Total Amount",
      "Rincian Produk",
      "Channel",
      "Status",
      "Sales Person",
      "Divisi",
      "Tanggal Dibuat",
    ];

    const rows = invoices.map((inv) => {
      const itemsDetail = inv.items
        .map((it) => {
          const name = it.item_name || productsMap.get(it.sku) || it.sku;
          return `${name} (${it.sku}) x${it.qty}`;
        })
        .join(" | ");
      return [
        `"${inv.no_invoice}"`,
        `"${inv.nama_customer}"`,
        inv.item_count,
        inv.total_qty,
        inv.total_amount,
        `"${itemsDetail}"`,
        `"${inv.channel}"`,
        `"${inv.status}"`,
        `"${inv.nama_sales}"`,
        `"${inv.nama_divisi}"`,
        `"${inv.created_at}"`,
      ];
    });
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rekap_Nota_Penjualan_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [invoices, productsMap]);

  // Enrich each row with formatted dates and search helpers for robust table filtering
  const processedInvoices = useMemo(() => {
    return invoices.map((inv) => {
      const enrichedItems = (inv.items || []).map((it) => ({
        ...it,
        item_name: it.item_name || productsMap.get(it.sku) || it.sku,
      }));
      const itemsSearchText = enrichedItems
        .map((it) => `${it.item_name} ${it.sku}`)
        .join(" ");
      const formattedDateStr = formatDate(inv.created_at);

      return {
        ...inv,
        items: enrichedItems,
        created_at_display: formattedDateStr,
        products_search: itemsSearchText || inv.no_invoice,
        sales_divisi_search: `${inv.nama_sales || ""} ${inv.nama_divisi || ""}`.trim(),
      };
    });
  }, [invoices, productsMap]);

  // Client-side search & WIB date range safety filter to guarantee 100% precision on table view
  const filteredInvoices = useMemo(() => {
    return processedInvoices.filter((inv) => {
      // 1. Strict Date Range Filter in Asia/Jakarta (WIB) timezone
      if (startDate || endDate) {
        if (!inv.created_at) return false;
        const invDate = new Date(inv.created_at);
        if (isNaN(invDate.getTime())) return false;

        // Convert invoice ISO string to Asia/Jakarta date string YYYY-MM-DD
        let invJakartaStr = "";
        try {
          invJakartaStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(invDate);
        } catch {
          invJakartaStr = invDate.toISOString().substring(0, 10);
        }

        if (startDate && invJakartaStr < startDate) return false;
        if (endDate && invJakartaStr > endDate) return false;
      }

      // 2. Search query filter (handles both search object and legacy string search)
      if (typeof debouncedSearch === "object" && debouncedSearch !== null) {
        const { invoice, customer, sales, divisi, sku } = debouncedSearch;
        if (invoice && !inv.no_invoice?.toLowerCase().includes(invoice.toLowerCase().trim())) {
          return false;
        }
        if (customer && !inv.nama_customer?.toLowerCase().includes(customer.toLowerCase().trim())) {
          return false;
        }
        if (sales && !inv.nama_sales?.toLowerCase().includes(sales.toLowerCase().trim())) {
          return false;
        }
        if (divisi && !inv.nama_divisi?.toLowerCase().includes(divisi.toLowerCase().trim())) {
          return false;
        }
        if (sku && !inv.products_search?.toLowerCase().includes(sku.toLowerCase().trim())) {
          return false;
        }
      } else if (typeof debouncedSearch === "string" && debouncedSearch) {
        const q = (debouncedSearch as string).toLowerCase().trim();
        const matchInv = inv.no_invoice?.toLowerCase().includes(q);
        const matchCust = inv.nama_customer?.toLowerCase().includes(q);
        const matchSales = inv.nama_sales?.toLowerCase().includes(q);
        const matchDiv = inv.nama_divisi?.toLowerCase().includes(q);
        const matchChan = inv.channel?.toLowerCase().includes(q);
        const matchStatus = inv.status?.toLowerCase().includes(q);
        const matchProd = inv.products_search?.toLowerCase().includes(q);
        if (!(matchInv || matchCust || matchSales || matchDiv || matchChan || matchStatus || matchProd)) {
          return false;
        }
      }

      return true;
    });
  }, [processedInvoices, debouncedSearch, startDate, endDate]);

  // SimpleTable Column Definitions with typed accessors, sorting, filtering, and custom cellRenderers
  const columns: ReactColumnDef<any>[] = useMemo(() => [
    {
      accessor: "created_at",
      label: "Tanggal Dibuat",
      sortable: true,
      filterable: false,
      width: 145,
      cellRenderer: ({ row }) => (
        <div className="flex items-center gap-1.5 py-1 text-slate-700 text-xs font-medium whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="font-semibold">{row?.created_at_display || formatDate(row?.created_at)}</span>
        </div>
      ),
    },
    {
      accessor: "no_invoice",
      label: "No. Invoice",
      sortable: true,
      filterable: false,
      width: 175,
      cellRenderer: ({ row }) => (
        <div className="flex items-center gap-2 py-1">
          <div className="p-1 rounded bg-indigo-50 text-indigo-600">
            <FileText className="w-3.5 h-3.5" />
          </div>
          <span className="font-mono font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
            {row?.no_invoice || "-"}
          </span>
        </div>
      ),
    },
    {
      accessor: "sales_divisi_search",
      label: "Sales & Divisi",
      sortable: true,
      filterable: false,
      width: "auto",
      minWidth: 140,
      maxWidth: 200,
      cellRenderer: ({ row }) => (
        <div className="flex flex-col justify-center py-1">
          <div className="font-semibold text-slate-900 truncate">{row?.nama_sales || "-"}</div>
          <div className="text-[10px] text-slate-500 truncate">{row?.nama_divisi || "-"}</div>
        </div>
      ),
    },
    {
      accessor: "nama_customer",
      label: "Customer",
      sortable: true,
      filterable: false,
      width: "auto",
      minWidth: 150,
      maxWidth: 220,
      cellRenderer: ({ row }) => (
        <div
          className="font-semibold text-slate-800 truncate hover:text-indigo-600 transition-colors"
          title={row?.nama_customer}
        >
          {row?.nama_customer || "-"}
        </div>
      ),
    },
    {
      accessor: "channel",
      label: "Channel",
      type: "enum",
      enumOptions:
        channels && channels.length > 0
          ? channels.map((c) => ({ value: c.nama_channel, label: c.nama_channel }))
          : [
              { value: "Tokopedia", label: "Tokopedia" },
              { value: "TikTok", label: "TikTok Shop" },
              { value: "Shopee", label: "Shopee" },
              { value: "Lazada", label: "Lazada" },
              { value: "Offline", label: "Offline Store" },
            ],
      sortable: true,
      filterable: false,
      width: 125,
      cellRenderer: ({ row }) => {
        const hexColor = getChannelColor(row?.channel, channels);
        const badgeStyle = getDynamicBadgeStyle(hexColor);
        return (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border"
            style={{
              backgroundColor: badgeStyle.backgroundColor,
              color: badgeStyle.color,
              borderColor: badgeStyle.borderColor,
            }}
          >
            {row?.channel || "-"}
          </span>
        );
      },
    },
    {
      accessor: "products_search",
      label: "Daftar Produk",
      sortable: false,
      filterable: false,
      width: "auto",
      minWidth: 230,
      maxWidth: 320,
      cellRenderer: ({ row }) => {
        const firstItem = row?.items?.[0];
        const remainingCount = (row?.items?.length || 1) - 1;
        const itemName = firstItem?.item_name || (firstItem?.sku ? productsMap.get(firstItem.sku) : "") || "-";
        const skuCode = firstItem?.sku || "-";
        return (
          <div className="flex flex-col justify-center py-1 max-w-full overflow-hidden">
            {/* Baris Atas: Item Name */}
            <div className="font-semibold text-slate-900 truncate text-xs" title={itemName}>
              {itemName}
            </div>
            {/* Baris Bawah: SKU dan Qty */}
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              {firstItem && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200/70 font-medium">
                  SKU: {skuCode} <span className="text-slate-500 font-sans font-bold">({firstItem.qty} pcs)</span>
                </span>
              )}
              {remainingCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                  +{remainingCount} produk lain
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessor: "status",
      label: "Status Nota",
      type: "enum",
      enumOptions:
        orderStatuses && orderStatuses.length > 0
          ? [...orderStatuses]
              .sort((a, b) => (a.urutan || 99) - (b.urutan || 99))
              .map((s) => ({ value: s.nama_status, label: s.nama_status }))
          : [
              { value: "Input Orderan", label: "Input Orderan" },
              { value: "Diproses", label: "Diproses" },
              { value: "Selesai Packing", label: "Selesai Packing" },
              { value: "Batal", label: "Batal" },
              { value: "Retur", label: "Retur" },
            ],
      sortable: true,
      filterable: false,
      width: 160,
      cellRenderer: ({ row }) => {
        const hexColor = getStatusColor(row?.status, orderStatuses);
        const badgeStyle = getDynamicBadgeStyle(hexColor);
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
            style={{
              backgroundColor: badgeStyle.backgroundColor,
              color: badgeStyle.color,
              borderColor: badgeStyle.borderColor,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: hexColor }}
            />
            <span>{row?.status || "-"}</span>
          </span>
        );
      },
    },
    {
      accessor: "total_qty",
      label: "Total Qty",
      type: "number",
      align: "center",
      sortable: true,
      filterable: false,
      width: 100,
      cellRenderer: ({ row }) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold text-xs tabular">
          {row?.total_qty || 0} pcs
        </span>
      ),
    },
    {
      accessor: "total_amount",
      label: "Total Nilai",
      type: "number",
      align: "right",
      sortable: true,
      filterable: false,
      width: 145,
      cellRenderer: ({ row }) => (
        <span className="font-bold text-slate-900 tabular whitespace-nowrap">
          {formatRupiah(row?.total_amount)}
        </span>
      ),
    },
    
  ], [channels, orderStatuses, productsMap]);

  // Prepare QuickFilterGroup options for Channel
  const channelQuickFilterOptions: QuickFilterOption[] = useMemo(() => {
    const rawChannels: string[] = channels && channels.length > 0
      ? channels.map((c) => c.nama_channel).filter((c): c is string => Boolean(c))
      : ["Tokopedia", "Shopee", "TikTok", "Lazada", "Offline", "WhatsApp", "Instagram", "B2B"];
    
    // Unique channel names
    const uniqueChannels = Array.from(new Set(rawChannels));

    return uniqueChannels.map((ch) => {
      const hexColor = getChannelColor(ch, channels);
      const count = summaryCounts.channelCounts[ch] ?? 0;
      return {
        id: ch,
        label: ch,
        count,
        textColor: hexColor || "#38bdf8",
        badgeBgColor: hexColor || "#0284c7",
      };
    });
  }, [channels, summaryCounts.channelCounts]);

  // Prepare QuickFilterGroup options for Status Nota
  const statusQuickFilterOptions: QuickFilterOption[] = useMemo(() => {
    const rawStatuses: string[] = orderStatuses && orderStatuses.length > 0
      ? [...orderStatuses]
          .sort((a, b) => (a.urutan || 99) - (b.urutan || 99))
          .map((s) => s.nama_status)
          .filter((s): s is string => Boolean(s))
      : ["Input Orderan", "Diproses", "Selesai Packing", "Batal", "Retur"];

    const uniqueStatuses = Array.from(new Set(rawStatuses));

    return uniqueStatuses.map((st) => {
      const hexColor = getStatusColor(st, orderStatuses);
      const count = summaryCounts.statusCounts[st] ?? 0;
      return {
        id: st,
        label: st,
        count,
        textColor: hexColor || "#f59e0b",
        badgeBgColor: hexColor || "#d97706",
      };
    });
  }, [orderStatuses, summaryCounts.statusCounts]);

  return (
    <div className="space-y-4 animate-in fade-in-50 duration-200" id="admin-data-grid-view">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Admin Management
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-display flex items-center gap-2.5">
            <span>Live Data Grid Nota & Transaksi</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-sans font-medium">
              Multi-Item per Nota
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            1 baris menampilkan 1 nota lengkap (bisa 2+ produk). Didukung Simple Table dengan Infinite Scroll, sorting kolom, dan filter interaktif.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            id="export-csv-btn"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs space-y-3.5" id="grid-filter-bar">
        {/* Top Filter Controls: Search & Date Range */}
        {/* Advanced Search Area (4 Kolom per Baris) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Baris 1: 4 Kolom Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchParams.invoice}
              onChange={(e) => handleSearchChange("invoice", e.target.value)}
              placeholder="Cari No. Invoice..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
            />
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchParams.customer}
              onChange={(e) => handleSearchChange("customer", e.target.value)}
              placeholder="Cari Customer..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
            />
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchParams.sales}
              onChange={(e) => handleSearchChange("sales", e.target.value)}
              placeholder="Cari Sales Person..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
            />
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchParams.divisi}
              onChange={(e) => handleSearchChange("divisi", e.target.value)}
              placeholder="Cari Divisi..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
            />
          </div>

          {/* Baris 2: SKU (1 kolom), Tanggal (2 Kolom), Action (1 Kolom) */}
          <div className="relative lg:col-span-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchParams.sku}
              onChange={(e) => handleSearchChange("sku", e.target.value)}
              placeholder="Cari Produk / SKU..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all"
            />
          </div>

          {/* Date Range: Takes 2 columns space on large screens */}
          <div className="lg:col-span-2 flex items-center gap-2">

            <div className="relative flex-1">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-slate-900 font-medium text-slate-800 transition-all cursor-pointer"
              />
            </div>
            <span className="text-xs text-slate-400 font-medium shrink-0">-</span>
            <div className="relative flex-1">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-slate-900 font-medium text-slate-800 transition-all cursor-pointer"
              />
            </div>
          </div>

          {/* Reset All Filters Button */}
          <div className="lg:col-span-1 flex items-center justify-end">
            <button
              type="button"
              onClick={() => {
                setSearchParams({ invoice: "", customer: "", sales: "", divisi: "", sku: "" });
                setStartDate("");
                setEndDate("");
              }}
              className="flex items-center justify-center w-full lg:w-auto gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          </div>
        </div>

        {/* Quick Filter Groups (Channel & Status Nota) - Positioned below search field */}
        <div className="pt-2 border-t border-slate-100 space-y-2.5" id="admin-quick-filter-groups">
          {/* Channel Quick Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <QuickFilterGroup
              id="channel-quick-filter"
              label="Channel"
              options={channelQuickFilterOptions}
              selectedValue={channelFilter}
              onSelect={(val) => setChannelFilter(val)}
              onClear={() => setChannelFilter("ALL")}
            />
          </div>

          {/* Status Nota Quick Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <QuickFilterGroup
              id="status-quick-filter"
              label="Status Nota"
              options={statusQuickFilterOptions}
              selectedValue={statusFilter}
              onSelect={(val) => setStatusFilter(val)}
              onClear={() => setStatusFilter("ALL")}
            />
          </div>
        </div>

        {/* Status Counter Summary */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <div>
            Menampilkan <strong className="text-slate-900 tabular">{filteredInvoices.length}</strong> nota
            {hasMore ? " (scroll tabel untuk memuat nota berikutnya)" : " (semua nota telah dimuat)"}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            {isLoadingMore && <span className="text-blue-600 font-semibold animate-pulse">Memuat batch nota berikutnya...</span>}
            <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-medium">True Cursor Pagination</span>
          </div>
        </div>
      </div>

      {/* Main SimpleTable Grid */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-2xs overflow-hidden cursor-pointer" id="admin-orders-table-wrapper">
        <SimpleTable<any>
          rows={filteredInvoices}
          columns={columns}
          theme="custom"
          customTheme={{ rowHeight: 64, headerHeight: 44 }}
          height="580px"
          getRowId={({ row }) => row.no_invoice}
          onCellClick={({ row }) => {
            if (row?.no_invoice) {
              handleOpenDetail(row.no_invoice);
            }
          }}
          isLoading={loading || isFetchingFirstPage || isLoadingMore}
          onLoadMore={handleLoadMore}
          infiniteScrollThreshold={150}
          columnResizing={true}
          columnReordering={true}
          autoExpandColumns={true}
          icons={simpleTableIcons}
          hoverRowBackground={true}
          oddEvenRowBackground={true}
          tableEmptyStateRenderer={
            <div className="py-16 text-center text-slate-400">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Tidak ada data transaksi</p>
              <p className="text-xs text-slate-500 mt-1">
                Tidak ada nota penjualan yang sesuai dengan filter atau kata kunci pencarian.
              </p>
            </div>
          }
        />
      </div>

      {/* Order Detail Sidebar */}
      <OrderDetailSidebar
        invoiceNumber={selectedInvoice}
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
        onRefreshData={handleSidebarRefreshData}
        onUpdateStatusOptimistic={handleLocalUpdateStatusOptimistic}
        userRole={userRole}
        channels={channels}
        orderStatuses={orderStatuses}
        salesPersons={salesPersons}
        products={products}
        brands={brands}
        customers={customers}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title={deleteModal.title}
        message={deleteModal.message}
        onConfirm={deleteModal.onConfirm}
        onCancel={() => setDeleteModal((prev) => ({ ...prev, isOpen: false }))}
        isLoading={deleteModal.isLoading}
        confirmLabel="Ya, Hapus Nota"
        cancelLabel="Batal"
        variant="danger"
      />
    </div>
  );
};
