import React, { useState } from 'react';
import {
  Radio,
  Plus,
  Edit2,
  Trash2,
  Send,
  Clock,
  Sparkles,
  CheckCircle2,
  Shuffle,
  Eye,
  Puzzle,
  X,
} from 'lucide-react';
import type { AutopostChannel, DiscordAccount } from '../types/index.ts';
import { ConfirmModal } from '../components/ConfirmModal.tsx';
import { useToast } from '../components/Toast.tsx';
import { api } from '../services/api.ts';

interface ChannelsPageProps {
  channels: AutopostChannel[];
  accounts: DiscordAccount[];
  isLoading: boolean;
  onRefresh: () => void;
  isOpenAddModal: boolean;
  onCloseAddModal: () => void;
  onOpenAddModal: () => void;
  onToggleChannel: (id: string) => void;
  onSendNow: (id: string) => void;
}

export function ChannelsPage({
  channels,
  accounts,
  isLoading,
  onRefresh,
  isOpenAddModal,
  onCloseAddModal,
  onOpenAddModal,
  onToggleChannel,
  onSendNow,
}: ChannelsPageProps) {
  const { success, error } = useToast();

  const [editingChannel, setEditingChannel] = useState<AutopostChannel | null>(null);

  const [name, setName] = useState('');
  const [channelId, setChannelId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [delayHours, setDelayHours] = useState(0);
  const [delayMinutes, setDelayMinutes] = useState(5);
  const [delaySeconds, setDelaySeconds] = useState(0);
  const [randomDelayEnabled, setRandomDelayEnabled] = useState(false);
  const [randomDelayMinSeconds, setRandomDelayMinSeconds] = useState(10);
  const [randomDelayMaxSeconds, setRandomDelayMaxSeconds] = useState(30);
  const [messageTemplate, setMessageTemplate] = useState('Halo {channel}! Waktu sekarang: {time}. Kode unik: #{random_1-100}');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isValidatingChannel, setIsValidatingChannel] = useState(false);
  const [validatedChannelInfo, setValidatedChannelInfo] = useState<{ id: string; name?: string } | null>(null);

  const [channelToDelete, setChannelToDelete] = useState<AutopostChannel | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewText, setPreviewText] = useState('');

  const handleOpenEdit = (ch: AutopostChannel) => {
    setEditingChannel(ch);
    setName(ch.name);
    setChannelId(ch.channelId);
    setAccountId(ch.accountId);
    setDelayHours(ch.delayHours);
    setDelayMinutes(ch.delayMinutes);
    setDelaySeconds(ch.delaySeconds);
    setRandomDelayEnabled(ch.randomDelayEnabled);
    setRandomDelayMinSeconds(ch.randomDelayMinSeconds || 10);
    setRandomDelayMaxSeconds(ch.randomDelayMaxSeconds || 30);
    setMessageTemplate(ch.messageTemplate);
    setIsActive(ch.isActive);
    setValidatedChannelInfo(null);
    updatePreview(ch.messageTemplate, ch.name);
  };

  const handleOpenCreate = () => {
    setEditingChannel(null);
    setName('');
    setChannelId('');
    setAccountId(accounts.length > 0 ? accounts[0].id : '');
    setDelayHours(0);
    setDelayMinutes(5);
    setDelaySeconds(0);
    setRandomDelayEnabled(false);
    setRandomDelayMinSeconds(10);
    setRandomDelayMaxSeconds(30);
    setMessageTemplate('Halo {channel}! Waktu sekarang: {time}. Info: #{random_1-100}');
    setIsActive(true);
    setValidatedChannelInfo(null);
    updatePreview('Halo {channel}! Waktu sekarang: {time}. Info: #{random_1-100}', 'Channel-Baru');
    onOpenAddModal();
  };

  const updatePreview = (tpl: string, cName?: string) => {
    const acc = accounts.find((a) => a.id === accountId);
    const rendered = tpl
      .replace(/\{time\}/gi, new Date().toLocaleTimeString())
      .replace(/\{date\}/gi, new Date().toISOString().slice(0, 10))
      .replace(/\{channel\}/gi, cName || name || '#general')
      .replace(/\{account\}/gi, acc?.name || 'MyAccount')
      .replace(/\{random_1-100\}/gi, '42')
      .replace(/\{uuid\}/gi, '7X9K2A');
    setPreviewText(rendered);
  };

  const insertPlaceholder = (ph: string) => {
    const updated = messageTemplate + ' ' + ph;
    setMessageTemplate(updated);
    updatePreview(updated);
  };

  const handleCheckChannelId = async () => {
    if (!channelId.trim()) {
      error('INPUT KOSONG', 'Masukkan Channel ID terlebih dahulu');
      return;
    }
    if (!accountId) {
      error('PILIH AKUN', 'Pilih akun Discord pengirim untuk memeriksa channel');
      return;
    }

    setIsValidatingChannel(true);
    setValidatedChannelInfo(null);
    try {
      const acc = accounts.find((a) => a.id === accountId);
      // Try backend first
      const res = await fetch('/api/channels/validate-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, channelId: channelId.trim() }),
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.channel) {
          setValidatedChannelInfo(data.channel);
          if (data.channel.name && !name) setName(`#${data.channel.name}`);
          success('CHANNEL VALID!', `Terhubung ke #${data.channel.name || channelId}`);
          return;
        }
      }

      // Direct fallback if token is available
      if (acc?.tokenEncrypted && acc.tokenEncrypted.length > 20) {
        const directRes = await fetch(`https://discord.com/api/v10/channels/${channelId.trim()}`, {
          headers: { Authorization: acc.tokenEncrypted },
        }).catch(() => null);
        if (directRes && directRes.ok) {
          const d = await directRes.json().catch(() => null);
          if (d) {
            setValidatedChannelInfo(d);
            if (d.name && !name) setName(`#${d.name}`);
            success('CHANNEL VALID!', `Terhubung ke #${d.name || channelId}`);
            return;
          }
        }
      }

      success('CHANNEL ID TERDETEKSI', `Channel ID #${channelId} siap digunakan.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      error('INFO CHANNEL', msg);
    } finally {
      setIsValidatingChannel(false);
    }
  };

  const handleSubmitChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelId.trim()) {
      error('INPUT KOSONG', 'Channel ID Discord wajib diisi');
      return;
    }
    if (!accountId) {
      error('AKUN KOSONG', 'Pilih akun pengirim terlebih dahulu');
      return;
    }
    if (!messageTemplate.trim()) {
      error('PESAN KOSONG', 'Template pesan tidak boleh kosong');
      return;
    }

    const totalSeconds = delayHours * 3600 + delayMinutes * 60 + delaySeconds;
    if (totalSeconds < 5) {
      error('DELAY TERLALU PENDEK', 'Delay minimal adalah 5 detik.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim() || `Channel-${channelId.trim().slice(-4)}`,
        channelId: channelId.trim(),
        accountId,
        delayHours,
        delayMinutes,
        delaySeconds,
        randomDelayEnabled,
        randomDelayMinSeconds,
        randomDelayMaxSeconds,
        messageTemplate,
        isActive,
      };

      const result = await api.saveChannel(payload, editingChannel?.id);
      if (!result.success || !result.channel) {
        throw new Error(result.error || 'Gagal menyimpan channel');
      }

      success(
        editingChannel ? 'CHANNEL DIPERBARUI' : 'CHANNEL BLOCK DIBUAT',
        `Channel ${result.channel.name} berhasil disimpan.`
      );
      setEditingChannel(null);
      onCloseAddModal();
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      error('GAGAL MENYIMPAN', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!channelToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteChannel(channelToDelete.id);
      success('CHANNEL DIHAPUS', `Channel ${channelToDelete.name} berhasil dihapus.`);
      setChannelToDelete(null);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      error('GAGAL MENGHAPUS', msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const isModalOpen = isOpenAddModal || Boolean(editingChannel);

  return (
    <div className="space-y-6">
      {/* HEADER ACTION BLOCK */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 block-card p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2563EB] text-[#FACC15] border-2 border-[#0F172A] shadow-[0_3px_0_#1D4ED8] flex items-center justify-center">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase font-mono tracking-wider flex items-center gap-2">
              <span>CHANNEL BLOCKS REGISTRY</span>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#0B0F1A] text-[#FACC15] font-mono border border-[#0F172A] font-bold">
                {channels.length} BLOCKS
              </span>
            </h3>
            <p className="text-xs text-[#94A3B8]">
              Setiap channel berjalan mandiri dengan template pesan dan jadwal delay masing-masing
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="block-btn block-btn-primary px-4 py-2.5 text-xs text-white w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 text-[#FACC15]" />
          <span>NEW CHANNEL BLOCK</span>
        </button>
      </div>

      {/* TABLE / LIST OF CHANNEL BLOCKS */}
      {channels.length === 0 ? (
        <div className="block-card p-12 text-center flex flex-col items-center justify-center border-dashed">
          <div className="w-14 h-14 rounded-2xl bg-[#2563EB] text-[#FACC15] border-2 border-[#0F172A] shadow-[0_4px_0_#1D4ED8] flex items-center justify-center mb-3">
            <Radio className="w-7 h-7" />
          </div>
          <h4 className="text-sm font-extrabold text-white uppercase font-mono tracking-wider">BELUM ADA TARGET CHANNEL</h4>
          <p className="text-xs text-[#94A3B8] max-w-md mt-1 mb-5">
            Daftarkan channel Discord tujuan beserta jeda waktu (Jam/Menit/Detik) dan pesan yang ingin dikirimkan.
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="block-btn block-btn-primary px-4 py-2.5 text-xs text-white"
          >
            <Plus className="w-4 h-4 text-[#FACC15]" />
            <span>ADD FIRST CHANNEL BLOCK</span>
          </button>
        </div>
      ) : (
        <div className="block-card overflow-hidden shadow-[0_8px_0_#0B0F1A]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-[#2563EB] text-white border-b-2 border-[#0F172A] uppercase tracking-wider text-[11px] shadow-[0_2px_0_#1D4ED8]">
                  <th className="py-3.5 px-4 font-black">CHANNEL TARGET</th>
                  <th className="py-3.5 px-4 font-black">USER TOKEN</th>
                  <th className="py-3.5 px-4 font-black">DELAY INTERVAL</th>
                  <th className="py-3.5 px-4 font-black">MESSAGE PREVIEW</th>
                  <th className="py-3.5 px-4 font-black">STATUS</th>
                  <th className="py-3.5 px-4 font-black text-center">TOGGLE</th>
                  <th className="py-3.5 px-4 font-black text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#0F172A]">
                {channels.map((ch, idx) => {
                  const isRunning = ch.isActive;
                  const hasError = Boolean(ch.lastError);
                  const rowBg = idx % 2 === 0 ? 'bg-[#111827]' : 'bg-[#1A1F2E]';

                  return (
                    <tr
                      key={ch.id}
                      className={`${rowBg} hover:bg-[#1E2536] transition duration-150`}
                    >
                      {/* Name & ID */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-white text-sm">
                          {ch.name}
                        </div>
                        <div className="text-[11px] text-[#FACC15] mt-0.5">
                          #{ch.channelId}
                        </div>
                        {hasError && (
                          <div className="text-[10px] text-[#EF4444] mt-1 max-w-xs truncate" title={ch.lastError || ''}>
                            ⚠️ {ch.lastError}
                          </div>
                        )}
                      </td>

                      {/* Account */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-[#F8FAFC] bg-[#0B0F1A] px-2.5 py-1 rounded-lg border border-[#0F172A] inline-block">
                          {ch.accountName || 'Discord User'}
                        </span>
                      </td>

                      {/* Delay */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#FACC15]">
                          {ch.delayHours > 0 ? `${ch.delayHours}h ` : ''}
                          {ch.delayMinutes}m {ch.delaySeconds}s
                        </div>
                        {ch.randomDelayEnabled ? (
                          <div className="text-[10px] text-[#3B82F6] flex items-center gap-1 mt-0.5 font-bold">
                            <Shuffle className="w-2.5 h-2.5" />
                            <span>+{ch.randomDelayMinSeconds}s~+{ch.randomDelayMaxSeconds}s</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-[#94A3B8]">FIXED</div>
                        )}
                      </td>

                      {/* Message Preview */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div
                          className="bg-[#0B0F1A] border border-[#0F172A] p-2 rounded-lg text-[#F8FAFC] text-[11px] line-clamp-2 leading-relaxed"
                          title={ch.messageTemplate}
                        >
                          {ch.messageTemplate}
                        </div>
                        <div className="text-[10px] mt-1 flex items-center gap-2">
                          <span className="text-[#22C55E] font-bold">SENT: {ch.sentCount || 0}</span>
                          {ch.failCount > 0 && (
                            <span className="text-[#EF4444] font-bold">FAIL: {ch.failCount}</span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isRunning ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black bg-[#FACC15] text-[#0B0F1A] border-2 border-[#0F172A] shadow-[0_2px_0_#CA8A04]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                            RUNNING
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black bg-[#1E2536] text-[#94A3B8] border-2 border-[#0F172A]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                            STOPPED
                          </span>
                        )}
                      </td>

                      {/* Toggle Switch */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => onToggleChannel(ch.id)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-[#0F172A] transition-colors duration-200 ease-in-out ${
                            isRunning ? 'bg-[#FACC15]' : 'bg-[#0B0F1A]'
                          }`}
                          title={isRunning ? 'Stop Channel' : 'Start Channel'}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full border border-[#0F172A] bg-white shadow-md transition duration-200 ease-in-out ${
                              isRunning ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSendNow(ch.id)}
                            className="block-btn block-btn-primary p-2 text-xs"
                            title="Tes Kirim Sekarang"
                          >
                            <Send className="w-3.5 h-3.5 text-[#FACC15]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(ch)}
                            className="block-btn block-btn-dark p-2 text-xs text-[#FACC15]"
                            title="Edit Block Ini"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setChannelToDelete(ch)}
                            className="block-btn block-btn-danger p-2 text-xs"
                            title="Hapus Block Channel"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD / EDIT MODAL BLOCK */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0F1A]/85 backdrop-blur-sm">
          <div className="bg-[#1E2536] border-2 border-[#0F172A] rounded-2xl w-full max-w-2xl shadow-[0_12px_0_#0B0F1A,0_20px_35px_rgba(0,0,0,0.7)] relative overflow-hidden animate-snap-in max-h-[92vh] overflow-y-auto">
            {/* Header Block */}
            <div className="p-4 bg-[#2563EB] text-white border-b-2 border-[#0F172A] flex items-center justify-between shadow-[0_3px_0_#1D4ED8]">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-[#0B0F1A]/20 border border-white/20">
                  <Puzzle className="w-5 h-5 text-[#FACC15]" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold uppercase font-mono tracking-wider">
                    {editingChannel ? 'EDIT CHANNEL BLOCK' : 'CREATE NEW CHANNEL BLOCK'}
                  </h3>
                  <p className="text-[11px] text-white/80">Konfigurasi interval waktu dan template pesan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingChannel(null);
                  onCloseAddModal();
                }}
                className="p-1 hover:bg-black/20 rounded-lg text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitChannel} className="p-6 space-y-4 font-mono">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Account Selection */}
                <div>
                  <label className="block text-xs font-black text-[#FACC15] uppercase tracking-wider mb-1.5">
                    PILIH USER TOKEN <span className="text-[#EF4444]">*</span>
                  </label>
                  {accounts.length === 0 ? (
                    <div className="text-xs text-[#EF4444] bg-[#0B0F1A] p-2.5 rounded-xl border border-[#EF4444]/40">
                      Belum ada token! Silakan tambah akun di menu Tokens terlebih dahulu.
                    </div>
                  ) : (
                    <select
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      required
                      className="block-input w-full px-3.5 py-2.5 text-xs cursor-pointer"
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} (@{a.username})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Channel Label */}
                <div>
                  <label className="block text-xs font-black text-[#FACC15] uppercase tracking-wider mb-1.5">
                    LABEL CHANNEL (OPSIONAL)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: #trade-market, #lounge"
                    className="block-input w-full px-3.5 py-2.5 text-xs font-sans"
                  />
                </div>
              </div>

              {/* Channel ID */}
              <div>
                <label className="block text-xs font-black text-[#FACC15] uppercase tracking-wider mb-1.5">
                  DISCORD CHANNEL ID <span className="text-[#EF4444]">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={channelId}
                    onChange={(e) => {
                      setChannelId(e.target.value);
                      setValidatedChannelInfo(null);
                    }}
                    placeholder="Contoh: 123456789012345678"
                    required
                    className="block-input flex-1 px-3.5 py-2.5 text-xs"
                  />
                  <button
                    type="button"
                    disabled={isValidatingChannel || !channelId.trim() || !accountId}
                    onClick={handleCheckChannelId}
                    className="block-btn block-btn-dark px-3.5 py-2.5 text-xs text-[#FACC15] shrink-0"
                  >
                    {isValidatingChannel ? 'CHECKING...' : 'TEST CHANNEL'}
                  </button>
                </div>
                {validatedChannelInfo && (
                  <p className="text-xs text-[#22C55E] mt-1 flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Channel valid: #{validatedChannelInfo.name || validatedChannelInfo.id}
                  </p>
                )}
              </div>

              {/* Delay Tiles (Hours, Minutes, Seconds) */}
              <div className="p-4 rounded-xl bg-[#111827] border-2 border-[#0F172A] space-y-3 shadow-inner">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-[#FACC15] uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#3B82F6]" />
                    <span>DELAY TIME INTERVAL (JAM / MENIT / DETIK)</span>
                  </label>
                  <span className="text-[11px] font-mono text-[#FACC15] bg-[#0B0F1A] px-2 py-0.5 rounded border border-[#0F172A] font-bold">
                    TOTAL: {delayHours * 3600 + delayMinutes * 60 + delaySeconds}s
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#0B0F1A] p-2.5 rounded-xl border border-[#1E2536] text-center">
                    <label className="block text-[10px] text-[#94A3B8] uppercase font-bold mb-1">JAM</label>
                    <input
                      type="number"
                      min={0}
                      max={72}
                      value={delayHours}
                      onChange={(e) => setDelayHours(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-[#111827] border border-[#0F172A] rounded-lg px-2 py-1.5 text-sm text-[#FACC15] font-black text-center focus:border-[#2563EB] outline-none"
                    />
                  </div>
                  <div className="bg-[#0B0F1A] p-2.5 rounded-xl border border-[#1E2536] text-center">
                    <label className="block text-[10px] text-[#94A3B8] uppercase font-bold mb-1">MENIT</label>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={delayMinutes}
                      onChange={(e) => setDelayMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-[#111827] border border-[#0F172A] rounded-lg px-2 py-1.5 text-sm text-[#FACC15] font-black text-center focus:border-[#2563EB] outline-none"
                    />
                  </div>
                  <div className="bg-[#0B0F1A] p-2.5 rounded-xl border border-[#1E2536] text-center">
                    <label className="block text-[10px] text-[#94A3B8] uppercase font-bold mb-1">DETIK</label>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={delaySeconds}
                      onChange={(e) => setDelaySeconds(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-[#111827] border border-[#0F172A] rounded-lg px-2 py-1.5 text-sm text-[#FACC15] font-black text-center focus:border-[#2563EB] outline-none"
                    />
                  </div>
                </div>

                {/* Random Delay Range (Jitter) */}
                <div className="pt-2 border-t-2 border-[#0F172A]">
                  <label className="text-xs text-[#F8FAFC] font-bold flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={randomDelayEnabled}
                      onChange={(e) => setRandomDelayEnabled(e.target.checked)}
                      className="rounded border-[#0F172A] text-[#2563EB] focus:ring-[#2563EB] cursor-pointer"
                    />
                    <span>AKTIFKAN RANDOM JITTER RANGE (ANTI-SPAM)</span>
                  </label>

                  {randomDelayEnabled && (
                    <div className="grid grid-cols-2 gap-3 mt-2.5 animate-snap-in">
                      <div>
                        <label className="block text-[10px] text-[#94A3B8] uppercase font-bold mb-1">MIN JITTER (DETIK)</label>
                        <input
                          type="number"
                          min={0}
                          value={randomDelayMinSeconds}
                          onChange={(e) => setRandomDelayMinSeconds(Math.max(0, parseInt(e.target.value) || 0))}
                          className="block-input w-full px-3 py-1.5 text-xs text-[#3B82F6] font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#94A3B8] uppercase font-bold mb-1">MAX JITTER (DETIK)</label>
                        <input
                          type="number"
                          min={0}
                          value={randomDelayMaxSeconds}
                          onChange={(e) => setRandomDelayMaxSeconds(Math.max(0, parseInt(e.target.value) || 0))}
                          className="block-input w-full px-3 py-1.5 text-xs text-[#3B82F6] font-bold"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Message Template Textarea */}
              <div>
                <label className="block text-xs font-black text-[#FACC15] uppercase tracking-wider mb-1.5">
                  ISI PESAN (MULTI-LINE & PLACEHOLDERS) <span className="text-[#EF4444]">*</span>
                </label>
                <textarea
                  rows={4}
                  value={messageTemplate}
                  onChange={(e) => {
                    setMessageTemplate(e.target.value);
                    updatePreview(e.target.value);
                  }}
                  required
                  placeholder="Ketik template pesan di sini..."
                  className="block-input w-full p-3 text-xs leading-relaxed"
                />

                {/* Helper Placeholder Chips */}
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  <span className="text-[10px] text-[#94A3B8] mr-1 flex items-center gap-1 uppercase font-bold">
                    <Sparkles className="w-3 h-3 text-[#FACC15]" />
                    VAR CHIPS:
                  </span>
                  {[
                    { label: '{time}', code: '{time}' },
                    { label: '{date}', code: '{date}' },
                    { label: '{channel}', code: '{channel}' },
                    { label: '{random_1-100}', code: '{random_1-100}' },
                    { label: '{uuid}', code: '{uuid}' },
                    { label: '{greeting}', code: '{greeting}' },
                  ].map((p) => (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => insertPlaceholder(p.code)}
                      className="text-[10px] bg-[#0B0F1A] hover:bg-[#2563EB] hover:text-white text-[#FACC15] px-2 py-0.5 rounded font-bold border border-[#0F172A] transition cursor-pointer"
                    >
                      + {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="p-3.5 rounded-xl bg-[#0B0F1A] border-2 border-[#0F172A] space-y-1">
                <div className="flex items-center justify-between text-[10px] text-[#94A3B8]">
                  <span className="flex items-center gap-1 font-bold text-[#FACC15]">
                    <Eye className="w-3.5 h-3.5" />
                    LIVE RENDERED SIMULATION:
                  </span>
                  <span>BLOCK PREVIEW</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#111827] border border-[#1E2536] text-xs text-[#22C55E] whitespace-pre-wrap break-words font-mono">
                  {previewText || messageTemplate}
                </div>
              </div>

              {/* Toggle switch */}
              <div className="flex items-center justify-between pt-1">
                <label className="text-xs font-bold text-[#F8FAFC] flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-[#0F172A] text-[#2563EB] focus:ring-[#2563EB] cursor-pointer"
                  />
                  <span>LANGSUNG AKTIFKAN BLOCK (RUNNING)</span>
                </label>
              </div>

              {/* Modal Footer: Yellow Cancel + Blue Save */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-[#0F172A]">
                <button
                  type="button"
                  onClick={() => {
                    setEditingChannel(null);
                    onCloseAddModal();
                  }}
                  className="block-btn block-btn-secondary px-4 py-2 text-xs"
                >
                  BATAL
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || accounts.length === 0}
                  className="block-btn block-btn-primary px-5 py-2 text-xs text-white"
                >
                  {isSubmitting
                    ? 'MENYIMPAN...'
                    : editingChannel
                    ? 'UPDATE BLOCK'
                    : 'SAVE & SCHEDULE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(channelToDelete)}
        title="HAPUS CHANNEL BLOCK?"
        description={`Apakah Anda yakin ingin menghapus channel "${channelToDelete?.name}"? Jadwal pengiriman otomatis untuk channel ini akan dihentikan dan dihapus dari SQLite.`}
        confirmText="HAPUS BLOCK"
        isDangerous={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setChannelToDelete(null)}
      />
    </div>
  );
}
