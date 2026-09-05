import * as XLSX from "xlsx";
import { SalesChannel } from "../types";

export interface MasterExcelTemplateData {
  divisi?: Array<{ nama_divisi: string }>;
  sales_person?: Array<{ nama_sales: string; nama_divisi: string }>;
  brand?: Array<{ nama_brand: string }>;
  item_group?: Array<{ nama_group: string }>;
  category?: Array<{ nama_kategori: string }>;
  channel?: Array<{ nama_channel: string; color?: string }>;
  order_status?: Array<{
    nama_status: string;
    color?: string;
    urutan?: number;
    next_status?: string;
    is_final?: boolean;
  }>;
  customers?: Array<{
    nama_customer: string;
    no_telepon?: string;
    alamat?: string;
    kota?: string;
    email?: string;
    catatan?: string;
  }>;
  products?: Array<{
    sku: string;
    item_name: string;
    nama_brand: string;
    item_group?: string;
    category?: string;
  }>;
}

export interface ParsedOrderRow {
  no_invoice: string;
  nama_customer: string;
  channel: SalesChannel;
  sku: string;
  qty: number;
  amount: number;
  nama_sales?: string;
  status?: string;
  catatan?: string;
}

// ----------------------------------------------------
// 1. MASTER DATA TEMPLATE GENERATORS
// ----------------------------------------------------

/**
 * Downloads a complete All-in-One Master Data Excel template with 6 sheets.
 */
