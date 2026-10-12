import React, { useState, useEffect } from 'react';
import {
  Settings,
  Lock,
  PauseCircle,
  PlayCircle,
  Zap,
  Code2,
  AlertTriangle,
  Save,
  CheckCircle2,
  Puzzle,
} from 'lucide-react';
import type { AppSettings } from '../types/index.ts';
import { useToast } from '../components/Toast.tsx';
import { api } from '../services/api.ts';

interface SettingsPageProps {
  settings: AppSettings | null;
  onRefresh: () => void;
}

export function SettingsPage({ settings, onRefresh }: SettingsPageProps) {
  const { success, error } = useToast();

  const [globalPause, setGlobalPause] = useState(false);
  const [autoRetryOnRateLimit, setAutoRetryOnRateLimit] = useState(true);
  const [maxLogsLimit, setMaxLogsLimit] = useState(500);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setGlobalPause(settings.globalPause);
      setAutoRetryOnRateLimit(settings.autoRetryOnRateLimit);
      setMaxLogsLimit(settings.maxLogsLimit || 500);
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await api.updateSettings({
        globalPause,
        autoRetryOnRateLimit,
        maxLogsLimit: Number(maxLogsLimit) || 500,
      });
      if (!res.success) {
        throw new Error(res.error || 'Gagal menyimpan pengaturan');
      }
      success('PENGATURAN DISIMPAN', 'Konfigurasi scheduler di SQLite berhasil diperbarui.');
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      error('GAGAL MENYIMPAN', msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* SETTINGS FORM & SECURITY BLOCKS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): System Configuration */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSave} className="block-card p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b-2 border-[#0F172A]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#2563EB] text-[#FACC15] border-2 border-[#0F172A] shadow-[0_3px_0_#1D4ED8] flex items-center justify-center">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase font-mono tracking-wider">
                    SYSTEM & SCHEDULER SETTINGS
                  </h3>
                  <p className="text-xs text-[#94A3B8]">Konfigurasi kontrol server-side autopost di SQLite</p>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="block-btn block-btn-primary px-4 py-2 text-xs text-white"
              >
                <Save className="w-3.5 h-3.5 text-[#FACC15]" />
                <span>{isSaving ? 'SAVING...' : 'SAVE CONFIG'}</span>
              </button>
            </div>

            {/* Master Pause Switch Block */}
            <div className="p-4 rounded-xl bg-[#111827] border-2 border-[#0F172A] flex items-start justify-between gap-4 shadow-inner">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {globalPause ? (
                    <PauseCircle className="w-4 h-4 text-[#EF4444]" />
                  ) : (
                    <PlayCircle className="w-4 h-4 text-[#22C55E]" />
                  )}
                  <span className="text-xs font-black text-white font-mono uppercase tracking-wide">
                    GLOBAL KILL-SWITCH (PAUSE ALL)
                  </span>
                  {globalPause && (
                    <span className="text-[10px] bg-[#EF4444] text-white px-2 py-0.5 rounded font-mono font-black border border-[#0F172A]">
                      PAUSED
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Jika dinyalakan, semua interval otomatis pengiriman akan berhenti seketika di level server tanpa mengubah status aktif masing-masing channel.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setGlobalPause(!globalPause)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-[#0F172A] transition-colors duration-200 ease-in-out ${
                  globalPause ? 'bg-[#EF4444]' : 'bg-[#0B0F1A]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full border border-[#0F172A] bg-white shadow-md transition duration-200 ease-in-out ${
                    globalPause ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Auto Retry on Rate Limit Block */}
            <div className="p-4 rounded-xl bg-[#111827] border-2 border-[#0F172A] flex items-start justify-between gap-4 shadow-inner">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#FACC15]" />
                  <span className="text-xs font-black text-white font-mono uppercase tracking-wide">
                    AUTO-BACKOFF RATE LIMIT (HTTP 429)
                  </span>
                </div>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Jika Discord membalas dengan status 429 Too Many Requests, scheduler akan otomatis membaca header <code>retry_after</code> dan menunda pengiriman hingga aman.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setAutoRetryOnRateLimit(!autoRetryOnRateLimit)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-[#0F172A] transition-colors duration-200 ease-in-out ${
                  autoRetryOnRateLimit ? 'bg-[#FACC15]' : 'bg-[#0B0F1A]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full border border-[#0F172A] bg-white shadow-md transition duration-200 ease-in-out ${
                    autoRetryOnRateLimit ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Max Logs Limit Block */}
            <div className="p-4 rounded-xl bg-[#111827] border-2 border-[#0F172A] space-y-2 shadow-inner font-mono">
              <label className="block text-xs font-black text-[#FACC15] uppercase tracking-wider">
                BATAS MAKSIMAL LOGS RETENSI (BARIS SQLITE)
              </label>
              <p className="text-xs text-[#94A3B8] font-sans">
                Log paling lama akan otomatis dipangkas saat mencapai batas ini untuk menjaga performa file SQLite.
              </p>
              <input
                type="number"
                min={50}
                max={5000}
                step={50}
                value={maxLogsLimit}
                onChange={(e) => setMaxLogsLimit(parseInt(e.target.value) || 500)}
                className="block-input w-48 px-3 py-2 text-xs text-white font-black"
              />
            </div>
          </form>

          {/* Placeholders Guide Block */}
          <div className="block-card p-6 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b-2 border-[#0F172A]">
              <Code2 className="w-5 h-5 text-[#3B82F6]" />
              <h3 className="text-sm font-black text-white uppercase font-mono tracking-wider">
                BLOCKLY TEMPLATE VARIABLE REFERENCE
              </h3>
            </div>
            <p className="text-xs text-[#94A3B8]">
              Gunakan variabel ini di template pesan channel Anda. Nilai akan dirender secara dinamis saat pesan diposting:
            </p>

            <div className="overflow-x-auto rounded-xl border-2 border-[#0F172A] shadow-[0_4px_0_#0B0F1A]">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="bg-[#2563EB] text-white border-b-2 border-[#0F172A] uppercase text-[11px] font-black">
                    <th className="py-2.5 px-3">VARIABLE</th>
                    <th className="py-2.5 px-3">CONTOH NILAI</th>
                    <th className="py-2.5 px-3">DESKRIPSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-[#0F172A]">
                  <tr className="bg-[#0B0F1A]">
                    <td className="py-2.5 px-3 text-[#FACC15] font-black">{'{time}'}</td>
                    <td className="py-2.5 px-3 text-[#22C55E]">14:35:20</td>
                    <td className="py-2.5 px-3 text-[#94A3B8] font-sans">Waktu pengiriman pesan (HH:mm:ss)</td>
                  </tr>
                  <tr className="bg-[#111827]">
                    <td className="py-2.5 px-3 text-[#FACC15] font-black">{'{date}'}</td>
                    <td className="py-2.5 px-3 text-[#22C55E]">2026-10-12</td>
                    <td className="py-2.5 px-3 text-[#94A3B8] font-sans">Tanggal hari ini (YYYY-MM-DD)</td>
                  </tr>
                  <tr className="bg-[#0B0F1A]">
                    <td className="py-2.5 px-3 text-[#FACC15] font-black">{'{channel}'}</td>
                    <td className="py-2.5 px-3 text-[#22C55E]">Trade Hub #1</td>
                    <td className="py-2.5 px-3 text-[#94A3B8] font-sans">Nama channel target</td>
                  </tr>
                  <tr className="bg-[#111827]">
                    <td className="py-2.5 px-3 text-[#FACC15] font-black">{'{account}'}</td>
                    <td className="py-2.5 px-3 text-[#22C55E]">JohnTrader</td>
                    <td className="py-2.5 px-3 text-[#94A3B8] font-sans">Username akun Discord pengirim</td>
                  </tr>
                  <tr className="bg-[#0B0F1A]">
                    <td className="py-2.5 px-3 text-[#FACC15] font-black">{'{random_1-100}'}</td>
                    <td className="py-2.5 px-3 text-[#22C55E]">73</td>
                    <td className="py-2.5 px-3 text-[#94A3B8] font-sans">Angka acak dinamis (contoh: {'{random_500-999}'})</td>
                  </tr>
                  <tr className="bg-[#111827]">
                    <td className="py-2.5 px-3 text-[#FACC15] font-black">{'{uuid}'}</td>
                    <td className="py-2.5 px-3 text-[#22C55E]">9K2X7A</td>
                    <td className="py-2.5 px-3 text-[#94A3B8] font-sans">Kode unik pendek pencegah deteksi duplikasi</td>
                  </tr>
                  <tr className="bg-[#0B0F1A]">
                    <td className="py-2.5 px-3 text-[#FACC15] font-black">{'{greeting}'}</td>
                    <td className="py-2.5 px-3 text-[#22C55E]">Halo kawan!</td>
                    <td className="py-2.5 px-3 text-[#94A3B8] font-sans">Variasi sapaan ramah acak</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* BLOCKLY DESIGN SYSTEM SHOWCASE BLOCK */}
          <div className="block-card p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#0F172A]">
              <div className="flex items-center gap-2">
                <Puzzle className="w-5 h-5 text-[#FACC15]" />
                <h3 className="text-sm font-black text-white uppercase font-mono tracking-wider">
                  BLOCKLY DESIGN SYSTEM (UI COMPONENT SHOWCASE)
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#2563EB] text-white font-bold">
                CSS + TAILWIND
              </span>
            </div>

            <p className="text-xs text-[#94A3B8]">
              Spesifikasi visual puzzle block dengan 3 varian tombol dan reusable <code className="text-[#FACC15] font-mono font-bold">.block-card</code>:
            </p>

            {/* 3 Button Variants Demo */}
            <div className="p-4 rounded-xl bg-[#111827] border-2 border-[#0F172A] space-y-3 shadow-inner">
              <span className="text-[11px] font-mono font-black text-[#FACC15] uppercase tracking-wider block">
                1. TIGA VARIAN TOMBOL BLOCK PUZZLE (HOVER / PRESS INTERACTION):
              </span>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {/* Variant 1: Primary Blue */}
                <button
                  type="button"
                  onClick={() => success('PRIMARY CLICKED', 'Varian Primary: Biru #2563EB dengan bevel #1D4ED8')}
                  className="block-btn block-btn-primary px-4 py-2.5 text-xs text-white"
                >
                  <span>PRIMARY BIRU (#2563EB)</span>
                </button>

                {/* Variant 2: Secondary Yellow */}
                <button
                  type="button"
                  onClick={() => success('SECONDARY CLICKED', 'Varian Secondary: Kuning #FACC15 dengan bevel #CA8A04')}
                  className="block-btn block-btn-secondary px-4 py-2.5 text-xs text-[#0B0F1A]"
                >
                  <span>SECONDARY KUNING (#FACC15)</span>
                </button>

                {/* Variant 3: Danger Red */}
                <button
                  type="button"
                  onClick={() => error('DANGER CLICKED', 'Varian Danger: Merah #EF4444 dengan bevel #B91C1C')}
                  className="block-btn block-btn-danger px-4 py-2.5 text-xs text-white"
                >
                  <span>DANGER MERAH (#EF4444)</span>
                </button>
              </div>
              <p className="text-[10px] text-[#94A3B8] font-mono mt-1">
                *Coba klik atau arahkan kursor pada tombol di atas untuk merasakan efek "terangkat" (-2px) dan "tertekan" (+2px) puzzle block.
              </p>
            </div>

            {/* Reusable .block-card Example */}
            <div className="p-4 rounded-xl bg-[#111827] border-2 border-[#0F172A] space-y-3 shadow-inner">
              <span className="text-[11px] font-mono font-black text-[#FACC15] uppercase tracking-wider block">
                2. REUSABLE .BLOCK-CARD (BORDER TEBAL + INNER HIGHLIGHT + DROP SHADOW):
              </span>
              <div className="block-card p-4 bg-[#1E2536] border-2 border-[#0F172A]">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-extrabold text-white">CONTOH .BLOCK-CARD PUZZLE</span>
                  <span className="text-[#FACC15] font-bold">SHADOW 4PX PEKAT</span>
                </div>
                <p className="text-[11px] text-[#94A3B8] mt-1 font-mono">
                  background: #1E2536; border: 2px solid #0F172A; box-shadow: 0 4px 0 #0B0F1A, 0 6px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08);
                </p>
              </div>
            </div>

            {/* Color Palette Swatches */}
            <div className="grid grid-cols-3 gap-3 font-mono text-[11px]">
              <div className="p-3 rounded-xl bg-[#2563EB] text-white border-2 border-[#0F172A] shadow-[0_3px_0_#1D4ED8]">
                <div className="font-extrabold">BIRU UTAMA</div>
                <div className="text-[10px] text-white/80">#2563EB</div>
              </div>
              <div className="p-3 rounded-xl bg-[#FACC15] text-[#0B0F1A] border-2 border-[#0F172A] shadow-[0_3px_0_#CA8A04]">
                <div className="font-extrabold">KUNING AKSEN</div>
                <div className="text-[10px] font-bold">#FACC15</div>
              </div>
              <div className="p-3 rounded-xl bg-[#0B0F1A] text-white border-2 border-[#0F172A] shadow-[0_3px_0_#1E2536]">
                <div className="font-extrabold text-[#FACC15]">HITAM UTAMA</div>
                <div className="text-[10px] text-[#94A3B8]">#0B0F1A</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (1 span): Encryption Status & Safety Advice */}
        <div className="space-y-6">
          {/* Encryption card */}
          <div className="block-card p-6 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b-2 border-[#0F172A]">
              <Lock className="w-5 h-5 text-[#22C55E]" />
              <h3 className="text-sm font-black text-white uppercase font-mono tracking-wider">
                TOKEN ENCRYPTION STATUS
              </h3>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0B0F1A] border-2 border-[#22C55E]/40 space-y-2">
              <div className="flex items-center gap-2 text-xs font-black text-[#22C55E] font-mono uppercase">
                <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
                <span>AES-256-GCM ACTIVE</span>
              </div>
              <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                Setiap user token Discord dienkripsi menggunakan AES-256-GCM sebelum disimpan ke file SQLite <code>data/autopost.sqlite</code>.
              </p>
            </div>

            <div className="text-xs text-[#94A3B8] space-y-2 pt-2 border-t-2 border-[#0F172A] font-mono">
              <div className="flex justify-between">
                <span>DATABASE:</span>
                <span className="text-white font-bold">SQLite (.sqlite)</span>
              </div>
              <div className="flex justify-between">
                <span>CIPHER:</span>
                <span className="text-[#3B82F6] font-bold">AES-256-GCM</span>
              </div>
              <div className="flex justify-between">
                <span>SCHEDULER:</span>
                <span className="text-[#FACC15] font-bold">node-cron</span>
              </div>
              <div className="flex justify-between">
                <span>TOKEN EXPOSURE:</span>
                <span className="text-[#22C55E] font-bold">0% (SERVER ONLY)</span>
              </div>
            </div>
          </div>

          {/* Safety advice */}
          <div className="block-card p-6 space-y-4 border-[#FACC15]/40">
            <div className="flex items-center gap-2 text-[#FACC15] pb-2 border-b-2 border-[#0F172A]">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-black uppercase font-mono tracking-wider">
                SAFETY RULES
              </h3>
            </div>

            <div className="space-y-3 text-xs text-[#94A3B8] leading-relaxed">
              <div className="p-2.5 rounded-lg bg-[#0B0F1A] border border-[#0F172A]">
                <strong className="text-white block font-mono">1. DELAY WAKTU WAJAR</strong>
                <p className="mt-0.5 text-[11px]">Gunakan delay minimal 3–5 menit per channel.</p>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0B0F1A] border border-[#0F172A]">
                <strong className="text-white block font-mono">2. GUNAKAN RANDOM JITTER</strong>
                <p className="mt-0.5 text-[11px]">Hindari interval kaku yang sama persis setiap iterasi.</p>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0B0F1A] border border-[#0F172A]">
                <strong className="text-white block font-mono">3. GUNAKAN AKUN KHUSUS</strong>
                <p className="mt-0.5 text-[11px]">Jangan gunakan akun utama berharga untuk automasi.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
