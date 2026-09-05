import express, { Request, Response } from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import dotenv from "dotenv";
import { ObjectId } from "mongodb";
import { client, db, initDatabase, seedDatabase, clearAllData, clearTransactionsOnly, getDbInfo, getCollectionIndexes } from "./server/db";

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const app = express();
let idCounter = Date.now() * 10;
const generateId = () => ++idCounter;
const server = http.createServer(app);

// CORS middleware for cross-origin frontend support (e.g., Netlify -> Render / Vercel)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Auto-connect MongoDB in Serverless environments (Vercel)
app.use(async (req, res, next) => {
  try {
    await initDatabase();
  } catch (err) {
    console.error("Database connection error in request handler:", err);
  }
  next();
});

// API status endpoint for health check
app.get("/api", (req, res) => {
  res.json({
    status: "ok",
    service: "Mini ERP Backend API",
    timestamp: new Date().toISOString()
  });
});

// Real-time Clients: WebSocket & Server-Sent Events (SSE)
let wss: WebSocketServer | null = null;
const wsClients = new Set<WebSocket>();
const sseClients = new Set<Response>();

if (!process.env.VERCEL && !process.env.NOW_REGION) {
  wss = new WebSocketServer({ server, path: "/api/ws" });
  wss.on("connection", (ws) => {
    wsClients.add(ws);
    try {
      ws.send(JSON.stringify({ type: "connection:ready", payload: { activeClients: wsClients.size + sseClients.size } }));
    } catch {}

    ws.on("message", (msg) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", time: Date.now() }));
        }
      } catch {}
    });

    ws.on("close", () => {
      wsClients.delete(ws);
    });
    ws.on("error", () => {
      wsClients.delete(ws);
    });
  });
}

