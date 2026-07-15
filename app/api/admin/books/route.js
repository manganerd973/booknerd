import { authorizeAdminRequest } from '../../../../lib/admin-auth.js';
import { listAllBooks, slugify } from '../../../../lib/books.js';
import { requireDb } from '../../../../lib/runtime.js';

function normalizeBookPayload(payload = {}) {
  const genres = Array.isArray(payload.genres)
    ? payload.genres.map((genre) => String(genre).trim()).filter(Boolean).slice(0, 8)
    : String(payload.genres || '').split(',').map((genre) => genre.trim()).filter(Boolean).slice(0, 8);
  return {
    title: String(payload.title || '').trim().slice(0, 180),
    originalTitle: String(payload.originalTitle || '').trim().slice(0, 180),
    author: String(payload.author || '').trim().slice(0, 140),
    synopsis: String(payload.synopsis || '').trim().slice(0, 12000),
    genres,
    status: String(payload.status || 'Черновик').trim().slice(0, 80),
    progress: Math.max(0, Math.min(100, Number(payload.progress || 0))),
    coverKey: payload.coverKey ? String(payload.coverKey).trim() : null,
    published: Boolean(payload.published),
    requestedSlug: String(payload.slug || '').trim(),
  };
}

async function uniqueSlug(db, base) {
  let candidate = base;
  let suffix = 2;
  while (await db.prepare(`SELECT id FROM books WHERE slug = ? LIMIT 1`).bind(candidate).first()) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export async function GET(request) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    return Response.json({ books: await listAllBooks() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 503 });
  }
}

export async function POST(request) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const payload = normalizeBookPayload(await request.json());
    if (!payload.title || !payload.author) {
      return Response.json({ error: 'Укажите название книги и автора.' }, { status: 400 });
    }

    const db = requireDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const slug = await uniqueSlug(db, slugify(payload.requestedSlug || payload.title));
    await db.prepare(
      `INSERT INTO books
       (id, slug, title, original_title, author, synopsis, genres, status, progress, cover_key, published, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, slug, payload.title, payload.originalTitle, payload.author, payload.synopsis,
      JSON.stringify(payload.genres), payload.status, payload.progress, payload.coverKey,
      payload.published ? 1 : 0, now, now,
    ).run();

    return Response.json({ id, slug }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось добавить книгу.' }, { status: 500 });
  }
}
