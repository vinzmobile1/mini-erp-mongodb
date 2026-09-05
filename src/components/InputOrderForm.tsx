import React, { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  CheckCircle2,
  Check,
  AlertCircle,
  Hash,
  User,
  ShoppingBag,
  Layers,
  Sparkles,
  Calculator,
  RotateCcw,
  FileSpreadsheet,
  Edit3,
} from "lucide-react";
import {
  Customer,
  SalesPerson,
  Product,
  Brand,
  SalesChannel,
  Channel,
  CreateOrderPayload,
  OrderItemInput,
  OrderStatusMaster,
} from "../types";
import { api, formatRupiah } from "../lib/api";
import { SearchableSelect } from "./SearchableSelect";
import { OrderExcelImportView } from "./OrderExcelImportView";

interface InputOrderFormProps {
  channels?: Channel[];
  salesPersons: SalesPerson[];
  products: Product[];
  brands: Brand[];
  customers?: Customer[];
  orderStatuses?: OrderStatusMaster[];
  editingInvoice?: any; // Using any for SalesOrder to avoid import cycles or missing imports
  onCancelEdit?: () => void;
  onOrderCreated?: () => void;
  onNavigateToGrid?: () => void;
  compact?: boolean;
}

interface ItemRowState {
  id: string;
  sku: string;
  selectedBrandId?: number | null;
  qty: number;
  unitPrice: number;
  amount: number;
}

const CHANNELS_DEFAULT: { value: string; label: string; badgeClass: string }[] =
  [
    {
      value: "Tokopedia",
      label: "Tokopedia",
      badgeClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
    },
    {
      value: "TikTok",
      label: "TikTok Shop",
      badgeClass: "text-zinc-900 bg-zinc-100 border-zinc-300",
    },
    {
      value: "Shopee",
      label: "Shopee",
      badgeClass: "text-orange-700 bg-orange-50 border-orange-200",
    },
    {
      value: "Lazada",
      label: "Lazada",
      badgeClass: "text-indigo-700 bg-indigo-50 border-indigo-200",
    },
    {
      value: "Offline",
      label: "Offline Store",
      badgeClass: "text-slate-700 bg-slate-100 border-slate-300",
    },
  ];

export const InputOrderForm: React.FC<
  InputOrderFormProps & { channels?: any[]; userRole?: string }
