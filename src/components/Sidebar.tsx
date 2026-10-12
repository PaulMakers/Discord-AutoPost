import React from 'react';
import {
  LayoutDashboard,
  Radio,
  Users,
  ScrollText,
  Settings,
  Puzzle,
  Activity,
  ShieldAlert,
} from 'lucide-react';
import type { DashboardStats } from '../types/index.ts';

export type TabType = 'dashboard' | 'channels' | 'accounts' | 'logs' | 'settings';

interface SidebarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  stats?: DashboardStats | null;
}

export function Sidebar({ currentTab, onSelectTab, stats }: SidebarProps) {
  const navItems: { id: TabType; label: string; icon: React.ReactNode; badge?: number | string }[] = [
    {
      id: 'dashboard',
      label: 'DASHBOARD',
      icon: <LayoutDashboard className="w-5 h-5 text-[#FACC15]" />,
    },
    {
      id: 'channels',
      label: 'CHANNEL BLOCKS',
      icon: <Radio className="w-5 h-5 text-[#FACC15]" />,
      badge: stats ? `${stats.activeChannels}/${stats.totalChannels}` : undefined,
    },
    {
      id: 'accounts',
      label: 'USER TOKENS',
      icon: <Users className="w-5 h-5 text-[#FACC15]" />,
      badge: stats ? stats.totalAccounts : undefined,
    },
    {
      id: 'logs',
      label: 'ACTIVITY LOGS',
      icon: <ScrollText className="w-5 h-5 text-[#FACC15]" />,
    },
    {
      id: 'settings',
      label: 'SETTINGS & DOCS',
      icon: <Settings className="w-5 h-5 text-[#FACC15]" />,
    },
  ];

  return (
    <aside className="w-68 bg-[#0B0F1A] border-r-2 border-[#0F172A] flex flex-col shrink-0 select-none">
      {/* Brand Header: Blockly Logo Block */}
      <div className="p-5 border-b-2 border-[#0F172A] bg-[#111827]">
        <div className="flex items-center gap-3">
          {/* 3D Puzzle Block Icon */}
          <div className="w-11 h-11 rounded-xl bg-[#2563EB] border-2 border-[#0F172A] flex items-center justify-center shadow-[0_4px_0_#1D4ED8] text-white relative group">
            <Puzzle className="w-6 h-6 text-[#FACC15]" />
            {/* Tiny puzzle tab notch on top */}
            <div className="absolute -top-1.5 left-3 w-4 h-1.5 bg-[#2563EB] rounded-t-sm border-t border-x border-[#0F172A]" />
          </div>

          <div className="min-w-0">
            <h1 className="font-extrabold text-base text-white tracking-wide flex items-center gap-1.5 uppercase font-mono">
              <span className="text-[#3B82F6]">DISCORD</span>
              <span className="text-[#FACC15] bg-[#1E2536] px-1.5 py-0.5 rounded-md border border-[#0F172A] text-xs">BLOCK</span>
            </h1>
            <p className="text-[11px] text-[#94A3B8] font-mono flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse"></span>
              <span>AUTOPOST ENGINE</span>
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Block Items */}
      <nav className="p-3.5 space-y-2 flex-1 overflow-y-auto">
        <div className="px-3 pt-1 pb-1 text-[11px] font-extrabold uppercase tracking-wider text-[#FACC15] flex items-center gap-1.5">
          <span className="w-1.5 h-3 bg-[#FACC15] rounded-xs"></span>
          <span>BLOCK MENU</span>
        </div>

        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-bold text-xs tracking-wider transition-all duration-100 relative cursor-pointer border-2 ${
                isActive
                  ? 'bg-[#2563EB] text-white border-[#0F172A] shadow-[0_4px_0_#1D4ED8] translate-y-[-1px]'
                  : 'bg-[#111827] text-[#94A3B8] border-[#0F172A] hover:bg-[#1E2536] hover:text-white hover:border-[#2563EB] shadow-[0_3px_0_#0B0F1A]'
              }`}
            >
              {/* Active Yellow Puzzle Tab on the left */}
              {isActive && (
                <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-6 bg-[#FACC15] rounded-r-md border-y-2 border-r-2 border-[#0F172A] shadow-sm" />
              )}

              <div className="flex items-center gap-3">
                <span className={isActive ? 'text-white' : 'text-[#FACC15]'}>{item.icon}</span>
                <span className={isActive ? 'text-white' : 'text-[#F8FAFC]'}>{item.label}</span>
              </div>

              {item.badge !== undefined && (
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-lg font-mono font-black border ${
                    isActive
                      ? 'bg-[#1D4ED8] text-[#FACC15] border-[#60A5FA]'
                      : 'bg-[#0B0F1A] text-[#FACC15] border-[#1E2536]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Engine Status Puzzle Block at Bottom */}
      <div className="p-3.5 m-3.5 bg-[#111827] rounded-2xl border-2 border-[#0F172A] shadow-[0_4px_0_#0B0F1A] text-xs space-y-2.5 relative">
        {/* Decorative puzzle tab on top */}
        <div className="absolute -top-2 left-6 w-6 h-2 bg-[#111827] rounded-t-md border-t-2 border-x-2 border-[#0F172A]" />

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-bold text-white text-[11px] uppercase tracking-wider">
            <Activity className="w-3.5 h-3.5 text-[#FACC15]" />
            SCHEDULER STATUS
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-md font-bold border border-[#0F172A] bg-[#0B0F1A]">
            <span
              className={`w-2 h-2 rounded-full ${
                stats?.isSchedulerRunning ? 'bg-[#22C55E] animate-ping' : 'bg-[#EF4444]'
              }`}
            />
            <span className={stats?.isSchedulerRunning ? 'text-[#22C55E]' : 'text-[#EF4444]'}>
              {stats?.isSchedulerRunning ? 'RUNNING' : 'STOPPED'}
            </span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t-2 border-[#0F172A] text-[11px]">
          <div className="bg-[#0B0F1A] p-2 rounded-xl border border-[#1E2536]">
            <div className="text-[10px] text-[#94A3B8] font-mono uppercase font-bold">SENT TODAY</div>
            <div className="font-extrabold font-mono text-[#FACC15] text-sm mt-0.5">
              {stats?.messagesSentToday ?? 0}
            </div>
          </div>
          <div className="bg-[#0B0F1A] p-2 rounded-xl border border-[#1E2536]">
            <div className="text-[10px] text-[#94A3B8] font-mono uppercase font-bold">CHANNELS</div>
            <div className="font-extrabold font-mono text-[#3B82F6] text-sm mt-0.5">
              {stats?.activeChannels ?? 0}/{stats?.totalChannels ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* Security info bar */}
      <div className="px-4 py-2.5 bg-[#0B0F1A] border-t-2 border-[#0F172A] text-[11px] text-[#94A3B8] flex items-center justify-between font-mono">
        <span className="flex items-center gap-1 text-[#FACC15]">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>SELF-BOT</span>
        </span>
        <span className="bg-[#1E2536] px-2 py-0.5 rounded-md text-[#3B82F6] font-bold border border-[#0F172A]">
          AES-256-GCM
        </span>
      </div>
    </aside>
  );
}
