import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { db } from './src/server/db.ts';
import { encryptToken, maskToken } from './src/server/crypto.ts';
import { validateDiscordToken, fetchDiscordChannel, renderMessageTemplate } from './src/server/discord.ts';
import { scheduler } from './src/server/scheduler.ts';
import type { DiscordAccount, AutopostChannel, DashboardStats } from './src/types/index.ts';

dotenv.config();

const app = express();
// Development environment must always listen on port 3000
const isProduction = process.env.NODE_ENV === 'production';
const PORT = isProduction && process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Enable CORS for all origins and methods
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (_req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ==========================================
// API ROUTES
// ==========================================

// 1. STATS
app.get('/api/stats', (_req: Request, res: Response) => {
  const accounts = db.getAccounts();
  const channels = db.getChannels();
  const logs = db.getLogs(500);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayTimestamp = startOfToday.getTime();

  let sentToday = 0;
  let failToday = 0;
  for (const log of logs) {
    const logTime = new Date(log.createdAt).getTime();
    if (logTime >= todayTimestamp) {
      if (log.status === 'success') sentToday++;
      if (log.status === 'failed') failToday++;
    }
  }

  const totalSent = channels.reduce((acc, c) => acc + (c.sentCount || 0), 0);

  const stats: DashboardStats = {
    totalAccounts: accounts.length,
    activeAccounts: accounts.filter((a) => a.status === 'valid').length,
    totalChannels: channels.length,
    activeChannels: channels.filter((c) => c.isActive).length,
    messagesSentToday: sentToday,
    totalMessagesSent: totalSent,
    totalFailedToday: failToday,
    isSchedulerRunning: !db.getSettings().globalPause,
  };

  res.json(stats);
});

// 2. ACCOUNTS
app.get('/api/accounts', (_req: Request, res: Response) => {
  const accounts = db.getAccounts();
  // Never expose tokenEncrypted to frontend!
  const sanitized = accounts.map(({ tokenEncrypted, ...rest }) => rest);
  res.json(sanitized);
});

// Validate token before adding
app.post('/api/accounts/validate', async (req: Request, res: Response) => {
  const rawToken = req.body?.token;
  if (!rawToken || typeof rawToken !== 'string') {
    return res.status(400).json({ error: 'Token Discord wajib diisi' });
  }

  const cleanToken = rawToken.trim().replace(/^["']|["']$/g, '').trim();
  if (!cleanToken) {
    return res.status(400).json({ error: 'Token Discord tidak boleh kosong' });
  }

  const result = await validateDiscordToken(cleanToken);
  if (!result.valid || !result.user) {
    return res.status(400).json({ error: result.error || 'Token tidak valid' });
  }

  res.json({
    valid: true,
    user: result.user,
  });
});

// Add new account
app.post('/api/accounts', async (req: Request, res: Response) => {
  const { token: rawToken, customName } = req.body;
  if (!rawToken || typeof rawToken !== 'string') {
    return res.status(400).json({ error: 'Token Discord diperlukan' });
  }

  const cleanToken = rawToken.trim().replace(/^["']|["']$/g, '').trim();
  if (!cleanToken) {
    return res.status(400).json({ error: 'Token Discord tidak boleh kosong' });
  }

  const check = await validateDiscordToken(cleanToken);
  if (!check.valid || !check.user) {
    return res.status(400).json({ error: check.error || 'Token tidak valid' });
  }

  const user = check.user;
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator || '0', 10) % 5}.png`;

  const encrypted = encryptToken(cleanToken);
  const masked = maskToken(cleanToken);

  const newAccount: DiscordAccount = {
    id: crypto.randomUUID(),
    name: customName?.trim() || user.global_name || user.username,
    discordId: user.id,
    username: user.username,
    discriminator: user.discriminator || '0',
    globalName: user.global_name,
    avatarUrl,
    tokenEncrypted: encrypted,
    tokenMasked: masked,
    status: 'valid',
    lastValidatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  db.addAccount(newAccount);

  const { tokenEncrypted, ...safeAccount } = newAccount;
  res.status(201).json(safeAccount);
});

// Revalidate account
app.post('/api/accounts/:id/revalidate', async (req: Request, res: Response) => {
  const { id } = req.params;
  const account = db.getAccount(id);
  if (!account) {
    return res.status(404).json({ error: 'Akun tidak ditemukan' });
  }

  try {
    const { decryptToken } = await import('./src/server/crypto.ts');
    const rawToken = decryptToken(account.tokenEncrypted);
    const check = await validateDiscordToken(rawToken);

    if (check.valid && check.user) {
      const updated = db.updateAccount(id, {
        status: 'valid',
        lastError: undefined,
        lastValidatedAt: new Date().toISOString(),
        username: check.user.username,
        globalName: check.user.global_name,
      });
      const { tokenEncrypted, ...safe } = updated!;
      return res.json(safe);
    } else {
      const updated = db.updateAccount(id, {
        status: 'invalid',
        lastError: check.error,
        lastValidatedAt: new Date().toISOString(),
      });
      const { tokenEncrypted, ...safe } = updated!;
      return res.json(safe);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// Delete account
app.delete('/api/accounts/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const success = db.deleteAccount(id);
  if (!success) {
    return res.status(404).json({ error: 'Akun tidak ditemukan' });
  }
  res.json({ success: true, message: 'Akun berhasil dihapus' });
});

// 3. CHANNELS
app.get('/api/channels', (_req: Request, res: Response) => {
  const channels = db.getChannels();
  const accounts = db.getAccounts();
  const accountMap = new Map(accounts.map((a) => [a.id, a.name || a.username]));

  const enriched = channels.map((c) => ({
    ...c,
    accountName: accountMap.get(c.accountId) || 'Akun tidak dikenal',
  }));

  res.json(enriched);
});

// Validate channel access with Discord API
app.post('/api/channels/validate-channel', async (req: Request, res: Response) => {
  const { accountId, channelId } = req.body;
  if (!accountId || !channelId) {
    return res.status(400).json({ error: 'accountId dan channelId harus diisi' });
  }

  const account = db.getAccount(accountId);
  if (!account) {
    return res.status(404).json({ error: 'Akun tidak ditemukan' });
  }

  try {
    const { decryptToken } = await import('./src/server/crypto.ts');
    const rawToken = decryptToken(account.tokenEncrypted);
    const result = await fetchDiscordChannel(rawToken, channelId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, channel: result.channel });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// Create channel
app.post('/api/channels', (req: Request, res: Response) => {
  const {
    name,
    channelId,
    accountId,
    delayHours = 0,
    delayMinutes = 5,
    delaySeconds = 0,
    randomDelayEnabled = false,
    randomDelayMinSeconds = 0,
    randomDelayMaxSeconds = 0,
    messageTemplate,
    isActive = true,
  } = req.body;

  if (!channelId || !channelId.trim()) {
    return res.status(400).json({ error: 'Channel ID Discord wajib diisi' });
  }
  if (!accountId) {
    return res.status(400).json({ error: 'Pilih akun Discord pengirim' });
  }
  if (!messageTemplate || !messageTemplate.trim()) {
    return res.status(400).json({ error: 'Template pesan tidak boleh kosong' });
  }

  const account = db.getAccount(accountId);
  if (!account) {
    return res.status(400).json({ error: 'Akun yang dipilih tidak ditemukan' });
  }

  const totalSec = Math.max(5, (Number(delayHours) || 0) * 3600 + (Number(delayMinutes) || 0) * 60 + (Number(delaySeconds) || 0));

  const newChannel: AutopostChannel = {
    id: crypto.randomUUID(),
    name: name?.trim() || `Channel-${channelId.trim().slice(-4)}`,
    channelId: channelId.trim(),
    accountId,
    accountName: account.name || account.username,
    delayHours: Number(delayHours) || 0,
    delayMinutes: Number(delayMinutes) || 0,
    delaySeconds: Number(delaySeconds) || 0,
    delayTotalSeconds: totalSec,
    randomDelayEnabled: Boolean(randomDelayEnabled),
    randomDelayMinSeconds: Number(randomDelayMinSeconds) || 0,
    randomDelayMaxSeconds: Number(randomDelayMaxSeconds) || 0,
    messageTemplate: messageTemplate.trim(),
    isActive: Boolean(isActive),
    status: isActive ? 'waiting' : 'stopped',
    lastSentAt: null,
    nextSendAt: null,
    lastError: null,
    sentCount: 0,
    failCount: 0,
    createdAt: new Date().toISOString(),
  };

  db.addChannel(newChannel);

  if (newChannel.isActive) {
    scheduler.activateChannel(newChannel.id);
  }

  res.status(201).json(newChannel);
});

// Update channel
app.put('/api/channels/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = db.getChannel(id);
  if (!existing) {
    return res.status(404).json({ error: 'Channel tidak ditemukan' });
  }

  const {
    name,
    channelId,
    accountId,
    delayHours,
    delayMinutes,
    delaySeconds,
    randomDelayEnabled,
    randomDelayMinSeconds,
    randomDelayMaxSeconds,
    messageTemplate,
    isActive,
  } = req.body;

  const totalSec = Math.max(
    5,
    (Number(delayHours ?? existing.delayHours) || 0) * 3600 +
      (Number(delayMinutes ?? existing.delayMinutes) || 0) * 60 +
      (Number(delaySeconds ?? existing.delaySeconds) || 0)
  );

  const updates: Partial<AutopostChannel> = {
    ...(name !== undefined && { name: name.trim() }),
    ...(channelId !== undefined && { channelId: channelId.trim() }),
    ...(accountId !== undefined && { accountId }),
    ...(delayHours !== undefined && { delayHours: Number(delayHours) }),
    ...(delayMinutes !== undefined && { delayMinutes: Number(delayMinutes) }),
    ...(delaySeconds !== undefined && { delaySeconds: Number(delaySeconds) }),
    delayTotalSeconds: totalSec,
    ...(randomDelayEnabled !== undefined && { randomDelayEnabled: Boolean(randomDelayEnabled) }),
    ...(randomDelayMinSeconds !== undefined && { randomDelayMinSeconds: Number(randomDelayMinSeconds) }),
    ...(randomDelayMaxSeconds !== undefined && { randomDelayMaxSeconds: Number(randomDelayMaxSeconds) }),
    ...(messageTemplate !== undefined && { messageTemplate }),
  };

  if (isActive !== undefined && isActive !== existing.isActive) {
    updates.isActive = Boolean(isActive);
    if (updates.isActive) {
      scheduler.activateChannel(id);
    } else {
      scheduler.deactivateChannel(id);
    }
  }

  const updated = db.updateChannel(id, updates);
  if (updated) {
    scheduler.syncChannelToModularScheduler(updated);
  }
  res.json(updated);
});

// Delete channel
app.delete('/api/channels/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  scheduler.deactivateChannel(id);
  scheduler.removeChannelTask(id);
  const deleted = db.deleteChannel(id);
  if (!deleted) {
    return res.status(404).json({ error: 'Channel tidak ditemukan' });
  }
  res.json({ success: true, message: 'Channel berhasil dihapus' });
});

// Toggle channel active status
app.post('/api/channels/:id/toggle', (req: Request, res: Response) => {
  const { id } = req.params;
  const channel = db.getChannel(id);
  if (!channel) {
    return res.status(404).json({ error: 'Channel tidak ditemukan' });
  }

  if (channel.isActive) {
    const updated = scheduler.deactivateChannel(id);
    res.json(updated);
  } else {
    const updated = scheduler.activateChannel(id);
    res.json(updated);
  }
});

// Immediate test send
app.post('/api/channels/:id/send-now', async (req: Request, res: Response) => {
  const { id } = req.params;
  const channel = db.getChannel(id);
  if (!channel) {
    return res.status(404).json({ error: 'Channel tidak ditemukan' });
  }

  const result = await scheduler.executeSend(channel, true);
  if (result.success) {
    res.json({ success: true, message: result.message });
  } else {
    res.status(400).json({ success: false, error: result.message });
  }
});

// Start all channels
app.post('/api/channels/start-all', (_req: Request, res: Response) => {
  scheduler.activateAll();
  res.json({ success: true, message: 'Semua channel diaktifkan' });
});

// Stop all channels
app.post('/api/channels/stop-all', (_req: Request, res: Response) => {
  scheduler.deactivateAll();
  res.json({ success: true, message: 'Semua channel dihentikan' });
});

// Preview template message
app.post('/api/channels/preview-template', (req: Request, res: Response) => {
  const { template, channelName, accountName } = req.body;
  if (!template) {
    return res.json({ preview: '' });
  }
  const preview = renderMessageTemplate(template, {
    channelName: channelName || '#general',
    accountName: accountName || 'User123',
  });
  res.json({ preview });
});

// 4. LOGS
app.get('/api/logs', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
  const logs = db.getLogs(limit);
  res.json(logs);
});

app.delete('/api/logs', (_req: Request, res: Response) => {
  db.clearLogs();
  res.json({ success: true, message: 'Semua log dibersihkan' });
});

// 5. SETTINGS
app.get('/api/settings', (_req: Request, res: Response) => {
  res.json(db.getSettings());
});

app.put('/api/settings', (req: Request, res: Response) => {
  const updated = db.updateSettings(req.body);
  res.json(updated);
});

// 404 handler for unmatched API routes - ALWAYS JSON, NEVER HTML
app.all('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint API tidak ditemukan (404)' });
});

// Global error handler - ALWAYS JSON, NEVER HTML
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error('Server error:', err);
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Format JSON payload tidak valid' });
  }
  return res.status(500).json({ error: err?.message || 'Internal Server Error' });
});

// ==========================================
// VITE / STATIC SERVE SETUP
// ==========================================
async function startServer() {
  // Initialize SQLite database
  await db.init();
  console.log('✅ SQLite database initialized.');

  // Initialize node-cron background scheduler
  scheduler.init();

  const distIndex = path.resolve(process.cwd(), 'dist', 'index.html');
  const isProd = process.env.NODE_ENV === 'production' || (fs.existsSync(distIndex) && process.env.NODE_ENV !== 'development');

  if (isProd && fs.existsSync(distIndex)) {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(distIndex);
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Discord Autopost Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
});