export function downloadAllMasterTemplate() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Divisi
  const wsDivisi = XLSX.utils.aoa_to_sheet([
    ["nama_divisi"],
    ["Apple Division"],
    ["Android Division"],
    ["Laptop & PC Division"],
    ["Accessories Division"],
  ]);
  wsDivisi["!cols"] = [{ wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsDivisi, "1_Divisi");

  // Sheet 2: Sales Person
  const wsSales = XLSX.utils.aoa_to_sheet([
    ["nama_sales", "nama_divisi"],
    ["Harvey", "Apple Division"],
    ["Burney", "Android Division"],
    ["Naufal", "Laptop & PC Division"],
    ["Sarah", "Accessories Division"],
  ]);
  wsSales["!cols"] = [{ wch: 25 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsSales, "2_Sales_Person");

  // Sheet 3: Brand
  const wsBrand = XLSX.utils.aoa_to_sheet([
    ["nama_brand"],
    ["Apple"],
    ["Samsung"],
    ["Xiaomi"],
    ["Sony"],
    ["Asus"],
    ["Lenovo"],
  ]);
  wsBrand["!cols"] = [{ wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsBrand, "3_Brand");

  // Sheet 4: Item Group
  const wsGroup = XLSX.utils.aoa_to_sheet([
    ["nama_group"],
    ["Iphone 15 Series"],
    ["Iphone 16 Series"],
    ["Galaxy S Series"],
    ["MacBook Series"],
    ["Gaming Laptop"],
    ["TWS & Audio"],
  ]);
  wsGroup["!cols"] = [{ wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsGroup, "4_Item_Group");

  // Sheet 5: Category
  const wsCategory = XLSX.utils.aoa_to_sheet([
    ["nama_kategori"],
    ["Handphone"],
    ["Laptop"],
    ["Tablet"],
    ["Camera Action"],
    ["Smartwatch"],
    ["Aksesoris"],
  ]);
  wsCategory["!cols"] = [{ wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsCategory, "5_Category");

  // Sheet 6: Products (Supports thousands of SKUs)
  const wsProducts = XLSX.utils.aoa_to_sheet([
    ["sku", "item_name", "nama_brand", "item_group", "category"],
    ["IP15-128-BLK", "iPhone 15 128GB Black", "Apple", "Iphone 15 Series", "Handphone"],
    ["IP15-128-BLU", "iPhone 15 128GB Blue", "Apple", "Iphone 15 Series", "Handphone"],
    ["IP15-256-NAT", "iPhone 15 Pro 256GB Natural Titanium", "Apple", "Iphone 15 Series", "Handphone"],
    ["IP16-128-WHT", "iPhone 16 128GB White", "Apple", "Iphone 16 Series", "Handphone"],
    ["SGS24-256-GRY", "Samsung Galaxy S24 256GB Onyx Grey", "Samsung", "Galaxy S Series", "Handphone"],
    ["MBA-M2-256", "MacBook Air M2 8GB 256GB Space Grey", "Apple", "MacBook Series", "Laptop"],
    ["ROG-Z13-512", "Asus ROG Flow Z13 Gaming", "Asus", "Gaming Laptop", "Laptop"],
  ]);
  wsProducts["!cols"] = [
    { wch: 20 },
    { wch: 45 },
    { wch: 20 },
    { wch: 25 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, wsProducts, "6_Products");

  // Sheet 7: Channel
  const wsChannel = XLSX.utils.aoa_to_sheet([
    ["nama_channel"],
    ["Tokopedia"],
    ["Shopee"],
    ["TikTok Shop"],
    ["Lazada"],
    ["Offline Store"],
  ]);
  wsChannel["!cols"] = [{ wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsChannel, "7_Channel");

  // Sheet 8: Customers
  const wsCustomers = XLSX.utils.aoa_to_sheet([
    ["nama_customer", "no_telepon", "alamat", "kota", "email", "catatan"],
    ["Budi Santoso", "081234567890", "Jl. Sudirman No. 45", "Jakarta Selatan", "budi.santoso@gmail.com", "VIP Customer"],
    ["Siti Rahmawati", "081398765432", "Jl. Malioboro No. 12", "Yogyakarta", "siti.rahma@yahoo.com", "Langganan"],
    ["Rian Hidayat", "085612349876", "Jl. Dago No. 88", "Bandung", "rian.h@outlook.com", "Marketplace buyer"],
    ["Mega Putri", "087788990011", "Jl. Pemuda No. 23", "Surabaya", "mega.putri@gmail.com", "Dropshipper"],
  ]);
  wsCustomers["!cols"] = [
    { wch: 25 },
    { wch: 18 },
    { wch: 35 },
    { wch: 20 },
    { wch: 25 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, wsCustomers, "8_Customers");

  XLSX.writeFile(wb, "Template_Master_Data_Semua_Tabel.xlsx");
}

/**
 * Downloads a specific single-table Master Data Excel template.
 */
export function downloadSingleMasterTemplate(type: "divisi" | "sales_person" | "brand" | "item_group" | "category" | "products" | "channel" | "customer" | "customers" | "order_status" | "status") {
  const wb = XLSX.utils.book_new();

  switch (type) {
    case "divisi": {
      const ws = XLSX.utils.aoa_to_sheet([
        ["nama_divisi"],
        ["Apple"],
        ["Android"],
        ["Laptop"],
        ["Accessories"],
      ]);
      ws["!cols"] = [{ wch: 30 }];
      XLSX.utils.book_append_sheet(wb, ws, "Divisi");
      XLSX.writeFile(wb, "Template_Master_Divisi.xlsx");
      break;
    }
    case "sales_person": {
      const ws = XLSX.utils.aoa_to_sheet([
        ["nama_sales", "nama_divisi"],
        ["Harvey", "Apple"],
        ["Burney", "Android"],
        ["Naufal", "Laptop"],
      ]);
      ws["!cols"] = [{ wch: 25 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(wb, ws, "Sales_Person");
      XLSX.writeFile(wb, "Template_Master_Sales_Person.xlsx");
      break;
    }
    case "brand": {
      const ws = XLSX.utils.aoa_to_sheet([
        ["nama_brand"],
        ["Apple"],
        ["Samsung"],
        ["Xiaomi"],
        ["Sony"],
        ["Asus"],
      ]);
      ws["!cols"] = [{ wch: 25 }];
      XLSX.utils.book_append_sheet(wb, ws, "Brand");
      XLSX.writeFile(wb, "Template_Master_Brand.xlsx");
      break;
    }
    case "item_group": {
      const ws = XLSX.utils.aoa_to_sheet([
        ["nama_group"],
        ["Iphone 15"],
        ["Iphone 16"],
        ["Galaxy S24"],
        ["MacBook Air"],
      ]);
      ws["!cols"] = [{ wch: 25 }];
      XLSX.utils.book_append_sheet(wb, ws, "Item_Group");
      XLSX.writeFile(wb, "Template_Master_Item_Group.xlsx");
      break;
    }
    
    case "channel": {
      const ws = XLSX.utils.aoa_to_sheet([
        ["nama_channel", "color"],
        ["Tokopedia", "#10B981"],
        ["Shopee", "#F97316"],
        ["TikTok Shop", "#18181B"],
        ["Lazada", "#6366F1"],
        ["Offline Store", "#64748B"],
      ]);
      ws["!cols"] = [{ wch: 22 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws, "Channel");
      XLSX.writeFile(wb, "Template_Master_Channel.xlsx");
      break;
    }
    case "order_status":
    case "status": {
      const ws = XLSX.utils.aoa_to_sheet([
        ["nama_status", "color", "urutan", "next_status", "is_final"],
        ["Input Orderan", "#F59E0B", 1, "Diproses", false],
        ["Diproses", "#3B82F6", 2, "Selesai Packing", false],
        ["Selesai Packing", "#10B981", 3, "", true],
        ["Batal", "#EF4444", 4, "", true],
        ["Retur", "#8B5CF6", 5, "", true],
      ]);
      ws["!cols"] = [{ wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 20 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws, "OrderStatus");
      XLSX.writeFile(wb, "Template_Master_Status_Nota.xlsx");
      break;
    }
    case "customer":
    case "customers": {
      const ws = XLSX.utils.aoa_to_sheet([
        ["nama_customer", "no_telepon", "alamat", "kota", "email", "catatan"],
        ["Budi Santoso", "081234567890", "Jl. Sudirman No. 45", "Jakarta Selatan", "budi.santoso@gmail.com", "VIP Customer"],
        ["Siti Rahmawati", "081398765432", "Jl. Malioboro No. 12", "Yogyakarta", "siti.rahma@yahoo.com", "Langganan"],
        ["Rian Hidayat", "085612349876", "Jl. Dago No. 88", "Bandung", "rian.h@outlook.com", "Marketplace buyer"],
        ["Mega Putri", "087788990011", "Jl. Pemuda No. 23", "Surabaya", "mega.putri@gmail.com", "Dropshipper"],
      ]);
      ws["!cols"] = [
        { wch: 25 },
        { wch: 18 },
        { wch: 35 },
        { wch: 20 },
        { wch: 25 },
        { wch: 30 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Customers");
      XLSX.writeFile(wb, "Template_Master_Customers.xlsx");
      break;
    }
    case "category": {

      const ws = XLSX.utils.aoa_to_sheet([
        ["nama_kategori"],
        ["Handphone"],
        ["Laptop"],
        ["Camera Action"],
        ["Aksesoris"],
      ]);
      ws["!cols"] = [{ wch: 25 }];
      XLSX.utils.book_append_sheet(wb, ws, "Category");
      XLSX.writeFile(wb, "Template_Master_Kategori.xlsx");
      break;
    }
    case "products": {
      const ws = XLSX.utils.aoa_to_sheet([
        ["sku", "item_name", "nama_brand", "item_group", "category"],
        ["IP15-128-RED", "Iphone 15 128GB Red", "Apple", "Iphone 15", "Handphone"],
        ["IP15-256-BLU", "Iphone 15 256GB Blue", "Apple", "Iphone 15", "Handphone"],
        ["IP16-128-BLK", "Iphone 16 128GB Black", "Apple", "Iphone 16", "Handphone"],
        ["SAM-S24-256", "Samsung Galaxy S24 256GB", "Samsung", "Galaxy S24", "Handphone"],
        ["MAC-AIR-M2", "MacBook Air M2 256GB", "Apple", "MacBook Air", "Laptop"],
      ]);
      ws["!cols"] = [
        { wch: 20 },
        { wch: 40 },
        { wch: 20 },
        { wch: 25 },
        { wch: 20 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Products");
      XLSX.writeFile(wb, "Template_Master_Produk_7000_SKU.xlsx");
      break;
    }
  }
}

// ----------------------------------------------------
// 2. ORDER MULTI-CHANNEL TEMPLATE GENERATOR
// ----------------------------------------------------

/**
 * Downloads standard Multi-Channel Order Excel Template with realistic multi-platform examples.
 */
export function downloadOrderTemplate() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Orders (Sample rows across channels)
  const wsOrders = XLSX.utils.aoa_to_sheet([
    [
      "no_invoice",
      "nama_customer",
      "channel",
      "sku",
      "qty",
      "amount",
      "nama_sales",
      "status",
      "catatan",
    ],
    // Contoh Pesanan TikTok Shop
    [
      "TT-2026-9801",
      "Budi Santoso",
      "TikTok",
      "IP15-128-RED",
      1,
      14500000,
      "Harvey",
      "Input Orderan",
      "Prioritas kirim hari ini",
    ],
    // Contoh Pesanan Shopee Multi-Item (No Invoice sama = 1 Nota gabungan)
    [
      "SP-2026-4402",
      "Citra Ayu",
      "Shopee",
      "IP15-128-RED",
      1,
      14500000,
      "Harvey",
      "Input Orderan",
      "Packing kayu + asuransi",
    ],
    [
      "SP-2026-4402",
      "Citra Ayu",
      "Shopee",
      "SAM-S24-256",
      1,
      13200000,
      "Burney",
      "Input Orderan",
      "Item kedua pesanan",
    ],
    // Contoh Tokopedia
    [
      "TKP-2026-1190",
      "Dimas Pratama",
      "Tokopedia",
      "IP16-128-BLK",
      2,
      32000000,
      "Harvey",
      "Input Orderan",
      "Instant Courier",
    ],
    // Contoh Lazada
    [
      "LZD-2026-5501",
      "Eko Prasetyo",
      "Lazada",
      "MAC-AIR-M2",
      1,
      16500000,
      "Naufal",
      "Input Orderan",
      "Customer VIP",
    ],
    // Contoh Offline Store
    [
      "OFF-2026-0033",
      "Fani Rahmawati",
      "Offline",
      "IP15-128-RED",
      1,
      14500000,
      "Harvey",
      "Input Orderan",
      "Walk-in customer tunai",
    ],
  ]);

  wsOrders["!cols"] = [
    { wch: 18 }, // no_invoice
    { wch: 22 }, // nama_customer
    { wch: 14 }, // channel
    { wch: 18 }, // sku
    { wch: 8 },  // qty
    { wch: 16 }, // amount
    { wch: 16 }, // nama_sales
    { wch: 16 }, // status
    { wch: 30 }, // catatan
  ];

  XLSX.utils.book_append_sheet(wb, wsOrders, "Orders");

  // Sheet 2: Panduan & Validasi
  const wsGuide = XLSX.utils.aoa_to_sheet([
    ["KOLOM", "STATUS", "PILIHAN / CONTOH", "KETERANGAN"],
    ["no_invoice", "Wajib", "TT-2026-9801 / INV-001", "Nomor resi / invoice pesanan unik"],
    ["nama_customer", "Wajib", "Budi Santoso", "Nama pembeli / akun marketplace"],
    ["channel", "Wajib", "Tokopedia | TikTok | Shopee | Lazada | Offline", "Harus salah satu dari 5 pilihan ini"],
    ["sku", "Wajib", "IP15-128-RED", "Kode SKU barang yang terdaftar di Master Data"],
    ["qty", "Wajib", "1, 2, 5, dst.", "Jumlah unit barang (angka)"],
    ["amount", "Wajib", "14500000", "Total nominal harga (angka tanpa titik/koma)"],
    ["nama_sales", "Opsional", "Harvey / Burney", "Nama sales penanggung jawab (otomatis disinkron)"],
    ["status", "Opsional", "Input Orderan / Diproses / Selesai Packing", "Default: 'Input Orderan'"],
    ["catatan", "Opsional", "Catatan packing / instruksi khusus", "Akan masuk ke timeline riwayat nota"],
  ]);
  wsGuide["!cols"] = [{ wch: 16 }, { wch: 10 }, { wch: 35 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, "Panduan_Channel_Status");

  XLSX.writeFile(wb, "Template_Import_Order_MultiChannel.xlsx");
}

// ----------------------------------------------------
// 3. EXCEL PARSER UTILITIES (Robust Header Matching)
// ----------------------------------------------------

function normalizeKey(str: string): string {
  return String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Reads any uploaded Excel or CSV file buffer into raw JSON array of row objects per sheet.
 */
export async function readExcelFile(file: File): Promise<{ [sheetName: string]: any[] }> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  const result: { [sheetName: string]: any[] } = {};

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });
    result[sheetName] = json;
  }

  return result;
}

/**
 * Parses Master Data workbook (supports all 6 sheets in 1 file, or single sheet).
 */
export function parseMasterDataSheets(sheets: { [sheetName: string]: any[] }): MasterExcelTemplateData {
  const result: MasterExcelTemplateData = {
    divisi: [],
    sales_person: [],
    brand: [],
    item_group: [],
    category: [],
    channel: [],
    customers: [],
    products: [],
  };

  const sheetNames = Object.keys(sheets);

  for (const sheetName of sheetNames) {
    const rows = sheets[sheetName];
    if (!Array.isArray(rows) || rows.length === 0) continue;

    const lowerName = sheetName.toLowerCase();

    // Check sheet type by name or by columns
    const firstRow = rows[0] || {};
    const keys = Object.keys(firstRow).map(normalizeKey);

    const isDivisi = lowerName.includes("divisi") || (keys.includes("namadivisi") && !keys.includes("namasales"));
    const isSales = lowerName.includes("sales") || (keys.includes("namasales") && (keys.includes("namadivisi") || keys.includes("divisi")));
    const isBrand = lowerName.includes("brand") || (keys.includes("namabrand") && !keys.includes("sku"));
    const isGroup = lowerName.includes("group") || lowerName.includes("kelompok") || keys.includes("namagroup");
    const isCategory = lowerName.includes("category") || lowerName.includes("kategori") || keys.includes("namakategori");
    const isChannel = lowerName.includes("channel") || keys.includes("namachannel");
    const isOrderStatus = lowerName.includes("status") || keys.includes("namastatus") || keys.includes("orderstatus");
    const isCustomer = lowerName.includes("customer") || lowerName.includes("pelanggan") || lowerName.includes("buyer") || keys.includes("namacustomer");
    const isProduct = lowerName.includes("product") || lowerName.includes("produk") || keys.includes("sku") || keys.includes("itemname");

    if (isDivisi) {
      for (const r of rows) {
        const val = findVal(r, ["nama_divisi", "namadivisi", "divisi", "nama"]);
        if (val) result.divisi!.push({ nama_divisi: String(val).trim() });
      }
    } else if (isSales) {
      for (const r of rows) {
        const namaSales = findVal(r, ["nama_sales", "namasales", "sales", "nama"]);
        const namaDivisi = findVal(r, ["nama_divisi", "namadivisi", "divisi"]);
        if (namaSales) {
          result.sales_person!.push({
            nama_sales: String(namaSales).trim(),
            nama_divisi: String(namaDivisi || "").trim(),
          });
        }
      }
    } else if (isBrand) {
      for (const r of rows) {
        const val = findVal(r, ["nama_brand", "namabrand", "brand", "merek", "merk", "nama"]);
        if (val) result.brand!.push({ nama_brand: String(val).trim() });
      }
    } else if (isGroup) {
      for (const r of rows) {
        const val = findVal(r, ["nama_group", "namagroup", "group", "kelompok", "item_group", "nama"]);
        if (val) result.item_group!.push({ nama_group: String(val).trim() });
      }
    } else if (isChannel) {
      for (const r of rows) {
        const val = findVal(r, ["nama_channel", "namachannel", "channel", "nama"]);
        const col = findVal(r, ["color", "warna", "warna_hex", "hex"]);
        if (val) {
          result.channel!.push({
            nama_channel: String(val).trim(),
            color: col ? String(col).trim() : undefined,
          });
        }
      }
    } else if (isOrderStatus) {
      if (!result.order_status) result.order_status = [];
      for (const r of rows) {
        const name = findVal(r, ["nama_status", "namastatus", "status", "nama"]);
        const col = findVal(r, ["color", "warna", "warna_hex", "hex"]);
        const urutan = findVal(r, ["urutan", "no", "order", "step"]);
        const next = findVal(r, ["next_status", "nextstatus", "status_berikutnya"]);
        const isFinal = findVal(r, ["is_final", "isfinal", "final", "tahap_akhir"]);
        if (name) {
          result.order_status.push({
            nama_status: String(name).trim(),
            color: col ? String(col).trim() : undefined,
            urutan: urutan !== undefined && urutan !== "" ? Number(urutan) : undefined,
            next_status: next ? String(next).trim() : undefined,
            is_final: isFinal === true || isFinal === "true" || isFinal === 1 || isFinal === "1",
          });
        }
      }
    } else if (isCustomer) {
      for (const r of rows) {
        const name = findVal(r, ["nama_customer", "namacustomer", "customer", "nama_pelanggan", "nama"]);
        const phone = findVal(r, ["no_telepon", "notelepon", "telepon", "phone", "hp", "wa", "no_hp", "nohp"]);
        const addr = findVal(r, ["alamat", "address", "alamat_lengkap"]);
        const city = findVal(r, ["kota", "city", "kabupaten"]);
        const email = findVal(r, ["email", "e_mail", "surel"]);
        const note = findVal(r, ["catatan", "catatan_customer", "note", "keterangan"]);
        if (name) {
          result.customers!.push({
            nama_customer: String(name).trim(),
            no_telepon: phone ? String(phone).trim() : undefined,
            alamat: addr ? String(addr).trim() : undefined,
            kota: city ? String(city).trim() : undefined,
            email: email ? String(email).trim() : undefined,
            catatan: note ? String(note).trim() : undefined,
          });
        }
      }
    } else if (isCategory) {
      for (const r of rows) {
        const val = findVal(r, ["nama_kategori", "namakategori", "kategori", "category", "nama"]);
        if (val) result.category!.push({ nama_kategori: String(val).trim() });
      }
    } else if (isProduct) {
      for (const r of rows) {
        const sku = findVal(r, ["sku", "kodesku", "kode_sku", "kode_barang", "kode"]);
        const itemName = findVal(r, ["item_name", "itemname", "nama_produk", "namaproduk", "nama_barang", "namabarang", "nama"]);
        const brand = findVal(r, ["nama_brand", "namabrand", "brand", "merek", "merk"]);
        const group = findVal(r, ["item_group", "itemgroup", "nama_group", "namagroup", "group", "kelompok"]);
        const cat = findVal(r, ["category", "kategori", "nama_kategori", "namakategori"]);

        if (sku && itemName) {
          result.products!.push({
            sku: String(sku).trim().toUpperCase(),
            item_name: String(itemName).trim(),
            nama_brand: String(brand || "").trim(),
            item_group: group ? String(group).trim() : undefined,
            category: cat ? String(cat).trim() : undefined,
          });
        }
      }
    }
  }

  return result;
}

/**
 * Parses Multi-Channel Orders sheet into standardized order rows.
 */
export function parseOrderSheet(rows: any[]): ParsedOrderRow[] {
  const result: ParsedOrderRow[] = [];

  for (const r of rows) {
    const inv = findVal(r, ["no_invoice", "noinvoice", "invoice", "nopesanan", "no_pesanan", "resi", "order_id", "id"]);
    const customer = findVal(r, ["nama_customer", "namacustomer", "customer", "pembeli", "nama_pembeli", "buyer", "nama"]);
    const channelRaw = findVal(r, ["channel", "salchannel", "platform", "marketplace", "salurkan"]);
    const sku = findVal(r, ["sku", "kodesku", "kode_sku", "kode_barang", "item_code"]);
    const qty = findVal(r, ["qty", "quantity", "jumlah", "pcs", "banyak"]);
    const amount = findVal(r, ["amount", "total", "subtotal", "harga", "harga_total", "nominal", "nilai"]);
    const sales = findVal(r, ["nama_sales", "namasales", "sales", "sales_person", "pic"]);
    const status = findVal(r, ["status", "status_pesanan", "state"]);
    const catatan = findVal(r, ["catatan", "note", "notes", "keterangan"]);

    if (!inv || !sku) continue;

    // Normalize Channel
    let channel: SalesChannel = "Offline";
    const chLower = String(channelRaw || "").toLowerCase();
    if (chLower.includes("toko") || chLower.includes("toped")) channel = "Tokopedia";
    else if (chLower.includes("tik") || chLower.includes("tt")) channel = "TikTok";
    else if (chLower.includes("shop") || chLower.includes("shopee")) channel = "Shopee";
    else if (chLower.includes("laz") || chLower.includes("lazada")) channel = "Lazada";
    else if (chLower.includes("off") || chLower.includes("toko") || chLower.includes("manual")) channel = "Offline";

    // Clean amounts
    const cleanQty = Math.max(1, parseInt(String(qty || "1").replace(/[^0-9]/g, "")) || 1);
    const cleanAmount = Math.max(
      0,
      parseFloat(String(amount || "0").replace(/[^0-9.]/g, "")) || 0
    );

    result.push({
      no_invoice: String(inv).trim().toUpperCase(),
      nama_customer: String(customer || "Pelanggan").trim(),
      channel,
      sku: String(sku).trim().toUpperCase(),
      qty: cleanQty,
      amount: cleanAmount,
      nama_sales: sales ? String(sales).trim() : undefined,
      status: status ? String(status).trim() : "Input Orderan",
      catatan: catatan ? String(catatan).trim() : undefined,
    });
  }

  return result;
}

function findVal(row: any, candidates: string[]): any {
  if (!row) return undefined;
  const rowKeys = Object.keys(row);

  // Exact match
  for (const c of candidates) {
    if (row[c] !== undefined && row[c] !== "") return row[c];
  }

  // Normalized key match
  const normCandidates = candidates.map(normalizeKey);
  for (const key of rowKeys) {
    const normKey = normalizeKey(key);
    if (normCandidates.includes(normKey)) {
      if (row[key] !== undefined && row[key] !== "") return row[key];
    }
  }

  return undefined;
}
