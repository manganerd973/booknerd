'use client';

const QUEUE_KEY = 'booknerd-offline-reading-progress-v1';
const MAX_QUEUE = 100;

function readQueue() {
  try { const value = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; }
}

function saveQueue(items) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-MAX_QUEUE))); } catch { /* Offline sync is best effort. */ }
}

function queuePayload(payload) {
  const items = readQueue();
  const index = items.findIndex((item) => item.visitorKey === payload.visitorKey && item.chapterId === payload.chapterId);
  if (index >= 0) {
    const old = items[index];
    items[index] = {
      ...old, ...payload,
      seconds: Math.min(7200, Number(old.seconds || 0) + Number(payload.seconds || 0)),
      chapterProgress: Math.max(Number(old.chapterProgress || 0), Number(payload.chapterProgress || 0)),
      bookProgress: Math.max(Number(old.bookProgress || 0), Number(payload.bookProgress || 0)),
      completed: Boolean(old.completed || payload.completed),
    };
  } else items.push(payload);
  saveQueue(items);
}

function announce(result) {
  if (result?.levelEvent && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('booknerd:level-up', { detail: result.levelEvent }));
}

async function post(payload, keepalive = true) {
  const response = await fetch('/api/reading-progress', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), keepalive });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'Не удалось синхронизировать чтение.'), { status: response.status });
  announce(data);
  return data;
}

export async function sendReadingProgress(payload, { queueOnFail = true, keepalive = true } = {}) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    if (queueOnFail) queuePayload(payload);
    return { ok: true, queued: true };
  }
  try { return await post(payload, keepalive); }
  catch (error) {
    if (queueOnFail && (!error.status || error.status >= 500)) queuePayload(payload);
    throw error;
  }
}

export async function flushOfflineReadingProgress() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  const queue = readQueue();
  if (!queue.length) return;
  const remaining = [];
  for (const item of queue) {
    try { await post({ ...item, offlineSync: true }, false); } catch { remaining.push(item); }
  }
  saveQueue(remaining);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flushOfflineReadingProgress().catch(() => {}); });
  queueMicrotask(() => { flushOfflineReadingProgress().catch(() => {}); });
}
