import React, { useState, useRef, useMemo } from "react";
import {
  X,
  FileSpreadsheet,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ShoppingBag,
  Users,
  Building2,
  Tag,
  FolderTree,
  ArrowRight,
  Loader2,
  Check,
} from "lucide-react";
import { SimpleTable, ReactColumnDef } from "@simple-table/react";
import {
  downloadAllMasterTemplate,
  downloadSingleMasterTemplate,
  readExcelFile,
  parseMasterDataSheets,
  MasterExcelTemplateData,
} from "../lib/excelUtils";
import { api } from "../lib/api";

interface MasterExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultTab?: "all" | "divisi" | "sales_person" | "brand" | "item_group" | "category" | "products" | "channel" | "customers";
}

export const MasterExcelImportModal: React.FC<MasterExcelImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultTab = "all",
}) => {
  const [activeTab, setActiveTab] = useState<"all" | "single">(
    defaultTab === "all" ? "all" : "single"
  );
  const [singleType, setSingleType] = useState<
    "divisi" | "sales_person" | "brand" | "item_group" | "category" | "products" | "channel" | "customers"
  >(defaultTab === "all" ? "products" : (defaultTab as any));

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<MasterExcelTemplateData | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultSummary, setResultSummary] = useState<{
    message: string;
    counts: any;
    durationMs: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewProductColumns = useMemo<ReactColumnDef<any>[]>(() => [
    {
      accessor: "sku",
      label: "SKU",
      width: 140,
      type: "string",
      cellRenderer: ({ row }) => (
        <span className="font-mono font-bold text-zinc-900 text-xs">{row.sku}</span>
      ),
    },
    {
      accessor: "item_name",
      label: "Nama Produk",
      width: 220,
      type: "string",
      cellRenderer: ({ row }) => (
        <span className="text-zinc-800 text-xs truncate">{row.item_name}</span>
      ),
    },
    {
      accessor: "nama_brand",
      label: "Brand",
      width: 130,
      type: "string",
      cellRenderer: ({ row }) => (
        <span className="text-zinc-600 text-xs">{row.nama_brand || "-"}</span>
      ),
    },
    {
      accessor: "item_group",
      label: "Group",
      width: 130,
      type: "string",
      cellRenderer: ({ row }) => (
        <span className="text-zinc-600 text-xs">{row.item_group || "-"}</span>
      ),
    },
    {
      accessor: "category",
      label: "Kategori",
      width: 130,
      type: "string",
      cellRenderer: ({ row }) => (
        <span className="text-zinc-600 text-xs">{row.category || "-"}</span>
      ),
    },
  ], []);

  if (!isOpen) return null;

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
      const data = parseMasterDataSheets(sheets);
      setParsedData(data);

      const totalRows =
        (data.divisi?.length || 0) +
        (data.sales_person?.length || 0) +
        (data.brand?.length || 0) +
        (data.item_group?.length || 0) +
        (data.category?.length || 0) +
        (data.channel?.length || 0) +
        (data.customers?.length || 0) +
        (data.products?.length || 0);

      if (totalRows === 0) {
        setErrorMsg("Tidak ada data master yang terdeteksi dari file ini. Pastikan nama kolom atau sheet sesuai dengan template Excel.");
      }
    } catch (err: any) {
      console.error("Error reading excel file:", err);
      setErrorMsg(`Gagal membaca file Excel: ${err.message || String(err)}`);
    } finally {
      setIsParsing(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!parsedData) return;
    setIsUploading(true);
    setErrorMsg(null);
    setUploadProgress("Mempersiapkan data untuk diproses...");

    try {
      const allProducts = parsedData.products || [];
      const CHUNK_SIZE = 1500;

      let aggregatedCounts = {
        divisi: 0,
        sales_person: 0,
        brand: 0,
        item_group: 0,
        category: 0,
        channel: 0,
        order_status: 0,
        customers: 0,
        products: 0,
      };
      let totalDuration = 0;

      if (allProducts.length <= CHUNK_SIZE) {
        setUploadProgress("Mengunggah dan menyimpan data ke database...");
        const res = await api.importMasterData(parsedData);
        aggregatedCounts = res.counts;
        totalDuration = res.durationMs;
      } else {
        const totalBatches = Math.ceil(allProducts.length / CHUNK_SIZE);
        for (let b = 0; b < totalBatches; b++) {
          const startIdx = b * CHUNK_SIZE;
          const endIdx = Math.min(allProducts.length, (b + 1) * CHUNK_SIZE);
          const chunkProducts = allProducts.slice(startIdx, endIdx);

          setUploadProgress(
            `Mengimpor batch ${b + 1} dari ${totalBatches} (${startIdx + 1} - ${endIdx} dari ${allProducts.length} produk)...`
          );

          const payload: MasterExcelTemplateData = {
            divisi: b === 0 ? parsedData.divisi : [],
            sales_person: b === 0 ? parsedData.sales_person : [],
            brand: b === 0 ? parsedData.brand : [],
            item_group: b === 0 ? parsedData.item_group : [],
            category: b === 0 ? parsedData.category : [],
            channel: b === 0 ? parsedData.channel : [],
            order_status: b === 0 ? parsedData.order_status : [],
            customers: b === 0 ? parsedData.customers : [],
            products: chunkProducts,
          };

          const res = await api.importMasterData(payload);
          if (b === 0) {
            aggregatedCounts.divisi = res.counts.divisi || 0;
            aggregatedCounts.sales_person = res.counts.sales_person || 0;
            aggregatedCounts.brand = res.counts.brand || 0;
            aggregatedCounts.item_group = res.counts.item_group || 0;
            aggregatedCounts.category = res.counts.category || 0;
            aggregatedCounts.channel = res.counts.channel || 0;
            aggregatedCounts.order_status = res.counts.order_status || 0;
            aggregatedCounts.customers = res.counts.customers || 0;
          }
          aggregatedCounts.products += res.counts.products || 0;
          totalDuration += res.durationMs;
        }
      }

      setResultSummary({
        message: `Import master data berhasil (${aggregatedCounts.products} produk, ${aggregatedCounts.customers} pelanggan) diselesaikan dalam ${(totalDuration / 1000).toFixed(2)} detik.`,
        counts: aggregatedCounts,
        durationMs: totalDuration,
      });
      onSuccess();
    } catch (err: any) {
      console.error("Import Error:", err);
      setErrorMsg(`Gagal memproses import data: ${err.message || String(err)}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setParsedData(null);
    setErrorMsg(null);
    setResultSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const totalDetectedProducts = parsedData?.products?.length || 0;
  const totalDetectedDivisi = parsedData?.divisi?.length || 0;
  const totalDetectedSales = parsedData?.sales_person?.length || 0;
  const totalDetectedBrand = parsedData?.brand?.length || 0;
  const totalDetectedGroup = parsedData?.item_group?.length || 0;
  const totalDetectedCategory = parsedData?.category?.length || 0;
  const totalDetectedChannel = parsedData?.channel?.length || 0;
  const totalDetectedStatus = parsedData?.order_status?.length || 0;
  const totalDetectedCustomers = parsedData?.customers?.length || 0;

  const grandTotalDetected =
    totalDetectedProducts +
    totalDetectedDivisi +
    totalDetectedSales +
    totalDetectedBrand +
    totalDetectedGroup +
    totalDetectedCategory +
    totalDetectedChannel +
    totalDetectedStatus +
    totalDetectedCustomers;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-100 bg-zinc-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-zinc-900 font-display">
                Import Master Data dari Excel
              </h2>
              <p className="text-xs text-zinc-500">
                Mendukung upload massal hingga ribuan data SKU, Divisi, Sales, Brand, Group & Kategori.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Step 1: Download Templates */}
          <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-zinc-700" />
                <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  Langkah 1: Unduh File Template Excel
                </h4>
              </div>
              <span className="text-[11px] text-zinc-500">Format .xlsx siap pakai</span>
            </div>

            <p className="text-xs text-zinc-600">
              Gunakan format kolom yang telah disesuaikan dengan skema database MongoDB agar import berjalan otomatis tanpa error.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={downloadAllMasterTemplate}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Template All-in-One (6 Sheet)</span>
              </button>

              <button
                type="button"
                onClick={() => downloadSingleMasterTemplate("products")}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-lg transition-colors"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-zinc-500" />
                <span>Template Khusus 7000 SKU</span>
              </button>

              <button
                type="button"
                onClick={() => downloadSingleMasterTemplate("sales_person")}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-lg transition-colors"
              >
                <Users className="w-3.5 h-3.5 text-zinc-500" />
                <span>Template Sales</span>
              </button>

              <button
                type="button"
                onClick={() => downloadSingleMasterTemplate("customer")}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-lg transition-colors"
              >
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                <span>Template Customers</span>
              </button>
            </div>
          </div>

          {/* Step 2: Upload Area */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-zinc-700" />
              <span>Langkah 2: Pilih atau Tarik File Excel (.xlsx / .csv)</span>
            </h4>

            {!selectedFile ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-300 hover:border-emerald-600 bg-zinc-50/50 hover:bg-emerald-50/20 rounded-2xl p-8 text-center cursor-pointer transition-all space-y-3"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 mx-auto flex items-center justify-center border border-emerald-200">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-zinc-900">
                    Klik untuk memilih file atau seret file ke sini
                  </p>
                  <p className="text-xs text-zinc-500">
                    Mendukung file .xlsx, .xls, atau .csv (Ukuran maksimal hingga puluhan ribu baris)
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
              <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs font-mono">
                      XLS
                    </div>
                    <div>
                      <div className="font-bold text-xs text-zinc-900">{selectedFile.name}</div>
                      <div className="text-[11px] text-zinc-500">
                        {(selectedFile.size / 1024).toFixed(1)} KB · Siap di-import
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs text-red-600 hover:text-red-700 font-semibold px-2 py-1 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Ganti File
                  </button>
                </div>

                {isParsing && (
                  <div className="py-6 text-center space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mx-auto" />
                    <p className="text-xs text-zinc-500">Menganalisis lembar kerja Excel...</p>
                  </div>
                )}

                {/* Parsed Inspection Matrix */}
                {!isParsing && parsedData && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-700">Ringkasan Data Terdeteksi:</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Total {grandTotalDetected} Baris
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <div className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="w-4 h-4 text-emerald-600" />
                          <span className="text-xs font-medium text-zinc-700">Produk (SKU)</span>
                        </div>
                        <span className="text-sm font-bold text-zinc-900 font-mono">
                          {totalDetectedProducts}
                        </span>
                      </div>

                      <div className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-blue-600" />
                          <span className="text-xs font-medium text-zinc-700">Brand</span>
                        </div>
                        <span className="text-sm font-bold text-zinc-900 font-mono">
                          {totalDetectedBrand}
                        </span>
                      </div>

                      <div className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-purple-600" />
                          <span className="text-xs font-medium text-zinc-700">Group</span>
                        </div>
                        <span className="text-sm font-bold text-zinc-900 font-mono">
                          {totalDetectedGroup}
                        </span>
                      </div>

                      <div className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FolderTree className="w-4 h-4 text-amber-600" />
                          <span className="text-xs font-medium text-zinc-700">Kategori</span>
                        </div>
                        <span className="text-sm font-bold text-zinc-900 font-mono">
                          {totalDetectedCategory}
                        </span>
                      </div>

                      <div className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-cyan-600" />
                          <span className="text-xs font-medium text-zinc-700">Divisi</span>
                        </div>
                        <span className="text-sm font-bold text-zinc-900 font-mono">
                          {totalDetectedDivisi}
                        </span>
                      </div>

                      <div className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-rose-600" />
                          <span className="text-xs font-medium text-zinc-700">Sales Person</span>
                        </div>
                        <span className="text-sm font-bold text-zinc-900 font-mono">
                          {totalDetectedSales}
                        </span>
                      </div>

                      <div className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-emerald-600" />
                          <span className="text-xs font-medium text-zinc-700">Customers</span>
                        </div>
                        <span className="text-sm font-bold text-zinc-900 font-mono">
                          {totalDetectedCustomers}
                        </span>
                      </div>

                      <div className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-teal-600" />
                          <span className="text-xs font-medium text-zinc-700">Channel</span>
                        </div>
                        <span className="text-sm font-bold text-zinc-900 font-mono">
                          {totalDetectedChannel}
                        </span>
                      </div>

                      <div className="p-3 bg-zinc-50 border border-zinc-200/80 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-orange-600" />
                          <span className="text-xs font-medium text-zinc-700">Status Nota</span>
                        </div>
                        <span className="text-sm font-bold text-zinc-900 font-mono">
                          {totalDetectedStatus}
                        </span>
                      </div>
                    </div>

                    {/* Preview Table of Products */}
                    {totalDetectedProducts > 0 && (
                      <div className="space-y-1.5 pt-2">
                        <div className="text-[11px] font-semibold text-zinc-500">
                          Pratinjau Data Produk ({parsedData.products?.length} Produk):
                        </div>
                        <div className="border border-zinc-200 rounded-lg overflow-hidden">
                          <SimpleTable<any>
                            rows={parsedData.products || []}
                            columns={previewProductColumns}
                            theme="custom"
                            customTheme={{ rowHeight: 38, headerHeight: 34 }}
                            height="180px"
                            getRowId={({ index }) => String(index)}
                            columnResizing={true}
                            columnReordering={true}
                            autoExpandColumns={true}
                            hoverRowBackground={true}
                            oddEvenRowBackground={true}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Upload Progress Indicator */}
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
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm font-display">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Import Selesai dengan Sukses!</span>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                {resultSummary.message}
              </p>
              <div className="flex flex-wrap gap-2 text-[11px]">
                {resultSummary.counts.products > 0 && (
                  <span className="px-2.5 py-1 rounded-md bg-emerald-200/60 font-semibold text-emerald-900">
                    +{resultSummary.counts.products} Produk
                  </span>
                )}
                {resultSummary.counts.brand > 0 && (
                  <span className="px-2.5 py-1 rounded-md bg-emerald-200/60 font-semibold text-emerald-900">
                    +{resultSummary.counts.brand} Brand
                  </span>
                )}
                {resultSummary.counts.item_group > 0 && (
                  <span className="px-2.5 py-1 rounded-md bg-emerald-200/60 font-semibold text-emerald-900">
                    +{resultSummary.counts.item_group} Group
                  </span>
                )}
                {resultSummary.counts.category > 0 && (
                  <span className="px-2.5 py-1 rounded-md bg-emerald-200/60 font-semibold text-emerald-900">
                    +{resultSummary.counts.category} Kategori
                  </span>
                )}
                {resultSummary.counts.divisi > 0 && (
                  <span className="px-2.5 py-1 rounded-md bg-emerald-200/60 font-semibold text-emerald-900">
                    +{resultSummary.counts.divisi} Divisi
                  </span>
                )}
                {resultSummary.counts.sales_person > 0 && (
                  <span className="px-2.5 py-1 rounded-md bg-emerald-200/60 font-semibold text-emerald-900">
                    +{resultSummary.counts.sales_person} Sales
                  </span>
                )}
                {resultSummary.counts.customers > 0 && (
                  <span className="px-2.5 py-1 rounded-md bg-emerald-200/60 font-semibold text-emerald-900">
                    +{resultSummary.counts.customers} Pelanggan
                  </span>
                )}
                {resultSummary.counts.channel > 0 && (
                  <span className="px-2.5 py-1 rounded-md bg-emerald-200/60 font-semibold text-emerald-900">
                    +{resultSummary.counts.channel} Channel
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-zinc-100 bg-zinc-50/60 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-semibold text-zinc-700 hover:text-zinc-900 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-xl transition-colors"
          >
            {resultSummary ? "Tutup" : "Batal"}
          </button>

          <div className="flex items-center gap-2">
            {!resultSummary ? (
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={!parsedData || grandTotalDetected === 0 || isUploading || isParsing}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 rounded-xl transition-all shadow-sm disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ke Database...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Import {grandTotalDetected} Data Sekarang</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors shadow-2xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Selesai & Lihat Data</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
