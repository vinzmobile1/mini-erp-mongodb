import re

with open("src/components/InputOrderForm.tsx", "r") as f:
    content = f.read()

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
                        <div className="sm:col-span-4 space-y-1">
                          <label className="block text-[11px] text-zinc-600 font-semibold">
                            Pilih Produk / SKU <span className="text-red-500">*</span>
                          </label>
                          <SearchableSelect<Product>
                            items={products}
                            value={row.sku}
                            onChange={(sku) => updateItemSku(row.id, sku)}
                            getId={(p: Product) => p.sku}
                            getLabel={(p: Product) => p.item_name}
                            getSublabel={(p: Product) => p.nama_brand || "Brand"}
                            placeholder="Cari produk..."
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
                        
                        {/* Subtotal & Action */}
                        <div className="sm:col-span-3 space-y-1">
                          <label className="block text-[11px] text-zinc-600 font-medium">
                            Subtotal
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              value={formatRupiah(row.amount)}
                              className="w-full px-2 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg text-right font-bold tabular text-zinc-600 focus:outline-none cursor-not-allowed"
                              tabIndex={-1}
                            />
                            {items.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => removeItemRow(row.id)}
                                className="text-red-500 hover:text-red-700 bg-white hover:bg-red-50 p-2 border border-zinc-200 hover:border-red-200 rounded-lg transition-colors shrink-0 flex items-center justify-center"
                                title="Hapus Baris"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <div className="w-[34px] shrink-0"></div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Info Row */}
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
                      </div>
                    </div>
                  );
                })}
              </div>"""
    
    content = content.replace(old_items_map, new_items_map)

with open("src/components/InputOrderForm.tsx", "w") as f:
    f.write(content)
    
