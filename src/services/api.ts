import type {
  DiscordAccount,
  AutopostChannel,
  AutopostLog,
  AppSettings,
  DashboardStats,
} from '../types/index.ts';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const STORAGE_PREFIX = 'discord_autopost_hub_';

// Helper to safely parse JSON or return error message if HTML/non-JSON is returned
async function safeFetchJson<T>(url: string, options?: RequestInit): Promise<{ ok: boolean; status: number; data?: T; error?: string; isHtml?: boolean }> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();

    const trimmed = text.trim();
    const isHtmlOrNonJson = !contentType.includes('application/json') ||
      trimmed.startsWith('<!doctype') ||
      trimmed.startsWith('<html') ||
      trimmed.startsWith('<') ||
      trimmed.startsWith('The page') ||
      trimmed.startsWith('The requested') ||
      trimmed.startsWith('Error:');

    if (isHtmlOrNonJson) {
      let friendlyError = `Server backend mengembalikan respon non-JSON (HTTP ${res.status}).`;
      if (res.status === 404) {
        friendlyError = 'Endpoint backend server tidak ditemukan (HTTP 404). Silakan pastikan server backend aktif.';
      } else if (res.status === 502 || res.status === 503 || res.status === 504) {
        friendlyError = `Server backend sedang dalam proses booting atau tidak dapat dijangkau (HTTP ${res.status}). Tunggu sebentar dan coba lagi.`;
      }
      return {
        ok: false,
        status: res.status,
        isHtml: true,
        error: friendlyError,
      };
    }

    try {
      const json = JSON.parse(text) as T;
      if (!res.ok) {
        const errObj = json as { error?: string; message?: string };
        return {
          ok: false,
          status: res.status,
          error: errObj.error || errObj.message || `HTTP ${res.status}`,
        };
      }
      return { ok: true, status: res.status, data: json };
    } catch {
      return {
        ok: false,
        status: res.status,
        isHtml: false,
        error: `Format respons dari server tidak valid (HTTP ${res.status}).`,
      };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, error: `Koneksi ke server gagal: ${msg}` };
  }
}

// Local Storage Fallback Helpers
function getLocal<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setLocal<T>(key: string, val: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(val));
  } catch {
    // ignore
  }
}

export function maskTokenStr(token: string): string {
  if (!token || token.length < 12) return '••••••••••••';
  return `${token.substring(0, 6)}...••••...${token.substring(token.length - 4)}`;
}

