import { MongoClient, ServerApiVersion, Db } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://salesvinzmobile2_db_user:mZt6k2A0XO1HZpcr@erpaistudio.bpgfxxz.mongodb.net/?appName=erpaistudio";

let client: MongoClient;
let db: Db;
let isConnected = false;
let connectionError: string | null = null;

try {
  client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: false,
      deprecationErrors: true,
    },
    maxPoolSize: 150, // Optimal pool size: strictly <= 500 connections as requested
    minPoolSize: 10,  // Pre-warmed pool to eliminate connection handshake latency
    maxIdleTimeMS: 30000, // Reclaims idle connections after 30 seconds
    waitQueueTimeoutMS: 10000, // Prevents thread starvation
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
} catch (err: any) {
  console.error("Failed to initialize MongoDB client:", err);
  connectionError = err?.message || String(err);
}

export { client, db };

export function getDbInfo() {
  return {
    connected: isConnected,
    url: MONGODB_URI.replace(/:([^:@]{8})[^:@]*@/, ":***@"), // hide password
    error: connectionError,
    type: "MongoDB Atlas (Optimal Connection Pool: Max 150, Min 10)",
    poolConfig: {
      maxPoolSize: 150,
      minPoolSize: 10,
      maxIdleTimeMS: 30000,
      waitQueueTimeoutMS: 10000,
    },
  };
}

export async function getCollectionIndexes() {
  if (!db) return {};
  try {
    const salesIndexes = await db.collection("sales").indexes();
    return {
      sales: salesIndexes.map(idx => ({ name: idx.name, key: idx.key, unique: !!idx.unique }))
    };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function initDatabase() {
  try {
    if (!isConnected) {
      await client.connect();
      db = client.db("erpaistudio");
      isConnected = true;
      console.log("✅ Successfully connected to MongoDB Atlas");

      // Cleanup Obsolete Redundant Indexes on "sales" collection
      console.log("🧹 Checking and cleaning up obsolete database indexes on 'sales'...");
      const salesCol = db.collection("sales");
      
      const ALLOWED_SALES_INDEXES = new Set([
        "_id_",
        "no_invoice_1",
        "created_at_-1__id_-1",
        "status_1_created_at_-1__id_-1",
        "channel_1_created_at_-1__id_-1",
        "status_1_channel_1_created_at_-1__id_-1",
        "idx_sales_esr_status_channel_created_id",
        "items.sku_1",
        "nama_sales_1_nama_divisi_1",
        "nama_customer_1"
      ]);

      try {
        const existingIndexes = await salesCol.indexes();
        for (const idx of existingIndexes) {
          if (!ALLOWED_SALES_INDEXES.has(idx.name)) {
            console.log(`🗑️ Dropping redundant index: ${idx.name}`);
            await salesCol.dropIndex(idx.name).catch(err => console.warn(`Failed to drop index ${idx.name}:`, err.message));
          }
        }
      } catch (dropErr: any) {
        console.warn("Notice: Index cleanup scan skipped/warning:", dropErr.message);
      }

      // Setup Optimal Indexes following ESR Rule (Equality, Sort, Range)
      console.log("⚡ Verifying optimal MongoDB performance indexes...");
      await Promise.all([
        salesCol.createIndex({ no_invoice: 1 }, { unique: true }).catch(() => {}),
        salesCol.createIndex({ status: 1, channel: 1, created_at: -1, _id: -1 }, { name: "idx_sales_esr_status_channel_created_id" }).catch(() => {}),
        salesCol.createIndex({ status: 1, created_at: -1, _id: -1 }).catch(() => {}),
        salesCol.createIndex({ channel: 1, created_at: -1, _id: -1 }).catch(() => {}),
        salesCol.createIndex({ created_at: -1, _id: -1 }).catch(() => {}),
        salesCol.createIndex({ "items.sku": 1 }).catch(() => {}),
        salesCol.createIndex({ nama_sales: 1, nama_divisi: 1 }).catch(() => {}),
        salesCol.createIndex({ nama_customer: 1 }).catch(() => {}),
      ]);

      const productsCol = db.collection("products");
      await Promise.all([
        productsCol.createIndex({ sku: 1 }, { unique: true }),
        productsCol.createIndex({ brand_id: 1 }),
      ]);

      const brandCol = db.collection("brand");
      await brandCol.createIndex({ nama_brand: 1 }, { unique: true });

      const itemGroupCol = db.collection("item_group");
      await itemGroupCol.createIndex({ nama_group: 1 }, { unique: true });

      const categoryCol = db.collection("category");
      await categoryCol.createIndex({ nama_kategori: 1 }, { unique: true });

      const divisiCol = db.collection("divisi");
      await divisiCol.createIndex({ nama_divisi: 1 }, { unique: true });

      const salesPersonCol = db.collection("sales_person");
      await salesPersonCol.createIndex({ nama_sales: 1, divisi_id: 1 });

      const customerCol = db.collection("customers");
      await Promise.all([
        customerCol.createIndex({ nama_customer: 1 }, { unique: true }),
        customerCol.createIndex({ id: 1 }, { unique: true }),
        customerCol.createIndex({ no_telepon: 1 }, { sparse: true }),
        customerCol.createIndex({ created_at: -1 }),
      ]);

      const channelCol = db.collection("channel");
      await Promise.all([
        channelCol.createIndex({ nama_channel: 1 }, { unique: true }),
        channelCol.createIndex({ id: 1 }, { unique: true }),
      ]);

      const orderStatusCol = db.collection("order_status");
      await Promise.all([
        orderStatusCol.createIndex({ nama_status: 1 }, { unique: true }),
        orderStatusCol.createIndex({ id: 1 }, { unique: true }),
      ]);

      console.log("✅ MongoDB Schema & Indexes verified.");
    }
  } catch (err: any) {
    console.error("❌ Error initializing MongoDB:", err);
    connectionError = err?.message || String(err);
  }
}

export async function clearAllData() {
  return { ok: false, message: "Operasi penghapusan data dinonaktifkan." };
}

export async function clearTransactionsOnly() {
  return { ok: false, message: "Operasi penghapusan data dinonaktifkan." };
}

export async function seedDatabase() {
  // Sample data and seeding logic removed completely
  return;
}

