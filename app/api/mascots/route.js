import { hasReaderAccess } from '../../../lib/reader-access.js';
import { cachedRead } from '../../../lib/read-cache.js';
import { ensureDb, getDb } from '../../../lib/runtime.js';
import { answerMascotQuestion, parseMascotDialogues } from '../../../lib/mascot-knowledge.js';

const DEFAULT_CONFIG = { enabled: true, aiEnabled: false, disabledPages: [], blockedTopics: [], dialogues: [] };
const requestWindows = new Map();

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
  return cachedRead('mascot-public-config', 5 * 60 * 1000, async () => {
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
        aiEnabled: false,
        disabledPages: parseList(settings?.disabled_pages),
        blockedTopics: parseList(settings?.blocked_topics),
        dialogues: parseMascotDialogues(dialogues.results || []),
      };
    } catch {
      return DEFAULT_CONFIG;
    }
  });
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

export async function GET(request) {
  if (!(await hasReaderAccess(request))) return Response.json({ error: 'Сначала введите пароль читателя.' }, { status: 401 });
  const view = new URL(request.url).searchParams.get('view');
  if (view !== 'config') return Response.json({ error: 'Неизвестный запрос.' }, { status: 400 });
  return Response.json({ config: await publicConfig() }, { headers: { 'cache-control': 'public, max-age=120, s-maxage=300' } });
}

export async function POST(request) {
  if (!(await hasReaderAccess(request))) return Response.json({ error: 'Сначала введите пароль читателя.' }, { status: 401 });
  if (!allowRequest(request)) return Response.json({ error: 'Слишком много вопросов подряд. Подождите несколько минут.' }, { status: 429 });
  try {
    const payload = await request.json();
    const question = String(payload.question || '').trim();
    if (!question) return Response.json({ error: 'Введите вопрос.' }, { status: 400 });
    const messages = await answerMascotQuestion({
      question,
      askMode: payload.askMode,
      bookSlug: String(payload.bookSlug || '').slice(0, 120),
      visitorKey: payload.visitorKey,
      currentChapter: Math.max(0, Number(payload.currentChapter || 0)),
    });
    return Response.json({ messages, aiUsed: false }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error.message || 'Ответ временно недоступен.' }, { status: 503 });
  }
}

