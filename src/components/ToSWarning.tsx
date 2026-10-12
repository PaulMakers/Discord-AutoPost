import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ShieldCheck, Zap } from 'lucide-react';

export function ToSWarning() {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-[#111827] border-2 border-[#FACC15]/40 rounded-2xl p-4 text-[#F8FAFC] shadow-[0_4px_0_#0B0F1A] relative overflow-hidden">
      {/* Yellow top bar accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-[#FACC15]" />

      <div className="flex items-start gap-3.5">
        <div className="p-2 rounded-xl bg-[#FACC15] text-[#0B0F1A] border-2 border-[#0F172A] shadow-[0_2px_0_#CA8A04] shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5 font-bold" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="font-extrabold text-[#FACC15] text-xs uppercase tracking-wider font-mono flex items-center gap-2">
              <span>DISCORD SELF-BOT POLICY WARNING</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#0B0F1A] text-[#FDE047] border border-[#FACC15]/40 font-bold">
                USE AT YOUR OWN RISK
              </span>
            </h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-[#FACC15] hover:text-white flex items-center gap-1 font-bold font-mono transition cursor-pointer"
              >
                {expanded ? 'HIDE TIPS' : 'SHOW SAFE TIPS'}
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="text-xs text-[#94A3B8] hover:text-[#FACC15] font-mono ml-2 p-1 cursor-pointer"
                title="Tutup banner"
              >
                ✕
              </button>
            </div>
          </div>

          <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
            Penggunaan User Token untuk automasi dilarang secara resmi oleh ToS Discord. Gunakan akun khusus dan atur interval delay yang aman untuk menghindari suspend.
          </p>

          {expanded && (
            <div className="mt-3 pt-3 border-t-2 border-[#0F172A] text-xs space-y-2 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-[#1E2536] p-3.5 rounded-xl border-2 border-[#0F172A] shadow-[0_2px_0_#0B0F1A] space-y-2">
                  <div className="font-bold text-[#FACC15] flex items-center gap-1.5 uppercase font-mono text-[11px]">
                    <ShieldCheck className="w-4 h-4 text-[#22C55E]" />
                    <span>REKOMENDASI JADWAL AMAN:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[#94A3B8] text-[11px]">
                    <li>Gunakan delay minimal <strong className="text-white">2–5 menit</strong> per channel.</li>
                    <li>Aktifkan <strong className="text-[#FACC15]">Random Delay Range</strong> (contoh: +15s hingga +45s).</li>
                    <li>Gunakan placeholder <code className="text-[#3B82F6] font-mono">{'{time}'}</code> atau <code className="text-[#3B82F6] font-mono">{'{random_1-100}'}</code> agar pesan bervariasi.</li>
                  </ul>
                </div>

                <div className="bg-[#1E2536] p-3.5 rounded-xl border-2 border-[#0F172A] shadow-[0_2px_0_#0B0F1A] space-y-2">
                  <div className="font-bold text-[#3B82F6] flex items-center gap-1.5 uppercase font-mono text-[11px]">
                    <Zap className="w-4 h-4 text-[#FACC15]" />
                    <span>BLOCK SECURITY ENCRYPTION:</span>
                  </div>
                  <p className="text-[#94A3B8] text-[11px] leading-relaxed">
                    Token disimpan di database SQLite terenkripsi dengan standar militer <strong className="text-white">AES-256-GCM</strong>. Token asli tidak pernah diekspos ke antarmuka web.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
