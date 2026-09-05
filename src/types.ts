export interface Channel {
  id: number;
  nama_channel: string;
  color?: string;
}

export interface OrderStatusMaster {
  id: number;
  nama_status: string;
  color?: string;
  urutan?: number;
  is_final?: boolean;
  next_status?: string;
}

export interface Customer {
  id: number;
  nama_customer: string;
  no_telepon?: string;
  alamat?: string;
  email?: string;
  catatan?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Divisi {
  id: number;
  nama_divisi: string;
}

export interface SalesPerson {
  id: number;
  nama_sales: string;
  divisi_id: number;
  nama_divisi?: string;
}

export interface Brand {
  id: number;
  nama_brand: string;
}

export interface ItemGroup {
  id: number;
  nama_group: string;
}

export interface Category {
  id: number;
  nama_kategori: string;
}

export interface Product {
  sku: string;
  item_name: string;
  item_group?: string | null;
  category?: string | null;
  brand_id: number;
  nama_brand?: string;
}

export type SalesChannel = "Tokopedia" | "TikTok" | "Shopee" | "Lazada" | "Offline" | (string & {});

export type OrderStatus =
  | "Input Orderan"
  | "Diproses"
  | "Selesai Packing"
  | "Batal"
  | "Retur"
  | (string & {});

export interface OrderItemInput {
  sku: string;
  qty: number;
  amount: number;
}

export interface CreateOrderPayload {
  no_invoice: string;
  nama_customer: string;
  sales_person_id: number;
  channel: SalesChannel;
  items: OrderItemInput[];
  no_telepon?: string;
  alamat?: string;
  author?: string;
}

export interface SalesOrder {
  id: number;
  no_invoice: string;
  nama_customer: string;
  no_telepon?: string;
  alamat?: string;
  customer_snapshot?: {
    no_telepon?: string;
    alamat?: string;
  };
  sku: string;
  item_name?: string;
  nama_brand?: string;
  category?: string;
  item_group?: string;
  qty: number;
  amount: number;
  channel: SalesChannel;
  status: OrderStatus;
  nama_sales: string;
  nama_divisi: string;
  created_at: string;
}

export interface InvoiceItem {
  id: number;
  no_invoice: string;
  nama_customer: string;
  no_telepon?: string;
  alamat?: string;
  sku: string;
  item_name: string;
  nama_brand?: string;
  category?: string;
  item_group?: string;
  qty: number;
  amount: number;
  channel: SalesChannel;
  status: OrderStatus;
  nama_sales: string;
  nama_divisi: string;
  created_at: string;
}

export interface InvoiceOrder {
  no_invoice: string;
  nama_customer: string;
  no_telepon?: string;
  alamat?: string;
  customer_snapshot?: {
    no_telepon?: string;
    alamat?: string;
  };
  channel: SalesChannel;
  status: OrderStatus;
  nama_sales: string;
  nama_divisi: string;
  created_at: string;
  items: InvoiceItem[];
  total_qty: number;
  total_amount: number;
  item_count: number;
}

export interface OrderNote {
  id: string | number;
  no_invoice?: string;
  note: string;
  author: string;
  created_at: string;
}

export interface StatusHistory {
  id: number;
  sales_id?: number;
  no_invoice?: string;
  status_lama: string;
  status_baru: string;
  author?: string;
  updated_at: string;
}

export interface InvoiceDetailResponse {
  invoice: InvoiceOrder;
  items: InvoiceItem[];
  history: StatusHistory[];
  notes: OrderNote[];
}

export interface DailySalesStat {
  date: string;
  omset: number;
  qty: number;
  jumlah_nota: number;
}

export interface AnalyticsSummary {
  total_revenue: number;
  total_orders: number;
  total_items_sold: number;
  date_range?: string;
  today_by_status: {
    status: OrderStatus;
    count: number;
    total_amount: number;
  }[];
  per_status: {
    status: OrderStatus;
    count: number;
    total_amount: number;
  }[];
  per_channel: {
    channel: SalesChannel;
    order_count: number;
    total_qty: number;
    total_amount: number;
  }[];
  top_sales: {
    nama_sales: string;
    nama_divisi: string;
    order_count: number;
    total_amount: number;
  }[];
  top_products: {
    sku: string;
    item_name: string;
    nama_brand: string;
    total_qty: number;
    total_amount: number;
  }[];
  daily_sales: DailySalesStat[];
}

export interface DbStatusInfo {
  ok: boolean;
  info: {
    connected: boolean;
    url: string;
    error: string | null;
    type: string;
  };
  serverTime?: string;
}

export type AppRole = "Admin" | "Gudang" | "Sales";
