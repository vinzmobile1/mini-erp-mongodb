-- Mini ERP Rekap Penjualan Multi-Channel — Turso (libSQL) Schema
-- Database schema for Turso Cloud (libsql://...) / SQLite

CREATE TABLE IF NOT EXISTS divisi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama_divisi TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS sales_person (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama_sales TEXT NOT NULL,
    divisi_id INTEGER NOT NULL,
    FOREIGN KEY (divisi_id) REFERENCES divisi(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS brand (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama_brand TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
    sku TEXT PRIMARY KEY,
    item_name TEXT NOT NULL,
    item_group TEXT,
    category TEXT,
    brand_id INTEGER NOT NULL,
    FOREIGN KEY (brand_id) REFERENCES brand(id) ON DELETE RESTRICT
);

-- CATATAN KRUSIAL SNAPSHOT:
-- Kolom `nama_sales` dan `nama_divisi` di tabel `sales` HARUS disimpan sebagai string teks langsung (snapshot value)
-- saat transaksi dibuat, BUKAN sebagai Foreign Key ID.
-- Jika master data sales atau divisi dihapus di kemudian hari, data historis penjualan tidak boleh terhapus/berubah.
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    no_invoice TEXT NOT NULL,
    nama_customer TEXT NOT NULL,
    sku TEXT NOT NULL,
    qty INTEGER NOT NULL,
    amount REAL NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('Tokopedia', 'TikTok', 'Shopee', 'Lazada', 'Offline')),
    status TEXT NOT NULL DEFAULT 'Input Orderan' CHECK (status IN ('Input Orderan', 'Diproses', 'Selesai Packing')),
    nama_sales TEXT NOT NULL,
    nama_divisi TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sku) REFERENCES products(sku) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(no_invoice);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);

CREATE TABLE IF NOT EXISTS status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sales_id INTEGER NOT NULL,
    status_lama TEXT NOT NULL,
    status_baru TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sales_id) REFERENCES sales(id) ON DELETE CASCADE
);
