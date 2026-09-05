import React from "react";

export interface QuickFilterOption {
  id: string;
  label: string;
  count: number;
  textColor?: string;
  badgeBgColor?: string;
  dotColor?: string;
}

interface QuickFilterGroupProps {
  label?: string;
  options: QuickFilterOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClear: () => void;
  className?: string;
  id?: string;
}

export const QuickFilterGroup: React.FC<QuickFilterGroupProps> = ({
  label,
  options,
  selectedValue,
  onSelect,
  onClear,
  className = "",
  id = "quick-filter-group",
}) => {
  const isAnySelected = selectedValue !== "" && selectedValue !== "ALL";

  return (
    <div className={`flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 ${className}`} id={id}>
      {label && (
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-0.5">
          {label}:
        </span>
      )}

      {/* Clear Button (Light theme) */}
      <button
        type="button"
        id={`${id}-clear-btn`}
        onClick={onClear}
        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all shrink-0 select-none ${
          !isAnySelected
            ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
            : "bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50 hover:border-slate-300"
        }`}
      >
        Clear
      </button>

      {/* Segmented Group Container (Light White Theme) */}
      <div className="inline-flex items-center bg-white border border-slate-200 rounded-lg p-0.5 divide-x divide-slate-100 shrink-0 shadow-2xs">
        {options.map((option) => {
          const isSelected = selectedValue === option.id;
          const labelColor = option.textColor || "#334155";
          const badgeBg = option.badgeBgColor || "#475569";

          return (
            <button
              key={option.id}
              type="button"
              id={`${id}-opt-${option.id.toLowerCase().replace(/\s+/g, "-")}`}
              onClick={() => onSelect(isSelected ? "ALL" : option.id)}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold transition-all whitespace-nowrap select-none ${
                isSelected
                  ? "bg-slate-100/90 rounded-md ring-1 ring-slate-300 shadow-2xs"
                  : "hover:bg-slate-50"
              }`}
            >
              {/* Option Label */}
              <span
                className="font-bold tracking-tight text-xs"
                style={{
                  color: isSelected ? labelColor : "#475569",
                }}
              >
                {option.label}
              </span>

              {/* Count Badge */}
              <span
                className="px-1.5 py-0.5 rounded text-[11px] font-bold text-white leading-none min-w-[20px] text-center shadow-2xs"
                style={{
                  backgroundColor: badgeBg,
                }}
              >
                {option.count.toLocaleString("id-ID")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

