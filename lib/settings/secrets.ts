import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const SECRET_KEYS = new Set([
  'fonepaySecretKey', 'digitalSecretKey', 'smsApiKey', 'mobileApiKey', 'webhookSecret',
]);

function key() {
  const source = process.env.SETTINGS_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!source) throw new Error('SETTINGS_ENCRYPTION_KEY or JWT_SECRET is required');
  return createHash('sha256').update(source).digest();
}

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `enc:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted.toString('base64')}`;
}

function decrypt(value: string) {
  if (!value.startsWith('enc:')) return value;
  const [, iv, tag, data] = value.split(':');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}

export function mergeEncryptedConfiguration(current: Record<string, unknown>, next: Record<string, unknown>) {
  const merged = { ...current, ...next };
  for (const name of SECRET_KEYS) {
    const value = next[name];
    if (value === '') merged[name] = current[name];
    else if (typeof value === 'string' && value) merged[name] = encrypt(value);
  }
  return merged;
}

export function redactConfiguration(configuration: Record<string, unknown> | null) {
  const safe = { ...(configuration || {}) };
  for (const name of SECRET_KEYS) {
    if (typeof safe[name] === 'string' && decrypt(safe[name] as string)) safe[name] = '';
  }
  return safe;
}
