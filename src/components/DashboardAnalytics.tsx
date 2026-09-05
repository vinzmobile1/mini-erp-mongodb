import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  Package,
  Clock,
  CheckCircle,
  ShoppingBag,
  ArrowUpRight,
  UserCheck,
  RefreshCw,
  Plus,
  Calendar,
  XCircle,
  RotateCcw,
  BarChart3,
  Hash,
  Layers,
  ChevronRight,
  Filter,
  TableProperties,
} from "lucide-react";
import { AnalyticsSummary, OrderStatus, SalesChannel, DailySalesStat, Channel, OrderStatusMaster } from "../types";
import { formatRupiah, formatDate, getJakartaDateString } from "../lib/api";
import { getChannelColor, getStatusColor, getDynamicBadgeStyle } from "../lib/colorUtils";

interface DashboardAnalyticsProps {
  summary: AnalyticsSummary | null;
  loading: boolean;
  onRefresh: () => void;
  onNavigate: (tab: string) => void;
  onFilterChange?: (params: { range: string; start_date?: string; end_date?: string }) => void;
  channels?: Channel[];
  orderStatuses?: OrderStatusMaster[];
}

type DailyMetricType = "omset" | "qty" | "jumlah_nota";

export const DashboardAnalytics: React.FC<DashboardAnalyticsProps> = ({
  summary,
  loading,
  onRefresh,
  onNavigate,
  onFilterChange,
  channels,
  orderStatuses,
}) => {
  // Date Range State
  const [selectedRange, setSelectedRange] = useState<string>("this_month");
  const [startDate, setStartDate] = useState<string>(() => {
    const todayJakarta = getJakartaDateString();
    const [y, m] = todayJakarta.split("-");
    return `${y}-${m}-01`;
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return getJakartaDateString();
  });
  const [showCustomPicker, setShowCustomPicker] = useState<boolean>(false);
  const [activeCustomRangeLabel, setActiveCustomRangeLabel] = useState<string | null>(null);

  // Daily Sales Metric Switcher (Omset vs Qty vs Jumlah Nota)
  const [dailyMetric, setDailyMetric] = useState<DailyMetricType>("omset");
  const [hoveredDailyIndex, setHoveredDailyIndex] = useState<number | null>(null);

  const handleRangeSelect = (range: string) => {
    setSelectedRange(range);
    if (range === "custom") {
      setShowCustomPicker(true);
      if (startDate && endDate) {
        onFilterChange?.({ range: "custom", start_date: startDate, end_date: endDate });
        setActiveCustomRangeLabel(`${formatDate(startDate)} - ${formatDate(endDate)}`);
      }
    } else {
      setShowCustomPicker(false);
      setActiveCustomRangeLabel(null);
      onFilterChange?.({ range });
    }
  };

  const handleApplyCustomDate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!startDate || !endDate) {
      alert("Harap pilih tanggal mulai dan tanggal akhir.");
      return;
    }
    if (startDate > endDate) {
      alert("Tanggal mulai tidak boleh lebih besar dari tanggal akhir.");
      return;
    }
    setSelectedRange("custom");
    setActiveCustomRangeLabel(`${formatDate(startDate)} - ${formatDate(endDate)}`);
    onFilterChange?.({
      range: "custom",
      start_date: startDate,
      end_date: endDate,
    });
  };

  const getTodayCount = (status: OrderStatus) => {
    if (!summary?.today_by_status) return 0;
    const found = summary.today_by_status.find((s) => s.status === status);
    return found ? found.count : 0;
  };

  const getOverallCount = (status: OrderStatus) => {
    if (!summary?.per_status) return 0;
    const found = summary.per_status.find((s) => s.status === status);
    return found ? found.count : 0;
  };

  const sortedChannels = useMemo(() => {
    if (!summary?.per_channel) return [];
    return [...summary.per_channel].sort((a, b) => b.total_amount - a.total_amount);
  }, [summary?.per_channel]);

  const maxChannelAmount = sortedChannels.length
    ? Math.max(...sortedChannels.map((c) => c.total_amount), 1)
    : 1;

  // Daily Sales data strictly bounded to selected date range
  const dailySales: DailySalesStat[] = useMemo(() => {
    let list = summary?.daily_sales || [];
    if (selectedRange === "custom" && startDate && endDate) {
      list = list.filter((d) => d.date >= startDate && d.date <= endDate);
    }
    return list;
  }, [summary?.daily_sales, selectedRange, startDate, endDate]);
  const maxDailyValue = dailySales.length
    ? Math.max(...dailySales.map((d) => (dailyMetric === "omset" ? d.omset : dailyMetric === "qty" ? d.qty : d.jumlah_nota)), 1)
    : 1;

  const totalDailyMetricSum = dailySales.reduce(
    (acc, curr) => acc + (dailyMetric === "omset" ? curr.omset : dailyMetric === "qty" ? curr.qty : curr.jumlah_nota),
    0
  );

  const avgDailyMetric = dailySales.length > 0 ? totalDailyMetricSum / dailySales.length : 0;

  const formatDailyDateLabel = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0));
        return new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Jakarta",
          weekday: "short",
          day: "numeric",
          month: "short",
        }).format(d);
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200" id="dashboard-analytics-view">
      {/* Top Controls: Header + Date Range Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-2xs">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Real-Time Intelligence & Reporting
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 font-display">
            Dashboard Analytics Penjualan
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Perhitungan akurat per Nota Unik (Invoice), Multi-Item, dan sinkronisasi live MongoDB Atlas.
          </p>
        </div>

        {/* Date Range Selector Pill Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex bg-zinc-100 p-1 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-700">
            <button
              type="button"
              id="filter-range-7days"
              onClick={() => handleRangeSelect("7days")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedRange === "7days"
                  ? "bg-zinc-900 text-white shadow-xs"
                  : "hover:text-zinc-900 hover:bg-zinc-200/60"
              }`}
            >
              7 Hari
            </button>
            <button
              type="button"
              id="filter-range-this-month"
              onClick={() => handleRangeSelect("this_month")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedRange === "this_month"
                  ? "bg-zinc-900 text-white shadow-xs"
                  : "hover:text-zinc-900 hover:bg-zinc-200/60"
              }`}
            >
              Bulan Ini
            </button>
            <button
              type="button"
              id="filter-range-last-month"
              onClick={() => handleRangeSelect("last_month")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedRange === "last_month"
                  ? "bg-zinc-900 text-white shadow-xs"
                  : "hover:text-zinc-900 hover:bg-zinc-200/60"
              }`}
            >
              Bulan Lalu
            </button>
            <button
              type="button"
              id="filter-range-30days"
              onClick={() => handleRangeSelect("30days")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedRange === "30days"
                  ? "bg-zinc-900 text-white shadow-xs"
                  : "hover:text-zinc-900 hover:bg-zinc-200/60"
              }`}
            >
              30 Hari
            </button>
            <button
              type="button"
              id="filter-range-custom"
              onClick={() => handleRangeSelect("custom")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                selectedRange === "custom"
                  ? "bg-zinc-900 text-white shadow-xs"
                  : "hover:text-zinc-900 hover:bg-zinc-200/60"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Custom Date</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            id="refresh-analytics-btn"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-xl shadow-2xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Custom Date Form (Drawer / Bar) */}
      {showCustomPicker && (
        <form
          onSubmit={handleApplyCustomDate}
          className="p-4 bg-zinc-900 text-white rounded-2xl flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-200 shadow-md text-xs border border-zinc-800"
          id="custom-date-filter-form"
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 font-bold text-amber-400">
              <Calendar className="w-4 h-4" />
              <span>Pilih Rentang Tanggal Custom:</span>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-zinc-300 font-medium">Dari:</label>
              <input
                type="date"
                id="custom-start-date-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="bg-zinc-800 border border-zinc-700 text-white px-2.5 py-1.5 rounded-lg text-xs focus:ring-1 focus:ring-amber-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-zinc-300 font-medium">Sampai:</label>
              <input
                type="date"
                id="custom-end-date-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="bg-zinc-800 border border-zinc-700 text-white px-2.5 py-1.5 rounded-lg text-xs focus:ring-1 focus:ring-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {activeCustomRangeLabel && (
              <span className="text-[11px] text-zinc-400 bg-zinc-800 px-2.5 py-1 rounded-lg border border-zinc-700">
                Aktif: <strong className="text-amber-300">{activeCustomRangeLabel}</strong>
              </span>
            )}
            <button
              type="submit"
              id="apply-custom-date-btn"
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 font-bold text-zinc-950 rounded-lg transition-colors shadow-xs"
            >
              Terapkan Filter
            </button>
          </div>
        </form>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" id="kpi-cards-grid">
        {/* Total Omset */}
        <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-2xs space-y-3" id="kpi-total-revenue">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Total Omset (Periode)
            </span>
            <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-zinc-900 tabular font-display">
              {formatRupiah(summary?.total_revenue || 0)}
            </div>
            <div className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
              <strong className="text-zinc-800 tabular">{summary?.total_orders || 0}</strong> unique nota (
              <span className="tabular">{summary?.total_items_sold || 0}</span> pcs terjual)
            </div>
          </div>
        </div>

        {/* Input Orderan */}
        <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-2xs space-y-3" id="kpi-input-orderan">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
              Input Orderan
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-amber-600 tabular font-display">
              {getOverallCount("Input Orderan")} <span className="text-xs font-normal text-zinc-500">nota</span>
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              Hari ini: <strong className="text-zinc-700 tabular">{getTodayCount("Input Orderan")}</strong> nota masuk
            </div>
          </div>
        </div>

        {/* Diproses */}
        <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-2xs space-y-3" id="kpi-diproses">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
              Diproses Gudang
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-blue-600 tabular font-display">
              {getOverallCount("Diproses")} <span className="text-xs font-normal text-zinc-500">nota</span>
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              Hari ini: <strong className="text-zinc-700 tabular">{getTodayCount("Diproses")}</strong> nota dipacking
            </div>
          </div>
        </div>

        {/* Selesai Packing */}
        <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-2xs space-y-3" id="kpi-selesai-packing">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
              Selesai Packing
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-emerald-600 tabular font-display">
              {getOverallCount("Selesai Packing")} <span className="text-xs font-normal text-zinc-500">nota</span>
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              Hari ini: <strong className="text-zinc-700 tabular">{getTodayCount("Selesai Packing")}</strong> nota siap kirim
            </div>
          </div>
        </div>

        {/* Batal & Retur */}
        <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-2xs space-y-3" id="kpi-batal-retur">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">
              Batal & Retur
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-rose-600 tabular font-display flex items-center gap-1.5">
              <span>{getOverallCount("Batal")}</span>
              <span className="text-xs text-zinc-400 font-normal">/</span>
              <span className="text-purple-600">{getOverallCount("Retur")}</span>
              <span className="text-xs font-normal text-zinc-500">nota</span>
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              <span className="text-rose-600 font-semibold">{getOverallCount("Batal")} Batal</span> ·{" "}
              <span className="text-purple-600 font-semibold">{getOverallCount("Retur")} Retur</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feature 4: PENJUALAN PER HARI (Daily Sales Interactive Chart & Breakdown) */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-2xs space-y-5" id="daily-sales-chart-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-zinc-700" />
              <span>Grafik Performa Harian</span>
            </div>
            <h2 className="text-lg font-bold text-zinc-900 font-display">
              Penjualan Per Hari ({dailySales.length} Hari dalam Rentang)
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Pilih nilai metrik di bawah ini untuk menganalisis performa berdasarkan Omset, Total Qty, atau Jumlah Nota unik.
            </p>
          </div>

          {/* Metric Value Switcher: Omset / Qty / Jumlah Nota */}
          <div className="inline-flex bg-zinc-100 p-1 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-700">
            <button
              type="button"
              id="metric-toggle-omset"
              onClick={() => setDailyMetric("omset")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                dailyMetric === "omset"
                  ? "bg-zinc-900 text-white shadow-xs"
                  : "hover:text-zinc-900 hover:bg-zinc-200/60"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Omset (Rp)</span>
            </button>

            <button
              type="button"
              id="metric-toggle-qty"
              onClick={() => setDailyMetric("qty")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                dailyMetric === "qty"
                  ? "bg-zinc-900 text-white shadow-xs"
                  : "hover:text-zinc-900 hover:bg-zinc-200/60"
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Qty (Pcs)</span>
            </button>

            <button
              type="button"
              id="metric-toggle-nota"
              onClick={() => setDailyMetric("jumlah_nota")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                dailyMetric === "jumlah_nota"
                  ? "bg-zinc-900 text-white shadow-xs"
                  : "hover:text-zinc-900 hover:bg-zinc-200/60"
              }`}
            >
              <Hash className="w-3.5 h-3.5" />
              <span>Jumlah Nota</span>
            </button>
          </div>
        </div>

        {/* Daily Summary Stats Pill */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-zinc-50 border border-zinc-200/80 rounded-xl text-xs">
          <div>
            <span className="text-zinc-500 block text-[11px]">Total {dailyMetric === "omset" ? "Omset" : dailyMetric === "qty" ? "Qty" : "Nota"} Periode:</span>
            <span className="font-bold text-zinc-900 text-sm tabular">
              {dailyMetric === "omset"
                ? formatRupiah(totalDailyMetricSum)
                : `${totalDailyMetricSum.toLocaleString("id-ID")} ${dailyMetric === "qty" ? "pcs" : "nota"}`}
            </span>
          </div>
          <div>
            <span className="text-zinc-500 block text-[11px]">Rata-rata Per Hari:</span>
            <span className="font-bold text-zinc-900 text-sm tabular">
              {dailyMetric === "omset"
                ? formatRupiah(Math.round(avgDailyMetric))
                : `${avgDailyMetric.toFixed(1)} ${dailyMetric === "qty" ? "pcs/hari" : "nota/hari"}`}
            </span>
          </div>
          <div>
            <span className="text-zinc-500 block text-[11px]">Puncak Tertinggi:</span>
            <span className="font-bold text-emerald-700 text-sm tabular">
              {dailyMetric === "omset"
                ? formatRupiah(maxDailyValue)
                : `${maxDailyValue.toLocaleString("id-ID")} ${dailyMetric === "qty" ? "pcs" : "nota"}`}
            </span>
          </div>
        </div>

        {/* Visual Chart Bars Container */}
        {dailySales.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 rounded-xl">
            Tidak ada data transaksi harian pada rentang tanggal yang dipilih.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-end gap-2 h-56 pt-12 px-3 overflow-x-auto pb-2 border-b border-zinc-200">
              {dailySales.map((d, idx) => {
                const val = dailyMetric === "omset" ? d.omset : dailyMetric === "qty" ? d.qty : d.jumlah_nota;
                const heightPct = Math.max(Math.round((val / maxDailyValue) * 100), 4);
                const isHovered = hoveredDailyIndex === idx;

                return (
                  <div
                    key={d.date}
                    onMouseEnter={() => setHoveredDailyIndex(idx)}
                    onMouseLeave={() => setHoveredDailyIndex(null)}
                    className="flex-1 min-w-[38px] max-w-[64px] h-full flex flex-col items-center justify-end group cursor-pointer relative"
                  >
                    {/* Tooltip on hover / active */}
                    {isHovered && (
                      <div className="absolute top-1 z-30 bg-zinc-900 text-white text-[10px] rounded-lg px-2.5 py-1.5 shadow-xl border border-zinc-700/80 pointer-events-none whitespace-nowrap animate-in fade-in duration-150">
                        <div className="font-semibold text-zinc-300 text-[10px]">{formatDailyDateLabel(d.date)}</div>
                        <div className="text-amber-400 font-bold text-xs">
                          {dailyMetric === "omset"
                            ? formatRupiah(d.omset)
                            : dailyMetric === "qty"
                            ? `${d.qty.toLocaleString("id-ID")} pcs`
                            : `${d.jumlah_nota.toLocaleString("id-ID")} nota`}
                        </div>
                      </div>
                    )}

                    {/* Bar graphic area */}
                    <div className="w-full h-32 flex items-end">
                      <div
                        className={`w-full rounded-t-md transition-all duration-300 ${
                          dailyMetric === "omset"
                            ? isHovered ? "bg-indigo-600 shadow-md shadow-indigo-500/20" : "bg-zinc-900 group-hover:bg-indigo-600"
                            : dailyMetric === "qty"
                            ? isHovered ? "bg-blue-500 shadow-md shadow-blue-500/20" : "bg-blue-600 group-hover:bg-blue-500"
                            : isHovered ? "bg-emerald-500 shadow-md shadow-emerald-500/20" : "bg-emerald-600 group-hover:bg-emerald-500"
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>

                    {/* Date label */}
                    <span className="text-[10px] text-zinc-500 font-mono mt-1.5 group-hover:text-zinc-900 group-hover:font-bold">
                      {d.date.split("-").slice(1).join("/")}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Daily Table Breakdown List */}
            <div className="max-h-60 overflow-y-auto divide-y divide-zinc-100 border border-zinc-200/80 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 sticky top-0 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Tanggal</th>
                    <th className="py-2.5 px-3 text-right">Omset (Rp)</th>
                    <th className="py-2.5 px-3 text-center">Total Qty (Pcs)</th>
                    <th className="py-2.5 px-3 text-center">Jumlah Nota Unik</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {dailySales.map((d) => (
                    <tr key={d.date} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="py-2 px-3 font-semibold text-zinc-900">
                        {formatDailyDateLabel(d.date)}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-zinc-900 tabular font-mono">
                        {formatRupiah(d.omset)}
                      </td>
                      <td className="py-2 px-3 text-center font-semibold text-blue-700 tabular">
                        {d.qty} pcs
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-emerald-700 tabular">
                        {d.jumlah_nota} nota
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Main Analytics Layout: Channel Distribution & Pipeline Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Penjualan per Channel */}
        <div className="lg:col-span-2 bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-2xs space-y-4" id="chart-channel-section">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Marketplace & Channel Breakdown
              </div>
              <h2 className="text-lg font-bold text-zinc-900 font-display">
                Distribusi Omset Penjualan per Channel
              </h2>
            </div>
            <span className="text-xs text-zinc-500 font-medium">{sortedChannels.length} Channel Aktif</span>
          </div>

          <div className="space-y-3 pt-2">
            {sortedChannels.map((c) => {
              const hexColor = getChannelColor(c.channel, channels);
              const pct = Math.round((c.total_amount / maxChannelAmount) * 100);
              const revShare = summary.total_revenue > 0 ? ((c.total_amount / summary.total_revenue) * 100).toFixed(1) : "0";

              return (
                <div key={c.channel} className="space-y-1.5" id={`channel-stat-${c.channel.toLowerCase()}`}>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: hexColor }} />
                      <span className="font-semibold text-zinc-800">{c.channel}</span>
                      <span className="text-zinc-400">·</span>
                      <span className="text-zinc-500 tabular font-medium">{c.order_count} nota unik</span>
                      <span className="text-zinc-400">·</span>
                      <span className="text-zinc-500 tabular">{c.total_qty} pcs</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400 font-mono text-[11px]">{revShare}%</span>
                      <span className="font-bold text-zinc-900 tabular text-sm">
                        {formatRupiah(c.total_amount)}
                      </span>
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="h-3.5 w-full bg-zinc-100 rounded-md overflow-hidden p-0.5">
                    <div
                      className="h-full rounded-sm transition-all duration-500"
                      style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: hexColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
            <span>Dihitung dari total nilai transaksi per channel pada rentang tanggal aktif.</span>
            <button
              onClick={() => onNavigate("admin")}
              className="text-zinc-900 font-medium hover:underline flex items-center gap-1"
            >
              Lihat Detail Transaksi <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Col: Ringkasan Pipeline Gudang */}
        <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-2xs space-y-4" id="status-breakdown-section">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Pipeline Gudang
            </div>
            <h2 className="text-lg font-bold text-zinc-900 font-display">
              Status Pesanan Nota
            </h2>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {orderStatuses && orderStatuses.length > 0 ? (
              [...orderStatuses]
                .sort((a, b) => (a.urutan || 99) - (b.urutan || 99))
                .map((st, idx) => {
                  const stColor = getStatusColor(st.nama_status, orderStatuses);
                  const badgeStyle = getDynamicBadgeStyle(stColor);
                  const count = getOverallCount(st.nama_status);
                  return (
                    <div
                      key={st.id || st.nama_status}
                      className="p-3 rounded-xl border flex items-center justify-between transition-colors"
                      style={{
                        backgroundColor: badgeStyle.backgroundColor,
                        borderColor: badgeStyle.borderColor,
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs"
                          style={{ backgroundColor: stColor, color: "#ffffff" }}
                        >
                          {st.urutan || idx + 1}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                            <span>{st.nama_status}</span>
                            {st.is_final && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-200 text-zinc-700 font-semibold">
                                Final
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-500">
                            {st.is_final
                              ? "Status penyelesaian"
                              : st.next_status
                              ? `Lanjut ke: ${st.next_status}`
                              : "Sedang berlangsung"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className="text-base font-bold tabular font-display"
                          style={{ color: stColor }}
                        >
                          {count}
                        </div>
                        <div className="text-[10px] text-zinc-500 uppercase font-semibold">Nota</div>
                      </div>
                    </div>
                  );
                })
            ) : (
              // Clean fallback to default statuses
              ["Input Orderan", "Diproses", "Selesai Packing", "Batal", "Retur"].map((stName, idx) => {
                const stColor = getStatusColor(stName);
                const badgeStyle = getDynamicBadgeStyle(stColor);
                return (
                  <div
                    key={stName}
                    className="p-3 rounded-xl border flex items-center justify-between"
                    style={{
                      backgroundColor: badgeStyle.backgroundColor,
                      borderColor: badgeStyle.borderColor,
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs"
                        style={{ backgroundColor: stColor, color: "#ffffff" }}
                      >
                        {idx + 1}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-900">{stName}</div>
                        <div className="text-[10px] text-zinc-500">Antrean status pesanan</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className="text-base font-bold tabular font-display"
                        style={{ color: stColor }}
                      >
                        {getOverallCount(stName)}
                      </div>
                      <div className="text-[10px] text-zinc-500 uppercase font-semibold">Nota</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <button
            onClick={() => onNavigate("admin")}
            className="w-full py-2.5 px-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <TableProperties className="w-3.5 h-3.5" />
            <span>Buka Live Grid Transaksi</span>
          </button>
        </div>
      </div>

      {/* Leaderboard Sections: Top Sales & Top Products */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Sales Person */}
        <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-2xs space-y-3" id="top-sales-card">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-zinc-700" />
              <h3 className="font-bold text-sm text-zinc-900 font-display">Top Sales Person</h3>
            </div>
            <span className="text-[11px] text-zinc-500">Berdasarkan Total Omzet</span>
          </div>

          <div className="divide-y divide-zinc-100">
            {summary?.top_sales?.map((s, idx) => (
              <div key={s.nama_sales} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-zinc-100 text-zinc-600 font-bold flex items-center justify-center text-[10px]">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="font-semibold text-zinc-900">{s.nama_sales}</div>
                    <div className="text-[11px] text-zinc-500">{s.nama_divisi}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-zinc-900 tabular">{formatRupiah(s.total_amount)}</div>
                  <div className="text-[11px] text-zinc-500 tabular">{s.order_count} nota unik</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-2xs space-y-3" id="top-products-card">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-zinc-700" />
              <h3 className="font-bold text-sm text-zinc-900 font-display">Top 5 Produk Terlaris</h3>
            </div>
            <span className="text-[11px] text-zinc-500">Paling banyak dipesan</span>
          </div>

          <div className="divide-y divide-zinc-100">
            {summary?.top_products?.map((p, idx) => (
              <div key={p.sku} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-zinc-100 text-zinc-600 font-bold flex items-center justify-center text-[10px]">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="font-semibold text-zinc-900">{p.item_name}</div>
                    <div className="text-[11px] text-zinc-500 font-mono">
                      {p.nama_brand} · {p.sku}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-zinc-900 tabular">{formatRupiah(p.total_amount)}</div>
                  <div className="text-[11px] text-zinc-500 tabular">{p.total_qty} pcs terjual</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
