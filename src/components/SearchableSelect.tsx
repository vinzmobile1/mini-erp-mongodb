import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, X, Check } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface SearchableSelectProps<T> {
  id?: string;
  items: T[];
  value: string | number | null | undefined;
  onChange: (value: any, item?: T) => void;
  getLabel: (item: T) => string;
  getSublabel?: (item: T) => string | undefined;
  getId: (item: T) => string | number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function matchSmartWildcard(targetText: string, searchPattern: string): boolean {
  if (!searchPattern.trim()) return true;
  const lowerText = targetText.toLowerCase();
  const lowerQuery = searchPattern.toLowerCase().trim();

  // 1. Wildcard matching if query contains '*', '?', or '%'
  if (lowerQuery.includes("*") || lowerQuery.includes("?") || lowerQuery.includes("%")) {
    const regexPattern = lowerQuery
      .replace(/%/g, "*")
      .split("*")
      .map((segment) => segment.replace(/[.+^${}()|[\]\\]/g, "\\$&"))
      .join(".*")
      .replace(/\?/g, ".");
    try {
      const regex = new RegExp(regexPattern, "i");
      if (regex.test(lowerText)) return true;
    } catch {
      // fallback
    }
  }

  // 2. Multi-word token search
  const tokens = lowerQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((token) => lowerText.includes(token));
}

export function SearchableSelect<T>({
  id,
  items,
  value,
  onChange,
  getLabel,
  getSublabel,
  getId,
  placeholder = "Ketik atau pilih...",
  disabled = false,
  className = "",
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollParentRef = useRef<HTMLDivElement>(null);

  const selectedItem = items.find((it) => String(getId(it)) === String(value));

  // Sync input text when value changes
  useEffect(() => {
    if (!isOpen) {
      if (selectedItem) {
        setSearch(getLabel(selectedItem));
      } else {
        setSearch("");
      }
    }
  }, [value, selectedItem, isOpen, getLabel]);

  const checkPlacement = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 240;
      if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    }
  };

  const filteredItems = items.filter((it) => {
    if (!search.trim()) return true;
    if (selectedItem && search.trim().toLowerCase() === getLabel(selectedItem).trim().toLowerCase()) {
      return true;
    }
    const label = getLabel(it);
    const sublabel = getSublabel ? getSublabel(it) || "" : "";
    const idVal = String(getId(it));
    const combined = `${label} ${sublabel} ${idVal}`;
    return matchSmartWildcard(combined, search);
  });

  // Setup TanStack Virtualizer for virtualization of large product catalogs
  const rowVirtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 48,
    overscan: 5,
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (selectedItem) {
          setSearch(getLabel(selectedItem));
        } else {
          setSearch("");
        }
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, selectedItem, getLabel]);

  const handleSelect = (item: T) => {
    onChange(getId(item), item);
    setSearch(getLabel(item));
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setSearch("");
    setIsOpen(false);
  };

  const handleInputFocus = () => {
    if (disabled) return;
    checkPlacement();
    setIsOpen(true);
    setTimeout(() => {
      inputRef.current?.select();
    }, 10);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    checkPlacement();
    if (!isOpen) setIsOpen(true);
    if (!val.trim() && value) {
      onChange(null);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`} id={id}>
      <div
        className={`w-full flex items-center justify-between px-3 py-1.5 text-sm bg-white border rounded-lg transition-all ${
          isOpen ? "border-zinc-900 ring-2 ring-zinc-900/10 shadow-xs" : "border-zinc-200 hover:border-zinc-300"
        } ${disabled ? "bg-zinc-100 text-zinc-400 cursor-not-allowed" : "text-zinc-900"}`}
      >
        <div className="flex-1 flex items-center min-w-0 pr-2">
          <input
            ref={inputRef}
            type="text"
            id={id ? `${id}-input` : undefined}
            disabled={disabled}
            value={search}
            onFocus={handleInputFocus}
            onChange={handleInputChange}
            placeholder={selectedItem ? getLabel(selectedItem) : placeholder}
            className="w-full text-xs font-medium bg-transparent border-none outline-none text-zinc-900 placeholder:text-zinc-400 truncate"
          />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {(selectedItem || search) && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-zinc-400 hover:text-zinc-600 rounded-full hover:bg-zinc-100 transition-colors"
              title="Hapus pilihan"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (isOpen) {
                setIsOpen(false);
              } else {
                handleInputFocus();
                inputRef.current?.focus();
              }
            }}
            className="p-0.5 text-zinc-400 hover:text-zinc-700"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-150 ${isOpen ? "rotate-180 text-zinc-800" : ""}`}
            />
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          className={`absolute z-50 w-full bg-white border border-zinc-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in-50 duration-100 ${
            openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
          style={{ maxHeight: "250px" }}
        >
          <div
            ref={scrollParentRef}
            className="max-h-56 overflow-y-auto p-1"
          >
            {filteredItems.length === 0 ? (
              <div className="py-4 px-3 text-center text-xs text-zinc-400">
                Tidak ada data produk &quot;{search}&quot;
              </div>
            ) : (
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const item = filteredItems[virtualRow.index];
                  const isSelected = String(getId(item)) === String(value);

                  return (
                    <button
                      key={virtualRow.key}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelect(item)}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      className={`flex items-center justify-between px-3 py-1.5 text-xs rounded-md text-left transition-colors ${
                        isSelected
                          ? "bg-zinc-900 text-white font-medium"
                          : "hover:bg-zinc-100 text-zinc-800"
                      }`}
                    >
                      <div className="truncate min-w-0 pr-2">
                        <div className="font-semibold truncate">{getLabel(item)}</div>
                        {getSublabel && getSublabel(item) && (
                          <div
                            className={`text-[11px] truncate mt-0.5 ${
                              isSelected ? "text-zinc-300" : "text-zinc-500"
                            }`}
                          >
                            {getSublabel(item)}
                          </div>
                        )}
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-white" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
