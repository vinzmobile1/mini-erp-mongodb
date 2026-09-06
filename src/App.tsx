import React, { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Header } from "./components/Header";
import { DashboardAnalytics } from "./components/DashboardAnalytics";
import { InputOrderForm } from "./components/InputOrderForm";
import { AdminDataGrid } from "./components/AdminDataGrid";
import { MasterDataManager } from "./components/MasterDataManager";
import {
  AppRole,
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
  OrderStatus,
  AnalyticsSummary,
  InvoiceOrder,
} from "./types";
import { api } from "./lib/api";
import { wsClient, useWebSocketSync } from "./lib/ws";

export default function App() {
  useWebSocketSync();
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [currentRole, setCurrentRole] = useState<AppRole>("Admin");
  const [editingInvoice, setEditingInvoice] = useState<SalesOrder | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // 1. TanStack Query for Master Data
  const { data: masterData, refetch: refetchMaster } = useQuery({
    queryKey: ["masterData"],
    queryFn: async () => {
      const [channelData, divData, spData, brandData, groupData, catData, prodData, custData, statusData] = await Promise.all([
        api.getChannels(),
        api.getDivisi(),
        api.getSalesPersons(),
        api.getBrands(),
        api.getItemGroups(),
        api.getCategories(),
        api.getProducts(),
        api.getCustomers().catch(() => []),
        api.getOrderStatuses().catch(() => []),
      ]);
      return {
        channels: channelData,
        divisi: divData,
        salesPersons: spData,
        brands: brandData,
        itemGroups: groupData,
        categories: catData,
        products: prodData,
        customers: custData || [],
        orderStatuses: statusData || [],
      };
    },
    staleTime: 5 * 60 * 1000, // Master data considered fresh for 5 mins
  });

  const channels = masterData?.channels || [];
  const divisi = masterData?.divisi || [];
  const salesPersons = masterData?.salesPersons || [];
  const brands = masterData?.brands || [];
  const itemGroups = masterData?.itemGroups || [];
  const categories = masterData?.categories || [];
  const products = masterData?.products || [];
  const customers = masterData?.customers || [];
  const orderStatuses = masterData?.orderStatuses || [];

  // 2. TanStack Query for Orders / Invoices
  const { data: invoices = [], isLoading: loadingOrders, refetch: refetchOrders } = useQuery<InvoiceOrder[]>({
    queryKey: ["invoices"],
    queryFn: async () => {
      const res = await api.getInvoices({ limit: 50 });
      return res.data;
    },
    staleTime: 15 * 1000,
  });

  // 3. Analytics Filter State & Query
  const [analyticsFilter, setAnalyticsFilter] = useState<{ range?: string; start_date?: string; end_date?: string }>({
    range: "this_month",
  });

  const { data: summary = null, isLoading: loadingAnalytics, refetch: refetchAnalytics } = useQuery<AnalyticsSummary>({
    queryKey: ["analytics", analyticsFilter],
    queryFn: async () => {
      return await api.getAnalytics(analyticsFilter.range, analyticsFilter.start_date, analyticsFilter.end_date);
    },
    staleTime: 15 * 1000,
  });

  const handleFilterChange = (params: { range: string; start_date?: string; end_date?: string }) => {
    setAnalyticsFilter(params);
  };

  // Immediate optimistic status update helper for local cache
  const updateOrderStatusOptimistic = useCallback((no_invoice: string, newStatus: OrderStatus) => {
    queryClient.setQueryData<InvoiceOrder[]>(["invoices"], (old) => {
      if (!old) return [];
      return old.map((o) => (o.no_invoice === no_invoice ? { ...o, status: newStatus } : o));
    });
  }, [queryClient]);

  const refreshAllData = useCallback(() => {
    refetchMaster();
    refetchOrders();
    refetchAnalytics();
  }, [refetchMaster, refetchOrders, refetchAnalytics]);

  // Debounced / Throttled WebSocket Event Handler to avoid rapid re-renders on bulk Excel import events
  const wsTimerRef = useRef<NodeJS.Timeout | null>(null);

  const scheduleDebouncedSync = useCallback((shouldRefreshMaster = false) => {
    if (wsTimerRef.current) clearTimeout(wsTimerRef.current);
    wsTimerRef.current = setTimeout(() => {
      refetchOrders();
      refetchAnalytics();
      if (shouldRefreshMaster) refetchMaster();
    }, 80); // Snappy 80ms sync debounce
  }, [refetchOrders, refetchAnalytics, refetchMaster]);

  // Realtime Socket.io / WebSockets Subscriber
  useEffect(() => {
    const unsubscribeWs = wsClient.subscribe((event) => {
      const payload = event.payload || {};
      const inv = payload.no_invoice || payload.invoice || payload.id || payload.order?.no_invoice;

      if (event.type === "sync:refresh") {
        scheduleDebouncedSync(true);
      } else if (
        event.type === "order:created" ||
        event.type === "invoice:created" ||
        event.type === "order:imported" ||
        event.type === "order:updated" ||
        event.type === "invoice:updated" ||
        event.type === "order:deleted" ||
        event.type === "invoice:deleted"
      ) {
        scheduleDebouncedSync(false);
      } else if (event.type === "order:status" || event.type === "invoice:status") {
        const newStatus = payload.status;
        if (inv && newStatus) {
          updateOrderStatusOptimistic(inv, newStatus);
        }
        scheduleDebouncedSync(false);
      } else if (event.type === "master:updated") {
        scheduleDebouncedSync(true);
      }
    });

    return () => {
      if (wsTimerRef.current) clearTimeout(wsTimerRef.current);
      unsubscribeWs();
    };
  }, [scheduleDebouncedSync, updateOrderStatusOptimistic]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F9F9F8] text-zinc-900 selection:bg-zinc-900 selection:text-white" id="erp-root-container">
      {/* Top Application Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentRole={currentRole}
        setCurrentRole={setCurrentRole}
        onRefreshData={() => refreshAllData(false)}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full px-2 sm:px-3.5 lg:px-4 py-3 sm:py-4">
        {globalError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start justify-between gap-3 text-sm text-red-900 shadow-sm">
            <div className="flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-bold mb-1">Kendala Memuat Data</p>
                <p className="text-xs text-red-700">{globalError}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setGlobalError(null);
                refreshAllData(false);
              }}
              className="shrink-0 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* Role-based Context Banner for Gudang & Sales */}
        {currentRole === "Gudang" && activeTab !== "admin" && (
          <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900">
            <div className="flex items-center gap-2 font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
              <span>
                Anda sedang dalam mode <strong>Role: Gudang</strong>. Buka Live Grid untuk memproses status pesanan & packing.
              </span>
            </div>
            <button
              onClick={() => setActiveTab("admin")}
              className="px-3 py-1 font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Buka Live Grid →
            </button>
          </div>
        )}

        {currentRole === "Sales" && activeTab !== "orders" && (
          <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-600" />
              <span>
                Anda sedang dalam mode <strong>Role: Sales</strong>. Klik tombol berikut untuk input transaksi baru.
              </span>
            </div>
            <button
              onClick={() => setActiveTab("orders")}
              className="px-3 py-1 font-bold bg-amber-700 text-white rounded-lg hover:bg-amber-800"
            >
              + Input Orderan Baru →
            </button>
          </div>
        )}

        {/* View Switcher */}
        {activeTab === "dashboard" && (
          <DashboardAnalytics
            summary={summary}
            loading={loadingAnalytics}
            channels={channels}
            orderStatuses={orderStatuses}
            onRefresh={() => refetchAnalytics()}
            onNavigate={(tab) => setActiveTab(tab)}
            onFilterChange={handleFilterChange}
          />
        )}

        {activeTab === "orders" && (
          <InputOrderForm
            channels={channels}
            customers={customers}
            salesPersons={salesPersons}
            products={products}
            brands={brands}
            orderStatuses={orderStatuses}
            editingInvoice={editingInvoice}
            onCancelEdit={() => setEditingInvoice(null)}
            onOrderCreated={() => {
              refetchOrders();
              refetchAnalytics();
              setEditingInvoice(null);
            }}
            onNavigateToGrid={() => setActiveTab("admin")}
          />
        )}

        {activeTab === "admin" && (
          <AdminDataGrid
            channels={channels}
            orderStatuses={orderStatuses}
            salesPersons={salesPersons}
            products={products}
            brands={brands}
            customers={customers}
            orders={invoices}
            loading={loadingOrders}
            onRefresh={() => {
              refetchOrders();
              refetchAnalytics();
            }}
            onUpdateStatusOptimistic={updateOrderStatusOptimistic}
            userRole={currentRole}
          />
        )}

        {activeTab === "master" && (
          <MasterDataManager
            channels={channels}
            customers={customers}
            divisi={divisi}
            salesPersons={salesPersons}
            brands={brands}
            itemGroups={itemGroups}
            categories={categories}
            products={products}
            orderStatuses={orderStatuses}
            onRefresh={() => {
              refetchMaster();
              refetchAnalytics();
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-200 bg-white py-4 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-800">Mini ERP Rekap Penjualan Multi-Channel</span>
            <span>·</span>
            <span>MongoDB Atlas</span>
            <span>·</span>
            <span>Real-time WebSocket</span>
          </div>
          <div className="text-[11px] text-zinc-400">
            Tokopedia · TikTok Shop · Shopee · Lazada · Offline Store
          </div>
        </div>
      </footer>
    </div>
  );
}
