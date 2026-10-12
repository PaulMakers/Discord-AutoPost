import crypto from 'node:crypto';
import cron, { type ScheduledTask } from 'node-cron';
import { db } from './db.ts';
import { decryptToken } from './crypto.ts';
import { sendDiscordMessage, renderMessageTemplate } from './discord.ts';
import { modularScheduler } from './modularScheduler.ts';
import type { AutopostChannel, AutopostLog } from '../types/index.ts';

class AutopostBridgeScheduler {
  private cronJob: ScheduledTask | null = null;

  public init(): void {
    // 1. Sync all channels from database into modularScheduler
    const channels = db.getChannels();
    for (const ch of channels) {
      this.syncChannelToModularScheduler(ch);
    }

    // 2. Schedule second-level sync tick with node-cron for countdown metrics
    if (this.cronJob) {
      this.cronJob.stop();
    }

    this.cronJob = cron.schedule('* * * * * *', () => {
      this.syncHeartbeat();
    });

    console.log('[Scheduler] Modular Channel Scheduler + node-cron bridge initialized.');
  }

  /**
   * Register or update a channel as an isolated modular task.
   */
  public syncChannelToModularScheduler(channel: AutopostChannel): void {
    modularScheduler.registerTask({
      id: channel.id,
      name: channel.name,
      interval: {
        hours: channel.delayHours,
        minutes: channel.delayMinutes,
        seconds: channel.delaySeconds,
      },
      randomDelay: {
        enabled: channel.randomDelayEnabled,
        minSeconds: channel.randomDelayMinSeconds,
        maxSeconds: channel.randomDelayMaxSeconds,
      },
      execute: async () => {
        // Fetch fresh state from database
        const fresh = db.getChannel(channel.id);
        if (!fresh) return;
        await this.executeSend(fresh, false);
      },
      onStatusChange: (status) => {
        db.updateChannel(channel.id, { status });
      },
      onError: (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        db.updateChannel(channel.id, {
          status: 'error',
          lastError: msg,
          failCount: (channel.failCount || 0) + 1,
        });
      },
    });

    if (channel.isActive) {
      modularScheduler.startTask(channel.id, false);
    }
  }

  /**
   * Periodic heartbeat to update nextSendAt timestamps for UI countdowns
   */
  private syncHeartbeat(): void {
    const tasks = modularScheduler.getAllTasks();
    for (const t of tasks) {
      db.updateChannel(
        t.id,
        {
          nextSendAt: t.nextRunAt,
          status: t.status,
        },
        false
      );
    }
  }

