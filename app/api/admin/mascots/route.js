import { authorizeAdminRequest } from '../../../../lib/admin-auth.js';
import { invalidateCachedRead } from '../../../../lib/read-cache.js';
import { ensureDb } from '../../../../lib/runtime.js';

const CATEGORIES = new Set(['greeting', 'returning', 'recommendation', 'new-chapter', 'chapter-ending', 'search', 'empty', 'offline', 'error', 'achievement', 'seasonal', 'banter', 'flirt', 'tip']);
const PAGES = new Set(['home', 'book', 'notifications', 'library', 'offline', 'profile', 'other']);

function parseList(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function cleanList(value, allowed, limit = 20) {
  const source = Array.isArray(value) ? value : [];
  return [...new Set(source.map((item) => String(item || '').trim()).filter((item) => item && (!allowed || allowed.has(item))))].slice(0, limit);
}

function parseDisabledPages(value) {
  return parseList(value).filter((item) => PAGES.has(item));
}

function cleanLines(value) {
  return (Array.isArray(value) ? value : []).map((line) => ({
    character: line?.character === 'till' ? 'till' : line?.character === 'both' ? 'both' : 'ivan',
    text: String(line?.text || '').trim().slice(0, 800),
  })).filter((line) => line.text).slice(0, 8);
}

function optionalDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function readState(db) {
  const [settings, dialogues] = await Promise.all([
    db.prepare(`SELECT * FROM mascot_settings WHERE id = 'global' LIMIT 1`).first(),
    db.prepare(`SELECT * FROM mascot_dialogues ORDER BY updated_at DESC LIMIT 200`).all(),
  ]);
  return {
    config: {
      enabled: settings ? Boolean(settings.enabled) : true,
      aiEnabled: settings ? Boolean(settings.ai_enabled) : true,
      disabledPages: parseDisabledPages(settings?.disabled_pages),
      blockedTopics: parseList(settings?.blocked_topics),
      updatedAt: settings?.updated_at || null,
    },
    dialogues: (dialogues.results || []).map((row) => ({
      id: row.id,
      category: row.category,
      pages: parseList(row.pages),
      lines: parseList(row.lines),
      active: Boolean(row.active),
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  };
}

export async function GET(request) {
  const auth = await authorizeAdminRequest(request, { ownerOnly: true });
  if (auth.response) return auth.response;
  try {
    return Response.json(await readState(await ensureDb()));
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось загрузить помощников.' }, { status: 503 });
  }
}

export async function PUT(request) {
  const auth = await authorizeAdminRequest(request, { ownerOnly: true });
  if (auth.response) return auth.response;
  try {
    const payload = await request.json();
    const enabled = payload.enabled !== false;
    const aiEnabled = payload.aiEnabled === true;
    const disabledPages = cleanList(payload.disabledPages, PAGES);
    const blockedTopics = cleanList(payload.blockedTopics, null, 40).map((item) => item.slice(0, 120));
    const now = new Date().toISOString();
    const db = await ensureDb();
    await db.prepare(
      `INSERT INTO mascot_settings (id, enabled, ai_enabled, disabled_pages, blocked_topics, updated_at, updated_by)
       VALUES ('global', ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET enabled = excluded.enabled, ai_enabled = excluded.ai_enabled,
         disabled_pages = excluded.disabled_pages, blocked_topics = excluded.blocked_topics,
         updated_at = excluded.updated_at, updated_by = excluded.updated_by`
    ).bind(enabled ? 1 : 0, aiEnabled ? 1 : 0, JSON.stringify(disabledPages), JSON.stringify(blockedTopics), now, auth.email || 'owner').run();
    invalidateCachedRead('mascot-public-config');
    return Response.json({ ok: true, ...(await readState(db)) });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось сохранить настройки.' }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await authorizeAdminRequest(request, { ownerOnly: true });
  if (auth.response) return auth.response;
  try {
    const payload = await request.json();
    const id = String(payload.id || '').trim().slice(0, 100) || crypto.randomUUID();
    const category = CATEGORIES.has(payload.category) ? payload.category : 'tip';
    const pages = cleanList(payload.pages, PAGES, 8);
    const lines = cleanLines(payload.lines);
    if (!pages.length || !lines.length) return Response.json({ error: 'Выберите страницу и добавьте хотя бы одну реплику.' }, { status: 400 });
    const startsAt = optionalDate(payload.startsAt);
    const endsAt = optionalDate(payload.endsAt);
    if (payload.startsAt && !startsAt || payload.endsAt && !endsAt) return Response.json({ error: 'Проверьте даты сезонной реплики.' }, { status: 400 });
    if (startsAt && endsAt && startsAt > endsAt) return Response.json({ error: 'Дата окончания должна быть позже даты начала.' }, { status: 400 });
    const now = new Date().toISOString();
    const db = await ensureDb();
    await db.prepare(
      `INSERT INTO mascot_dialogues (id, category, pages, lines, active, starts_at, ends_at, created_at, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET category = excluded.category, pages = excluded.pages, lines = excluded.lines,
         active = excluded.active, starts_at = excluded.starts_at, ends_at = excluded.ends_at,
         updated_at = excluded.updated_at, updated_by = excluded.updated_by`
    ).bind(id, category, JSON.stringify(pages), JSON.stringify(lines), payload.active === false ? 0 : 1, startsAt, endsAt, now, now, auth.email || 'owner').run();
    invalidateCachedRead('mascot-public-config');
    return Response.json({ ok: true, ...(await readState(db)) }, { status: payload.id ? 200 : 201 });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось сохранить реплику.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const auth = await authorizeAdminRequest(request, { ownerOnly: true });
  if (auth.response) return auth.response;
  try {
    const id = String(new URL(request.url).searchParams.get('id') || '').trim();
    if (!id) return Response.json({ error: 'Реплика не выбрана.' }, { status: 400 });
    const db = await ensureDb();
    await db.prepare(`DELETE FROM mascot_dialogues WHERE id = ?`).bind(id).run();
    invalidateCachedRead('mascot-public-config');
    return Response.json({ ok: true, ...(await readState(db)) });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось удалить реплику.' }, { status: 500 });
  }
}
