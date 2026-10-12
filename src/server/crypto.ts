import crypto from 'node:crypto';

// Secret key derivation
const rawSecret = process.env.ENCRYPTION_SECRET || 'discord-autopost-hub-default-master-key-2026';
const salt = Buffer.from('discord_autopost_salt_secure_v1', 'utf8');
const KEY = crypto.scryptSync(rawSecret, salt, 32);

/**
 * Encrypt a string using AES-256-GCM.
 * Output format: iv:authTag:ciphertext (hex encoded)
 */
export function encryptToken(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 */
export function decryptToken(encryptedString: string): string {
  if (!encryptedString) return '';
  try {
    const parts = encryptedString.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format');
    }
    const [ivHex, authTagHex, cipherHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption failed:', err);
    throw new Error('Gagal mendekripsi token. Secret key mungkin telah berubah.');
  }
}

/**
 * Mask a Discord token for display in the UI (e.g. "MTI5...****...wYzY")
 */
export function maskToken(token: string): string {
  if (!token || token.length < 12) return '••••••••••••';
  const first = token.substring(0, 6);
  const last = token.substring(token.length - 4);
  return `${first}...••••...${last}`;
}
