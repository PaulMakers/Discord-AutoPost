import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import type { DiscordAccount, AutopostChannel, AutopostLog, AppSettings } from '../types/index.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const SQLITE_FILE = path.resolve(DATA_DIR, 'autopost.sqlite');

const DEFAULT_SETTINGS: AppSettings = {
  globalPause: false,
  autoRetryOnRateLimit: true,
  defaultDelayMinutes: 5,
  tosAccepted: false,
  maxLogsLimit: 500,
};

class SQLiteDatabaseManager {
  private db: SqlJsDatabase | null = null;
  private isInitialized = false;
  private isSaving = false;

  public async init(): Promise<void> {
    if (this.isInitialized && this.db) return;

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const SQL = await initSqlJs();

    if (fs.existsSync(SQLITE_FILE)) {
      try {
        const fileBuffer = fs.readFileSync(SQLITE_FILE);
        this.db = new SQL.Database(fileBuffer);
      } catch (err) {
        console.error('Failed to load existing SQLite database, creating new one:', err);
        this.db = new SQL.Database();
      }
    } else {
      this.db = new SQL.Database();
    }

    this.createTables();
    this.isInitialized = true;
    this.saveToFile();
  }

  private createTables(): void {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        discord_id TEXT,
        username TEXT,
        discriminator TEXT,
        avatar_url TEXT,
        token_encrypted TEXT NOT NULL,
        token_masked TEXT NOT NULL,
        status TEXT DEFAULT 'valid',
        last_error TEXT,
        last_validated_at TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        delay_hours INTEGER DEFAULT 0,
        delay_minutes INTEGER DEFAULT 5,
        delay_seconds INTEGER DEFAULT 0,
        delay_total_seconds INTEGER DEFAULT 300,
        random_delay_enabled INTEGER DEFAULT 0,
        random_delay_min_seconds INTEGER DEFAULT 0,
        random_delay_max_seconds INTEGER DEFAULT 0,
        message_template TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        status TEXT DEFAULT 'stopped',
        last_sent_at TEXT,
        next_send_at TEXT,
        last_error TEXT,
        sent_count INTEGER DEFAULT 0,
        fail_count INTEGER DEFAULT 0,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        channel_id TEXT,
        channel_name TEXT,
        target_channel_id TEXT,
        account_id TEXT,
        account_name TEXT,
        status TEXT,
        message_preview TEXT,
        response_code INTEGER,
        response_details TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  }

