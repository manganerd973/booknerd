import { hasReaderAccess } from '../../../lib/reader-access.js';
import { cachedRead } from '../../../lib/read-cache.js';
import { ensureDb, getDb } from '../../../lib/runtime.js';
import { answerMascotQuestion, parseMascotDialogues } from '../../../lib/mascot-knowledge.js';
import { answerWithOptionalMascotAi } from '../../../lib/mascot-ai-provider.js';
import { isSensitiveMascotQuestion } from '../../../lib/mascot-spoiler-guard.js';

const DEFAULT_CONFIG = { enabled: true, aiEnabled: true, disabledPages: [], blockedTopics: [], dialogues: [] };
const CONFIG_CACHE_MS = 30 * 60 * 1000;
const CONFIG_CACHE_VERSION = 'v47';
const requestWindows = new Map();
const aiRequestWindows = new Map();

function parseList(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function publicConfig() {
  if (!getDb()) return DEFAULT_CONFIG;
  return cachedRead('mascot-public-config', CONFIG_CACHE_MS, async () => {
    try {
      const db = await ensureDb();
      const now = new Date().toISOString();
      const [settings, dialogues] = await Promise.all([
        db.prepare(`SELECT enabled, ai_enabled, disabled_pages, blocked_topics FROM mascot_settings WHERE id = 'global' LIMIT 1`).first(),
        db.prepare(
          `SELECT id, category, pages, lines
           FROM mascot_dialogues
           WHERE active = 1
             AND (starts_at IS NULL OR starts_at <= ?)
             AND (ends_at IS NULL OR ends_at >= ?)
           ORDER BY updated_at DESC
           LIMIT 40`
        ).bind(now, now).all(),
      ]);
      return {
        enabled: settings ? Boolean(settings.enabled) : true,
        aiEnabled: settings ? Boolean(settings.ai_enabled) : true,
        disabledPages: parseList(settings?.disabled_pages).filter((item) => ['home', 'book', 'notifications', 'library', 'offline', 'profile', 'other'].includes(item)),
        blockedTopics: parseList(settings?.blocked_topics),
        dialogues: parseMascotDialogues(dialogues.results || []),
      };
    } catch {
      return DEFAULT_CONFIG;
    }
  });
}

function configCacheKey(request, slot) {
  const url = new URL(request.url);
  url.pathname = '/__booknerd-cache/mascot-config';
  url.search = `version=${CONFIG_CACHE_VERSION}&slot=${slot}`;
  return new Request(url.toString(), { method: 'GET' });
}

function allowRequest(request) {
  const key = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'local';
  const now = Date.now();
  const recent = (requestWindows.get(key) || []).filter((time) => now - time < 5 * 60 * 1000);
  if (recent.length >= 12) return false;
  recent.push(now);
  requestWindows.set(key, recent);
  if (requestWindows.size > 2000) {
    for (const [entryKey, times] of requestWindows) if (!times.some((time) => now - time < 5 * 60 * 1000)) requestWindows.delete(entryKey);
  }
  return true;
}

function allowAiRequest(request) {
  const key = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'local';
  const now = Date.now();
  const recent = (aiRequestWindows.get(key) || []).filter((time) => now - time < 10 * 60 * 1000);
  if (recent.length >= 3) return false;
  recent.push(now);
  aiRequestWindows.set(key, recent);
  if (aiRequestWindows.size > 2000) {
    for (const [entryKey, times] of aiRequestWindows) if (!times.some((time) => now - time < 10 * 60 * 1000)) aiRequestWindows.delete(entryKey);
  }
  return true;
}

export async function GET(request) {
  if (!(await hasReaderAccess(request))) return Response.json({ error: 'Сначала введите пароль читателя.' }, { status: 401 });
  const view = new URL(request.url).searchParams.get('view');
  if (view !== 'config') return Response.json({ error: 'Неизвестный запрос.' }, { status: 400 });
  const slot = Math.floor(Date.now() / CONFIG_CACHE_MS);
  const edgeCache = globalThis.caches?.default || null;
  const key = configCacheKey(request, slot);
  if (edgeCache) {
    const cached = await edgeCache.match(key).catch(() => null);
    if (cached) {
      const payload = await cached.json().catch(() => null);
      if (payload?.config) return Response.json(payload, { headers: { 'cache-control': 'private, no-store', 'x-booknerd-cache': 'HIT' } });
    }
  }
  const payload = { config: await publicConfig() };
  if (edgeCache) {
    const nextSlot = (slot + 1) * CONFIG_CACHE_MS;
    const seconds = Math.max(1, Math.ceil((nextSlot - Date.now()) / 1000));
    await edgeCache.put(key, Response.json(payload, { headers: { 'cache-control': `public, max-age=${seconds}` } })).catch(() => {});
  }
  return Response.json(payload, { headers: { 'cache-control': 'private, no-store', 'x-booknerd-cache': 'MISS' } });
}

export async function POST(request) {
  if (!(await hasReaderAccess(request))) return Response.json({ error: 'Сначала введите пароль читателя.' }, { status: 401 });
  if (!allowRequest(request)) return Response.json({ error: 'Слишком много вопросов подряд. Подождите несколько минут.' }, { status: 429 });
  try {
    const config = await publicConfig();
    if (!config.enabled) return Response.json({ error: 'Иван и Тилл временно выключены редакцией.' }, { status: 503 });
    const payload = await request.json();
    const question = String(payload.question || '').trim();
    if (!question) return Response.json({ error: 'Введите вопрос.' }, { status: 400 });
    const deterministic = await answerMascotQuestion({
      question,
      askMode: payload.askMode,
      bookSlug: String(payload.bookSlug || '').slice(0, 120),
      visitorKey: payload.visitorKey,
      currentChapter: Math.max(0, Number(payload.currentChapter || 0)),
      blockedTopics: config.blockedTopics,
      firstSpeaker: 'ivan',
      allowSpoilers: payload.allowSpoilers === true,
    });
    const sensitive = isSensitiveMascotQuestion(question, config.blockedTopics);
    const aiMessages = deterministic.requiresSpoilerConfirmation ? null : await answerWithOptionalMascotAi({
      enabled: config.aiEnabled && allowAiRequest(request),
      question,
      deterministicMessages: deterministic.messages,
      askMode: payload.askMode,
      sensitive,
    });
    return Response.json({
      messages: aiMessages || deterministic.messages,
      requiresSpoilerConfirmation: deterministic.requiresSpoilerConfirmation === true,
      aiUsed: Boolean(aiMessages),
    }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error.message || 'Ответ временно недоступен.' }, { status: 503 });
  }
}
