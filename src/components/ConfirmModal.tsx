import React from "react";
import { AlertTriangle, Trash2, X, RefreshCw } from "lucide-react";

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmText?: string;
  cancelLabel?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "primary";
  type?: "danger" | "warning" | "primary";
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  onClose?: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  confirmText = "Ya, Hapus",
  cancelLabel,
  cancelText = "Batal",
  variant,
  type = "danger",
  isLoading = false,
  onConfirm,
  onCancel,
  onClose,
}) => {
  if (!isOpen) return null;

  const resolvedVariant = variant || type;
  const isDanger = resolvedVariant === "danger";
  const resolvedConfirmLabel = confirmLabel || confirmText;
  const resolvedCancelLabel = cancelLabel || cancelText;
  const handleClose = () => {
    if (onCancel) onCancel();
    else if (onClose) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      id="custom-confirm-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) handleClose();
      }}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden animate-in zoom-in-95 duration-150"
        id="custom-confirm-modal-content"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-xl shrink-0 ${
                isDanger ? "bg-red-50 text-red-600 border border-red-100" : "bg-amber-50 text-amber-600 border border-amber-100"
              }`}
            >
              {isDanger ? <Trash2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>

            <div className="space-y-1.5 flex-1 min-w-0">
              <h3 className="text-lg font-bold text-zinc-900 font-display leading-tight">{title}</h3>
              <p className="text-sm text-zinc-600 leading-relaxed break-words">{message}</p>
            </div>

            {!isLoading && (
              <button
                type="button"
                onClick={handleClose}
                className="text-zinc-400 hover:text-zinc-600 p-1 rounded-lg hover:bg-zinc-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="bg-zinc-50 px-6 py-4 border-t border-zinc-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-semibold text-zinc-700 hover:text-zinc-900 bg-white border border-zinc-200 hover:bg-zinc-100 rounded-xl transition-all disabled:opacity-50"
          >
            {resolvedCancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onConfirm()}
            disabled={isLoading}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-bold text-white rounded-xl shadow-xs transition-all disabled:opacity-50 ${
              isDanger
                ? "bg-red-600 hover:bg-red-700 active:bg-red-800"
                : "bg-amber-600 hover:bg-amber-700 active:bg-amber-800"
            }`}
          >
            {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
            <span>{resolvedConfirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
