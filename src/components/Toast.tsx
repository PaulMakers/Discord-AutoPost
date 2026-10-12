import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextType {
  toast: (type: ToastType, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);

    setTimeout(() => {
      removeToast(id);
    }, 4500);
  }, [removeToast]);

  const success = useCallback((title: string, message?: string) => addToast('success', title, message), [addToast]);
  const error = useCallback((title: string, message?: string) => addToast('error', title, message), [addToast]);
  const warning = useCallback((title: string, message?: string) => addToast('warning', title, message), [addToast]);
  const info = useCallback((title: string, message?: string) => addToast('info', title, message), [addToast]);

  return (
    <ToastContext.Provider value={{ toast: addToast, success, error, warning, info }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none px-2">
        {toasts.map((t) => {
          let topBar = 'bg-[#3B82F6]';
          let icon = <Info className="w-5 h-5 text-[#3B82F6] shrink-0" />;

          if (t.type === 'success') {
            topBar = 'bg-[#22C55E]';
            icon = <CheckCircle2 className="w-5 h-5 text-[#22C55E] shrink-0" />;
          } else if (t.type === 'error') {
            topBar = 'bg-[#EF4444]';
            icon = <XCircle className="w-5 h-5 text-[#EF4444] shrink-0" />;
          } else if (t.type === 'warning') {
            topBar = 'bg-[#FACC15]';
            icon = <AlertTriangle className="w-5 h-5 text-[#FACC15] shrink-0" />;
          }

          return (
            <div
              key={t.id}
              className="pointer-events-auto flex flex-col bg-[#1E2536] border-2 border-[#0F172A] rounded-xl shadow-[0_6px_0_#0B0F1A,0_10px_20px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-200 animate-snap-in"
            >
              {/* Colorful top block bevel */}
              <div className={`h-1.5 w-full ${topBar}`} />

              <div className="p-3.5 flex items-start gap-3">
                <div className="p-1 rounded-lg bg-[#111827] border border-[#0F172A]">
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-black text-white uppercase font-mono tracking-wide">{t.title}</h4>
                  {t.message && (
                    <p className="text-[11px] text-[#94A3B8] mt-0.5 leading-relaxed break-words font-medium">
                      {t.message}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => removeToast(t.id)}
                  className="text-[#94A3B8] hover:text-white p-1 rounded-md hover:bg-[#111827] transition"
                  aria-label="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
