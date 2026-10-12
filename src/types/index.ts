export interface DiscordAccount {
  id: string;
  name: string;
  discordId: string;
  username: string;
  discriminator: string;
  globalName?: string;
  avatarUrl?: string;
  tokenEncrypted: string;
  tokenMasked: string;
  status: 'valid' | 'invalid' | 'unknown';
  lastError?: string;
  lastValidatedAt: string;
  createdAt: string;
}

export interface AutopostChannel {
  id: string;
  name: string;
  channelId: string;
  accountId: string;
  accountName?: string;
  delayHours: number;
  delayMinutes: number;
  delaySeconds: number;
  delayTotalSeconds: number;
  randomDelayEnabled: boolean;
  randomDelayMinSeconds: number;
  randomDelayMaxSeconds: number;
  messageTemplate: string;
  isActive: boolean;
  status: 'idle' | 'running' | 'waiting' | 'sending' | 'error' | 'stopped';
  lastSentAt: string | null;
  nextSendAt: string | null;
  lastError: string | null;
  sentCount: number;
  failCount: number;
  createdAt: string;
}

export interface AutopostLog {
  id: string;
  channelId: string;
  channelName: string;
  targetChannelId: string;
  accountId: string;
  accountName: string;
  status: 'success' | 'failed' | 'rate_limited';
  messagePreview: string;
  responseCode: number;
  responseDetails: string;
  createdAt: string;
}

export interface AppSettings {
  globalPause: boolean;
  autoRetryOnRateLimit: boolean;
  defaultDelayMinutes: number;
  tosAccepted: boolean;
  maxLogsLimit: number;
}

export interface DashboardStats {
  totalAccounts: number;
  activeAccounts: number;
  totalChannels: number;
  activeChannels: number;
  messagesSentToday: number;
  totalMessagesSent: number;
  totalFailedToday: number;
  isSchedulerRunning: boolean;
}
