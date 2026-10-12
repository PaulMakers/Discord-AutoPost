import { Play, Square, RefreshCw, Layers } from 'lucide-react';
import type { TabType } from './Sidebar.tsx';
import type { DashboardStats } from '../types/index.ts';

interface HeaderProps {
  currentTab: TabType;
  stats?: DashboardStats | null;
  isLoading: boolean;
  onRefresh: () => void;
  onStartAll: () => void;
  onStopAll: () => void;
}

export function Header({
  currentTab,
  stats,
  isLoading,
  onRefresh,
  onStartAll,
  onStopAll,
}: HeaderProps) {
  const titles: Record<TabType, { title: string; subtitle: string; tag: string }> = {
    dashboard: {
      title: 'DASHBOARD OVERVIEW',
      subtitle: 'Visual status monitor untuk seluruh block scheduler dan channel target',
      tag: 'MONITOR',
    },
    channels: {
      title: 'CHANNEL BLOCKS MANAGER',
      subtitle: 'Konfigurasi interval waktu, random jitter, dan template pesan tiap block',
      tag: 'CHANNELS',
    },
    accounts: {
      title: 'USER TOKEN VAULT',
      subtitle: 'Kelola multi-akun Discord dengan perlindungan enkripsi block AES-256-GCM',
      tag: 'TOKENS',
    },
    logs: {
      title: 'EXECUTION LOG TERMINAL',
      subtitle: 'Histori real-time pengiriman pesan, response code Discord, dan status rate-limit',
      tag: 'AUDIT',
    },
    settings: {
      title: 'SETTINGS & SYSTEM DOCS',
      subtitle: 'Master kill-switch, delay safety limits, dan referensi placeholder dinamis',
      tag: 'CONFIG',
    },
  };

  const { title, subtitle, tag } = titles[currentTab];

  return (
    <header className="h-20 bg-[#111827] border-b-2 border-[#0F172A] px-8 flex items-center justify-between shrink-0 select-none shadow-[0_4px_0_#0B0F1A]">
      <div className="flex items-center gap-3">
        {/* Yellow Blockly Badge */}
        <div className="hidden sm:flex px-2 py-1 bg-[#FACC15] text-[#0B0F1A] font-extrabold text-[10px] font-mono rounded-lg border-2 border-[#0F172A] shadow-[0_2px_0_#CA8A04] items-center gap-1 uppercase tracking-wider">
          <Layers className="w-3 h-3" />
          <span>{tag}</span>
        </div>

        <div>
          <h2 className="text-lg font-black text-white tracking-wide uppercase font-mono flex items-center gap-2">
            <span>{title}</span>
            <span className="w-2 h-2 rounded-full bg-[#FACC15]"></span>
          </h2>
          <p className="text-xs text-[#94A3B8] font-medium mt-0.5">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* START ALL BLOCK BUTTON */}
        <button
          type="button"
          onClick={onStartAll}
          disabled={!stats || stats.totalChannels === 0}
          className="block-btn block-btn-primary px-4 py-2.5 text-xs text-white"
          title="Nyalakan seluruh block autopost"
        >
          <Play className="w-3.5 h-3.5 fill-current text-[#FACC15]" />
          <span>START ALL</span>
        </button>

        {/* STOP ALL BLOCK BUTTON */}
        <button
          type="button"
          onClick={onStopAll}
          disabled={!stats || stats.activeChannels === 0}
          className="block-btn block-btn-danger px-4 py-2.5 text-xs text-white"
          title="Hentikan seluruh block autopost"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>STOP ALL</span>
        </button>

        <div className="h-7 w-0.5 bg-[#1E2536] mx-1" />

        {/* REFRESH BLOCK BUTTON */}
        <button
          type="button"
          onClick={onRefresh}
          className={`block-btn block-btn-dark p-2.5 text-[#FACC15] ${
            isLoading ? 'animate-spin text-[#3B82F6]' : ''
          }`}
          title="Sync / Segarkan data sekarang"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
