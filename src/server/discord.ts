export interface DiscordUserResponse {
  id: string;
  username: string;
  discriminator: string;
  global_name?: string;
  avatar?: string;
  bot?: boolean;
}

export interface DiscordChannelResponse {
  id: string;
  name?: string;
  type?: number;
  guild_id?: string;
}

export interface SendMessageResult {
  success: boolean;
  statusCode: number;
  error?: string;
  retryAfterSeconds?: number;
  messageId?: string;
  responseBody?: unknown;
}

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/**
 * Validate a Discord user token by querying /users/@me
 */
export async function validateDiscordToken(rawToken: string): Promise<{
  valid: boolean;
  user?: DiscordUserResponse;
  error?: string;
}> {
  let cleanToken = (rawToken || '').trim().replace(/^["']|["']$/g, '').trim();
  if (!cleanToken) {
    return { valid: false, error: 'Token Discord tidak boleh kosong' };
  }

  if (cleanToken.toLowerCase().startsWith('bot ')) {
    return {
      valid: false,
      error: 'Token berawalan "Bot ". Aplikasi ini menggunakan Discord USER Token (bukan Bot Token).',
    };
  }

  try {
    const res = await fetch(`${DISCORD_API_BASE}/users/@me`, {
      method: 'GET',
      headers: {
        Authorization: cleanToken,
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    });

    if (res.status === 200) {
      try {
        const data = (await res.json()) as DiscordUserResponse;
        if (data && data.id) {
          return {
            valid: true,
            user: data,
          };
        }
      } catch {
        return {
          valid: false,
          error: 'Respon profil Discord tidak valid (bukan JSON)',
        };
      }
    }

    if (res.status === 401 || res.status === 403) {
      return {
        valid: false,
        error: 'Token tidak valid atau telah kadaluarsa (HTTP 401/403 Unauthorized). Silakan periksa kembali User Token Anda.',
      };
    }

    if (res.status === 400) {
      const errData = (await res.json().catch(() => ({}))) as { message?: string };
      return {
        valid: false,
        error: `Discord menolak token: ${errData.message || 'Format token salah'} (HTTP 400)`,
      };
    }

    if (res.status === 429) {
      return {
        valid: false,
        error: 'Terkena rate limit Discord saat validasi. Coba beberapa saat lagi (HTTP 429)',
      };
    }

    const text = await res.text().catch(() => '');
    return {
      valid: false,
      error: `Discord error (${res.status}): ${text.substring(0, 100) || 'Unknown response'}`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      error: `Koneksi ke Discord API gagal: ${message}`,
    };
  }
}

/**
 * Fetch channel details to confirm permissions and channel name
 */
export async function fetchDiscordChannel(
  rawToken: string,
  channelId: string
): Promise<{ success: boolean; channel?: DiscordChannelResponse; error?: string }> {
  try {
    const res = await fetch(`${DISCORD_API_BASE}/channels/${channelId}`, {
      method: 'GET',
      headers: {
        Authorization: rawToken.trim(),
        'User-Agent': USER_AGENT,
      },
    });

    if (res.ok) {
      const data = (await res.json()) as DiscordChannelResponse;
      return { success: true, channel: data };
    }

    if (res.status === 403) {
      return {
        success: false,
        error: 'Akun tidak memiliki izin untuk melihat/mengakses channel ini (HTTP 403 Forbidden)',
      };
    }
    if (res.status === 404) {
      return {
        success: false,
        error: 'Channel ID tidak ditemukan atau akun bukan anggota server (HTTP 404)',
      };
    }

    return {
      success: false,
      error: `Status Discord ${res.status}`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Replace placeholders in template message
 */
export function renderMessageTemplate(
  template: string,
  context: {
    channelName?: string;
    channelId?: string;
    accountName?: string;
  }
): string {
  const now = new Date();
  
  // Format dates
  const timeStr = now.toTimeString().split(' ')[0]; // HH:mm:ss
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const dateTimeStr = `${dateStr} ${timeStr}`;

  // Random quotes/greetings
  const greetings = ['Halo kawan!', 'Selamat beraktivitas!', 'Salam hangat!', 'Update status!'];
  const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];

  let rendered = template
    .replace(/\{time\}/gi, timeStr)
    .replace(/\{date\}/gi, dateStr)
    .replace(/\{datetime\}/gi, dateTimeStr)
    .replace(/\{channel\}/gi, context.channelName || context.channelId || 'Channel')
    .replace(/\{channel_id\}/gi, context.channelId || '')
    .replace(/\{account\}/gi, context.accountName || 'Discord User')
    .replace(/\{greeting\}/gi, randomGreeting)
    .replace(/\{uuid\}/gi, Math.random().toString(36).substring(2, 8).toUpperCase())
    .replace(/\{random_uuid\}/gi, Math.random().toString(36).substring(2, 8).toUpperCase());

  // Replace {random_min-max} e.g. {random_1-100}
  rendered = rendered.replace(/\{random_(\d+)-(\d+)\}/gi, (_, minStr, maxStr) => {
    const min = parseInt(minStr, 10);
    const max = parseInt(maxStr, 10);
    if (!isNaN(min) && !isNaN(max) && max >= min) {
      return String(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    return '0';
  });

  // Replace {random_choice:Option A|Option B|Option C}
  rendered = rendered.replace(/\{random_choice:([^}]+)\}/gi, (_, choicesStr) => {
    const choices = choicesStr.split('|').map((s: string) => s.trim()).filter(Boolean);
    if (choices.length > 0) {
      return choices[Math.floor(Math.random() * choices.length)];
    }
    return '';
  });

  return rendered;
}

/**
 * Send message to Discord channel using User Token
 */
export async function sendDiscordMessage(
  rawToken: string,
  channelId: string,
  content: string
): Promise<SendMessageResult> {
  const cleanToken = rawToken.trim();
  const targetChannel = channelId.trim();

  if (!cleanToken) {
    return { success: false, statusCode: 400, error: 'User token tidak ditemukan' };
  }
  if (!targetChannel) {
    return { success: false, statusCode: 400, error: 'Channel ID kosong' };
  }
  if (!content || !content.trim()) {
    return { success: false, statusCode: 400, error: 'Pesan tidak boleh kosong' };
  }

  try {
    const res = await fetch(`${DISCORD_API_BASE}/channels/${targetChannel}/messages`, {
      method: 'POST',
      headers: {
        Authorization: cleanToken,
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({
        content: content,
        tts: false,
        flags: 0,
      }),
    });

    if (res.status === 200 || res.status === 201) {
      const data = await res.json();
      return {
        success: true,
        statusCode: res.status,
        messageId: data.id,
        responseBody: data,
      };
    }

    if (res.status === 429) {
      const data = (await res.json().catch(() => ({}))) as {
        retry_after?: number;
        message?: string;
      };
      const retryAfter = data.retry_after || 5;
      return {
        success: false,
        statusCode: 429,
        error: `Rate limited oleh Discord. Tunggu ${retryAfter} detik.`,
        retryAfterSeconds: retryAfter,
        responseBody: data,
      };
    }

    if (res.status === 401) {
      return {
        success: false,
        statusCode: 401,
        error: 'Token kadaluarsa atau tidak sah (401 Unauthorized)',
      };
    }

    if (res.status === 403) {
      const data = (await res.json().catch(() => ({}))) as { message?: string; code?: number };
      const reason = data.message || 'Tidak ada hak izin kirim pesan (Missing Permissions)';
      return {
        success: false,
        statusCode: 403,
        error: `403 Forbidden: ${reason}`,
        responseBody: data,
      };
    }

    if (res.status === 404) {
      return {
        success: false,
        statusCode: 404,
        error: 'Channel tidak ditemukan (404 Not Found)',
      };
    }

    const errText = await res.text();
    return {
      success: false,
      statusCode: res.status,
      error: `HTTP ${res.status}: ${errText.substring(0, 150)}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      statusCode: 500,
      error: `Network/Fetch Error: ${msg}`,
    };
  }
}