  /**
   * Send message to Discord channel with full error isolation and 429 rate limit backoff.
   */
  public async executeSend(
    channel: AutopostChannel,
    isManualTest = false
  ): Promise<{ success: boolean; message: string }> {
    const account = db.getAccount(channel.accountId);
    if (!account) {
      const log: AutopostLog = {
        id: crypto.randomUUID(),
        channelId: channel.id,
        channelName: channel.name,
        targetChannelId: channel.channelId,
        accountId: channel.accountId,
        accountName: 'Akun Terhapus',
        status: 'failed',
        messagePreview: channel.messageTemplate.substring(0, 80),
        responseCode: 404,
        responseDetails: 'Akun Discord pengirim tidak ditemukan atau sudah dihapus.',
        createdAt: new Date().toISOString(),
      };
      db.addLog(log);
      db.updateChannel(channel.id, {
        status: 'error',
        lastError: 'Akun Discord tidak ditemukan',
        failCount: (channel.failCount || 0) + 1,
      });
      return { success: false, message: 'Akun Discord tidak ditemukan' };
    }

    let token = '';
    try {
      token = decryptToken(account.tokenEncrypted);
    } catch {
      const log: AutopostLog = {
        id: crypto.randomUUID(),
        channelId: channel.id,
        channelName: channel.name,
        targetChannelId: channel.channelId,
        accountId: account.id,
        accountName: account.name,
        status: 'failed',
        messagePreview: channel.messageTemplate.substring(0, 80),
        responseCode: 500,
        responseDetails: 'Gagal mendekripsi user token akun ini.',
        createdAt: new Date().toISOString(),
      };
      db.addLog(log);
      db.updateChannel(channel.id, {
        status: 'error',
        lastError: 'Gagal mendekripsi token',
        failCount: (channel.failCount || 0) + 1,
      });
      return { success: false, message: 'Gagal mendekripsi token' };
    }

    const renderedContent = renderMessageTemplate(channel.messageTemplate, {
      channelName: channel.name,
      channelId: channel.channelId,
      accountName: account.username || account.name,
    });

    const nowIso = new Date().toISOString();

    try {
      const result = await sendDiscordMessage(token, channel.channelId, renderedContent);

      if (result.success) {
        const log: AutopostLog = {
          id: crypto.randomUUID(),
          channelId: channel.id,
          channelName: channel.name,
          targetChannelId: channel.channelId,
          accountId: account.id,
          accountName: account.username || account.name,
          status: 'success',
          messagePreview: renderedContent.substring(0, 100),
          responseCode: result.statusCode,
          responseDetails: `Pesan sukses terkirim ke Discord (Msg ID: ${result.messageId || 'OK'})`,
          createdAt: nowIso,
        };
        db.addLog(log);

        db.updateChannel(channel.id, {
          status: channel.isActive ? 'waiting' : 'stopped',
          lastSentAt: nowIso,
          lastError: null,
          sentCount: (channel.sentCount || 0) + 1,
        });

        return { success: true, message: 'Pesan berhasil terkirim ke Discord!' };
      }

      // Handle Discord 429 Rate Limit
      if (result.statusCode === 429 && result.retryAfterSeconds) {
        const log: AutopostLog = {
          id: crypto.randomUUID(),
          channelId: channel.id,
          channelName: channel.name,
          targetChannelId: channel.channelId,
          accountId: account.id,
          accountName: account.username || account.name,
          status: 'rate_limited',
          messagePreview: renderedContent.substring(0, 80),
          responseCode: 429,
          responseDetails: `Rate limit Discord. Scheduler otomatis menunggu ${result.retryAfterSeconds}s sebelum mencoba lagi.`,
          createdAt: nowIso,
        };
        db.addLog(log);

        db.updateChannel(channel.id, {
          status: 'waiting',
          lastError: `Rate limited (${result.retryAfterSeconds}s)`,
        });

        return {
          success: false,
          message: `Rate limited oleh Discord. Menunggu ${result.retryAfterSeconds} detik.`,
        };
      }

      // Handle 401, 403, 404, etc.
      const log: AutopostLog = {
        id: crypto.randomUUID(),
        channelId: channel.id,
        channelName: channel.name,
        targetChannelId: channel.channelId,
        accountId: account.id,
        accountName: account.username || account.name,
        status: 'failed',
        messagePreview: renderedContent.substring(0, 80),
        responseCode: result.statusCode,
        responseDetails: result.error || 'Gagal mengirim pesan ke Discord',
        createdAt: nowIso,
      };
      db.addLog(log);

      db.updateChannel(channel.id, {
        status: 'error',
        lastError: result.error || `HTTP ${result.statusCode}`,
        failCount: (channel.failCount || 0) + 1,
      });

      if (result.statusCode === 401) {
        db.updateAccount(account.id, {
          status: 'invalid',
          lastError: 'Token invalid atau telah expired',
        });
      }

      return { success: false, message: result.error || 'Gagal mengirim pesan' };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const log: AutopostLog = {
        id: crypto.randomUUID(),
        channelId: channel.id,
        channelName: channel.name,
        targetChannelId: channel.channelId,
        accountId: account.id,
        accountName: account.username || account.name,
        status: 'failed',
        messagePreview: renderedContent.substring(0, 80),
        responseCode: 500,
        responseDetails: `Internal Error: ${errMsg}`,
        createdAt: nowIso,
      };
      db.addLog(log);

      db.updateChannel(channel.id, {
        status: 'error',
        lastError: errMsg,
        failCount: (channel.failCount || 0) + 1,
      });

      return { success: false, message: errMsg };
    }
  }

  // --- DYNAMIC CONTROL METHODS (NO SERVER RESTART REQUIRED) ---

  public activateChannel(channelId: string, runImmediately = false): AutopostChannel | undefined {
    const channel = db.getChannel(channelId);
    if (!channel) return undefined;

    this.syncChannelToModularScheduler(channel);
    modularScheduler.startTask(channelId, runImmediately);

    const taskInfo = modularScheduler.getTaskInfo(channelId);
    return db.updateChannel(channelId, {
      isActive: true,
      status: 'waiting',
      nextSendAt: taskInfo?.nextRunAt || null,
      lastError: null,
    });
  }

  public deactivateChannel(channelId: string): AutopostChannel | undefined {
    modularScheduler.stopTask(channelId);
    return db.updateChannel(channelId, {
      isActive: false,
      status: 'stopped',
      nextSendAt: null,
    });
  }

  public activateAll(): void {
    const channels = db.getChannels();
    for (const ch of channels) {
      this.activateChannel(ch.id);
    }
  }

  public deactivateAll(): void {
    const channels = db.getChannels();
    for (const ch of channels) {
      this.deactivateChannel(ch.id);
    }
  }

  public removeChannelTask(channelId: string): void {
    modularScheduler.removeTask(channelId);
  }

  public stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    modularScheduler.stopAll();
  }
}

export const scheduler = new AutopostBridgeScheduler();
