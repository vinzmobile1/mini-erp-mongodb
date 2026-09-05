import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  PlusCircle,
  TableProperties,
  Database,
  RefreshCw,
  Layers,
  Shield,
  Radio,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { AppRole, DbStatusInfo } from "../types";
import { wsClient } from "../lib/ws";
import { api } from "../lib/api";
import { ConfirmModal } from "./ConfirmModal";

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentRole: AppRole;
  setCurrentRole: (role: AppRole) => void;
  onRefreshData?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  currentRole,
  setCurrentRole,
  onRefreshData,
}) => {
  const [wsStatus, setWsStatus] = useState<"connected" | "connecting" | "disconnected">("connecting");
  const [dbInfo, setDbInfo] = useState<DbStatusInfo | null>(null);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [isReseeding, setIsReseeding] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [reseedMsg, setReseedMsg] = useState<string | null>(null);

  // Custom Confirm Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    variant: "danger" | "warning";
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    confirmLabel: "Konfirmasi",
    variant: "danger",
    onConfirm: async () => {},
  });

  useEffect(() => {
    const unsub = wsClient.onStatusChange((status) => {
      setWsStatus(status);
    });

    api.getDbStatus().then(setDbInfo).catch((err) => {
      console.warn("Db info error:", err);
    });

    return () => unsub();
  }, []);

  const handleClearAll = () => {
    setConfirmModal({
      isOpen: true,
      title: "Kosongkan Seluruh Data Tabel",
      message: "Peringatan: Anda akan MENGOSONGKAN SELURUH DATA TABEL (Master Data & Transaksi). Apakah Anda yakin?",
      confirmLabel: "Ya, Kosongkan Semua",
      variant: "danger",
      onConfirm: async () => {
        setIsClearing(true);
        setReseedMsg(null);
        try {
          await api.clearAllData();
          setReseedMsg("✅ Seluruh data tabel (Master Data & Transaksi) berhasil dikosongkan. Anda dapat mulai mengisi dari awal.");
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          if (onRefreshData) onRefreshData();
        } catch (err: any) {
          setReseedMsg(`Gagal: ${err.message}`);
        } finally {
          setIsClearing(false);
        }
      },
    });
  };

  const handleClearTransactions = () => {
    setConfirmModal({
      isOpen: true,
      title: "Kosongkan Data Transaksi",
      message: "Kosongkan semua data transaksi (penjualan, nota & riwayat)? Master data akan tetap disimpan.",
      confirmLabel: "Ya, Kosongkan Transaksi",
      variant: "danger",
      onConfirm: async () => {
        setIsClearing(true);
        setReseedMsg(null);
        try {
          await api.clearTransactions();
          setReseedMsg("✅ Data transaksi penjualan & nota berhasil dikosongkan.");
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          if (onRefreshData) onRefreshData();
        } catch (err: any) {
          setReseedMsg(`Gagal: ${err.message}`);
        } finally {
          setIsClearing(false);
        }
      },
    });
  };

  const handleReseed = () => {
    setConfirmModal({
      isOpen: true,
      title: "Muat Contoh Demo",
      message: "Muat ulang data contoh / demo ke dalam database?",
      confirmLabel: "Muat Demo",
      variant: "warning",
      onConfirm: async () => {
        setIsReseeding(true);
        setReseedMsg(null);
        try {
          await api.reseedDatabase();
          setReseedMsg("✅ Database berhasil diisi dengan sample data demo!");
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          if (onRefreshData) onRefreshData();
        } catch (err: any) {
          setReseedMsg(`Gagal: ${err.message}`);
        } finally {
          setIsReseeding(false);
        }
      },
    });
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, badge: null },
    { id: "orders", label: "Input Order", icon: PlusCircle, badge: null },
    { id: "admin", label: "Live Grid", icon: TableProperties, badge: null },
    { id: "master", label: "Master Data", icon: Database, badge: null },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-zinc-200" id="main-header">
      <div className="w-full px-2 sm:px-3.5 lg:px-4">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Identity */}
          <div className="flex items-center gap-6 shrink-0">
            <button
              onClick={() => setActiveTab("dashboard")}
              className="flex items-center gap-2.5 text-left group"
              id="brand-logo-button"
            >
              <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-sm tracking-tight text-zinc-900 flex items-center gap-1.5 font-display">
                  Mini ERP <span className="text-zinc-500 font-normal">v1.0</span>
                </div>
                <div className="text-[10px] tracking-wider uppercase text-zinc-500 font-medium">
                  Rekap Penjualan Multi-Channel
                </div>
              </div>
            </button>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1" id="desktop-nav">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    id={`nav-tab-${item.id}`}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? "bg-zinc-900 text-white shadow-xs"
                        : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right controls: WebSocket Live Pill, Database status, Role Selector */}
          <div className="flex items-center gap-3 shrink-0">
            {/* MongoDB Database Status Pill */}
            <button
              onClick={() => setIsDbModalOpen(true)}
              id="mongodb-status-pill"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 transition-colors"
              title="Klik untuk melihat detail koneksi MongoDB"
            >
              <Database className="w-3 h-3 text-emerald-600" />
              <span className="truncate max-w-[120px]">MongoDB</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            </button>

            {/* Realtime Live Status */}
            <div
              id="ws-status-indicator"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-zinc-200 bg-white shadow-2xs"
              title={`Status Sinkronisasi Real-time: ${wsStatus === "connected" ? "Terhubung (SSE + WebSocket)" : wsStatus === "connecting" ? "Menghubungkan..." : "Offline / Polling"}`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  wsStatus === "connected"
                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse"
                    : wsStatus === "connecting"
                    ? "bg-amber-500 animate-ping"
                    : "bg-zinc-400"
                }`}
              />
              <span className="text-[11px] text-zinc-700 font-medium hidden sm:inline">
                {wsStatus === "connected" ? "Real-time Live" : wsStatus === "connecting" ? "Sinkronisasi..." : "Auto-Sync"}
              </span>
            </div>

            {/* Role Switcher */}
            <div className="flex items-center gap-1.5 bg-zinc-100 p-0.5 rounded-lg border border-zinc-200" id="role-switcher-container">
              <span className="text-[10px] uppercase font-semibold text-zinc-500 px-1.5 hidden lg:inline">
                Role:
              </span>
              {(["Admin", "Gudang", "Sales"] as AppRole[]).map((r) => (
                <button
                  key={r}
                  id={`role-btn-${r.toLowerCase()}`}
                  onClick={() => setCurrentRole(r)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                    currentRole === r
                      ? "bg-white text-zinc-900 shadow-xs border border-zinc-200/80"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden overflow-x-auto scrollbar-none py-2 border-t border-zinc-100 gap-1" id="mobile-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`mobile-nav-tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all ${
                  isActive
                    ? "bg-zinc-900 text-white shadow-xs"
                    : "text-zinc-600 bg-zinc-50 hover:bg-zinc-100"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MongoDB Connection Modal */}
      {isDbModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-zinc-200 space-y-4" id="mongodb-info-modal">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 font-display">Status Database MongoDB Atlas</h3>
                  <p className="text-xs text-zinc-500">Cloud MongoDB Atlas Database connection</p>
                </div>
              </div>
              <button
                onClick={() => setIsDbModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 p-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 space-y-1.5">
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Engine:</span>
                  <span className="font-semibold text-zinc-900">{dbInfo?.info.type || "MongoDB Atlas"}</span>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Connection URL:</span>
                  <span className="font-mono text-[11px] text-zinc-800 break-all">{dbInfo?.info.url}</span>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Connection Status:</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Terhubung Aktif
                  </span>
                </div>
                {dbInfo?.serverTime && (
                  <div className="flex items-center justify-between text-zinc-600">
                    <span>Server Timestamp:</span>
                    <span className="font-mono text-[11px] text-zinc-700">{dbInfo.serverTime}</span>
                  </div>
                )}
              </div>

              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-xs leading-relaxed">
                <strong>Snapshot Archiving Note:</strong> Transaksi menyimpan teks snapshot{" "}
                <code className="bg-amber-100 px-1 py-0.5 rounded">nama_sales</code> dan{" "}
                <code className="bg-amber-100 px-1 py-0.5 rounded">nama_divisi</code> secara mandiri. Data historis penjualan tetap aman walau master data dihapus.
              </div>

              <div className="p-3 bg-red-50/70 rounded-lg border border-red-200 text-xs space-y-2">
                <div className="font-bold text-red-900 flex items-center gap-1.5">
                  <span>⚙️ Manajemen & Pengosongan Data:</span>
                </div>
                <p className="text-zinc-600 text-[11px] leading-relaxed">
                  Gunakan tombol di bawah ini jika ingin mengosongkan data untuk diisi secara manual dari awal.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleClearAll}
                    disabled={isClearing || isReseeding}
                    id="clear-all-db-btn"
                    className="px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 shadow-2xs"
                  >
                    {isClearing ? "Mengosongkan..." : "🗑️ Kosongkan Seluruh Tabel (Mulai dari Nol)"}
                  </button>

                  <button
                    type="button"
                    onClick={handleClearTransactions}
                    disabled={isClearing || isReseeding}
                    id="clear-trans-db-btn"
                    className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-red-50 text-red-700 border border-red-300 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Kosongkan Transaksi Saja
                  </button>
                </div>
              </div>

              {reseedMsg && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-xs font-medium">
                  {reseedMsg}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={handleReseed}
                disabled={isReseeding || isClearing}
                id="reseed-db-button"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isReseeding ? "animate-spin" : ""}`} />
                <span>{isReseeding ? "Memuat..." : "Muat Contoh Demo (Optional)"}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDbModalOpen(false)}
                className="px-4 py-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 rounded-lg"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Action Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        cancelLabel="Batal"
        variant={confirmModal.variant}
        isLoading={isClearing || isReseeding}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => {
          if (!isClearing && !isReseeding) {
            setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          }
        }}
      />
    </header>
  );
};
