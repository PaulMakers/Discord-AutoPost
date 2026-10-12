import { useState } from 'react';
import {
  ScrollText,
  Trash2,
  Download,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Puzzle,
  X,
} from 'lucide-react';
import type { AutopostLog } from '../types/index.ts';
import { ConfirmModal } from '../components/ConfirmModal.tsx';
import { useToast } from '../components/Toast.tsx';

interface LogsPageProps {
  logs: AutopostLog[];
  isLoading: boolean;
  onRefresh: () => void;
  onClearLogs: () => Promise<void>;
}

export function LogsPage({ logs, isLoading, onRefresh, onClearLogs }: LogsPageProps) {
  const { success, error } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed' | 'rate_limited'>('all');
  const [selectedLog, setSelectedLog] = useState<AutopostLog | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const filteredLogs = logs.filter((l) => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      l.channelName.toLowerCase().includes(q) ||
      l.accountName.toLowerCase().includes(q) ||
      l.targetChannelId.includes(q) ||
      l.messagePreview.toLowerCase().includes(q) ||
      l.responseDetails.toLowerCase().includes(q)
    );
  });

  const handleClear = async () => {
    setIsClearing(true);
    try {
      await onClearLogs();
      success('LOG DIBERSIHKAN', 'Semua riwayat aktivitas pengiriman di SQLite berhasil dihapus.');
      setShowClearConfirm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      error('GAGAL MEMBERSIHKAN', msg);
    } finally {
      setIsClearing(false);
    }
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `discord_autopost_logs_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    success('EXPORT JSON BERHASIL', 'File log JSON telah diunduh.');
  };

  const handleExportCsv = () => {
    const headers = ['Timestamp', 'Status', 'Channel', 'Channel_ID', 'Akun', 'HTTP_Code', 'Pesan', 'Detail'];
    const rows = logs.map((l) => [
      `"${l.createdAt}"`,
      `"${l.status}"`,
      `"${l.channelName.replace(/"/g, '""')}"`,
      `"${l.targetChannelId}"`,
      `"${l.accountName.replace(/"/g, '""')}"`,
      l.responseCode,
      `"${l.messagePreview.replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      `"${l.responseDetails.replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', encodeURI(csvContent));
    downloadAnchor.setAttribute('download', `discord_autopost_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    success('EXPORT CSV BERHASIL', 'File log CSV telah diunduh.');
  };

  return (
    <div className="space-y-6">
      {/* HEADER CONTROL BLOCK */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 block-card p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2563EB] text-[#FACC15] border-2 border-[#0F172A] shadow-[0_3px_0_#1D4ED8] flex items-center justify-center">
            <ScrollText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase font-mono tracking-wider flex items-center gap-2">
              <span>DISCORD EXECUTION TERMINAL LOGS</span>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#0B0F1A] text-[#FACC15] font-mono border border-[#0F172A] font-bold">
                {logs.length} ENTRIES
              </span>
            </h3>
            <p className="text-xs text-[#94A3B8]">
              Audit log real-time dari tabel logs SQLite untuk setiap request ke Discord API
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap font-mono">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={logs.length === 0}
            className="block-btn block-btn-dark px-3 py-2 text-xs text-[#FACC15]"
            title="Download CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            disabled={logs.length === 0}
            className="block-btn block-btn-dark px-3 py-2 text-xs text-[#3B82F6]"
            title="Download JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>

          <button
            type="button"
            disabled={logs.length === 0}
            onClick={() => setShowClearConfirm(true)}
            className="block-btn block-btn-danger px-3.5 py-2 text-xs text-white"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>CLEAR LOGS</span>
          </button>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#111827] p-3.5 rounded-2xl border-2 border-[#0F172A] shadow-[0_4px_0_#0B0F1A]">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#FACC15] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari channel, akun, teks..."
            className="block-input w-full pl-9 pr-3 py-2 text-xs font-mono"
          />
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1.5 bg-[#0B0F1A] p-1.5 rounded-xl border border-[#0F172A] text-xs font-mono w-full sm:w-auto overflow-x-auto">
          {[
            { id: 'all', label: `ALL (${logs.length})` },
            { id: 'success', label: `SUCCESS (${logs.filter((l) => l.status === 'success').length})` },
            { id: 'rate_limited', label: `429 RATE (${logs.filter((l) => l.status === 'rate_limited').length})` },
            { id: 'failed', label: `FAILED (${logs.filter((l) => l.status === 'failed').length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as typeof statusFilter)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-[#2563EB] text-white shadow-[0_2px_0_#1D4ED8]'
                  : 'text-[#94A3B8] hover:text-[#FACC15]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* LOG TERMINAL TABLE */}
      {filteredLogs.length === 0 ? (
        <div className="block-card p-12 text-center flex flex-col items-center justify-center text-[#94A3B8] text-xs font-mono border-dashed">
          <ScrollText className="w-10 h-10 text-[#FACC15] mb-2" />
          <p className="font-bold text-white uppercase">TIDAK ADA LOG DENGAN FILTER INI</p>
          <p className="text-[#94A3B8] mt-1">Gunakan kata kunci lain atau pilih tab filter ALL.</p>
        </div>
      ) : (
        <div className="block-card overflow-hidden shadow-[0_8px_0_#0B0F1A]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-[#2563EB] text-white border-b-2 border-[#0F172A] uppercase tracking-wider text-[11px] shadow-[0_2px_0_#1D4ED8]">
                  <th className="py-3 px-4 font-black">TIMESTAMP</th>
                  <th className="py-3 px-4 font-black">STATUS</th>
                  <th className="py-3 px-4 font-black">TARGET CHANNEL</th>
                  <th className="py-3 px-4 font-black">USER TOKEN</th>
                  <th className="py-3 px-4 font-black">MESSAGE PREVIEW</th>
                  <th className="py-3 px-4 font-black">DISCORD RESPONSE</th>
                  <th className="py-3 px-4 font-black text-right">INSPECT</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#0F172A]">
                {filteredLogs.map((log, idx) => {
                  const isSuccess = log.status === 'success';
                  const isRate = log.status === 'rate_limited';
                  const rowBg = idx % 2 === 0 ? 'bg-[#0B0F1A]' : 'bg-[#111827]';

                  return (
                    <tr key={log.id} className={`${rowBg} hover:bg-[#1E2536] transition`}>
                      {/* Timestamp */}
                      <td className="py-3 px-4 text-[#94A3B8] whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isSuccess ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#22C55E] bg-[#0B0F1A] border border-[#22C55E]/40 px-2 py-0.5 rounded">
                            <CheckCircle2 className="w-3 h-3" /> 200 OK
                          </span>
                        ) : isRate ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#FACC15] bg-[#0B0F1A] border border-[#FACC15]/40 px-2 py-0.5 rounded">
                            <Clock className="w-3 h-3" /> 429 RATE LIMIT
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#EF4444] bg-[#0B0F1A] border border-[#EF4444]/40 px-2 py-0.5 rounded">
                            <XCircle className="w-3 h-3" /> {log.responseCode || 'ERROR'}
                          </span>
                        )}
                      </td>

                      {/* Channel */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{log.channelName}</div>
                        <div className="text-[10px] text-[#FACC15]">#{log.targetChannelId}</div>
                      </td>

                      {/* Account */}
                      <td className="py-3 px-4 text-[#3B82F6] font-bold">
                        {log.accountName}
                      </td>

                      {/* Message Preview */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="text-[11px] text-[#F8FAFC] truncate bg-[#111827] p-1.5 rounded border border-[#0F172A]">
                          {log.messagePreview}
                        </div>
                      </td>

                      {/* Response Details */}
                      <td className="py-3 px-4 max-w-xs">
                        <div
                          className={`text-[11px] truncate ${
                            isSuccess ? 'text-[#94A3B8]' : isRate ? 'text-[#FACC15]' : 'text-[#EF4444]'
                          }`}
                        >
                          {log.responseDetails}
                        </div>
                      </td>

                      {/* Inspect Detail */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="block-btn block-btn-dark p-1.5 text-xs text-[#FACC15]"
                          title="Lihat Detail Log"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DETAIL MODAL BLOCK */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0F1A]/85 backdrop-blur-sm">
          <div className="bg-[#1E2536] border-2 border-[#0F172A] rounded-2xl w-full max-w-lg shadow-[0_12px_0_#0B0F1A,0_20px_35px_rgba(0,0,0,0.7)] relative overflow-hidden animate-snap-in font-mono">
            {/* Header Block Bar */}
            <div className="p-4 bg-[#2563EB] text-white border-b-2 border-[#0F172A] flex items-center justify-between shadow-[0_3px_0_#1D4ED8]">
              <div className="flex items-center gap-2">
                <Puzzle className="w-4 h-4 text-[#FACC15]" />
                <h3 className="text-sm font-extrabold uppercase tracking-wider">
                  LOG ENTRY DETAILS
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1 hover:bg-black/20 rounded-lg text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-[#0B0F1A] rounded-xl border-2 border-[#0F172A]">
                <div>
                  <div className="text-[10px] text-[#94A3B8] uppercase font-bold">STATUS</div>
                  <div className="font-black text-[#FACC15] mt-0.5">
                    {selectedLog.status.toUpperCase()} ({selectedLog.responseCode})
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#94A3B8] uppercase font-bold">TIMESTAMP</div>
                  <div className="text-white mt-0.5">{new Date(selectedLog.createdAt).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#94A3B8] uppercase font-bold">CHANNEL</div>
                  <div className="font-bold text-white mt-0.5">{selectedLog.channelName} (#{selectedLog.targetChannelId})</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#94A3B8] uppercase font-bold">USER TOKEN</div>
                  <div className="font-bold text-[#3B82F6] mt-0.5">{selectedLog.accountName}</div>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#FACC15] uppercase font-bold block mb-1">PESAN TERKIRIM:</label>
                <div className="p-3 bg-[#0B0F1A] rounded-xl border-2 border-[#0F172A] text-[#22C55E] whitespace-pre-wrap break-words leading-relaxed">
                  {selectedLog.messagePreview}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#FACC15] uppercase font-bold block mb-1">DISCORD API RESPONSE:</label>
                <div className="p-3 bg-[#0B0F1A] rounded-xl border-2 border-[#0F172A] text-[#94A3B8] break-words leading-relaxed">
                  {selectedLog.responseDetails}
                </div>
              </div>
            </div>

            <div className="p-4 border-t-2 border-[#0F172A] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="block-btn block-btn-secondary px-4 py-2 text-xs"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      <ConfirmModal
        isOpen={showClearConfirm}
        title="BERSIHKAN SEMUA LOG?"
        description="Tindakan ini akan menghapus seluruh data tabel log dari SQLite secara permanen."
        confirmText="CLEAR ALL LOGS"
        isDangerous={true}
        isLoading={isClearing}
        onConfirm={handleClear}
        onClose={() => setShowClearConfirm(false)}
      />
    </div>
  );
}