  public saveToFile(): void {
    if (!this.db || this.isSaving) return;
    this.isSaving = true;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      const tempPath = `${SQLITE_FILE}.tmp`;
      fs.writeFileSync(tempPath, buffer);
      fs.renameSync(tempPath, SQLITE_FILE);
    } catch (err) {
      console.error('Failed to save SQLite file to disk:', err);
    } finally {
      this.isSaving = false;
    }
  }

  // --- ACCOUNTS CRUD ---
  public getAccounts(): DiscordAccount[] {
    if (!this.db) return [];
    const res = this.db.exec(`SELECT * FROM accounts ORDER BY created_at DESC`);
    if (res.length === 0 || !res[0].values) return [];

    const cols = res[0].columns;
    return res[0].values.map((row) => {
      const obj: Record<string, unknown> = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return {
        id: String(obj.id),
        name: String(obj.name),
        discordId: String(obj.discord_id || ''),
        username: String(obj.username || ''),
        discriminator: String(obj.discriminator || '0'),
        avatarUrl: obj.avatar_url ? String(obj.avatar_url) : undefined,
        tokenEncrypted: String(obj.token_encrypted),
        tokenMasked: String(obj.token_masked),
        status: (obj.status as 'valid' | 'invalid' | 'unknown') || 'valid',
        lastError: obj.last_error ? String(obj.last_error) : undefined,
        lastValidatedAt: String(obj.last_validated_at || new Date().toISOString()),
        createdAt: String(obj.created_at || new Date().toISOString()),
      };
    });
  }

  public getAccount(id: string): DiscordAccount | undefined {
    return this.getAccounts().find((a) => a.id === id);
  }

  public addAccount(account: DiscordAccount): DiscordAccount {
    if (!this.db) throw new Error('Database not ready');
    this.db.run(
      `INSERT INTO accounts (id, name, discord_id, username, discriminator, avatar_url, token_encrypted, token_masked, status, last_error, last_validated_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        account.id,
        account.name,
        account.discordId,
        account.username,
        account.discriminator,
        account.avatarUrl || null,
        account.tokenEncrypted,
        account.tokenMasked,
        account.status,
        account.lastError || null,
        account.lastValidatedAt,
        account.createdAt,
      ]
    );
    this.saveToFile();
    return account;
  }

  public updateAccount(id: string, updates: Partial<DiscordAccount>): DiscordAccount | undefined {
    const existing = this.getAccount(id);
    if (!existing || !this.db) return undefined;

    const merged = { ...existing, ...updates };
    this.db.run(
      `UPDATE accounts SET 
        name = ?, discord_id = ?, username = ?, discriminator = ?, avatar_url = ?, 
        status = ?, last_error = ?, last_validated_at = ?
       WHERE id = ?`,
      [
        merged.name,
        merged.discordId,
        merged.username,
        merged.discriminator,
        merged.avatarUrl || null,
        merged.status,
        merged.lastError || null,
        merged.lastValidatedAt,
        id,
      ]
    );
    this.saveToFile();
    return merged;
  }

  public deleteAccount(id: string): boolean {
    if (!this.db) return false;
    this.db.run(`DELETE FROM accounts WHERE id = ?`, [id]);
    this.db.run(`DELETE FROM channels WHERE account_id = ?`, [id]);
    this.saveToFile();
    return true;
  }

  // --- CHANNELS CRUD ---
  public getChannels(): AutopostChannel[] {
    if (!this.db) return [];
    const res = this.db.exec(`SELECT * FROM channels ORDER BY created_at DESC`);
    if (res.length === 0 || !res[0].values) return [];

    const cols = res[0].columns;
    return res[0].values.map((row) => {
      const obj: Record<string, unknown> = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return {
        id: String(obj.id),
        name: String(obj.name),
        channelId: String(obj.channel_id),
        accountId: String(obj.account_id),
        delayHours: Number(obj.delay_hours || 0),
        delayMinutes: Number(obj.delay_minutes || 0),
        delaySeconds: Number(obj.delay_seconds || 0),
        delayTotalSeconds: Number(obj.delay_total_seconds || 300),
        randomDelayEnabled: Boolean(obj.random_delay_enabled),
        randomDelayMinSeconds: Number(obj.random_delay_min_seconds || 0),
        randomDelayMaxSeconds: Number(obj.random_delay_max_seconds || 0),
        messageTemplate: String(obj.message_template),
        isActive: Boolean(obj.is_active),
        status: (obj.status as AutopostChannel['status']) || 'stopped',
        lastSentAt: obj.last_sent_at ? String(obj.last_sent_at) : null,
        nextSendAt: obj.next_send_at ? String(obj.next_send_at) : null,
        lastError: obj.last_error ? String(obj.last_error) : null,
        sentCount: Number(obj.sent_count || 0),
        failCount: Number(obj.fail_count || 0),
        createdAt: String(obj.created_at || new Date().toISOString()),
      };
    });
  }

  public getChannel(id: string): AutopostChannel | undefined {
    return this.getChannels().find((c) => c.id === id);
  }

  public addChannel(channel: AutopostChannel): AutopostChannel {
    if (!this.db) throw new Error('Database not ready');
    this.db.run(
      `INSERT INTO channels (
        id, name, channel_id, account_id, delay_hours, delay_minutes, delay_seconds, delay_total_seconds,
        random_delay_enabled, random_delay_min_seconds, random_delay_max_seconds, message_template,
        is_active, status, last_sent_at, next_send_at, last_error, sent_count, fail_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        channel.id,
        channel.name,
        channel.channelId,
        channel.accountId,
        channel.delayHours,
        channel.delayMinutes,
        channel.delaySeconds,
        channel.delayTotalSeconds,
        channel.randomDelayEnabled ? 1 : 0,
        channel.randomDelayMinSeconds,
        channel.randomDelayMaxSeconds,
        channel.messageTemplate,
        channel.isActive ? 1 : 0,
        channel.status,
        channel.lastSentAt,
        channel.nextSendAt,
        channel.lastError,
        channel.sentCount,
        channel.failCount,
        channel.createdAt,
      ]
    );
    this.saveToFile();
    return channel;
  }

  public updateChannel(id: string, updates: Partial<AutopostChannel>): AutopostChannel | undefined {
    const existing = this.getChannel(id);
    if (!existing || !this.db) return undefined;

    const m = { ...existing, ...updates };
    this.db.run(
      `UPDATE channels SET
        name = ?, channel_id = ?, account_id = ?, delay_hours = ?, delay_minutes = ?, delay_seconds = ?,
        delay_total_seconds = ?, random_delay_enabled = ?, random_delay_min_seconds = ?, random_delay_max_seconds = ?,
        message_template = ?, is_active = ?, status = ?, last_sent_at = ?, next_send_at = ?, last_error = ?,
        sent_count = ?, fail_count = ?
       WHERE id = ?`,
      [
        m.name,
        m.channelId,
        m.accountId,
        m.delayHours,
        m.delayMinutes,
        m.delaySeconds,
        m.delayTotalSeconds,
        m.randomDelayEnabled ? 1 : 0,
        m.randomDelayMinSeconds,
        m.randomDelayMaxSeconds,
        m.messageTemplate,
        m.isActive ? 1 : 0,
        m.status,
        m.lastSentAt,
        m.nextSendAt,
        m.lastError,
        m.sentCount,
        m.failCount,
        id,
      ]
    );
    this.saveToFile();
    return m;
  }

  public deleteChannel(id: string): boolean {
    if (!this.db) return false;
    this.db.run(`DELETE FROM channels WHERE id = ?`, [id]);
    this.saveToFile();
    return true;
  }

  // --- LOGS CRUD ---
  public getLogs(limit = 100): AutopostLog[] {
    if (!this.db) return [];
    const res = this.db.exec(
      `SELECT * FROM logs ORDER BY datetime(created_at) DESC LIMIT ${Number(limit) || 100}`
    );
    if (res.length === 0 || !res[0].values) return [];

    const cols = res[0].columns;
    return res[0].values.map((row) => {
      const obj: Record<string, unknown> = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return {
        id: String(obj.id),
        channelId: String(obj.channel_id),
        channelName: String(obj.channel_name),
        targetChannelId: String(obj.target_channel_id),
        accountId: String(obj.account_id),
        accountName: String(obj.account_name),
        status: (obj.status as AutopostLog['status']) || 'failed',
        messagePreview: String(obj.message_preview || ''),
        responseCode: Number(obj.response_code || 0),
        responseDetails: String(obj.response_details || ''),
        createdAt: String(obj.created_at || new Date().toISOString()),
      };
    });
  }

  public addLog(log: AutopostLog): void {
    if (!this.db) return;
    this.db.run(
      `INSERT INTO logs (id, channel_id, channel_name, target_channel_id, account_id, account_name, status, message_preview, response_code, response_details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        log.id,
        log.channelId,
        log.channelName,
        log.targetChannelId,
        log.accountId,
        log.accountName,
        log.status,
        log.messagePreview,
        log.responseCode,
        log.responseDetails,
        log.createdAt,
      ]
    );

    // Prune logs if over limit
    const limit = this.getSettings().maxLogsLimit || 500;
    this.db.run(`
      DELETE FROM logs WHERE id NOT IN (
        SELECT id FROM logs ORDER BY datetime(created_at) DESC LIMIT ${limit}
      )
    `);

    this.saveToFile();
  }

  public clearLogs(): void {
    if (!this.db) return;
    this.db.run(`DELETE FROM logs`);
    this.saveToFile();
  }

  // --- SETTINGS CRUD ---
  public getSettings(): AppSettings {
    if (!this.db) return DEFAULT_SETTINGS;
    try {
      const res = this.db.exec(`SELECT value FROM settings WHERE key = 'app_config'`);
      if (res.length > 0 && res[0].values && res[0].values[0]) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(String(res[0].values[0][0])) };
      }
    } catch {
      // return default
    }
    return DEFAULT_SETTINGS;
  }

  public updateSettings(updates: Partial<AppSettings>): AppSettings {
    const cur = this.getSettings();
    const merged = { ...cur, ...updates };
    if (this.db) {
      this.db.run(
        `INSERT OR REPLACE INTO settings (key, value) VALUES ('app_config', ?)`,
        [JSON.stringify(merged)]
      );
      this.saveToFile();
    }
    return merged;
  }
}

export const db = new SQLiteDatabaseManager();