> = ({
  salesPersons,
  products,
  brands,
  customers = [],
  orderStatuses = [],
  editingInvoice,
  onCancelEdit,
  onOrderCreated,
  onNavigateToGrid,
  compact = false,
  channels = [],
  userRole = "Admin",
}) => {
  const availableChannels =
    channels && channels.length > 0
      ? channels.map((c) => ({
          value: c.nama_channel,
          label: c.nama_channel,
          badgeClass: "text-blue-700 bg-blue-100 border-blue-300",
        }))
      : CHANNELS_DEFAULT;

  const [entryMode, setEntryMode] = useState<"manual" | "excel">("manual");
  const [noInvoice, setNoInvoice] = useState("");
  const [namaCustomer, setNamaCustomer] = useState("");
  const [telepon, setTelepon] = useState("");
  const [alamat, setAlamat] = useState("");
  const [salesPersonId, setSalesPersonId] = useState<number | null>(null);
  const [salesPersonInput, setSalesPersonInput] = useState("");
  const [channel, setChannel] = useState<SalesChannel>(
    availableChannels.length > 0
      ? (availableChannels[0].value as SalesChannel)
      : "Tokopedia",
  );

  const [items, setItems] = useState<ItemRowState[]>([
    {
      id: "row-" + Date.now(),
      sku: "",
      selectedBrandId: null,
      qty: 1,
      unitPrice: 0,
      amount: 0,
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    invoice: string;
    itemCount: number;
    total: number;
  } | null>(null);

  // Generate suggested invoice number
  const generateInvoiceNumber = () => {
    const today = new Date();
    const yearMonth = today.toISOString().slice(0, 7).replace("-", "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setNoInvoice(`INV-${yearMonth}-${randomSuffix}`);
  };

  useEffect(() => {
    if (editingInvoice) {
      setNoInvoice(editingInvoice.no_invoice);
      setNamaCustomer(editingInvoice.nama_customer);
      setTelepon(editingInvoice.no_telepon || editingInvoice.customer_snapshot?.no_telepon || "");
      setAlamat(editingInvoice.alamat || editingInvoice.customer_snapshot?.alamat || "");
      setChannel(editingInvoice.channel as SalesChannel);
      
      const sales = salesPersons.find(s => s.nama_sales === editingInvoice.nama_sales);
      if (sales) {
        setSalesPersonId(sales.id);
        setSalesPersonInput(sales.nama_sales);
      }
      
      if (editingInvoice.items && editingInvoice.items.length > 0) {
        setItems(editingInvoice.items.map((it: any, i: number) => {
          const product = products.find(p => p.sku === it.sku);
          const historicalUnitPrice = (it.amount && it.qty) ? (it.amount / it.qty) : (product?.price || 0);
          return {
            id: `edit-row-${i}`,
            sku: it.sku,
            selectedBrandId: product?.brand_id || null,
            qty: it.qty,
            unitPrice: historicalUnitPrice,
            amount: it.amount
          };
        }));
      }
    } else {
      generateInvoiceNumber();
    }
  }, [editingInvoice, salesPersons, products]);

  // Selected Sales Snapshot Preview
  const selectedSales = salesPersons.find((s) => s.id === salesPersonId);

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: "row-" + Date.now() + "-" + Math.random(),
        sku: "",
        selectedBrandId: null,
        qty: 1,
        unitPrice: 0,
        amount: 0,
      },
    ]);
  };

  const removeItemRow = (rowId: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((r) => r.id !== rowId));
  };

  const updateItemSku = (rowId: string, sku: string) => {
    const product = products.find((p) => p.sku === sku);
    setItems((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        return {
          ...r,
          sku,
          selectedBrandId: product?.brand_id || r.selectedBrandId,
        };
      }),
    );
  };

  const updateItemQty = (rowId: string, qty: number) => {
    const safeQty = Math.max(1, qty || 1);
    setItems((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        return {
          ...r,
          qty: safeQty,
          amount: safeQty * r.unitPrice,
        };
      }),
    );
  };

  const updateItemUnitPrice = (rowId: string, unitPrice: number) => {
    const safePrice = Math.max(0, unitPrice || 0);
    setItems((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        return {
          ...r,
          unitPrice: safePrice,
          amount: r.qty * safePrice,
        };
      }),
    );
  };

  const totalOrderAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const totalItemCount = items.reduce((sum, item) => sum + item.qty, 0);

  const handleResetForm = () => {
    generateInvoiceNumber();
    setNamaCustomer("");
    setTelepon("");
    setAlamat("");
    setSalesPersonId(null);
    setSalesPersonInput("");
    setChannel(
      availableChannels.length > 0
        ? (availableChannels[0].value as SalesChannel)
        : "Tokopedia",
    );
    setItems([
      {
        id: "row-" + Date.now(),
        sku: "",
        selectedBrandId: null,
        qty: 1,
        unitPrice: 0,
        amount: 0,
      },
    ]);
    setErrorMessage(null);
    setSuccessResult(null);
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessResult(null);

    // Validation
    if (!noInvoice.trim()) {
      setErrorMessage("Nomor Invoice wajib diisi!");
      return;
    }
    if (!namaCustomer.trim()) {
      setErrorMessage("Nama Customer wajib diisi!");
      return;
    }
    // Determine effective sales person
    let effectiveSalesId = salesPersonId;
    if (!effectiveSalesId && salesPersonInput.trim()) {
      const matched = salesPersons.find(
        (s) => s.nama_sales.toLowerCase() === salesPersonInput.trim().toLowerCase(),
      );
      if (matched) {
        effectiveSalesId = matched.id;
        setSalesPersonId(matched.id);
      }
    }

    if (!effectiveSalesId) {
      setErrorMessage("Pilih Sales Person dari daftar terlebih dahulu!");
      return;
    }
    if (items.some((it) => !it.sku)) {
      setErrorMessage("Semua baris item pesanan wajib memilih Produk (SKU)!");
      return;
    }

    const payload: CreateOrderPayload = {
      no_invoice: noInvoice.trim(),
      nama_customer: namaCustomer.trim(),
      no_telepon: telepon.trim() || undefined,
      alamat: alamat.trim() || undefined,
      sales_person_id: effectiveSalesId,
      channel,
      author: userRole || "Admin",
      items: items.map((it) => ({
        sku: it.sku,
        qty: it.qty,
        amount: it.amount,
      })),
    };

    setIsSubmitting(true);
    try {
      if (editingInvoice) {
        await api.updateInvoice(editingInvoice.no_invoice, payload);
      } else {
        await api.createOrder(payload);
      }
      setSuccessResult({
        invoice: noInvoice.trim(),
        itemCount: items.length,
        total: totalOrderAmount,
      });

      if (onOrderCreated) onOrderCreated();

      if (!editingInvoice) {
        // Reset all fields automatically after submit
        generateInvoiceNumber();
        setNamaCustomer("");
        setTelepon("");
        setAlamat("");
        setSalesPersonId(null);
        setSalesPersonInput("");
        setChannel(
          availableChannels.length > 0
            ? (availableChannels[0].value as SalesChannel)
            : "Tokopedia",
        );
        setItems([
          {
            id: "row-" + Date.now(),
            sku: "",
            selectedBrandId: null,
            qty: 1,
            unitPrice: 0,
            amount: 0,
          },
        ]);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal menyimpan pesanan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="w-full space-y-4 animate-in fade-in-50 duration-200"
      id="input-order-form-container"
    >
      {/* Header Info & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Transaksi Penjualan Multi-Channel
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 font-display">
            {entryMode === "manual"
              ? "Form Input Order Manual"
              : "Import Pesanan Excel / CSV"}
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {entryMode === "manual"
              ? "Snapshot Sales & Divisi otomatis terkunci secara permanen pada transaksi di database MongoDB."
              : "Import ribuan invoice multi-channel sekaligus dengan format Excel standard."}
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-2">
          <div className="flex bg-zinc-200/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setEntryMode("manual")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                entryMode === "manual"
                  ? "bg-white text-zinc-900 shadow-2xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Input Manual</span>
            </button>
            <button
              type="button"
              onClick={() => setEntryMode("excel")}
              id="switch-order-excel-tab"
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                entryMode === "excel"
                  ? "bg-white text-zinc-900 shadow-2xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Import Excel</span>
            </button>
          </div>

          {entryMode === "manual" && (
            <button
              type="button"
              onClick={handleResetForm}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {entryMode === "excel" ? (
        <OrderExcelImportView
          products={products}
          salesPersons={salesPersons}
          onImportSuccess={() => {
            if (onOrderCreated) onOrderCreated();
          }}
          onNavigateToGrid={onNavigateToGrid}
        />
      ) : (
        <>
          {/* Success Alert */}
          {successResult && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start justify-between gap-4 animate-in slide-in-from-top-2">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-emerald-900">
                    Order Berhasil Disimpan & Disinkronisasi Real-time!
                  </h4>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    Nomor Invoice <strong>{successResult.invoice}</strong>{" "}
                    berisi{" "}
                    <strong>{successResult.itemCount} baris produk</strong>{" "}
                    dengan total nilai{" "}
                    <strong>{formatRupiah(successResult.total)}</strong>. Data
                    telah diteruskan ke tim gudang.
                  </p>
                </div>
              </div>
              {onNavigateToGrid && (
                <button
                  onClick={onNavigateToGrid}
                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 shrink-0 shadow-2xs"
                >
                  Lihat di Live Grid →
                </button>
              )}
            </div>
          )}

          {/* Error Alert */}
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-900 text-xs animate-in shake">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong>Terjadi Kesalahan:</strong>
                <div>{errorMessage}</div>
              </div>
            </div>
          )}

          {/* Main Form (Widescreen 2-column layout) */}
          <form
            onSubmit={handleSubmitOrder}
            id="order-entry-form"
            className="space-y-4"
          >
            <div className={`grid grid-cols-1 ${compact ? '' : 'xl:grid-cols-12'} gap-4 items-stretch`}>
              {/* Left Column: Form Details & Items */}
              <div className={`${compact ? '' : 'xl:col-span-8'} space-y-4`}>
                {/* Section 1: Header Invoice, Customer, Channel, Sales Snapshot */}
                <div className="bg-white border border-zinc-200/90 rounded-xl shadow-2xs p-5 space-y-5 h-full">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                    <h3 className="font-bold text-sm text-zinc-900 font-display flex items-center gap-2">
                      <Hash className="w-4 h-4 text-zinc-600" />
                      <span>Informasi Nota & Identitas Penjualan</span>
                    </h3>
                    <span className="text-[11px] text-zinc-400">
                      Langkah 1 dari 2
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* No Invoice */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="no-invoice-input"
                        className="block text-xs font-semibold text-zinc-700"
                      >
                        Nomor Invoice <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          id="no-invoice-input"
                          type="text"
                          value={noInvoice}
                          onChange={(e) => setNoInvoice(e.target.value)}
                          placeholder="Contoh: INV-202608-1001"
                          required
                          className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 font-mono font-medium"
                        />
                        <button
                          type="button"
                          onClick={generateInvoiceNumber}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-zinc-600 hover:text-zinc-900 px-2 py-0.5 bg-zinc-100 hover:bg-zinc-200 rounded font-medium border border-zinc-200"
                        >
                          Auto Gen
                        </button>
                      </div>
                      <p className="text-[11px] text-zinc-500">
                        Nomor invoice otomatis dicek unik di database MongoDB.
                      </p>
                    </div>

                    {/* Nama Customer */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="nama-customer-input"
                        className="block text-xs font-semibold text-zinc-700"
                      >
                        Nama Customer / Pembeli{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="nama-customer-input"
                        list="customers-list"
                        type="text"
                        value={namaCustomer}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNamaCustomer(val);
                          // Auto-fill if existing customer is selected
                          const existing = customers.find(
                            (c) =>
                              c.nama_customer.toLowerCase() ===
                              val.toLowerCase(),
                          );
                          if (existing) {
                            if (existing.no_telepon)
                              setTelepon(existing.no_telepon);
                            if (existing.alamat) setAlamat(existing.alamat);
                          }
                        }}
                        placeholder="Contoh: Budi Santoso (Ketik atau pilih dari daftar)"
                        required
                        className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                      />
                      <datalist id="customers-list">
                        {customers.map((c) => (
                          <option key={c.id} value={c.nama_customer}>
                            {c.no_telepon ? `${c.no_telepon} - ` : ""}
                            {c.alamat || ""}
                          </option>
                        ))}
                      </datalist>
                    </div>

                    {/* Telepon Customer */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="telepon-customer-input"
                        className="block text-xs font-semibold text-zinc-700"
                      >
                        No. Telepon / WhatsApp
                      </label>
                      <input
                        id="telepon-customer-input"
                        type="text"
                        value={telepon}
                        onChange={(e) => setTelepon(e.target.value)}
                        placeholder="Contoh: 081234567890"
                        className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 font-mono"
                      />
                    </div>

                    {/* Alamat Customer */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="alamat-customer-input"
                        className="block text-xs font-semibold text-zinc-700"
                      >
                        Alamat Lengkap
                      </label>
                      <textarea
                        id="alamat-customer-input"
                        value={alamat}
                        onChange={(e) => setAlamat(e.target.value)}
                        placeholder="Alamat pengiriman / customer"
                        rows={1}
                        className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 resize-none"
                      />
                    </div>

                    {/* Sales Person Selection (Native HTML5 datalist matching customer input style) */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="sales-person-input"
                        className="block text-xs font-semibold text-zinc-700"
                      >
                        Sales Person <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="sales-person-input"
                        list="sales-persons-list"
                        type="text"
                        value={salesPersonInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSalesPersonInput(val);
                          const matched = salesPersons.find(
                            (s) =>
                              s.nama_sales.toLowerCase() ===
                              val.trim().toLowerCase(),
                          );
                          setSalesPersonId(matched ? matched.id : null);
                        }}
                        placeholder="Contoh: Naufal Abiyyu (Ketik atau pilih dari daftar)"
                        required
                        className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                      />
                      <datalist id="sales-persons-list">
                        {salesPersons.map((s) => (
                          <option key={s.id} value={s.nama_sales}>
                            Divisi: {s.nama_divisi}
                          </option>
                        ))}
                      </datalist>
                      {selectedSales ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium pt-0.5">
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            Sales: <strong>{selectedSales.nama_sales}</strong> • Divisi: {selectedSales.nama_divisi}
                          </span>
                        </div>
                      ) : salesPersonInput.trim() ? (
                        <div className="text-[11px] text-amber-600 pt-0.5">
                          Pilih nama sales dari daftar agar tersambung dengan database divisi.
                        </div>
                      ) : null}
                    </div>

                    {/* Channel Selection */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-zinc-700">
                        Channel Penjualan{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                        {availableChannels.map((ch) => {
                          const isSelected = channel === ch.value;
                          return (
                            <button
                              key={ch.value}
                              type="button"
                              onClick={() =>
                                setChannel(ch.value as SalesChannel)
                              }
                              className={`px-2 py-2 text-xs font-semibold rounded-lg border text-center transition-all ${
                                isSelected
                                  ? "bg-zinc-900 text-white border-zinc-900 shadow-xs"
                                  : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                              }`}
                            >
                              {ch.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Sticky Summary & Action Card */}
              <div className={`${compact ? '' : 'xl:col-span-4'} space-y-4 ${compact ? '' : 'sticky top-20'}`}>
                <div className="bg-white border border-zinc-200/90 rounded-xl shadow-2xs p-5 space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                    <h3 className="font-bold text-sm text-zinc-900 font-display flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-zinc-700" />
                      <span>Ringkasan Nota Pesanan</span>
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      Status: Input Orderan
                    </span>
                  </div>

                  {/* Summary Items Breakdown */}
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between text-zinc-600 pb-1.5 border-b border-zinc-100">
                      <span>Nomor Invoice:</span>
                      <span className="font-mono font-bold text-zinc-900">
                        {noInvoice || "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-600 pb-1.5 border-b border-zinc-100">
                      <span>Customer:</span>
                      <span className="font-semibold text-zinc-900 truncate max-w-[160px]">
                        {namaCustomer || "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-600 pb-1.5 border-b border-zinc-100">
                      <span>Channel:</span>
                      <span className="font-semibold text-zinc-900">
                        {channel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-600 pb-1.5 border-b border-zinc-100">
                      <span>Sales & Divisi:</span>
                      <span className="font-semibold text-zinc-900 text-right truncate max-w-[160px]">
                        {selectedSales
                          ? `${selectedSales.nama_sales} (${selectedSales.nama_divisi})`
                          : "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-600 pb-1.5 border-b border-zinc-100">
                      <span>Total Jenis Produk:</span>
                      <span className="font-bold text-zinc-900 tabular">
                        {items.length} Baris
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-600 pb-1.5 border-b border-zinc-100">
                      <span>Total Unit Fisik:</span>
                      <span className="font-bold text-zinc-900 tabular">
                        {totalItemCount} Pcs
                      </span>
                    </div>
                  </div>

                  {/* Big Grand Total Box */}
                  <div className="p-4 bg-zinc-900 text-white rounded-xl space-y-1">
                    <div className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">
                      Total Nilai Transaksi
                    </div>
                    <div className="text-2xl font-bold font-display tabular tracking-tight">
                      {formatRupiah(totalOrderAmount)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 pt-1">
                    {editingInvoice && onCancelEdit && (
                      <button
                        type="button"
                        onClick={onCancelEdit}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all mb-3"
                      >
                        Batal Edit
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      id="submit-order-button"
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 text-xs font-bold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl shadow-sm transition-all disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {isSubmitting
                          ? "Menyimpan ke MongoDB..."
                          : editingInvoice ? "Simpan Perubahan" : "Simpan Pesanan & Teruskan"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResetForm}
                      className="w-full py-2 px-3 text-xs font-semibold text-zinc-600 hover:text-zinc-900 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-xl transition-colors"
                    >
                      Batal / Reset Input
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Items Table (Multi-item support) */}
            <div className="bg-white border border-zinc-200/90 rounded-xl shadow-2xs p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div>
                  <h3 className="font-bold text-sm text-zinc-900 font-display flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-zinc-600" />
                    <span>
                      Daftar Produk Pesanan ({items.length} Baris Item)
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Tambahkan satu atau beberapa produk dalam 1 invoice yang
                    sama.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addItemRow}
                  id="add-item-row-btn"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg transition-colors shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Tambah Baris</span>
                </button>
              </div>

              <div className="space-y-3">
                {items.map((row, idx) => {
                  const selectedProduct = products.find(
                    (p) => p.sku === row.sku,
                  );
                  return (
                    <div
                      key={row.id}
                      id={`order-item-row-${idx}`}
                      className="p-3 bg-white border border-zinc-200/90 rounded-xl space-y-3 hover:border-zinc-300 transition-colors shadow-2xs"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                        {/* Product Searchable Selection */}
                        <div className="sm:col-span-6 space-y-1">
                          <label className="block text-[11px] text-zinc-600 font-semibold">
                            Pilih Produk / SKU{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <SearchableSelect<Product>
                            items={products}
                            value={row.sku}
                            onChange={(sku) => updateItemSku(row.id, sku)}
                            getId={(p: Product) => p.sku}
                            getLabel={(p: Product) => p.item_name}
                            getSublabel={(p: Product) =>
                              `SKU: ${p.sku} · ${p.nama_brand || "Brand"}`
                            }
                            placeholder="Ketik nama produk atau SKU..."
                          />
                        </div>

                        {/* Quantity */}
                        <div className="sm:col-span-1 space-y-1">
                          <label className="block text-[11px] text-zinc-600 font-medium">
                            Qty
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={row.qty}
                            onChange={(e) =>
                              updateItemQty(
                                row.id,
                                parseInt(e.target.value) || 1,
                              )
                            }
                            className="w-full px-2 py-2 text-sm bg-white border border-zinc-200 rounded-lg text-center font-bold tabular focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                          />
                        </div>

                        {/* Harga (Rp) */}
                        <div className="sm:col-span-2 space-y-1">
                          <label className="block text-[11px] text-zinc-600 font-medium">
                            Harga (Rp){" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={
                              row.unitPrice > 0
                                ? row.unitPrice.toLocaleString("id-ID")
                                : ""
                            }
                            onChange={(e) => {
                              const raw = e.target.value.replace(/\D/g, "");
                              const newUnitPrice = raw ? parseInt(raw, 10) : 0;
                              updateItemUnitPrice(row.id, newUnitPrice);
                            }}
                            placeholder="0"
                            className="w-full px-2 py-2 text-sm bg-white border border-zinc-200 rounded-lg text-right font-bold tabular focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                          />
                        </div>

                        {/* Subtotal & Action */}
                        <div className="sm:col-span-3 space-y-1">
                          <label className="block text-[11px] text-zinc-600 font-medium">
                            Subtotal
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              value={formatRupiah(row.amount)}
                              className="w-full px-2 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg text-right font-bold tabular text-zinc-600 focus:outline-none cursor-not-allowed"
                              tabIndex={-1}
                            />
                            {items.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => removeItemRow(row.id)}
                                className="text-red-500 hover:text-red-700 bg-white hover:bg-red-50 p-2 border border-zinc-200 hover:border-red-200 rounded-lg transition-colors shrink-0 flex items-center justify-center"
                                title="Hapus Baris"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <div className="w-[34px] shrink-0"></div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Info Row */}
                      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-zinc-500 bg-zinc-50 px-3 py-2 rounded-lg border border-zinc-100">
                        {selectedProduct ? (
                          <span className="flex-1 truncate">
                            <span className="w-5 h-5 rounded bg-zinc-200 text-zinc-700 inline-flex items-center justify-center text-[10px] font-bold mr-2">
                              {idx + 1}
                            </span>
                            SKU:{" "}
                            <code className="font-mono font-semibold text-zinc-800">
                              {selectedProduct.sku}
                            </code>
                            <span className="hidden sm:inline">
                              {" "}
                              · {selectedProduct.item_group || "-"} ·{" "}
                              {selectedProduct.category || "-"}
                            </span>
                          </span>
                        ) : (
                          <span className="flex-1 flex items-center gap-2">
                            <span className="w-5 h-5 rounded bg-zinc-200 text-zinc-700 inline-flex items-center justify-center text-[10px] font-bold">
                              {idx + 1}
                            </span>
                            Pilih produk untuk melihat detail
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={addItemRow}
                  className="w-full py-2.5 border-2 border-dashed border-zinc-200 hover:border-zinc-400 rounded-xl text-xs font-semibold text-zinc-600 hover:text-zinc-900 flex items-center justify-center gap-1.5 transition-colors bg-zinc-50/50 hover:bg-zinc-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Tambah Baris Produk Lainnya</span>
                </button>
              </div>
            </div>

            {/* Quick Tips Card */}
            <div className="p-4 bg-zinc-50 border border-zinc-200/80 rounded-xl text-xs space-y-2 text-zinc-600">
              <div className="font-bold text-zinc-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Tips Pengisian Cepat</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Tekan <strong>Auto Gen</strong> untuk membuat nomor invoice
                berurutan otomatis. Produk yang dipilih akan langsung tampil di
                tabel <strong>Live Grid</strong> setelah disimpan.
              </p>
            </div>
          </form>
        </>
      )}
    </div>
  );
};
