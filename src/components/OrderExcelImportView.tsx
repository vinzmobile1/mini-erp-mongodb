import React, { useState, useRef, useMemo } from "react";
import {
  FileSpreadsheet,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  ShoppingBag,
  Sparkles,
  Loader2,
  Check,
  RotateCcw,
  ArrowRight,
  TrendingUp,
  Package,
  Layers,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Columns,
  Search,
} from "lucide-react";
import { SimpleTable, ReactColumnDef, ReactIconsConfig } from "@simple-table/react";
import { downloadOrderTemplate, readExcelFile, parseOrderSheet, ParsedOrderRow } from "../lib/excelUtils";
import { Product, SalesPerson, SalesChannel } from "../types";
import { api, formatRupiah } from "../lib/api";

const simpleTableIcons: ReactIconsConfig = {
  sortUp: <ArrowUp className="w-3.5 h-3.5 text-zinc-700" />,
  sortDown: <ArrowDown className="w-3.5 h-3.5 text-zinc-700" />,
  filter: <Filter className="w-3.5 h-3.5 text-zinc-500" />,
};

interface OrderExcelImportViewProps {
  products: Product[];
  salesPersons: SalesPerson[];
  onImportSuccess?: () => void;
  onNavigateToGrid?: () => void;
}

const CHANNEL_BADGES: Record<SalesChannel, { label: string; class: string }> = {
  Tokopedia: { label: "Tokopedia", class: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  TikTok: { label: "TikTok Shop", class: "text-zinc-900 bg-zinc-100 border-zinc-300" },
  Shopee: { label: "Shopee", class: "text-orange-700 bg-orange-50 border-orange-200" },
  Lazada: { label: "Lazada", class: "text-indigo-700 bg-indigo-50 border-indigo-200" },
  Offline: { label: "Offline Store", class: "text-slate-700 bg-slate-100 border-slate-300" },
};

export const OrderExcelImportView: React.FC<OrderExcelImportViewProps> = ({
  products,
  salesPersons,
  onImportSuccess,
  onNavigateToGrid,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedOrderRow[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultSummary, setResultSummary] = useState<{
    message: string;
    invoices: number;
    items: number;
    amount: number;
    skipped: string[];
    durationMs: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set of product SKUs for validation
  const productSkuSet = new Set(products.map((p) => p.sku.toUpperCase().trim()));

  const previewColumns = useMemo<ReactColumnDef<ParsedOrderRow>[]>(() => [
    {
      accessor: "no_invoice",
      label: "No. Invoice",
      width: 170,
      type: "string",
      cellRenderer: ({ row }) => (
        <span className="font-mono font-bold text-zinc-900 text-xs">{row.no_invoice}</span>
      ),
    },
    {
      accessor: "nama_customer",
      label: "Customer",
      width: 180,
      type: "string",
      cellRenderer: ({ row }) => (
        <span className="text-zinc-800 font-medium text-xs truncate">{row.nama_customer}</span>
      ),
    },
    {
      accessor: "channel",
      label: "Channel",
      width: 130,
      type: "string",
      cellRenderer: ({ row }) => (
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
            CHANNEL_BADGES[row.channel]?.class || "bg-zinc-100 text-zinc-700"
          }`}
        >
          {row.channel}
        </span>
      ),
    },
    {
      accessor: "sku",
      label: "SKU Produk",
      width: 150,
      type: "string",
      cellRenderer: ({ row }) => {
        const isKnownSku = productSkuSet.has(row.sku?.toUpperCase()?.trim());
        return (
          <span
            className={`px-1.5 py-0.5 rounded text-[11px] font-bold font-mono ${
              isKnownSku
                ? "bg-zinc-100 text-zinc-800"
                : "bg-amber-100 text-amber-800 border border-amber-300"
            }`}
            title={isKnownSku ? "SKU Terdaftar" : "SKU Baru"}
          >
            {row.sku}
          </span>
        );
      },
    },
    {
      accessor: "qty",
      label: "Qty",
      width: 70,
      type: "number",
      align: "center",
      cellRenderer: ({ row }) => (
        <span className="font-bold text-zinc-900 text-xs">{row.qty}</span>
      ),
    },
    {
      accessor: "amount",
      label: "Subtotal",
      width: 140,
      type: "number",
      align: "right",
      cellRenderer: ({ row }) => (
        <span className="font-mono font-semibold text-zinc-900 text-xs">
          {formatRupiah(row.amount)}
        </span>
      ),
    },
    {
      accessor: "nama_sales",
      label: "Sales PIC",
      width: 140,
      type: "string",
      cellRenderer: ({ row }) => (
        <span className="text-zinc-600 text-xs">{row.nama_sales || "-"}</span>
      ),
    },
  ], [productSkuSet]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setSelectedFile(file);
    setIsParsing(true);
    setErrorMsg(null);
    setResultSummary(null);

    try {
      const sheets = await readExcelFile(file);
      // Pick first sheet or 'Orders' sheet
      const sheetNames = Object.keys(sheets);
      let targetRows: any[] = [];
      const orderSheetName = sheetNames.find((s) => s.toLowerCase().includes("order") || s.toLowerCase().includes("pesanan"));
      if (orderSheetName) {
        targetRows = sheets[orderSheetName];
      } else if (sheetNames.length > 0) {
        targetRows = sheets[sheetNames[0]];
      }

      const rows = parseOrderSheet(targetRows);
      setParsedRows(rows);

      if (rows.length === 0) {
        setErrorMsg("Tidak ada baris data order yang terdeteksi. Pastikan kolom memiliki header seperti no_invoice, nama_customer, channel, sku, qty, amount.");
      }
    } catch (err: any) {
      console.error("Parse order excel error:", err);
      setErrorMsg(`Gagal membaca file: ${err.message || String(err)}`);
    } finally {
      setIsParsing(false);
    }
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;
    setIsUploading(true);
    setErrorMsg(null);
    setUploadProgress("Mempersiapkan data order...");

    try {
      const CHUNK_SIZE = 1200;
      let totalInvoices = 0;
      let totalItems = 0;
      let totalAmount = 0;
      const allSkipped: string[] = [];
      let totalDuration = 0;

      if (parsedRows.length <= CHUNK_SIZE) {
        setUploadProgress("Menyimpan data order ke database...");
        const res = await api.importOrders({
          orders: parsedRows,
          skipDuplicateInvoice: skipDuplicates,
        });
        totalInvoices = res.importedInvoicesCount;
        totalItems = res.importedItemsCount;
        totalAmount = res.totalImportedAmount;
        if (res.skippedInvoices) allSkipped.push(...res.skippedInvoices);
        totalDuration = res.durationMs;
      } else {
        const totalBatches = Math.ceil(parsedRows.length / CHUNK_SIZE);
        for (let b = 0; b < totalBatches; b++) {
          const startIdx = b * CHUNK_SIZE;
          const endIdx = Math.min(parsedRows.length, (b + 1) * CHUNK_SIZE);
          const chunkRows = parsedRows.slice(startIdx, endIdx);

          setUploadProgress(
            `Mengimpor batch ${b + 1} dari ${totalBatches} (${startIdx + 1} - ${endIdx} dari ${parsedRows.length} item order)...`
          );

          const res = await api.importOrders({
            orders: chunkRows,
            skipDuplicateInvoice: skipDuplicates,
          });

          totalInvoices += res.importedInvoicesCount;
          totalItems += res.importedItemsCount;
          totalAmount += res.totalImportedAmount;
          if (res.skippedInvoices) allSkipped.push(...res.skippedInvoices);
          totalDuration += res.durationMs;
        }
      }

      setResultSummary({
        message: `Berhasil mengimport ${totalInvoices} invoice (${totalItems} item produk) dalam ${(totalDuration / 1000).toFixed(2)} detik!`,
        invoices: totalInvoices,
        items: totalItems,
        amount: totalAmount,
        skipped: allSkipped,
        durationMs: totalDuration,
      });

      if (onImportSuccess) onImportSuccess();
    } catch (err: any) {
      console.error("Import orders error:", err);
      setErrorMsg(`Gagal memproses import data order: ${err.message || String(err)}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setParsedRows([]);
    setErrorMsg(null);
    setResultSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Group stats
  const uniqueInvoices = Array.from(new Set(parsedRows.map((r) => r.no_invoice)));
  const totalAmount = parsedRows.reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalPcs = parsedRows.reduce((sum, r) => sum + (r.qty || 1), 0);

  // Channel breakdown
  const channelCounts: Record<string, number> = {};
  for (const r of parsedRows) {
    channelCounts[r.channel] = (channelCounts[r.channel] || 0) + 1;
  }

  // Missing SKU count
  const missingSkuRows = parsedRows.filter((r) => !productSkuSet.has(r.sku));

  return (
    <div className="space-y-6" id="order-excel-import-panel">
      {/* Step 1 & Info Header */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-700 border border-orange-200/80 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-zinc-900 font-display">
                Import Order Multi-Channel (Excel / CSV)
              </h2>
              <p className="text-xs text-zinc-500">
                Impor pesanan massal dari TikTok Shop, Tokopedia, Shopee, Lazada, & Offline Store sekaligus.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={downloadOrderTemplate}
            id="download-order-template-btn"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors shadow-2xs shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Download Template Excel Pesanan (.xlsx)</span>
          </button>
        </div>

        {/* Multi-Channel Quick Specs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
          {Object.entries(CHANNEL_BADGES).map(([ch, info]) => (
            <div
              key={ch}
              className={`p-2.5 rounded-xl border text-center text-xs font-semibold ${info.class}`}
            >
              <div className="text-[10px] uppercase font-bold text-zinc-500">Channel</div>
              <div>{info.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Step 2: Upload Area or Data Preview */}
      {!selectedFile ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-zinc-300 hover:border-orange-500 bg-white hover:bg-orange-50/20 rounded-2xl p-10 text-center cursor-pointer transition-all space-y-4 shadow-2xs"
        >
          <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 mx-auto flex items-center justify-center border border-orange-200">
            <UploadCloud className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-zinc-900 font-display">
              Pilih atau Seret File Excel Order ke Sini
            </h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Format yang didukung: <strong>.xlsx</strong>, <strong>.xls</strong>, atau <strong>.csv</strong>. 
              Sistem akan otomatis mengenali nomor resi / invoice multi-item.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* File Selected Header Card */}
          <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs font-mono">
                  XLS
                </div>
                <div>
                  <div className="font-bold text-sm text-zinc-900">{selectedFile.name}</div>
                  <div className="text-xs text-zinc-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB · Berisi {parsedRows.length} item pesanan
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 w-4 h-4"
                  />
                  <span>Lewati jika nomor invoice sudah ada di database</span>
                </label>

                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 font-semibold hover:bg-red-50 rounded-lg transition-colors"
                >
                  Ganti File
                </button>
              </div>
            </div>

            {/* Metrics Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-xl">
                <div className="text-[11px] font-semibold text-zinc-500">Total Invoice / Nota</div>
                <div className="text-xl font-bold text-zinc-900 font-display">
                  {uniqueInvoices.length} <span className="text-xs font-normal text-zinc-500">Nota</span>
                </div>
              </div>

              <div className="p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-xl">
                <div className="text-[11px] font-semibold text-zinc-500">Total Unit Fisik</div>
                <div className="text-xl font-bold text-zinc-900 font-display">
                  {totalPcs} <span className="text-xs font-normal text-zinc-500">Pcs</span>
                </div>
              </div>

              <div className="p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-xl">
                <div className="text-[11px] font-semibold text-zinc-500">Total Nilai Transaksi</div>
                <div className="text-lg font-bold text-emerald-700 font-display truncate">
                  {formatRupiah(totalAmount)}
                </div>
              </div>

              <div className="p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-xl">
                <div className="text-[11px] font-semibold text-zinc-500">Status SKU Terdaftar</div>
                <div className="text-xs font-bold flex items-center gap-1.5 mt-1">
                  {missingSkuRows.length === 0 ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 100% SKU Terdaftar
                    </span>
                  ) : (
                    <span className="text-amber-700 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {missingSkuRows.length} SKU Baru (Auto-Link)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Upload Progress */}
            {isUploading && uploadProgress && (
              <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2.5 text-xs font-bold text-emerald-900">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
                  <span>{uploadProgress}</span>
                </div>
                <div className="w-full bg-emerald-200/60 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-emerald-600 h-1.5 rounded-full animate-pulse w-full"></div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-xs text-red-800">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Terjadi Kesalahan:</strong>
                  <span>{errorMsg}</span>
                </div>
              </div>
            )}

            {/* Success Summary */}
            {resultSummary && (
              <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-4">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm font-display">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>{resultSummary.message}</span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-200/80">
                    <span className="text-zinc-500 block text-[10px]">Invoice Tersimpan:</span>
                    <strong className="text-zinc-900 text-sm font-display">{resultSummary.invoices} Nota</strong>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-200/80">
                    <span className="text-zinc-500 block text-[10px]">Total Item Produk:</span>
                    <strong className="text-zinc-900 text-sm font-display">{resultSummary.items} Item</strong>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-200/80">
                    <span className="text-zinc-500 block text-[10px]">Total Omset:</span>
                    <strong className="text-emerald-700 text-sm font-display">{formatRupiah(resultSummary.amount)}</strong>
                  </div>
                </div>

                {resultSummary.skipped.length > 0 && (
                  <div className="text-[11px] text-zinc-600">
                    <span className="font-semibold text-amber-700">Dilewati ({resultSummary.skipped.length} invoice duplikat):</span>{" "}
                    {resultSummary.skipped.slice(0, 5).join(", ")}
                    {resultSummary.skipped.length > 5 ? "..." : ""}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  {onNavigateToGrid && (
                    <button
                      type="button"
                      onClick={onNavigateToGrid}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors shadow-2xs"
                    >
                      <span>Buka di Live Grid Admin</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Table Preview */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs text-zinc-600 font-semibold">
                <span>Pratinjau Data Order ({parsedRows.length} Baris):</span>
                <span className="text-[11px] text-zinc-400">Menampilkan seluruh baris import</span>
              </div>

              <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-2xs">
                <SimpleTable<ParsedOrderRow>
                  rows={parsedRows}
                  columns={previewColumns}
                  theme="custom"
                  customTheme={{ rowHeight: 40, headerHeight: 36 }}
                  height="340px"
                  getRowId={({ index }) => String(index)}
                  columnResizing={true}
                  columnReordering={true}
                  autoExpandColumns={true}
                  icons={simpleTableIcons}
                  hoverRowBackground={true}
                  oddEvenRowBackground={true}
                />
              </div>
            </div>

            {/* Bottom Action Button */}
            {!resultSummary && (
              <div className="pt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={isUploading || parsedRows.length === 0}
                  id="execute-import-order-btn"
                  className="flex items-center gap-2 px-6 py-3 text-xs font-bold text-white bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 rounded-xl transition-all shadow-sm disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan ke Database MongoDB...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Simpan & Import {uniqueInvoices.length} Invoice ({parsedRows.length} Item)</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
