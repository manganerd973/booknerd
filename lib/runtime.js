import { env } from 'cloudflare:workers';

export function getDb() {
  return env.DB || null;
}

export function requireDb() {
  const db = getDb();
  if (!db) throw new Error('Хранилище книг временно недоступно.');
  return db;
}

export function getBucket() {
  return env.BUCKET || null;
}

export function requireBucket() {
  const bucket = getBucket();
  if (!bucket) throw new Error('Хранилище обложек временно недоступно.');
  return bucket;
}

export function getOwnerEmail() {
  const localOwner = typeof process !== 'undefined' ? process.env?.BOOKNERD_OWNER_EMAIL : '';
  return String(env.BOOKNERD_OWNER_EMAIL || localOwner || '')
    .trim()
    .toLowerCase();
}
