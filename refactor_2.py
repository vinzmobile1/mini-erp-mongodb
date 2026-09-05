import re

with open("src/components/InputOrderForm.tsx", "r") as f:
    content = f.read()

# 1. Parent Grid items-start -> items-stretch
content = content.replace(
    '<div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">',
    '<div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">'
)

# 2. Add h-full to the left column's card container
# The container is: <div className="bg-white border border-zinc-200/90 rounded-xl shadow-2xs p-5 space-y-5">
# but we have multiple of these. 
# We need to target the first one inside xl:col-span-8 space-y-4
content = content.replace(
    '<div className="xl:col-span-8 space-y-4">\n                {/* Section 1: Header Invoice, Customer, Channel, Sales Snapshot */}\n                <div className="bg-white border border-zinc-200/90 rounded-xl shadow-2xs p-5 space-y-5">',
    '<div className="xl:col-span-8 space-y-4">\n                {/* Section 1: Header Invoice, Customer, Channel, Sales Snapshot */}\n                <div className="bg-white border border-zinc-200/90 rounded-xl shadow-2xs p-5 space-y-5 h-full">'
)

# We also need to add h-full to the right column's card just in case, or at least the flex-col for right column 
# Wait, Right column is inside `<div className="xl:col-span-4 space-y-4 sticky top-20">`
# and has `<div className="bg-white border border-zinc-200/90 rounded-xl shadow-2xs p-5 space-y-5">`
# Let's change that to h-full as well so they match exactly if they stretch? 
# Actually if the left is taller, the right sticky will just stick. The user asked "perbaiki div Informasi Nota & Identitas Penjualan tinggi ke bawahnya samakan dengan ringkasan nota biar sejajar".
# So items-stretch is good on the grid. If the left side has h-full, it stretches to match the height of the right side (or vice versa).

# 3. Rewrite the Items map
item_map_start_str = '              <div className="space-y-3">\n                {items.map((row, idx) => {'
item_map_end_str = '                })}\n              </div>'

start_idx = content.find(item_map_start_str)
end_idx = content.find(item_map_end_str, start_idx)

if start_idx != -1 and end_idx != -1:
    old_items_map = content[start_idx:end_idx + len(item_map_end_str)]
    
    new_items_map = """              <div className="space-y-3">
                {items.map((row, idx) => {
                  const selectedProduct = products.find(
                    (p) => p.sku === row.sku,
                  );
                  return (
                    <div
                      key={row.id}
                      id={`order-item-row-${idx}`}
                      className="p-3 bg-white border border-zinc-200/90 rounded-xl space-y-3 hover:border-zinc-300 transition-colors shadow-2xs"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                        {/* Product Searchable Selection */}
                        <div className="sm:col-span-7 space-y-1">
                          <label className="block text-[11px] text-zinc-600 font-semibold">
                            Pilih Produk / SKU <span className="text-red-500">*</span>
                          </label>
                          <SearchableSelect<Product>
                            items={products}
                            value={row.sku}
                            onChange={(sku) => updateItemSku(row.id, sku)}
                            getId={(p: Product) => p.sku}
                            getLabel={(p: Product) => p.item_name}
                            getSublabel={(p: Product) => `${p.nama_brand || "Brand"} · ${p.sku}`}
                            placeholder="Cari nama barang atau SKU..."
                          />
                        </div>

                        {/* Quantity */}
                        <div className="sm:col-span-2 space-y-1">
                          <label className="block text-[11px] text-zinc-600 font-medium">
                            Qty (Pcs)
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={row.qty}
                            onChange={(e) =>
                              updateItemQty(
                                row.id,
                                parseInt(e.target.value) || 1,
                              )
                            }
                            className="w-full px-2 py-2 text-sm bg-white border border-zinc-200 rounded-lg text-center font-bold tabular focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                          />
                        </div>

                        {/* Harga Satuan (Rp) */}
                        <div className="sm:col-span-3 space-y-1">
                          <label className="block text-[11px] text-zinc-600 font-medium">
                            Harga Satuan (Rp) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={
                              row.unitPrice > 0
                                ? row.unitPrice.toLocaleString("id-ID")
                                : ""
                            }
                            onChange={(e) => {
                              const raw = e.target.value.replace(/\D/g, "");
                              const newUnitPrice = raw ? parseInt(raw, 10) : 0;
                              updateItemUnitPrice(row.id, newUnitPrice);
                            }}
                            placeholder="0"
                            className="w-full px-2 py-2 text-sm bg-white border border-zinc-200 rounded-lg text-right font-bold tabular focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                          />
                        </div>
                      </div>

                      {/* Info & Action Row */}
                      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-zinc-500 bg-zinc-50 px-3 py-2 rounded-lg border border-zinc-100">
                        {selectedProduct ? (
                          <span className="flex-1 truncate">
                            <span className="w-5 h-5 rounded bg-zinc-200 text-zinc-700 inline-flex items-center justify-center text-[10px] font-bold mr-2">
                              {idx + 1}
                            </span>
                            SKU: <code className="font-mono font-semibold text-zinc-800">{selectedProduct.sku}</code>
                            <span className="hidden sm:inline">
                              {" "}· {selectedProduct.item_group || "-"} · {selectedProduct.category || "-"}
                            </span>
                          </span>
                        ) : (
                          <span className="flex-1 flex items-center gap-2">
                            <span className="w-5 h-5 rounded bg-zinc-200 text-zinc-700 inline-flex items-center justify-center text-[10px] font-bold">
                              {idx + 1}
                            </span>
                            Pilih produk untuk melihat detail
                          </span>
                        )}

                        <div className="flex items-center gap-3 shrink-0">
                          {selectedProduct && (
                            <span className="flex items-center gap-1.5">
                              <span>Subtotal:</span>
                              <strong className="text-zinc-900 font-bold tabular text-sm">
                                {formatRupiah(row.amount)}
                              </strong>
                            </span>
                          )}
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItemRow(row.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                              title="Hapus Baris"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>"""
    
    content = content.replace(old_items_map, new_items_map)

with open("src/components/InputOrderForm.tsx", "w") as f:
    f.write(content)
