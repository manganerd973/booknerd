import { getOwnerPassword } from './runtime.js';
async function recoveryKey() {
  const secret = getOwnerPassword();
  if (!secret) throw new Error('Администратору нужно настроить пароль владельца для восстановления профиля.');
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function createRecoveryCode(visitorKey) {
  if (!/^[a-zA-Z0-9:_-]{8,120}$/.test(visitorKey)) throw new Error('Неверный профиль.');
  const message = `BN1.${visitorKey}`;
  const bytes = await crypto.subtle.sign('HMAC', await recoveryKey(), new TextEncoder().encode(message));
  return `${message}.${Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')}`;
}
export async function verifyRecoveryCode(code) {
  const match = /^BN1\.([a-zA-Z0-9:_-]{8,120})\.([a-f0-9]{64})$/.exec(String(code || '').trim());
  if (!match) return null;
  const signature = Uint8Array.from(match[2].match(/../g), n => parseInt(n, 16));
  const valid = await crypto.subtle.verify('HMAC', await recoveryKey(), signature, new TextEncoder().encode(`BN1.${match[1]}`));
  return valid ? match[1] : null;
}
