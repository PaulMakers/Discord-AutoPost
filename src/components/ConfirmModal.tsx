import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmText = 'KONFIRMASI',
  cancelText = 'BATAL',
  isDangerous = true,
  isLoading = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0F1A]/85 backdrop-blur-sm">
      <div className="bg-[#1E2536] border-2 border-[#0F172A] rounded-2xl w-full max-w-md shadow-[0_12px_0_#0B0F1A,0_20px_35px_rgba(0,0,0,0.7)] relative overflow-hidden animate-snap-in">
        {/* Top Header Block Bar */}
        <div className={`p-4 border-b-2 border-[#0F172A] flex items-center justify-between ${
          isDangerous ? 'bg-[#EF4444] text-white shadow-[0_3px_0_#B91C1C]' : 'bg-[#2563EB] text-white shadow-[0_3px_0_#1D4ED8]'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#0B0F1A]/20 border border-white/20">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-sm font-extrabold tracking-wider uppercase font-mono">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-black/20 rounded-lg transition text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 bg-[#1E2536]">
          <p className="text-xs text-[#F8FAFC] leading-relaxed bg-[#111827] p-3.5 rounded-xl border-2 border-[#0F172A]">
            {description}
          </p>

          {/* Action Buttons: Yellow Cancel + Red/Blue Confirm */}
          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t-2 border-[#0F172A]">
            <button
              type="button"
              disabled={isLoading}
              onClick={onClose}
              className="block-btn block-btn-secondary px-4 py-2 text-xs"
            >
              {cancelText}
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={onConfirm}
              className={`block-btn px-4 py-2 text-xs text-white ${
                isDangerous ? 'block-btn-danger' : 'block-btn-primary'
              }`}
            >
              {isLoading ? 'MEMPROSES...' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