// Real-time Event System (Stateless & Redis Pub/Sub Ready)
// In a distributed/multi-instance deployment, connect to Redis Pub/Sub (e.g. ioredis)
// and forward subscribed messages to local WebSocket/SSE connection clients.
export function broadcast(event: { type: string; payload: any }) {
  const payloadWithMeta = {
    ...event,
    _eventId: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    _timestamp: Date.now(),
  };
  const message = JSON.stringify(payloadWithMeta);

  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (err) {
        wsClients.delete(client);
      }
    }
  }

  const sseChunk = `data: ${message}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(sseChunk);
    } catch (err) {
      sseClients.delete(res);
    }
  }
}

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Health Check Endpoint
app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    db_connected: !!db,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Prevent crashing if MongoDB is not connected with graceful wait during boot
app.use("/api", async (req, res, next) => {
  if (req.path === "/db-status" || req.path === "/events" || req.path === "/health") return next();
  if (!db) {
    let waitCount = 0;
    while (!db && waitCount < 25) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      waitCount++;
    }
  }
  if (!db) {
    return res.status(503).json({ 
      error: "Koneksi database MongoDB belum siap atau gagal. Pastikan IP Address 0.0.0.0/0 sudah di-allow di Network Access MongoDB Atlas Anda, lalu refresh halaman." 
    });
  }
  next();
});

// SSE Route
app.get("/api/events", (req: Request, res: Response) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`data: ${JSON.stringify({ type: "connection:ready", payload: { activeClients: wsClients.size + sseClients.size + 1 } })}\n\n`);
  sseClients.add(res);
  const keepAlive = setInterval(() => {
    try { res.write(`: ping\n\n`); } catch { clearInterval(keepAlive); sseClients.delete(res); }
  }, 15000);
  req.on("close", () => { clearInterval(keepAlive); sseClients.delete(res); });
});

app.post("/api/import/master", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { divisi = [], sales_person = [], brand = [], item_group = [], category = [], products = [], channel = [], customers = [], order_status = [] } = req.body || {};
    const counts = { divisi: 0, sales_person: 0, brand: 0, item_group: 0, category: 0, products: 0, channel: 0, customers: 0, order_status: 0 };
    
    // High-performance bulk upsert helper for MongoDB
    const importMasterData = async (collection: string, data: any[], key: string, mapFunc: (x: any) => any) => {
      if (!Array.isArray(data) || data.length === 0) return 0;
      const col = db.collection(collection);
      const operations: any[] = [];
      const seenKeys = new Set<string>();

      for (const item of data) {
        const mapped = mapFunc(item);
        const val = mapped[key];
        if (!val || seenKeys.has(String(val))) continue;
        seenKeys.add(String(val));

        operations.push({
          updateOne: {
            filter: { [key]: val },
            update: { $setOnInsert: mapped },
            upsert: true
          }
        });
      }

      if (operations.length === 0) return 0;
      const res = await col.bulkWrite(operations, { ordered: false });
      return res.upsertedCount || 0;
    };

    counts.divisi = await importMasterData("divisi", divisi, "nama_divisi", (x) => ({
      id: generateId(), nama_divisi: String(x.nama_divisi).trim()
    }));
    
    counts.brand = await importMasterData("brand", brand, "nama_brand", (x) => ({
      id: generateId(), nama_brand: String(x.nama_brand).trim()
    }));
    
    counts.item_group = await importMasterData("item_group", item_group, "nama_group", (x) => ({
      id: generateId(), nama_group: String(x.nama_group).trim()
    }));

    counts.category = await importMasterData("category", category, "nama_kategori", (x) => ({
      id: generateId(), nama_kategori: String(x.nama_kategori).trim()
    }));

    counts.channel = await importMasterData("channel", channel, "nama_channel", (x) => ({
      id: generateId(), nama_channel: String(x.nama_channel).trim(), color: x.color || x.warna_hex || "#64748B"
    }));

    counts.order_status = await importMasterData("order_status", order_status, "nama_status", (x) => ({
      id: generateId(),
      nama_status: String(x.nama_status).trim(),
      color: x.color || x.warna_hex || "#F59E0B",
      urutan: Number(x.urutan) || 1,
      next_status: x.next_status || x.status_berikutnya || "",
      is_final: Boolean(x.is_final)
    }));

    counts.customers = await importMasterData("customers", customers, "nama_customer", (x) => ({
      id: generateId(),
      nama_customer: String(x.nama_customer).trim(),
      no_telepon: x.no_telepon ? String(x.no_telepon).trim() : "",
      alamat: x.alamat ? String(x.alamat).trim() : "",
      email: x.email ? String(x.email).trim() : "",
      catatan: x.catatan ? String(x.catatan).trim() : "",
      created_at: new Date()
    }));

    if (Array.isArray(sales_person) && sales_person.length > 0) {
      const col = db.collection("sales_person");
      const allDivisi = await db.collection("divisi").find({}, { projection: { id: 1, nama_divisi: 1 } }).toArray();
      const divMap = new Map(allDivisi.map(d => [d.nama_divisi, d.id]));
      const spOps: any[] = [];
      const seenSales = new Set<string>();

      for (const s of sales_person) {
        const name = String(s.nama_sales || "").trim();
        if (!name || seenSales.has(name)) continue;
        seenSales.add(name);

        const divName = String(s.nama_divisi || "").trim();
        const divisiId = divMap.get(divName) || 1;

        spOps.push({
          updateOne: {
            filter: { nama_sales: name },
            update: { $setOnInsert: { id: generateId(), nama_sales: name, divisi_id: divisiId } },
            upsert: true
          }
        });
      }

      if (spOps.length > 0) {
        const res = await col.bulkWrite(spOps, { ordered: false });
        counts.sales_person = res.upsertedCount || 0;
      }
    }

    if (Array.isArray(products) && products.length > 0) {
      const col = db.collection("products");
      const allBrands = await db.collection("brand").find({}, { projection: { id: 1, nama_brand: 1 } }).toArray();
      const brandMap = new Map(allBrands.map(b => [b.nama_brand, b.id]));
      const productOps: any[] = [];
      const seenSkus = new Set<string>();

      for (const p of products) {
        const sku = String(p.sku || "").trim().toUpperCase();
        if (!sku || seenSkus.has(sku)) continue;
        seenSkus.add(sku);

        const brandName = String(p.nama_brand || "General").trim();
        const brandId = brandMap.get(brandName) || 1;
        const mapped = {
          sku,
          item_name: String(p.item_name || "").trim(),
          item_group: p.item_group ? String(p.item_group).trim() : null,
          category: p.category ? String(p.category).trim() : null,
          brand_id: brandId
        };

        productOps.push({
          updateOne: {
            filter: { sku },
            update: { $set: mapped },
            upsert: true
          }
        });
      }

      if (productOps.length > 0) {
        await col.bulkWrite(productOps, { ordered: false });
        counts.products = productOps.length;
      }
    }

    const durationMs = Date.now() - startTime;
    broadcast({ type: "master:updated", payload: { action: "import", counts } });
    res.json({ ok: true, message: `Import master data berhasil.`, counts, durationMs });
  } catch (err: any) {
    console.error("Import Master Data Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Orders import with batch query and bulkWrite execution
app.post("/api/import/orders", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { orders = [], skipDuplicateInvoice = true } = req.body || {};
    if (!Array.isArray(orders) || orders.length === 0) return res.status(400).json({ error: "Data order kosong." });

    const groupedOrders = new Map<string, any[]>();
    for (const row of orders) {
      const inv = String(row.no_invoice || "").trim().toUpperCase();
      if (inv) {
        if (!groupedOrders.has(inv)) groupedOrders.set(inv, []);
        groupedOrders.get(inv)!.push(row);
      }
    }

    let importedInvoicesCount = 0;
    let importedItemsCount = 0;
    let totalImportedAmount = 0;
    const skippedInvoices: string[] = [];

    const salesCol = db.collection("sales");
    const invNumbers = Array.from(groupedOrders.keys());
    const existingDocs = await salesCol.find({ no_invoice: { $in: invNumbers } }, { projection: { no_invoice: 1 } }).toArray();
    const existingSet = new Set(existingDocs.map(d => d.no_invoice));

    const bulkOps: any[] = [];
    for (const [invNum, items] of groupedOrders.entries()) {
      const isExisting = existingSet.has(invNum);
      if (isExisting && skipDuplicateInvoice) {
        skippedInvoices.push(invNum);
        continue;
      }

      const headerItem = items[0];
      const itemsToInsert = items.map(it => ({
        sku: String(it.sku || "").trim().toUpperCase(),
        qty: Math.max(1, Number(it.qty) || 1),
        amount: Math.max(0, Number(it.amount) || 0)
      }));

      const doc = {
        no_invoice: invNum,
        nama_customer: String(headerItem.nama_customer || "Customer").trim(),
        no_telepon: headerItem.no_telepon ? String(headerItem.no_telepon).trim() : "",
        alamat: headerItem.alamat ? String(headerItem.alamat).trim() : "",
        channel: String(headerItem.channel || "Offline"),
        status: String(headerItem.status || "Input Orderan"),
        nama_sales: String(headerItem.nama_sales || "Admin Sales").trim(),
        nama_divisi: String(headerItem.nama_divisi || "General").trim(),
        created_at: new Date(),
        items: itemsToInsert,
        history: [{
          status_lama: 'Import System',
          status_baru: String(headerItem.status || "Input Orderan"),
          updated_at: new Date()
        }],
        notes: headerItem.catatan ? [{
          note: String(headerItem.catatan).trim(),
          author: 'Import Excel',
          created_at: new Date()
        }] : []
      };

      if (isExisting) {
        bulkOps.push({ updateOne: { filter: { no_invoice: invNum }, update: { $set: doc } } });
      } else {
        bulkOps.push({ insertOne: { document: doc } });
      }

      importedInvoicesCount++;
      importedItemsCount += itemsToInsert.length;
      totalImportedAmount += itemsToInsert.reduce((sum, i) => sum + i.amount, 0);
    }

    if (bulkOps.length > 0) {
      await salesCol.bulkWrite(bulkOps, { ordered: false });
    }

    const durationMs = Date.now() - startTime;
    broadcast({ type: "order:imported", payload: { importedInvoicesCount, importedItemsCount, totalImportedAmount } });
    res.json({ ok: true, importedInvoicesCount, importedItemsCount, totalImportedAmount, skippedInvoices, durationMs });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/db-status", async (req: Request, res: Response) => {
  res.json({ ok: true, info: getDbInfo(), serverTime: new Date().toISOString() });
});

app.get("/api/db-indexes", async (req: Request, res: Response) => {
  const indexes = await getCollectionIndexes();
  res.json({ ok: true, indexes });
});

// Dangerous destructive endpoints disabled permanently
app.post("/api/clear-all", async (_req: Request, res: Response) => {
  res.status(403).json({ ok: false, error: "Endpoint clear-all dinonaktifkan demi perlindungan data." });
});

app.post("/api/clear-transactions", async (_req: Request, res: Response) => {
  res.status(403).json({ ok: false, error: "Endpoint clear-transactions dinonaktifkan demi perlindungan data." });
});

app.post("/api/reseed", async (_req: Request, res: Response) => {
  res.status(403).json({ ok: false, error: "Endpoint reseed dinonaktifkan demi perlindungan data." });
});

let channelSeeded = false;
let orderStatusSeeded = false;

// Generic Master Data endpoints generator
function setupMasterEndpoints(paths: string | string[], collection: string, idField: string, nameField: string) {
  const pathList = Array.isArray(paths) ? paths : [paths];

  for (const path of pathList) {
    app.get(path, async (req: Request, res: Response) => {
      try {
        // Auto-seed default channel if collection empty
        if (collection === "channel" && !channelSeeded) {
          channelSeeded = true;
          const count = await db.collection("channel").countDocuments();
          if (count === 0) {
            await db.collection("channel").insertMany([
              { id: 1, nama_channel: "Tokopedia", color: "#10B981" },
              { id: 2, nama_channel: "Shopee", color: "#F97316" },
              { id: 3, nama_channel: "TikTok", color: "#18181B" },
              { id: 4, nama_channel: "Lazada", color: "#6366F1" },
              { id: 5, nama_channel: "Offline", color: "#64748B" },
            ]);
          }
        }

        // Auto-seed default order_status if collection empty
        if (collection === "order_status" && !orderStatusSeeded) {
          orderStatusSeeded = true;
          const count = await db.collection("order_status").countDocuments();
          if (count === 0) {
            await db.collection("order_status").insertMany([
              { id: 1, nama_status: "Input Orderan", color: "#F59E0B", urutan: 1, next_status: "Diproses", is_final: false },
              { id: 2, nama_status: "Diproses", color: "#3B82F6", urutan: 2, next_status: "Selesai Packing", is_final: false },
              { id: 3, nama_status: "Selesai Packing", color: "#10B981", urutan: 3, next_status: "", is_final: true },
              { id: 4, nama_status: "Batal", color: "#EF4444", urutan: 4, next_status: "", is_final: true },
              { id: 5, nama_status: "Retur", color: "#8B5CF6", urutan: 5, next_status: "", is_final: true },
            ]);
          }
        }

        let docs;
        if (collection === "sales_person") {
          docs = await db.collection(collection).aggregate([
            { $lookup: { from: "divisi", localField: "divisi_id", foreignField: "id", as: "divisi" } },
            { $unwind: { path: "$divisi", preserveNullAndEmptyArrays: true } },
            { $addFields: { nama_divisi: "$divisi.nama_divisi" } },
            { $project: { _id: 0, divisi: 0 } },
            { $sort: { id: 1 } }
          ]).toArray();
        } else if (collection === "products") {
          const keyword = String(req.query.search || req.query.s || req.query.q || "").trim();
          const pipeline: any[] = [];

          // 1. Stage 0: $search (MUST be index 0 if search keyword is provided)
          if (keyword) {
            pipeline.push({
              $search: {
                index: "default_products",
                compound: {
                  should: [
                    { autocomplete: { query: keyword, path: "item_name", fuzzy: { maxEdits: 1 } } },
                    { autocomplete: { query: keyword, path: "sku", fuzzy: { maxEdits: 1 } } }
                  ],
                  minimumShouldMatch: 1
                }
              }
            });
          }

          // 2. Additional stages (lookup brand info)
          pipeline.push(
            { $lookup: { from: "brand", localField: "brand_id", foreignField: "id", as: "brand" } },
            { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } },
            { $addFields: { nama_brand: "$brand.nama_brand" } },
            { $project: { _id: 0, brand: 0 } }
          );

          // 3. Sort (if no search keyword, default sort by sku)
          if (!keyword) {
            pipeline.push({ $sort: { sku: 1 } });
          }

          // 4. Pagination ($skip and $limit)
          if (req.query.skip) {
            const skipNum = Math.max(0, Number(req.query.skip) || 0);
            if (skipNum > 0) pipeline.push({ $skip: skipNum });
          }
          if (req.query.limit) {
            const limitNum = Math.max(1, Number(req.query.limit) || 100);
            pipeline.push({ $limit: limitNum });
          }

          docs = await db.collection(collection).aggregate(pipeline).toArray();
        } else if (collection === "order_status") {
          docs = await db.collection(collection).find({}, { projection: { _id: 0 } }).sort({ urutan: 1, id: 1 }).toArray();
        } else {
          docs = await db.collection(collection).find({}, { projection: { _id: 0 } }).sort({ [idField]: 1 }).toArray();
        }
        res.json(docs);
      } catch (err: any) { res.status(500).json({ error: err.message }); }
    });

    app.post(path, async (req: Request, res: Response) => {
      try {
        const body = req.body;
        const doc: any = { ...body };
        if (idField !== "sku") doc.id = generateId();
        if (doc.sku) doc.sku = String(doc.sku).trim().toUpperCase();
        if (doc.urutan) doc.urutan = Number(doc.urutan);
        await db.collection(collection).insertOne(doc);
        broadcast({ type: "master:updated", payload: { table: collection, item: doc } });
        res.status(201).json(doc);
      } catch (err: any) { res.status(400).json({ error: err.message }); }
    });

    app.put(`${path}/:id`, async (req: Request, res: Response) => {
      try {
        const id = idField === "sku" ? req.params.id : parseInt(req.params.id);
        const updateDoc = { ...req.body };
        delete updateDoc[idField];
        if (updateDoc.urutan !== undefined) updateDoc.urutan = Number(updateDoc.urutan);
        await db.collection(collection).updateOne({ [idField]: id }, { $set: updateDoc });
        const updated = await db.collection(collection).findOne({ [idField]: id }, { projection: { _id: 0 } });
        broadcast({ type: "master:updated", payload: { table: collection, item: updated } });
        res.json(updated);
      } catch (err: any) { res.status(400).json({ error: err.message }); }
    });

    app.delete(`${path}/:id`, async (req: Request, res: Response) => {
      try {
        const rawParam = decodeURIComponent(req.params.id);
        const id = idField === "sku" ? rawParam.trim() : (parseInt(rawParam) || rawParam);
        
        let result = await db.collection(collection).deleteOne({ [idField]: id });
        if (result.deletedCount === 0 && typeof id === "number") {
          result = await db.collection(collection).deleteOne({ [idField]: String(id) });
        } else if (result.deletedCount === 0 && typeof id === "string" && !isNaN(Number(id))) {
          result = await db.collection(collection).deleteOne({ [idField]: Number(id) });
        }

        // If divisi is deleted, also update or delete related sales persons
        if (collection === "divisi") {
          await db.collection("sales_person").deleteMany({ divisi_id: id });
        }
        // If brand is deleted, also delete related products
        if (collection === "brand") {
          await db.collection("products").deleteMany({ brand_id: id });
        }

        broadcast({ type: "master:updated", payload: { table: collection, deletedId: id } });
        res.json({ ok: true, id, deletedCount: result.deletedCount });
      } catch (err: any) { res.status(500).json({ error: err.message }); }
    });
  }
}

setupMasterEndpoints(["/api/divisi", "/api/divisions"], "divisi", "id", "nama_divisi");
setupMasterEndpoints(["/api/sales-person", "/api/sales-persons"], "sales_person", "id", "nama_sales");
setupMasterEndpoints(["/api/brand", "/api/brands"], "brand", "id", "nama_brand");
setupMasterEndpoints(["/api/item-group", "/api/item-groups"], "item_group", "id", "nama_group");
setupMasterEndpoints(["/api/category", "/api/categories"], "category", "id", "nama_kategori");
setupMasterEndpoints(["/api/products", "/api/product"], "products", "sku", "item_name");
setupMasterEndpoints(["/api/channel", "/api/channels"], "channel", "id", "nama_channel");
setupMasterEndpoints(["/api/customers", "/api/customer"], "customers", "id", "nama_customer");
setupMasterEndpoints(["/api/order-status", "/api/order-statuses"], "order_status", "id", "nama_status");

// Helper to determine next order status dynamically from Master Data
async function getNextOrderStatus(currentStatus: string): Promise<string | null> {
  const statusCol = db.collection("order_status");
  const trimmed = String(currentStatus || "").trim();
  const currentDoc = await statusCol.findOne({
    nama_status: { $regex: new RegExp(`^${trimmed}$`, "i") }
  });

  // 1. Explicit next_status specified in master data
  if (currentDoc?.next_status && currentDoc.next_status.trim()) {
    return currentDoc.next_status.trim();
  }

  // 2. Next status by sequential urutan if not marked final
  if (currentDoc?.urutan && !currentDoc.is_final) {
    const nextInOrder = await statusCol
      .find({ urutan: { $gt: currentDoc.urutan }, is_final: { $ne: true } })
      .sort({ urutan: 1 })
      .limit(1)
      .toArray();
    if (nextInOrder.length > 0) return nextInOrder[0].nama_status;
  }

  // 3. Fallback progression
  if (trimmed === "Input Orderan") return "Diproses";
  if (trimmed === "Diproses") return "Selesai Packing";

  return null;
}

const apiCache = new Map<string, { data: any; expiry: number }>();
function getFromCache(keyPrefix: string, url: string): any | null {
  const item = apiCache.get(`${keyPrefix}:${url}`);
  if (item && Date.now() < item.expiry) return item.data;
  return null;
}
function setInCache(keyPrefix: string, url: string, data: any, ttlSeconds: number) {
  apiCache.set(`${keyPrefix}:${url}`, { data, expiry: Date.now() + ttlSeconds * 1000 });
}

let productMapCache: { map: Map<string, string>; expiry: number } | null = null;
function invalidateOrdersAndAnalyticsCache() {
  productMapCache = null;
  apiCache.clear();
}
async function getProductNameMap(): Promise<Map<string, string>> {
  if (productMapCache && Date.now() < productMapCache.expiry) {
    return productMapCache.map;
  }
  const products = await db.collection("products").find({}, { projection: { sku: 1, item_name: 1 } }).toArray();
  const map = new Map<string, string>();
  for (const p of products) {
    if (p.sku) map.set(p.sku, p.item_name || p.sku);
  }
  productMapCache = { map, expiry: Date.now() + 300000 };
  return map;
}

// Helper to flatten orders for frontend with targeted database projection
async function fetchFlatOrders(query: any) {
  const docs = await db.collection("sales").find(query).sort({ created_at: -1 }).toArray();
  if (docs.length === 0) return [];

  // Extract unique SKUs present in these documents
  const skusNeeded = Array.from(new Set(docs.flatMap(d => (d.items || []).map((i: any) => i.sku)).filter(Boolean)));
  const products = skusNeeded.length > 0
    ? await db.collection("products").find({ sku: { $in: skusNeeded } }, { projection: { sku: 1, item_name: 1, brand_id: 1, category: 1, item_group: 1 } }).toArray()
    : [];
  const prodMap = new Map(products.map(p => [p.sku, p]));

  const brandIdsNeeded = Array.from(new Set(products.map(p => p.brand_id).filter(Boolean)));
  const brands = brandIdsNeeded.length > 0
    ? await db.collection("brand").find({ id: { $in: brandIdsNeeded } }, { projection: { id: 1, nama_brand: 1 } }).toArray()
    : [];
  const brandMap = new Map(brands.map(b => [b.id, b.nama_brand]));

  const flat: any[] = [];
  for (const doc of docs) {
    for (let idx = 0; idx < doc.items.length; idx++) {
      const item = doc.items[idx];
      const p = prodMap.get(item.sku) as any || {};
      flat.push({
        id: doc._id.toString() + "-" + item.sku + "-" + idx,
        no_invoice: doc.no_invoice,
        nama_customer: doc.nama_customer,
        no_telepon: doc.no_telepon || doc.customer_snapshot?.no_telepon || "",
        alamat: doc.alamat || doc.customer_snapshot?.alamat || "",
        sku: item.sku,
        item_name: p.item_name || "",
        nama_brand: brandMap.get(p.brand_id) || "",
        category: p.category || "",
        item_group: p.item_group || "",
        qty: item.qty,
        amount: item.amount,
        channel: doc.channel,
        status: doc.status,
        nama_sales: doc.nama_sales,
        nama_divisi: doc.nama_divisi,
        created_at: doc.created_at instanceof Date ? doc.created_at.toISOString() : new Date(doc.created_at).toISOString(),
      });
    }
  }
  return flat;
}

// Helper to convert date filter string (e.g. YYYY-MM-DD) into strict WIB (UTC+7 / Asia/Jakarta) start and end Date objects
function parseWibDateRange(startDateParam?: any, endDateParam?: any) {
  let start: Date | undefined;
  let end: Date | undefined;

  if (startDateParam) {
    const sStr = String(startDateParam).trim();
    const dateMatch = sStr.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      start = new Date(`${dateMatch[1]}T00:00:00.000+07:00`);
    } else {
      const parsed = new Date(sStr);
      if (!isNaN(parsed.getTime())) start = parsed;
    }
  }

  if (endDateParam) {
    const eStr = String(endDateParam).trim();
    const dateMatch = eStr.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      end = new Date(`${dateMatch[1]}T23:59:59.999+07:00`);
    } else {
      const parsed = new Date(eStr);
      if (!isNaN(parsed.getTime())) end = parsed;
    }
  }

  return { start, end };
}

// --- 1. ENDPOINT SUMMARY (Memperbaiki Bug Angka Badge Filter) ---
app.get("/api/invoices-summary", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, channel, status } = req.query;
    let filter: any = {};

    // Filter Tanggal
    if (startDate || endDate) {
      const { start, end } = parseWibDateRange(startDate, endDate);
      if (start || end) {
        filter.created_at = filter.created_at || {};
        if (start) filter.created_at.$gte = start;
        if (end) filter.created_at.$lte = end;
      }
    }

    // Filter Dinamis untuk menghitung Badge secara akurat (Cross-Filtering)
    // Jika user sedang memilih channel tertentu, hitungan status harus menyesuaikan
    if (channel && channel !== "ALL") filter.channel = channel;
    // Jika user sedang memilih status tertentu, hitungan channel harus menyesuaikan
    if (status && status !== "ALL") filter.status = status;

    const [statusAgg, channelAgg, totalCount] = await Promise.all([
      db.collection("sales").aggregate([
        { $match: filter },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]).toArray(),
      db.collection("sales").aggregate([
        { $match: filter },
        { $group: { _id: "$channel", count: { $sum: 1 } } }
      ]).toArray(),
      db.collection("sales").countDocuments(filter)
    ]);

    const statusCounts: Record<string, number> = {};
    for (const s of statusAgg) {
      if (s._id) statusCounts[s._id] = s.count;
    }

    const channelCounts: Record<string, number> = {};
    for (const c of channelAgg) {
      if (c._id) channelCounts[c._id] = c.count;
    }

    res.json({ total: totalCount, statusCounts, channelCounts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- 2. ENDPOINT INVOICES (Rewrite Logika Pencarian Exact & Regex) ---
app.get("/api/invoices", async (req: Request, res: Response) => {
  try {
    const { 
      status, channel, startDate, endDate, limit = "50", cursor, format,
      invoice, customer, sales, divisi, sku // Parameter input search baru yang dipisah
    } = req.query;
    
    const limitNum = Math.min(Math.max(Number(limit) || 50, 1), 200);

    // Membangun Filter yang Rapi & Spesifik
    const finalFilter: any = {};
    
    // Quick Filters
    if (status && status !== "ALL") finalFilter.status = status;
    if (channel && channel !== "ALL") finalFilter.channel = channel;

    // Filter Tanggal
    if (startDate || endDate) {
      const { start, end } = parseWibDateRange(startDate, endDate);
      if (start || end) {
        finalFilter.created_at = {};
        if (start) finalFilter.created_at.$gte = start;
        if (end) finalFilter.created_at.$lte = end;
      }
    }

    // LOGIKA PENCARIAN TERPISAH (Sangat Ringan & Cepat)
    
    // 1. Invoice -> EXACT MATCH (Harus sama persis)
    if (invoice) {
      finalFilter.no_invoice = String(invoice).trim();
    }
    
    // 2. Teks Bebas -> REGEX PARTIAL MATCH (Mencari sebagian kata, bebas huruf besar/kecil)
    if (customer) {
      finalFilter.nama_customer = new RegExp(String(customer).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").trim(), "i");
    }
    if (sales) {
      finalFilter.nama_sales = new RegExp(String(sales).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").trim(), "i");
    }
    if (divisi) {
      finalFilter.nama_divisi = new RegExp(String(divisi).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").trim(), "i");
    }
    if (sku) {
      finalFilter["items.sku"] = new RegExp(String(sku).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").trim(), "i");
    }

    // Cursor Pagination (Tidak Berubah)
    let cursorCond: any = null;
    if (cursor) {
      const parts = String(cursor).split("_");
      const cursorDate = new Date(parts[0]);
      if (!isNaN(cursorDate.getTime())) {
        if (parts.length > 1 && parts[1]) {
          try {
            const cursorId = parts[1].length === 24 ? new ObjectId(parts[1]) : parts[1];
            cursorCond = {
              $or: [
                { created_at: { $lt: cursorDate } },
                { created_at: cursorDate, _id: { $lt: cursorId } }
              ]
            };
          } catch { cursorCond = { created_at: { $lt: cursorDate } }; }
        } else { cursorCond = { created_at: { $lt: cursorDate } }; }
      }
    }

    if (cursorCond) {
      if (Object.keys(finalFilter).length > 0) {
        finalFilter.$and = [cursorCond];
      } else {
        Object.assign(finalFilter, cursorCond);
      }
    }

    // Eksekusi Query Bawaan MongoDB (Tanpa Atlas Search)
    const fallbackPipeline: any[] = [];
    if (Object.keys(finalFilter).length > 0) {
      fallbackPipeline.push({ $match: finalFilter });
    }
    fallbackPipeline.push({ $sort: { created_at: -1, _id: -1 } });
    fallbackPipeline.push({ $limit: limitNum + 1 });

    const docs = await db.collection("sales").aggregate(fallbackPipeline).toArray();

    // Pemrosesan Data ke Frontend (Tidak Berubah)
    const hasMore = docs.length > limitNum;
    const pagedDocs = docs.slice(0, limitNum);
    const prodMap = await getProductNameMap();

    const invoices = pagedDocs.map(doc => {
      const mappedItems = (doc.items || []).map((it: any) => ({
        sku: it.sku,
        item_name: it.item_name || prodMap.get(it.sku) || it.sku,
        qty: Number(it.qty) || 1,
        amount: Number(it.amount) || 0,
      }));

      return {
        no_invoice: doc.no_invoice,
        nama_customer: doc.nama_customer,
        no_telepon: doc.no_telepon || doc.customer_snapshot?.no_telepon || "",
        alamat: doc.alamat || doc.customer_snapshot?.alamat || "",
        channel: doc.channel,
        status: doc.status,
        nama_sales: doc.nama_sales,
        nama_divisi: doc.nama_divisi,
        created_at: doc.created_at instanceof Date ? doc.created_at.toISOString() : new Date(doc.created_at).toISOString(),
        item_count: mappedItems.length,
        total_qty: mappedItems.reduce((s: any, i: any) => s + (Number(i.qty) || 0), 0),
        total_amount: mappedItems.reduce((s: any, i: any) => s + (Number(i.amount) || 0), 0),
        items: mappedItems,
        _id: doc._id ? doc._id.toString() : undefined,
      };
    });

    const lastDoc = pagedDocs[pagedDocs.length - 1];
    const nextCursor = hasMore && lastDoc
      ? `${(lastDoc.created_at instanceof Date ? lastDoc.created_at : new Date(lastDoc.created_at)).toISOString()}_${lastDoc._id ? lastDoc._id.toString() : ""}`
      : null;

    if (format === "array") return res.json(invoices);

    res.json({ data: invoices, nextCursor: hasMore ? nextCursor : null, hasMore, count: invoices.length });
  } catch (err: any) { 
    res.status(500).json({ error: err.message }); 
  }
});

app.get("/api/invoices/:no_invoice", async (req: Request, res: Response) => {
  try {
    const no_invoice = decodeURIComponent(req.params.no_invoice);
    const doc = await db.collection("sales").findOne({ no_invoice });
    if (!doc) return res.status(404).json({ error: "Invoice not found" });

    const prodMap = await getProductNameMap();
    const mappedItems = (doc.items || []).map((it: any) => ({
      sku: it.sku,
      item_name: it.item_name || prodMap.get(it.sku) || it.sku,
      qty: Number(it.qty) || 1,
      amount: Number(it.amount) || 0,
    }));

    // Format like InvoiceDetailResponse
    const invoice = {
      no_invoice: doc.no_invoice,
      nama_customer: doc.nama_customer,
      no_telepon: doc.no_telepon || doc.customer_snapshot?.no_telepon || "",
      alamat: doc.alamat || doc.customer_snapshot?.alamat || "",
      customer_snapshot: doc.customer_snapshot,
      channel: doc.channel,
      status: doc.status,
      nama_sales: doc.nama_sales,
      nama_divisi: doc.nama_divisi,
      created_at: doc.created_at instanceof Date ? doc.created_at.toISOString() : new Date(doc.created_at).toISOString(),
      item_count: mappedItems.length,
      total_qty: mappedItems.reduce((s: any, i: any) => s + i.qty, 0),
      total_amount: mappedItems.reduce((s: any, i: any) => s + i.amount, 0),
      items: mappedItems,
    };

    const flatOrderArr = await fetchFlatOrders({ no_invoice: doc.no_invoice });
    
    res.json({
      invoice,
      items: flatOrderArr, // the flat items array expected by frontend
      history: doc.history || [],
      notes: doc.notes || []
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get("/api/orders", async (req: Request, res: Response) => {
  try {
    const cached = getFromCache("orders", req.originalUrl);
    if (cached) return res.json(cached);
    const { status, channel, limit = "20000" } = req.query;
    let filter: any = {};
    if (status && status !== "ALL") filter.status = status;
    if (channel && channel !== "ALL") filter.channel = channel;
    
    // We can't limit flat directly easily with MongoDB, so we just limit documents
    const flat = await fetchFlatOrders(filter);
    const result = limit === "all" ? flat : flat.slice(0, Number(limit));
    
    setInCache("orders", req.originalUrl, result, 30);
    res.json(result);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post("/api/orders", async (req: Request, res: Response) => {
  try {
    const { no_invoice, nama_customer, sales_person_id, channel, items, no_telepon, alamat } = req.body;
    
    const sp = await db.collection("sales_person").findOne({ id: Number(sales_person_id) });
    const div = sp ? await db.collection("divisi").findOne({ id: sp.divisi_id }) : null;

    const trimmedCust = String(nama_customer || "Customer").trim();

    // Auto-register to master 'customers' if not already in collection
    if (trimmedCust) {
      const custExists = await db.collection("customers").findOne({ nama_customer: trimmedCust });
      if (!custExists) {
        await db.collection("customers").insertOne({
          id: generateId(),
          nama_customer: trimmedCust,
          no_telepon: no_telepon ? String(no_telepon).trim() : "",
          alamat: alamat ? String(alamat).trim() : "",
          email: "",
          catatan: "Terdaftar otomatis dari Input Order",
          created_at: new Date()
        });
        broadcast({ type: "master:updated", payload: { table: "customers" } });
      }
    }

    const doc = {
      no_invoice,
      nama_customer: trimmedCust,
      no_telepon: no_telepon || "",
      alamat: alamat || "",
      channel,
      status: "Input Orderan",
      nama_sales: sp?.nama_sales || "Unknown",
      nama_divisi: div?.nama_divisi || "Unknown",
      created_at: new Date(),
      items: (items || []).map((i: any) => {
        const skuUpper = String(i.sku || "").trim().toUpperCase();
        return {
          sku: skuUpper,
          qty: Math.max(1, Number(i.qty) || 1),
          amount: Math.max(0, Number(i.amount) || 0)
        };
      }),
      history: [],
      notes: []
    };

    await db.collection("sales").insertOne(doc);
    
    const flat = await fetchFlatOrders({ no_invoice });
    broadcast({ type: "order:created", payload: { invoice: no_invoice } });
    res.status(201).json(flat);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

app.put("/api/invoices/:no_invoice", async (req: Request, res: Response) => {
  try {
    const { no_invoice } = req.params;
    const { no_invoice: new_no_invoice, nama_customer, sales_person_id, channel, items, no_telepon, alamat } = req.body;
    
    const doc = await db.collection("sales").findOne({ no_invoice });
    if (!doc) return res.status(404).json({ error: "Not found" });

    const sp = await db.collection("sales_person").findOne({ id: Number(sales_person_id) });
    const div = sp ? await db.collection("divisi").findOne({ id: sp.divisi_id }) : null;

    const trimmedCust = String(nama_customer || "Customer").trim();
    const newSalesName = sp?.nama_sales || doc.nama_sales || "Unknown";
    const newDivisiName = div?.nama_divisi || doc.nama_divisi || "Unknown";
    const editAuthor = String(req.body.author || req.body.userRole || "Admin").trim();

    // Track detailed field changes into history log
    const changes: string[] = [];
    if (doc.nama_sales && doc.nama_sales !== newSalesName) {
      changes.push(`Sales Person (${doc.nama_sales} → ${newSalesName})`);
    }
    if (doc.nama_customer && doc.nama_customer !== trimmedCust) {
      changes.push(`Nama Customer (${doc.nama_customer} → ${trimmedCust})`);
    }
    if (doc.channel && doc.channel !== channel) {
      changes.push(`Channel (${doc.channel} → ${channel})`);
    }
    if (doc.no_telepon !== (no_telepon || "")) {
      changes.push(`No Telepon (${doc.no_telepon || "-"} → ${no_telepon || "-"})`);
    }
    if (doc.alamat !== (alamat || "")) {
      changes.push(`Alamat (${doc.alamat || "-"} → ${alamat || "-"})`);
    }
    if (new_no_invoice && new_no_invoice !== no_invoice) {
      changes.push(`No Invoice (${no_invoice} → ${new_no_invoice})`);
    }

    // Compare items if changed
    const newItems = (items || []).map((i: any) => ({
      sku: String(i.sku || "").trim().toUpperCase(),
      qty: Math.max(1, Number(i.qty) || 1),
      amount: Math.max(0, Number(i.amount) || 0)
    }));

    const oldQty = (doc.items || []).reduce((acc: number, it: any) => acc + (Number(it.qty) || 0), 0);
    const newQty = newItems.reduce((acc: number, it: any) => acc + (Number(it.qty) || 0), 0);
    if (oldQty !== newQty || doc.items?.length !== newItems.length) {
      changes.push(`Item Produk (${doc.items?.length || 0} item / ${oldQty} pcs → ${newItems.length} item / ${newQty} pcs)`);
    }

    const history = doc.history || [];
    if (changes.length > 0) {
      changes.forEach(changeStr => {
        history.push({
          status_lama: "Edit Nota",
          status_baru: changeStr,
          author: editAuthor,
          updated_at: new Date()
        });
      });
    }

    const updateData = {
      no_invoice: new_no_invoice || no_invoice,
      nama_customer: trimmedCust,
      no_telepon: no_telepon || "",
      alamat: alamat || "",
      channel,
      nama_sales: newSalesName,
      nama_divisi: newDivisiName,
      items: newItems,
      history,
      updated_at: new Date()
    };

    await db.collection("sales").updateOne({ no_invoice }, { $set: updateData });

    invalidateOrdersAndAnalyticsCache();
    broadcast({ type: "order:updated", payload: { invoice: updateData.no_invoice, history } });
    res.json({ ok: true, history, orders: await fetchFlatOrders({ no_invoice: updateData.no_invoice }) });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

app.patch("/api/invoices/:no_invoice/status", async (req: Request, res: Response) => {
  try {
    const { no_invoice } = req.params;
    const { status, author } = req.body;
    const doc = await db.collection("sales").findOne({ no_invoice });
    if (!doc) return res.status(404).json({ error: "Not found" });

    // Guard: Prevent duplicate write & spam if already in target status
    if (doc.status === status) {
      return res.json({ ok: true, no_invoice, status, history: doc.history || [], unchanged: true });
    }

    const history = doc.history || [];
    history.push({
      status_lama: doc.status,
      status_baru: status,
      author: String(author || "Admin").trim(),
      updated_at: new Date()
    });

    await db.collection("sales").updateOne({ no_invoice }, { $set: { status, history } });
    invalidateOrdersAndAnalyticsCache();
    broadcast({ type: "invoice:status", payload: { no_invoice, status, history } });
    res.json({ ok: true, no_invoice, status, history });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

app.patch("/api/orders/:id/status", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const no_invoice = id.split("-").slice(0, -1).join("-") || id;
    const { status, author } = req.body;
    const doc = await db.collection("sales").findOne({ no_invoice });
    if (!doc) return res.status(404).json({ error: "Not found" });

    // Guard: Prevent duplicate write & spam if already in target status
    if (doc.status === status) {
      return res.json({ ok: true, status, history: doc.history || [], unchanged: true });
    }

    const history = doc.history || [];
    history.push({
      status_lama: doc.status,
      status_baru: status,
      author: String(author || "Admin").trim(),
      updated_at: new Date()
    });
    await db.collection("sales").updateOne({ no_invoice }, { $set: { status, history } });
    invalidateOrdersAndAnalyticsCache();
    broadcast({ type: "order:status", payload: { id, status, oldStatus: doc.status, history } });
    res.json({ ok: true, status, history });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

app.post("/api/invoices/:no_invoice/advance", async (req: Request, res: Response) => {
  try {
    const { no_invoice } = req.params;
    const { author } = req.body;
    const doc = await db.collection("sales").findOne({ no_invoice });
    if (!doc) return res.status(404).json({ error: "Not found" });

    const nextStatus = await getNextOrderStatus(doc.status);
    if (!nextStatus) {
      return res.status(400).json({ error: `Status "${doc.status}" sudah di tahap akhir.` });
    }

    const history = doc.history || [];
    history.push({
      status_lama: doc.status,
      status_baru: nextStatus,
      author: String(author || "Admin").trim(),
      updated_at: new Date()
    });
    await db.collection("sales").updateOne({ no_invoice }, { $set: { status: nextStatus, history } });
    invalidateOrdersAndAnalyticsCache();
    broadcast({ type: "invoice:status", payload: { no_invoice, status: nextStatus, history } });
    res.json({ ok: true, status: nextStatus, history });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

// --- PERBAIKAN BUG PARSING INVOICE ADVANCE STATUS ---
app.post("/api/orders/:id/advance", async (req: Request, res: Response) => {
  try {
    const rawId = decodeURIComponent(req.params.id);
    let no_invoice = rawId;

    // Logika Pintar: Ekstraksi hanya nomor invoice berformat INV-
    if (rawId.includes("INV-")) {
      const match = rawId.match(/INV-[A-Za-z0-9-]+/);
      if (match) {
        // Ini memastikan potongan ekstra (-SKU dll) tidak ikut, 
        // tapi jika ID sudah benar (INV-2026-001) tidak akan rusak.
        no_invoice = match[0]; 
      }
    } else if (rawId.includes("-")) {
      // Cadangan jika kamu menggunakan format custom selain "INV-"
      const parts = rawId.split("-");
      if (parts.length > 2) {
        no_invoice = parts.slice(0, -2).join("-");
      }
    }

    const { author } = req.body;
    const doc = await db.collection("sales").findOne({ no_invoice });
    if (!doc) return res.status(404).json({ error: "Not found" });

    const nextStatus = await getNextOrderStatus(doc.status);
    if (!nextStatus) {
      return res.status(400).json({ error: `Status "${doc.status}" sudah di tahap akhir.` });
    }

    const history = doc.history || [];
    history.push({
      status_lama: doc.status,
      status_baru: nextStatus,
      author: String(author || "Admin").trim(),
      updated_at: new Date()
    });
    
    await db.collection("sales").updateOne({ no_invoice }, { $set: { status: nextStatus, history } });
    broadcast({ type: "order:status", payload: { id: rawId, status: nextStatus, oldStatus: doc.status } });
    res.json({ ok: true, status: nextStatus });
  } catch (err: any) { 
    res.status(400).json({ error: err.message }); 
  }
});

app.post("/api/invoices/:no_invoice/notes", async (req: Request, res: Response) => {
  try {
    const no_invoice = decodeURIComponent(req.params.no_invoice);
    const { note, author } = req.body;
    if (!note || !String(note).trim()) return res.status(400).json({ error: "Catatan tidak boleh kosong" });

    const trimmedNote = String(note).trim();
    const noteAuthor = String(author || "Admin").trim();

    const doc = await db.collection("sales").findOne({ no_invoice });
    if (!doc) return res.status(404).json({ error: "Invoice tidak ditemukan" });

    // Deduplication guard: check if identical note was saved within the last 5 seconds
    const existingNotes = doc.notes || [];
    const recentDuplicate = existingNotes.find((n: any) => {
      if (n.note === trimmedNote && n.author === noteAuthor) {
        const noteTime = new Date(n.created_at).getTime();
        const ageMs = Date.now() - noteTime;
        return ageMs < 5000;
      }
      return false;
    });

    if (recentDuplicate) {
      return res.json(recentDuplicate);
    }

    const noteObj = {
      id: generateId(),
      note: trimmedNote,
      author: noteAuthor,
      created_at: new Date().toISOString(),
    };

    await db.collection("sales").updateOne(
      { no_invoice },
      { $push: { notes: noteObj } as any }
    );
    invalidateOrdersAndAnalyticsCache();
    broadcast({ type: "invoice:note", payload: { no_invoice, note: noteObj } });
    res.status(201).json(noteObj);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

app.delete("/api/invoices/:no_invoice", async (req: Request, res: Response) => {
  try {
    const no_invoice = decodeURIComponent(req.params.no_invoice);
    const result = await db.collection("sales").deleteOne({ no_invoice });
    invalidateOrdersAndAnalyticsCache();
    broadcast({ type: "invoice:deleted", payload: { no_invoice } });
    broadcast({ type: "order:deleted", payload: { no_invoice } });
    res.json({ ok: true, no_invoice, deletedCount: result.deletedCount });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/orders/:id", async (req: Request, res: Response) => {
  try {
    const rawId = decodeURIComponent(req.params.id);
    let no_invoice = rawId;
    if (!rawId.startsWith("INV-") && rawId.includes("INV-")) {
      const match = rawId.match(/INV-[A-Za-z0-9-]+/);
      if (match) no_invoice = match[0];
    }
    const result = await db.collection("sales").deleteOne({ no_invoice });
    invalidateOrdersAndAnalyticsCache();
    broadcast({ type: "invoice:deleted", payload: { no_invoice } });
    broadcast({ type: "order:deleted", payload: { id: rawId, no_invoice } });
    res.json({ ok: true, no_invoice, deletedCount: result.deletedCount });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get("/api/analytics/summary", async (req: Request, res: Response) => {
  try {
    const range = (req.query.range as string) || "this_month";

    // Use Jakarta (WIB / UTC+7) date formatting for accurate local business reporting
    const getJakartaDateStr = (d: Date) => {
      try {
        return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);
      } catch {
        return d.toISOString().substring(0, 10);
      }
    };

    const now = new Date();
    const todayJakartaStr = getJakartaDateStr(now);

    let startDate: Date;
    let endDate: Date | null = null;
    let startDateStr: string | null = null;
    let endDateStr: string | null = null;

    if (range === "7days") {
      const cur = new Date(`${todayJakartaStr}T00:00:00+07:00`);
      cur.setDate(cur.getDate() - 6);
      startDateStr = getJakartaDateStr(cur);
      endDateStr = todayJakartaStr;
      startDate = new Date(`${startDateStr}T00:00:00.000+07:00`);
      endDate = new Date(`${endDateStr}T23:59:59.999+07:00`);
    } else if (range === "30days") {
      const cur = new Date(`${todayJakartaStr}T00:00:00+07:00`);
      cur.setDate(cur.getDate() - 29);
      startDateStr = getJakartaDateStr(cur);
      endDateStr = todayJakartaStr;
      startDate = new Date(`${startDateStr}T00:00:00.000+07:00`);
      endDate = new Date(`${endDateStr}T23:59:59.999+07:00`);
    } else if (range === "this_month") {
      const [curY, curM] = todayJakartaStr.split("-");
      startDateStr = `${curY}-${curM}-01`;
      endDateStr = todayJakartaStr;
      startDate = new Date(`${startDateStr}T00:00:00.000+07:00`);
      endDate = new Date(`${endDateStr}T23:59:59.999+07:00`);
    } else if (range === "last_month") {
      const [curYStr, curMStr] = todayJakartaStr.split("-");
      let curY = parseInt(curYStr, 10);
      let curM = parseInt(curMStr, 10);
      let lmY = curY;
      let lmM = curM - 1;
      if (lmM === 0) {
        lmM = 12;
        lmY -= 1;
      }
      const lastDayOfLm = new Date(Date.UTC(lmY, lmM, 0)).getUTCDate();
      const lmMStr = String(lmM).padStart(2, "0");
      startDateStr = `${lmY}-${lmMStr}-01`;
      endDateStr = `${lmY}-${lmMStr}-${String(lastDayOfLm).padStart(2, "0")}`;
      startDate = new Date(`${startDateStr}T00:00:00.000+07:00`);
      endDate = new Date(`${endDateStr}T23:59:59.999+07:00`);
    } else if (range === "all") {
      startDate = new Date(0);
      endDate = null;
      startDateStr = null;
      endDateStr = null;
    } else if (range === "custom") {
      const rawStart = req.query.start_date as string;
      const rawEnd = req.query.end_date as string;
      if (rawStart) {
        startDateStr = rawStart;
        startDate = new Date(`${startDateStr}T00:00:00.000+07:00`);
      } else {
        startDate = new Date(0);
      }
      if (rawEnd) {
        endDateStr = rawEnd;
        endDate = new Date(`${endDateStr}T23:59:59.999+07:00`);
      }
    } else {
      startDate = new Date(0);
    }

    const dateFilter: any = { $gte: startDate };
    if (endDate) {
      dateFilter.$lte = endDate;
    }
    const matchStage: any = { created_at: dateFilter };

    const todayStart = new Date(`${todayJakartaStr}T00:00:00.000+07:00`);
    const todayEnd = new Date(`${todayJakartaStr}T23:59:59.999+07:00`);

    // Refactored from $facet to parallel Promise.all() queries to avoid MongoDB 16MB BSON limit
    const salesCol = db.collection("sales");

    const [
      overviewRes,
      perStatusRes,
      perChannelRes,
      topSalesRes,
      topProductsRes,
      dailySalesRes,
      todayByStatusRes
    ] = await Promise.all([
      // 1. Overview
      salesCol.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            total_revenue: { $sum: { $sum: "$items.amount" } },
            total_orders: { $sum: 1 },
            total_items_sold: { $sum: { $sum: "$items.qty" } }
          }
        }
      ]).toArray(),

      // 2. Per Status
      salesCol.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            total_amount: { $sum: { $sum: "$items.amount" } }
          }
        }
      ]).toArray(),

      // 3. Per Channel
      salesCol.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: "$channel",
            order_count: { $sum: 1 },
            total_qty: { $sum: { $sum: "$items.qty" } },
            total_amount: { $sum: { $sum: "$items.amount" } }
          }
        }
      ]).toArray(),

      // 4. Top Sales
      salesCol.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: { nama_sales: "$nama_sales", nama_divisi: "$nama_divisi" },
            order_count: { $sum: 1 },
            total_amount: { $sum: { $sum: "$items.amount" } }
          }
        },
        { $sort: { total_amount: -1 } },
        { $limit: 5 }
      ]).toArray(),

      // 5. Top Products
      salesCol.aggregate([
        { $match: matchStage },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.sku",
            total_qty: { $sum: "$items.qty" },
            total_amount: { $sum: "$items.amount" }
          }
        },
        { $sort: { total_amount: -1 } },
        { $limit: 5 }
      ]).toArray(),

      // 6. Daily Sales
      salesCol.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$created_at",
                timezone: "+07:00"
              }
            },
            omset: { $sum: { $sum: "$items.amount" } },
            qty: { $sum: { $sum: "$items.qty" } },
            jumlah_nota: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]).toArray(),

      // 7. Today By Status
      salesCol.aggregate([
        {
          $match: {
            created_at: {
              $gte: todayStart,
              $lte: todayEnd
            }
          }
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            total_amount: { $sum: { $sum: "$items.amount" } }
          }
        }
      ]).toArray()
    ]);

    const overview = overviewRes?.[0] || {
      total_revenue: 0,
      total_orders: 0,
      total_items_sold: 0
    };

    const per_status = perStatusRes.map((s: any) => ({
      status: s._id || "Unknown",
      count: s.count,
      total_amount: s.total_amount
    }));

    const per_channel = perChannelRes.map((c: any) => ({
      channel: c._id || "Unknown",
      order_count: c.order_count,
      total_qty: c.total_qty,
      total_amount: c.total_amount
    }));

    const top_sales = topSalesRes.map((s: any) => ({
      nama_sales: s._id?.nama_sales || "Unknown",
      nama_divisi: s._id?.nama_divisi || "-",
      order_count: s.order_count,
      total_amount: s.total_amount
    }));

    const topSkus = topProductsRes.map((p: any) => p._id).filter(Boolean);

    const prods = topSkus.length > 0 
      ? await db.collection("products").find({ sku: { $in: topSkus } }, { projection: { sku: 1, item_name: 1, brand_id: 1 } }).toArray() 
      : [];
    const pmap = new Map(prods.map(p => [p.sku, p]));

    const brandIdsNeeded = Array.from(new Set(prods.map(p => p.brand_id).filter(Boolean)));
    const brands = brandIdsNeeded.length > 0
      ? await db.collection("brand").find({ id: { $in: brandIdsNeeded } }, { projection: { id: 1, nama_brand: 1 } }).toArray()
      : [];
    const bmap = new Map(brands.map(b => [b.id, b.nama_brand]));

    const top_products = topProductsRes.map((item: any) => {
      const p = (pmap.get(item._id) as any) || {};
      return {
        sku: item._id,
        item_name: p.item_name || item._id,
        nama_brand: bmap.get(p.brand_id) || "",
        total_qty: item.total_qty,
        total_amount: item.total_amount
      };
    });

    const dailyMap = new Map<string, { omset: number; qty: number; count: number }>();

    // Pre-populate continuous daily range if start and end dates are specified (up to 93 days)
    if (startDateStr && endDateStr) {
      try {
        const curDate = new Date(`${startDateStr}T00:00:00+07:00`);
        const maxEndDate = new Date(`${endDateStr}T00:00:00+07:00`);
        let safetyCounter = 0;
        while (curDate <= maxEndDate && safetyCounter < 120) {
          const dStr = getJakartaDateStr(curDate);
          dailyMap.set(dStr, { omset: 0, qty: 0, count: 0 });
          curDate.setDate(curDate.getDate() + 1);
          safetyCounter++;
        }
      } catch (err) {
        console.error("Failed to pre-fill daily date range:", err);
      }
    }

    for (const d of dailySalesRes) {
      if (d._id) {
        dailyMap.set(d._id, {
          omset: d.omset || 0,
          qty: d.qty || 0,
          count: d.jumlah_nota || 0
        });
      }
    }

    const daily_sales = Array.from(dailyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({
        date: k,
        omset: v.omset,
        qty: v.qty,
        jumlah_nota: v.count
      }));

    const today_by_status = todayByStatusRes.map((t: any) => ({
      status: t._id || "Unknown",
      count: t.count,
      total_amount: t.total_amount
    }));

    const summaryData = {
      date_range: range,
      total_revenue: overview.total_revenue || 0,
      total_orders: overview.total_orders || 0,
      total_items_sold: overview.total_items_sold || 0,
      today_by_status,
      per_status,
      per_channel,
      top_sales,
      top_products,
      daily_sales,
    };

    res.json(summaryData);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

async function start() {
  try {
    await initDatabase();
  } catch (err) {
    console.error("Initial MongoDB connection error:", err);
  }
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Mini ERP Server running on http://localhost:${PORT}`);
  });
}

// Only run standalone server in non-serverless environments
if (!process.env.VERCEL && !process.env.NOW_REGION) {
  start();
}

export default app;