// ==========================================
// UNIFIED HYBRID API CLIENT
// ==========================================
export const api = {
  /**
   * Validate token: queries backend /api/accounts/validate
   */
  async validateToken(token: string): Promise<{ valid: boolean; user?: any; error?: string }> {
    let cleanToken = (token || '').trim().replace(/^["']|["']$/g, '').trim();
    if (!cleanToken) return { valid: false, error: 'Token Discord tidak boleh kosong' };

    if (cleanToken.toLowerCase().startsWith('bot ')) {
      return {
        valid: false,
        error: 'Token berawalan "Bot ". Aplikasi ini memerlukan Discord USER Token (bukan Bot Token).',
      };
    }

    // Call Backend API
    const backendRes = await safeFetchJson<{ valid: boolean; user: any }>('/api/accounts/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: cleanToken }),
    });

    if (backendRes.ok && backendRes.data?.user) {
      return { valid: true, user: backendRes.data.user };
    }

    return {
      valid: false,
      error: backendRes.error || 'Validasi token gagal. Pastikan token aktif dan server backend berjalan.',
    };
  },

  /**
   * Add account: queries backend /api/accounts
   */
  async addAccount(token: string, customName?: string): Promise<{ success: boolean; account?: DiscordAccount; error?: string }> {
    let cleanToken = (token || '').trim().replace(/^["']|["']$/g, '').trim();
    if (!cleanToken) return { success: false, error: 'Token Discord diperlukan' };

    if (cleanToken.toLowerCase().startsWith('bot ')) {
      return {
        success: false,
        error: 'Token berawalan "Bot ". Aplikasi ini memerlukan Discord USER Token (bukan Bot Token).',
      };
    }

    // Call backend
    const backendRes = await safeFetchJson<DiscordAccount>('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: cleanToken, customName: customName?.trim() || undefined }),
    });

    if (backendRes.ok && backendRes.data) {
      return { success: true, account: backendRes.data };
    }

    return {
      success: false,
      error: backendRes.error || 'Gagal menyimpan akun ke sistem.',
    };
  },

  /**
   * Revalidate account status
   */
  async revalidateAccount(id: string): Promise<{ success: boolean; status?: string; lastError?: string; error?: string }> {
    const res = await safeFetchJson<{ status: string; lastError?: string }>(`/api/accounts/${id}/revalidate`, {
      method: 'POST',
    });
    if (res.ok && res.data) {
      return { success: true, status: res.data.status, lastError: res.data.lastError };
    }
    return { success: false, error: res.error || 'Gagal memvalidasi ulang akun' };
  },

  /**
   * Fetch all accounts (from backend or local storage)
   */
  async getAccounts(): Promise<DiscordAccount[]> {
    const res = await safeFetchJson<DiscordAccount[]>('/api/accounts');
    if (res.ok && Array.isArray(res.data)) {
      return res.data;
    }
    return getLocal<DiscordAccount[]>('accounts', []);
  },

  /**
   * Delete account
   */
  async deleteAccount(id: string): Promise<boolean> {
    const res = await safeFetchJson<{ success: boolean }>(`/api/accounts/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) return true;

    const list = getLocal<DiscordAccount[]>('accounts', []);
    setLocal('accounts', list.filter((a) => a.id !== id));
    return true;
  },

  /**
   * Fetch channels
   */
  async getChannels(): Promise<AutopostChannel[]> {
    const res = await safeFetchJson<AutopostChannel[]>('/api/channels');
    if (res.ok && Array.isArray(res.data)) {
      return res.data;
    }
    return getLocal<AutopostChannel[]>('channels', []);
  },

  /**
   * Save channel (Add or Update)
   */
  async saveChannel(channelData: any, existingId?: string): Promise<{ success: boolean; channel?: AutopostChannel; error?: string }> {
    const url = existingId ? `/api/channels/${existingId}` : '/api/channels';
    const method = existingId ? 'PUT' : 'POST';

    const res = await safeFetchJson<AutopostChannel>(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(channelData),
    });

    if (res.ok && res.data) {
      return { success: true, channel: res.data };
    }

    if (!res.isHtml && res.error) {
      return { success: false, error: res.error };
    }

    // Fallback Local Storage
    const channels = getLocal<AutopostChannel[]>('channels', []);
    const accounts = await this.getAccounts();
    const account = accounts.find((a) => a.id === channelData.accountId);

    const totalSec = Math.max(5, (Number(channelData.delayHours) || 0) * 3600 + (Number(channelData.delayMinutes) || 0) * 60 + (Number(channelData.delaySeconds) || 0));

    if (existingId) {
      const idx = channels.findIndex((c) => c.id === existingId);
      if (idx !== -1) {
        channels[idx] = {
          ...channels[idx],
          ...channelData,
          accountName: account?.name || account?.username || 'Discord User',
          delayTotalSeconds: totalSec,
        };
        setLocal('channels', channels);
        return { success: true, channel: channels[idx] };
      }
    }

    const newCh: AutopostChannel = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10),
      name: channelData.name || `Channel-${channelData.channelId.slice(-4)}`,
      channelId: channelData.channelId,
      accountId: channelData.accountId,
      accountName: account?.name || account?.username || 'Discord User',
      delayHours: Number(channelData.delayHours) || 0,
      delayMinutes: Number(channelData.delayMinutes) || 0,
      delaySeconds: Number(channelData.delaySeconds) || 0,
      delayTotalSeconds: totalSec,
      randomDelayEnabled: Boolean(channelData.randomDelayEnabled),
      randomDelayMinSeconds: Number(channelData.randomDelayMinSeconds) || 0,
      randomDelayMaxSeconds: Number(channelData.randomDelayMaxSeconds) || 0,
      messageTemplate: channelData.messageTemplate,
      isActive: Boolean(channelData.isActive),
      status: channelData.isActive ? 'waiting' : 'stopped',
      lastSentAt: null,
      nextSendAt: channelData.isActive ? new Date(Date.now() + totalSec * 1000).toISOString() : null,
      lastError: null,
      sentCount: 0,
      failCount: 0,
      createdAt: new Date().toISOString(),
    };

    setLocal('channels', [newCh, ...channels]);
    return { success: true, channel: newCh };
  },

  /**
   * Toggle channel active status
   */
  async toggleChannel(id: string): Promise<boolean> {
    const res = await safeFetchJson<AutopostChannel>(`/api/channels/${id}/toggle`, {
      method: 'POST',
    });
    if (res.ok) return true;

    const channels = getLocal<AutopostChannel[]>('channels', []);
    const idx = channels.findIndex((c) => c.id === id);
    if (idx !== -1) {
      channels[idx].isActive = !channels[idx].isActive;
      channels[idx].status = channels[idx].isActive ? 'waiting' : 'stopped';
      setLocal('channels', channels);
    }
    return true;
  },

  /**
   * Delete channel
   */
  async deleteChannel(id: string): Promise<boolean> {
    const res = await safeFetchJson<{ success: boolean }>(`/api/channels/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) return true;

    const channels = getLocal<AutopostChannel[]>('channels', []);
    setLocal('channels', channels.filter((c) => c.id !== id));
    return true;
  },

  /**
   * Send test message now
   */
  async sendNow(channelId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await safeFetchJson<{ success: boolean; message?: string; error?: string }>(`/api/channels/${channelId}/send-now`, {
      method: 'POST',
    });
    if (res.ok && res.data?.success) {
      return { success: true, message: res.data.message || 'Pesan berhasil terkirim!' };
    }
    if (!res.isHtml && res.error) {
      return { success: false, error: res.error };
    }

    // Direct Discord send fallback
    const channels = await this.getChannels();
    const ch = channels.find((c) => c.id === channelId);
    if (!ch) return { success: false, error: 'Channel tidak ditemukan' };

    const accounts = await this.getAccounts();
    const acc = accounts.find((a) => a.id === ch.accountId);
    if (!acc) return { success: false, error: 'Akun pengirim tidak ditemukan' };

    try {
      const response = await fetch(`${DISCORD_API_BASE}/channels/${ch.channelId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: acc.tokenEncrypted,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: ch.messageTemplate
            .replace(/\{time\}/gi, new Date().toLocaleTimeString())
            .replace(/\{date\}/gi, new Date().toISOString().slice(0, 10))
            .replace(/\{channel\}/gi, ch.name)
            .replace(/\{random_1-100\}/gi, String(Math.floor(Math.random() * 100) + 1)),
        }),
      });

      if (response.ok) {
        return { success: true, message: 'Pesan berhasil diposting ke Discord!' };
      }
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data.message || `HTTP ${response.status}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },

  /**
   * Fetch logs
   */
  async getLogs(): Promise<AutopostLog[]> {
    const res = await safeFetchJson<AutopostLog[]>('/api/logs?limit=150');
    if (res.ok && Array.isArray(res.data)) {
      return res.data;
    }
    return getLocal<AutopostLog[]>('logs', []);
  },

  /**
   * Clear logs
   */
  async clearLogs(): Promise<void> {
    await safeFetchJson('/api/logs', { method: 'DELETE' });
    setLocal('logs', []);
  },

  /**
   * Fetch stats
   */
  async getStats(): Promise<DashboardStats> {
    const res = await safeFetchJson<DashboardStats>('/api/stats');
    if (res.ok && res.data) {
      return res.data;
    }

    const accounts = getLocal<DiscordAccount[]>('accounts', []);
    const channels = getLocal<AutopostChannel[]>('channels', []);
    const logs = getLocal<AutopostLog[]>('logs', []);

    return {
      totalAccounts: accounts.length,
      activeAccounts: accounts.filter((a) => a.status === 'valid').length,
      totalChannels: channels.length,
      activeChannels: channels.filter((c) => c.isActive).length,
      messagesSentToday: logs.filter((l) => l.status === 'success').length,
      totalMessagesSent: logs.filter((l) => l.status === 'success').length,
      totalFailedToday: logs.filter((l) => l.status === 'failed').length,
      isSchedulerRunning: true,
    };
  },

  /**
   * Start all channels
   */
  async startAll(): Promise<void> {
    await safeFetchJson('/api/channels/start-all', { method: 'POST' });
    const channels = getLocal<AutopostChannel[]>('channels', []);
    channels.forEach((c) => {
      c.isActive = true;
      c.status = 'waiting';
    });
    setLocal('channels', channels);
  },

  /**
   * Stop all channels
   */
  async stopAll(): Promise<void> {
    await safeFetchJson('/api/channels/stop-all', { method: 'POST' });
    const channels = getLocal<AutopostChannel[]>('channels', []);
    channels.forEach((c) => {
      c.isActive = false;
      c.status = 'stopped';
    });
    setLocal('channels', channels);
  },

  /**
   * Update app settings
   */
  async updateSettings(settings: Partial<AppSettings>): Promise<{ success: boolean; settings?: AppSettings; error?: string }> {
    const res = await safeFetchJson<AppSettings>('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (res.ok && res.data) {
      return { success: true, settings: res.data };
    }
    return { success: false, error: res.error || 'Gagal menyimpan pengaturan' };
  },
};
