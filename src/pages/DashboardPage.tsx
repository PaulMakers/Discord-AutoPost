import { useState, useEffect } from 'react';
import {
  Users,
  Radio,
  Send,
  AlertTriangle,
  Pause,
  Plus,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
  Puzzle,
} from 'lucide-react';
import type { DashboardStats, AutopostChannel, AutopostLog } from '../types/index.ts';
import type { TabType } from '../components/Sidebar.tsx';

interface DashboardPageProps {
  stats: DashboardStats | null;
  channels: AutopostChannel[];
  logs: AutopostLog[];
  onSelectTab: (tab: TabType) => void;
  onToggleChannel: (id: string) => void;
  onSendNow: (id: string) => void;
  onOpenAddChannel: () => void;
  onOpenAddAccount: () => void;
}

export function DashboardPage({
  stats,
  channels,
  logs,
  onSelectTab,
  onToggleChannel,
  onSendNow,
  onOpenAddChannel,
  onOpenAddAccount,
}: DashboardPageProps) {
  const [, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const activeChannels = channels.filter((c) => c.isActive);

  const getCountdown = (nextSendAt: string | null) => {
    if (!nextSendAt) return 'WAITING TRIGGER';
    const diffMs = new Date(nextSendAt).getTime() - Date.now();
    if (diffMs <= 0) return 'SENDING NOW...';
    const totalSec = Math.floor(diffMs / 1000);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className="space-y-6">
      {/* 4 BLOCK STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: ACCOUNTS BLOCK */}
        <div className="block-card p-5 relative overflow-hidden group">
          {/* Decorative puzzle tab notch */}
          <div className="absolute top-0 right-8 w-6 h-1.5 bg-[#2563EB] rounded-b-md border-b-2 border-x-2 border-[#0F172A]" />

          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#FACC15] font-mono">
              USER TOKENS
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#111827] border-2 border-[#0F172A] text-[#FACC15] shadow-[0_2px_0_#0B0F1A] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2 font-mono">
            <span className="text-3xl font-black text-[#3B82F6] tracking-tight">
              {stats?.totalAccounts ?? 0}
            </span>
            <span className="text-xs text-[#22C55E] font-bold">
              ({stats?.activeAccounts ?? 0} VALID)
            </span>
          </div>
          <p className="text-[10px] text-[#94A3B8] font-mono uppercase mt-1">Multi-Account Vault</p>
        </div>

        {/* Card 2: CHANNELS BLOCK */}
        <div className="block-card p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-8 w-6 h-1.5 bg-[#FACC15] rounded-b-md border-b-2 border-x-2 border-[#0F172A]" />

          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#FACC15] font-mono">
              ACTIVE CHANNELS
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#111827] border-2 border-[#0F172A] text-[#3B82F6] shadow-[0_2px_0_#0B0F1A] flex items-center justify-center">
              <Radio className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2 font-mono">
            <span className="text-3xl font-black text-[#FACC15] tracking-tight">
              {stats?.activeChannels ?? 0}
            </span>
            <span className="text-xs text-[#94A3B8] font-bold">
              / {stats?.totalChannels ?? 0} TOTAL
            </span>
          </div>
          <p className="text-[10px] text-[#94A3B8] font-mono uppercase mt-1">Target Blocks Online</p>
        </div>

        {/* Card 3: SENT TODAY BLOCK */}
        <div className="block-card p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-8 w-6 h-1.5 bg-[#22C55E] rounded-b-md border-b-2 border-x-2 border-[#0F172A]" />

          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#FACC15] font-mono">
              MESSAGES SENT
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#111827] border-2 border-[#0F172A] text-[#22C55E] shadow-[0_2px_0_#0B0F1A] flex items-center justify-center">
              <Send className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2 font-mono">
            <span className="text-3xl font-black text-[#22C55E] tracking-tight">
              {stats?.messagesSentToday ?? 0}
            </span>
            <span className="text-xs text-[#94A3B8] font-bold">
              ({stats?.totalMessagesSent ?? 0} ALL)
            </span>
          </div>
          <p className="text-[10px] text-[#94A3B8] font-mono uppercase mt-1">Today Success Dispatched</p>
        </div>

        {/* Card 4: FAILED / RATE LIMITED BLOCK */}
        <div className="block-card p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-8 w-6 h-1.5 bg-[#EF4444] rounded-b-md border-b-2 border-x-2 border-[#0F172A]" />

          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#FACC15] font-mono">
              ERRORS / RETRIES
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#111827] border-2 border-[#0F172A] text-[#EF4444] shadow-[0_2px_0_#0B0F1A] flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2 font-mono">
            <span className={`text-3xl font-black tracking-tight ${stats && stats.totalFailedToday > 0 ? 'text-[#EF4444]' : 'text-[#94A3B8]'}`}>
              {stats?.totalFailedToday ?? 0}
            </span>
            <span className="text-xs text-[#94A3B8] font-bold">TODAY</span>
          </div>
          <p className="text-[10px] text-[#94A3B8] font-mono uppercase mt-1">Isolated & Handled</p>
        </div>
      </div>

      {/* MAIN GRID: ACTIVE CHANNELS & TERMINAL LOG STREAM */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): ACTIVE CHANNEL BLOCKS */}
        <div className="lg:col-span-2 block-card p-6 flex flex-col">
          <div className="flex items-center justify-between mb-5 pb-3 border-b-2 border-[#0F172A]">
            <div>
              <h3 className="text-sm font-black text-white uppercase font-mono tracking-wider flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#FACC15]" />
                <span>ACTIVE AUTONOMOUS CHANNELS</span>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#2563EB] text-white border border-[#0F172A] font-mono">
                  {activeChannels.length} RUNNING
                </span>
              </h3>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Channel yang sedang menghitung mundur interval pengiriman terjadwal
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenAddChannel}
              className="block-btn block-btn-primary px-3.5 py-2 text-xs"
            >
              <Plus className="w-3.5 h-3.5 text-[#FACC15]" />
              <span>NEW CHANNEL</span>
            </button>
          </div>

          {channels.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-[#0F172A] rounded-xl my-4 bg-[#111827]">
              <div className="w-12 h-12 rounded-xl bg-[#2563EB] text-[#FACC15] border-2 border-[#0F172A] shadow-[0_3px_0_#1D4ED8] flex items-center justify-center mb-3">
                <Puzzle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-extrabold text-white uppercase font-mono tracking-wider">BELUM ADA BLOCK CHANNEL</h4>
              <p className="text-xs text-[#94A3B8] max-w-sm mt-1 mb-4">
                Mulai dengan menambahkan token Discord di menu Tokens, lalu konfigurasi channel target dan delay.
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onOpenAddAccount}
                  className="block-btn block-btn-dark px-3.5 py-2 text-xs"
                >
                  ADD TOKEN
                </button>
                <button
                  type="button"
                  onClick={onOpenAddChannel}
                  className="block-btn block-btn-primary px-3.5 py-2 text-xs text-white"
                >
                  CREATE CHANNEL BLOCK
                </button>
              </div>
            </div>
          ) : activeChannels.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-[#0F172A] rounded-xl my-4 bg-[#111827]">
              <Clock className="w-8 h-8 text-[#94A3B8] mb-2" />
              <p className="text-xs font-bold text-white uppercase font-mono">SEMUA CHANNEL SAAT INI BERHENTI (STOPPED)</p>
              <p className="text-xs text-[#94A3B8] mt-1 mb-3">
                Klik tombol Start All di header atas atau toggle tiap channel di halaman Channels.
              </p>
              <button
                type="button"
                onClick={() => onSelectTab('channels')}
                className="text-xs text-[#FACC15] hover:underline font-extrabold font-mono flex items-center gap-1 cursor-pointer"
              >
                OPEN CHANNELS MANAGER <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[380px] pr-1">
              {activeChannels.map((ch) => (
                <div
                  key={ch.id}
                  className="p-4 rounded-xl bg-[#111827] border-2 border-[#0F172A] shadow-[0_3px_0_#0B0F1A] flex items-center justify-between gap-4 transition hover:border-[#3B82F6]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-white tracking-wide">{ch.name}</span>
                      <span className="text-[11px] font-mono text-[#FACC15] bg-[#0B0F1A] px-2 py-0.5 rounded border border-[#0F172A]">
                        #{ch.channelId}
                      </span>
                      {ch.randomDelayEnabled && (
                        <span className="text-[10px] text-[#3B82F6] font-mono bg-[#0B0F1A] px-1.5 py-0.5 rounded border border-[#1E2536]">
                          JITTER +{ch.randomDelayMinSeconds}s~{ch.randomDelayMaxSeconds}s
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs text-[#94A3B8] font-mono">
                      <span>USER: <strong className="text-white">{ch.accountName || 'Discord User'}</strong></span>
                      <span>DELAY: <strong className="text-[#FACC15]">{ch.delayHours}h {ch.delayMinutes}m {ch.delaySeconds}s</strong></span>
                      <span className="text-[#22C55E]">SENT: {ch.sentCount || 0}</span>
                    </div>

                    {ch.lastError && (
                      <div className="mt-1 text-[11px] text-[#EF4444] font-mono truncate">
                        ⚠️ ERROR: {ch.lastError}
                      </div>
                    )}
                  </div>

                  {/* Countdown & Actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] text-[#94A3B8] font-mono uppercase font-bold">NEXT POST</div>
                      <div className="text-xs font-mono font-black text-[#FACC15] flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3 text-[#FACC15]" />
                        {getCountdown(ch.nextSendAt)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSendNow(ch.id)}
                        className="block-btn block-btn-primary p-2 text-xs"
                        title="Tes Kirim Manual Sekarang"
                      >
                        <Send className="w-3.5 h-3.5 text-[#FACC15]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleChannel(ch.id)}
                        className="block-btn block-btn-secondary p-2 text-xs"
                        title="Jeda Channel Ini"
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-3 border-t-2 border-[#0F172A] flex items-center justify-between text-xs text-[#94A3B8]">
            <span className="font-mono text-[11px]">RUNNING CHANNELS ({activeChannels.length})</span>
            <button
              type="button"
              onClick={() => onSelectTab('channels')}
              className="text-[#FACC15] hover:underline font-bold font-mono flex items-center gap-1 cursor-pointer"
            >
              ALL BLOCKS ({channels.length}) <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Column (1 span): TERMINAL LOG STREAM */}
        <div className="block-card p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-[#0F172A]">
            <h3 className="text-sm font-black text-white uppercase font-mono tracking-wider flex items-center gap-2">
              <Send className="w-4 h-4 text-[#22C55E]" />
              <span>TERMINAL FEED</span>
            </h3>
            <button
              type="button"
              onClick={() => onSelectTab('logs')}
              className="text-xs text-[#FACC15] hover:underline font-bold font-mono cursor-pointer"
            >
              VIEW ALL
            </button>
          </div>

          {logs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-[#0F172A] rounded-xl my-4 text-[#94A3B8] text-xs font-mono bg-[#111827]">
              Belum ada log aktivitas.
            </div>
          ) : (
            <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[380px] pr-1">
              {logs.slice(0, 7).map((log) => {
                const isSuccess = log.status === 'success';
                const isRate = log.status === 'rate_limited';

                return (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-[#0B0F1A] border-2 border-[#0F172A] text-xs space-y-1.5 font-mono shadow-[0_2px_0_#0F172A]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isSuccess ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E] shrink-0" />
                        ) : isRate ? (
                          <Clock className="w-3.5 h-3.5 text-[#FACC15] shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-[#EF4444] shrink-0" />
                        )}
                        <span className="font-bold text-white truncate">{log.channelName}</span>
                      </div>
                      <span className="text-[10px] text-[#94A3B8]">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#94A3B8] truncate bg-[#111827] px-2 py-1 rounded border border-[#1E2536]">
                      "{log.messagePreview}"
                    </div>

                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[#3B82F6]">{log.accountName}</span>
                      <span
                        className={`font-black ${
                          isSuccess ? 'text-[#22C55E]' : isRate ? 'text-[#FACC15]' : 'text-[#EF4444]'
                        }`}
                      >
                        {isSuccess ? '200 OK' : isRate ? '429 RATE LIMIT' : `HTTP ${log.responseCode}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Tips Puzzle Block */}
          <div className="mt-4 p-3 bg-[#111827] border-2 border-[#0F172A] rounded-xl text-xs space-y-1 shadow-[0_3px_0_#0B0F1A]">
            <div className="font-extrabold flex items-center gap-1.5 text-[#FACC15] font-mono uppercase text-[11px]">
              <Puzzle className="w-3.5 h-3.5" />
              <span>BLOCKLY ANTI-SPAM TIPS</span>
            </div>
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">
              Gunakan placeholder <code className="text-[#3B82F6] font-mono">{'{random_1-100}'}</code> dan aktifkan Random Delay Range agar pola pengiriman tampak seperti manusia.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
