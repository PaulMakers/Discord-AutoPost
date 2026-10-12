import React, { useState } from 'react';
import {
  Users,
  Plus,
  Trash2,
  RefreshCw,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  HelpCircle,
  ExternalLink,
  Puzzle,
  X,
} from 'lucide-react';
import type { DiscordAccount } from '../types/index.ts';
import { ConfirmModal } from '../components/ConfirmModal.tsx';
import { useToast } from '../components/Toast.tsx';
import { api } from '../services/api.ts';

interface AccountsPageProps {
  accounts: DiscordAccount[];
  isLoading: boolean;
  onRefresh: () => void;
  isOpenAddModal: boolean;
  onCloseAddModal: () => void;
  onOpenAddModal: () => void;
}

export function AccountsPage({
  accounts,
  isLoading,
  onRefresh,
  isOpenAddModal,
  onCloseAddModal,
  onOpenAddModal,
}: AccountsPageProps) {
  const { success, error } = useToast();

  const [tokenInput, setTokenInput] = useState('');
  const [customName, setCustomName] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validatedUser, setValidatedUser] = useState<{
    id: string;
    username: string;
    global_name?: string;
    avatar?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showTutorial, setShowTutorial] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<DiscordAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [revalidatingId, setRevalidatingId] = useState<string | null>(null);

  const handleValidateToken = async () => {
    if (!tokenInput.trim()) {
      error('INPUT KOSONG', 'Silakan masukkan user token Discord terlebih dahulu.');
      return;
    }

    setIsValidating(true);
    setValidatedUser(null);
    try {
      const res = await api.validateToken(tokenInput.trim());
      if (!res.valid || !res.user) {
        throw new Error(res.error || 'Token tidak valid');
      }

      setValidatedUser(res.user);
      success('TOKEN VALID!', `Terdeteksi akun: ${res.user.global_name || res.user.username}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      error('VALIDASI GAGAL', msg);
    } finally {
      setIsValidating(false);
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      error('INPUT KOSONG', 'Token Discord wajib diisi');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await api.addAccount(tokenInput.trim(), customName.trim());
      if (!result.success || !result.account) {
        throw new Error(result.error || 'Gagal menyimpan akun');
      }

      success('AKUN DISIMPAN', `Akun ${result.account.name} berhasil disimpan dan aktif.`);
      setTokenInput('');
      setCustomName('');
      setValidatedUser(null);
      onCloseAddModal();
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      error('GAGAL MENYIMPAN', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevalidate = async (acc: DiscordAccount) => {
    setRevalidatingId(acc.id);
    try {
      const data = await api.revalidateAccount(acc.id);
      if (!data.success) {
        throw new Error(data.error || 'Gagal revalidasi');
      }

      if (data.status === 'valid') {
        success('TOKEN VALID', `Akun ${acc.name} masih aktif dan terhubung.`);
      } else {
        error('TOKEN EXPIRED', `Akun ${acc.name} tidak valid: ${data.lastError || 'Unauthorized'}`);
      }
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      error('REVALIDASI GAGAL', msg);
    } finally {
      setRevalidatingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!accountToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteAccount(accountToDelete.id);
      success('AKUN DIHAPUS', `Akun ${accountToDelete.name} berhasil dihapus.`);
      setAccountToDelete(null);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      error('GAGAL MENGHAPUS', msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER ACTION BLOCK */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 block-card p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2563EB] text-[#FACC15] border-2 border-[#0F172A] shadow-[0_3px_0_#1D4ED8] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase font-mono tracking-wider flex items-center gap-2">
              <span>DISCORD USER TOKEN VAULT</span>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#0B0F1A] text-[#FACC15] font-mono border border-[#0F172A] font-bold">
                {accounts.length} ACCOUNTS
              </span>
            </h3>
            <p className="text-xs text-[#94A3B8]">
              Multi-token manager dengan validasi otomatis & enkripsi hardware-safe
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setShowTutorial(!showTutorial)}
            className="block-btn block-btn-dark px-3.5 py-2 text-xs flex-1 sm:flex-initial"
          >
            <HelpCircle className="w-4 h-4 text-[#FACC15]" />
            <span>HOW TO GET TOKEN</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddModal}
            className="block-btn block-btn-primary px-4 py-2 text-xs text-white flex-1 sm:flex-initial"
          >
            <Plus className="w-4 h-4 text-[#FACC15]" />
            <span>ADD USER TOKEN</span>
          </button>
        </div>
      </div>

      {/* TUTORIAL BLOCK */}
      {showTutorial && (
        <div className="block-card p-5 space-y-3 animate-snap-in">
          <div className="flex items-center justify-between pb-2 border-b-2 border-[#0F172A]">
            <h4 className="text-xs font-black text-[#FACC15] uppercase font-mono tracking-wider flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#3B82F6]" />
              <span>CARA MENGAMBIL DISCORD USER TOKEN DARI BROWSER (F12):</span>
            </h4>
            <button
              type="button"
              onClick={() => setShowTutorial(false)}
              className="text-xs text-[#94A3B8] hover:text-[#FACC15] font-mono font-bold"
            >
              CLOSE ✕
            </button>
          </div>
          <ol className="list-decimal list-inside space-y-2 text-xs text-[#F8FAFC] leading-relaxed pl-1 font-mono">
            <li>
              Buka Discord di web browser (Chrome/Edge) melalui{' '}
              <a
                href="https://discord.com/app"
                target="_blank"
                rel="noreferrer"
                className="text-[#3B82F6] underline inline-flex items-center gap-0.5 font-bold"
              >
                discord.com/app <ExternalLink className="w-3 h-3" />
              </a>{' '}
              dan login ke akun Anda.
            </li>
            <li>
              Tekan <kbd className="px-1.5 py-0.5 rounded bg-[#0B0F1A] text-[#FACC15] border border-[#1E2536]">F12</kbd> atau <kbd className="px-1.5 py-0.5 rounded bg-[#0B0F1A] text-[#FACC15] border border-[#1E2536]">Ctrl + Shift + I</kbd> untuk membuka Developer Tools.
            </li>
            <li>
              Pilih tab <strong className="text-[#FACC15]">Network</strong> pada panel atas DevTools.
            </li>
            <li>
              Di kotak pencarian filter, ketik <code className="text-[#3B82F6] font-bold">@me</code> atau kirim pesan tes di channel mana saja.
            </li>
            <li>
              Klik salah satu request bernama <code className="text-[#FACC15]">@me</code>, lalu buka tab <strong className="text-white">Headers</strong>.
            </li>
            <li>
              Cari bagian <strong className="text-[#FACC15]">Request Headers</strong> lalu copy isi baris <strong className="text-[#3B82F6]">authorization</strong>.
            </li>
          </ol>
        </div>
      )}

      {/* ACCOUNT LIST CARDS GRID */}
      {accounts.length === 0 ? (
        <div className="block-card p-12 text-center flex flex-col items-center justify-center border-dashed">
          <div className="w-14 h-14 rounded-2xl bg-[#2563EB] text-[#FACC15] border-2 border-[#0F172A] shadow-[0_4px_0_#1D4ED8] flex items-center justify-center mb-3">
            <KeyRound className="w-7 h-7" />
          </div>
          <h4 className="text-sm font-extrabold text-white uppercase font-mono tracking-wider">BELUM ADA AKUN TERHUBUNG</h4>
          <p className="text-xs text-[#94A3B8] max-w-md mt-1 mb-5">
            Tambahkan minimal satu User Token Discord untuk mulai mengirim pesan terjadwal ke channel target.
          </p>
          <button
            type="button"
            onClick={onOpenAddModal}
            className="block-btn block-btn-primary px-4 py-2.5 text-xs text-white"
          >
            <Plus className="w-4 h-4 text-[#FACC15]" />
            <span>ADD FIRST TOKEN</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc) => {
            const isValid = acc.status === 'valid';
            const isChecking = revalidatingId === acc.id;

            return (
              <div
                key={acc.id}
                className="block-card p-5 flex flex-col justify-between group"
              >
                <div>
                  {/* Top user badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={acc.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'}
                        alt={acc.name}
                        className="w-12 h-12 rounded-xl object-cover bg-[#0B0F1A] border-2 border-[#0F172A] shadow-[0_2px_0_#0B0F1A] shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'https://cdn.discordapp.com/embed/avatars/0.png';
                        }}
                      />
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-sm text-white truncate font-mono">
                          {acc.name}
                        </h4>
                        <p className="text-xs text-[#FACC15] font-mono truncate font-bold">
                          @{acc.username}
                        </p>
                        <p className="text-[10px] text-[#94A3B8] font-mono truncate mt-0.5">
                          ID: {acc.discordId}
                        </p>
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="shrink-0">
                      {isValid ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-black text-[#22C55E] bg-[#0B0F1A] border-2 border-[#0F172A] px-2 py-0.5 rounded-lg shadow-[0_1px_0_#0B0F1A]">
                          <CheckCircle2 className="w-3 h-3" /> VALID
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-black text-[#EF4444] bg-[#0B0F1A] border-2 border-[#0F172A] px-2 py-0.5 rounded-lg shadow-[0_1px_0_#0B0F1A]">
                          <XCircle className="w-3 h-3" /> INVALID
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Masked token box */}
                  <div className="mt-4 p-2.5 rounded-xl bg-[#0B0F1A] border-2 border-[#0F172A] text-xs flex items-center justify-between shadow-inner">
                    <div className="flex items-center gap-2 text-[#94A3B8] min-w-0">
                      <KeyRound className="w-3.5 h-3.5 text-[#FACC15] shrink-0" />
                      <span className="font-mono text-[11px] text-white truncate font-bold">
                        {acc.tokenMasked}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#3B82F6] bg-[#111827] px-2 py-0.5 rounded font-mono font-extrabold border border-[#0F172A] shrink-0">
                      AES-256
                    </span>
                  </div>

                  {acc.lastError && (
                    <p className="text-[11px] text-[#EF4444] font-mono mt-2 bg-[#0B0F1A] p-2 rounded-lg border border-[#EF4444]/40">
                      ⚠️ {acc.lastError}
                    </p>
                  )}
                </div>

                {/* Footer card actions */}
                <div className="mt-5 pt-3 border-t-2 border-[#0F172A] flex items-center justify-between text-xs text-[#94A3B8] font-mono">
                  <span className="text-[10px]">
                    CHECKED: {new Date(acc.lastValidatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isChecking}
                      onClick={() => handleRevalidate(acc)}
                      className={`block-btn block-btn-dark p-2 text-[#FACC15] ${
                        isChecking ? 'animate-spin' : ''
                      }`}
                      title="Tes Ulang Token Ini"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountToDelete(acc)}
                      className="block-btn block-btn-danger p-2 text-white"
                      title="Hapus Akun Ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD ACCOUNT BLOCK MODAL */}
      {isOpenAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0F1A]/85 backdrop-blur-sm">
          <div className="bg-[#1E2536] border-2 border-[#0F172A] rounded-2xl w-full max-w-lg shadow-[0_12px_0_#0B0F1A,0_20px_35px_rgba(0,0,0,0.7)] relative overflow-hidden animate-snap-in">
            {/* Header Block Bar */}
            <div className="p-4 bg-[#2563EB] text-white border-b-2 border-[#0F172A] flex items-center justify-between shadow-[0_3px_0_#1D4ED8]">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-[#0B0F1A]/20 border border-white/20">
                  <Puzzle className="w-5 h-5 text-[#FACC15]" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold uppercase font-mono tracking-wider">
                    ADD USER TOKEN BLOCK
                  </h3>
                  <p className="text-[11px] text-white/80">Disimpan terenkripsi dengan AES-256-GCM</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseAddModal}
                className="p-1 hover:bg-black/20 rounded-lg text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAddAccount} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-[#FACC15] uppercase font-mono tracking-wider mb-1.5">
                  USER TOKEN DISCORD <span className="text-[#EF4444]">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={tokenInput}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const cleaned = raw.replace(/^["']|["']$/g, '').trim();
                      setTokenInput(cleaned);
                      setValidatedUser(null);
                    }}
                    placeholder="Contoh: MTI5OTA5Mjg0Nzk1..."
                    required
                    className="block-input w-full px-3.5 py-2.5 text-xs font-mono pr-14"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="p-1.5 text-[#94A3B8] hover:text-[#FACC15]"
                    >
                      {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] text-[#94A3B8] font-mono">Bukan Bot Token (tanpa prefix)</span>
                  <button
                    type="button"
                    disabled={isValidating || !tokenInput.trim()}
                    onClick={handleValidateToken}
                    className="text-xs text-[#FACC15] hover:underline font-mono font-bold cursor-pointer disabled:opacity-40"
                  >
                    {isValidating ? 'VALIDATING...' : '🔍 TEST TOKEN'}
                  </button>
                </div>
              </div>

              {/* Discord User Validation Preview */}
              {validatedUser && (
                <div className="p-3 rounded-xl bg-[#0B0F1A] border-2 border-[#22C55E]/40 flex items-center gap-3 animate-snap-in">
                  <img
                    src={
                      validatedUser.avatar
                        ? `https://cdn.discordapp.com/avatars/${validatedUser.id}/${validatedUser.avatar}.png`
                        : 'https://cdn.discordapp.com/embed/avatars/0.png'
                    }
                    alt=""
                    className="w-10 h-10 rounded-xl bg-[#111827] border border-[#0F172A] shrink-0"
                  />
                  <div className="min-w-0 flex-1 font-mono">
                    <div className="text-xs font-bold text-[#22C55E] flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{validatedUser.global_name || validatedUser.username}</span>
                    </div>
                    <p className="text-[11px] text-[#94A3B8]">@{validatedUser.username}</p>
                    <p className="text-[10px] text-[#94A3B8]">ID: {validatedUser.id}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-black text-[#FACC15] uppercase font-mono tracking-wider mb-1.5">
                  NAMA LABEL AKUN (OPSIONAL)
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Contoh: Akun Promo Alpha, Trader #1"
                  className="block-input w-full px-3.5 py-2.5 text-xs"
                />
              </div>

              <div className="p-3 rounded-xl bg-[#0B0F1A] border-2 border-[#0F172A] text-[11px] text-[#94A3B8] space-y-1">
                <div className="flex items-center gap-1.5 text-[#3B82F6] font-extrabold uppercase font-mono">
                  <ShieldCheck className="w-4 h-4 text-[#22C55E]" />
                  <span>SERVER AES-256 ENCRYPTION:</span>
                </div>
                <p className="leading-relaxed">
                  Token akan dienkripsi dengan secret key di server dan disimpan ke file SQLite. Token mentah tidak pernah disimpan.
                </p>
              </div>

              {/* Modal footer: Yellow Cancel + Blue Save */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-[#0F172A]">
                <button
                  type="button"
                  onClick={onCloseAddModal}
                  className="block-btn block-btn-secondary px-4 py-2 text-xs"
                >
                  BATAL
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !tokenInput.trim()}
                  className="block-btn block-btn-primary px-5 py-2 text-xs text-white"
                >
                  {isSubmitting ? 'MENYIMPAN...' : 'SIMPAN AKUN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(accountToDelete)}
        title="HAPUS AKUN DISCORD?"
        description={`Apakah Anda yakin ingin menghapus akun "${accountToDelete?.name}"? Seluruh channel autopost yang terkait dengan akun ini juga akan terhapus dari SQLite.`}
        confirmText="HAPUS AKUN"
        isDangerous={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setAccountToDelete(null)}
      />
    </div>
  );
}
