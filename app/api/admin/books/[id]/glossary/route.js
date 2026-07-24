import { authorizeAdminRequest } from '../../../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../../../lib/runtime.js';

const CATEGORIES = new Set(['character', 'place', 'term']);

function normalizeEntry(payload = {}) {
  return {
    category: CATEGORIES.has(payload.category) ? payload.category : 'character',
    name: String(payload.name || '').trim().slice(0, 180),
    pronunciation: String(payload.pronunciation || '').trim().slice(0, 180),
    description: String(payload.description || '').trim().slice(0, 3000),
    connections: String(payload.connections || '').trim().slice(0, 2000),
    revealAfterChapter: Math.max(0, Math.floor(Number(payload.revealAfterChapter || 0))),
    sortOrder: Math.max(0, Math.floor(Number(payload.sortOrder || 0))),
  };
}

function mapEntry(row) {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    pronunciation: row.pronunciation || '',
    description: row.description || '',
    connections: row.connections || '',
    revealAfterChapter: Number(row.reveal_after_chapter || 0),
    sortOrder: Number(row.sort_order || 0),
  };
}

export async function GET(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const { id: bookId } = await params;
    const db = await ensureDb();
    const result = await db.prepare(
      `SELECT * FROM book_glossary WHERE book_id = ? ORDER BY sort_order ASC, name COLLATE NOCASE ASC`
    ).bind(bookId).all();
    return Response.json({ entries: (result.results || []).map(mapEntry) });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось открыть словарь.' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const { id: bookId } = await params;
    const entry = normalizeEntry(await request.json());
    if (!entry.name || !entry.description) {
      return Response.json({ error: 'Укажите название и описание.' }, { status: 400 });
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const db = await ensureDb();
    await db.prepare(
      `INSERT INTO book_glossary
       (id, book_id, category, name, pronunciation, description, connections, reveal_after_chapter, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, bookId, entry.category, entry.name, entry.pronunciation, entry.description,
      entry.connections, entry.revealAfterChapter, entry.sortOrder, now, now,
    ).run();
    return Response.json({ entry: { id, ...entry } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось добавить запись.' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const { id: bookId } = await params;
    const payload = await request.json();
    const entryId = String(payload.id || '').trim();
    const entry = normalizeEntry(payload);
    if (!entryId || !entry.name || !entry.description) {
      return Response.json({ error: 'Запись словаря заполнена не полностью.' }, { status: 400 });
    }
    const db = await ensureDb();
    await db.prepare(
      `UPDATE book_glossary
       SET category = ?, name = ?, pronunciation = ?, description = ?, connections = ?,
           reveal_after_chapter = ?, sort_order = ?, updated_at = ?
       WHERE id = ? AND book_id = ?`
    ).bind(
      entry.category, entry.name, entry.pronunciation, entry.description, entry.connections,
      entry.revealAfterChapter, entry.sortOrder, new Date().toISOString(), entryId, bookId,
    ).run();
    return Response.json({ entry: { id: entryId, ...entry } });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось сохранить запись.' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const { id: bookId } = await params;
    const entryId = String(new URL(request.url).searchParams.get('entryId') || '').trim();
    if (!entryId) return Response.json({ error: 'Запись не указана.' }, { status: 400 });
    const db = await ensureDb();
    await db.prepare(`DELETE FROM book_glossary WHERE id = ? AND book_id = ?`).bind(entryId, bookId).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось удалить запись.' }, { status: 500 });
  }
}
