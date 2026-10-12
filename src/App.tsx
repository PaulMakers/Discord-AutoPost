import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar.tsx';
import type { TabType } from './components/Sidebar.tsx';
import { Header } from './components/Header.tsx';
import { ToSWarning } from './components/ToSWarning.tsx';
import { ToastProvider, useToast } from './components/Toast.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { ChannelsPage } from './pages/ChannelsPage.tsx';
import { AccountsPage } from './pages/AccountsPage.tsx';
import { LogsPage } from './pages/LogsPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import type {
  DiscordAccount,
  AutopostChannel,
  AutopostLog,
  AppSettings,
  DashboardStats,
} from './types/index.ts';
import { api } from './services/api.ts';

function AppContent() {
  const { success, error, info } = useToast();

  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [accounts, setAccounts] = useState<DiscordAccount[]>([]);
  const [channels, setChannels] = useState<AutopostChannel[]>([]);
  const [logs, setLogs] = useState<AutopostLog[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Modal controls
  const [isOpenAddAccountModal, setIsOpenAddAccountModal] = useState(false);
  const [isOpenAddChannelModal, setIsOpenAddChannelModal] = useState(false);

  // Fetch all data
  const fetchData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsLoading(true);
    try {
      const [statsRes, accountsRes, channelsRes, logsRes] = await Promise.all([
        api.getStats(),
        api.getAccounts(),
        api.getChannels(),
        api.getLogs(),
      ]);

      if (statsRes) setStats(statsRes);
      if (Array.isArray(accountsRes)) setAccounts(accountsRes);
      if (Array.isArray(channelsRes)) setChannels(channelsRes);
      if (Array.isArray(logsRes)) setLogs(logsRes);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Periodic polling every 3.5 seconds for live countdowns & status
  useEffect(() => {
    const timer = setInterval(() => {
      fetchData(false);
    }, 3500);
    return () => clearInterval(timer);
  }, [fetchData]);

  // Global Start All
  const handleStartAll = async () => {
    try {
      await api.startAll();
      success('Semua Channel Dimulai', 'Autopost diaktifkan untuk seluruh channel target.');
      fetchData(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      error('Error', msg);
    }
  };

  // Global Stop All
  const handleStopAll = async () => {
    try {
      await api.stopAll();
      info('Semua Channel Dihentikan', 'Autopost dinonaktifkan untuk seluruh channel.');
      fetchData(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      error('Error', msg);
    }
  };

  // Toggle single channel
  const handleToggleChannel = async (id: string) => {
    try {
      await api.toggleChannel(id);
      success('Status Diperbarui', 'Status channel berhasil diubah.');
      fetchData(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      error('Gagal Mengubah Status', msg);
    }
  };

  // Immediate send test
  const handleSendNow = async (id: string) => {
    try {
      const target = channels.find((c) => c.id === id);
      info('Mengirim Pesan...', `Mencoba mengirim pesan ke channel "${target?.name || id}"`);
      const result = await api.sendNow(id);
      if (result.success) {
        success('Terkirim!', result.message || 'Pesan berhasil diposting ke Discord.');
        fetchData(false);
      } else {
        error('Gagal Mengirim', result.error || 'Pesan gagal terkirim');
        fetchData(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      error('Error', msg);
    }
  };

  // Clear all logs
  const handleClearLogs = async () => {
    try {
      await api.clearLogs();
      fetchData(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      error('Error', msg);
    }
  };

  return (
    <div className="flex h-screen bg-[#0B0F1A] text-[#F8FAFC] overflow-hidden select-none font-sans">
      {/* Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        stats={stats}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#0B0F1A]">
        {/* Top Header */}
        <Header
          currentTab={currentTab}
          stats={stats}
          isLoading={isLoading}
          onRefresh={() => fetchData(true)}
          onStartAll={handleStartAll}
          onStopAll={handleStopAll}
        />

        {/* Scrollable View Container */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
          {/* Always prominent ToS Notice */}
          <ToSWarning />

          {/* Active View */}
          {currentTab === 'dashboard' && (
            <DashboardPage
              stats={stats}
              channels={channels}
              logs={logs}
              onSelectTab={setCurrentTab}
              onToggleChannel={handleToggleChannel}
              onSendNow={handleSendNow}
              onOpenAddChannel={() => {
                setCurrentTab('channels');
                setIsOpenAddChannelModal(true);
              }}
              onOpenAddAccount={() => {
                setCurrentTab('accounts');
                setIsOpenAddAccountModal(true);
              }}
            />
          )}

          {currentTab === 'channels' && (
            <ChannelsPage
              channels={channels}
              accounts={accounts}
              isLoading={isLoading}
              onRefresh={() => fetchData(false)}
              isOpenAddModal={isOpenAddChannelModal}
              onCloseAddModal={() => setIsOpenAddChannelModal(false)}
              onOpenAddModal={() => setIsOpenAddChannelModal(true)}
              onToggleChannel={handleToggleChannel}
              onSendNow={handleSendNow}
            />
          )}

          {currentTab === 'accounts' && (
            <AccountsPage
              accounts={accounts}
              isLoading={isLoading}
              onRefresh={() => fetchData(false)}
              isOpenAddModal={isOpenAddAccountModal}
              onCloseAddModal={() => setIsOpenAddAccountModal(false)}
              onOpenAddModal={() => setIsOpenAddAccountModal(true)}
            />
          )}

          {currentTab === 'logs' && (
            <LogsPage
              logs={logs}
              isLoading={isLoading}
              onRefresh={() => fetchData(false)}
              onClearLogs={handleClearLogs}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsPage
              settings={settings}
              onRefresh={() => fetchData(false)}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
