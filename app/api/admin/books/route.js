import { authorizeAdminRequest } from '../../../../lib/admin-auth.js';
import { listAllBooks, slugify } from '../../../../lib/books.js';
import { ensureDb } from '../../../../lib/runtime.js';
import { normalizeGoogleDriveUrl } from '../../../../lib/google-drive.js';

function normalizeBookPayload(payload = {}) {
  const genres = Array.isArray(payload.genres)
    ? payload.genres.map((genre) => String(genre).trim()).filter(Boolean).slice(0, 20)
    : String(payload.genres || '').split(/[,;\n]+/).map((genre) => genre.trim()).filter(Boolean).slice(0, 20);
  const tropes = Array.isArray(payload.tropes)
    ? payload.tropes.map((trope) => String(trope).trim()).filter(Boolean).slice(0, 40)
    : String(payload.tropes || '').split(/[,;\n]+/).map((trope) => trope.trim()).filter(Boolean).slice(0, 40);
  const triggerWarnings = Array.isArray(payload.triggerWarnings)
    ? payload.triggerWarnings.map((warning) => String(warning).trim()).filter(Boolean).slice(0, 40)
    : String(payload.triggerWarnings || '').split(/[,;\n]+/).map((warning) => warning.trim()).filter(Boolean).slice(0, 40);
  const driveUrl = normalizeGoogleDriveUrl(payload.driveUrl);
  return {
    title: String(payload.title || '').trim().slice(0, 180),
    originalTitle: String(payload.originalTitle || '').trim().slice(0, 180),
    seriesTitle: String(payload.seriesTitle || '').trim().slice(0, 180),
    seriesNumber: payload.seriesNumber ? Math.max(1, Math.floor(Number(payload.seriesNumber))) : null,
    author: String(payload.author || '').trim().slice(0, 140),
    dedication: String(payload.dedication || '').trim().slice(0, 2000),
    triggerWarnings,
    hasHotScenes: Boolean(payload.hasHotScenes),
    hotSceneChapters: String(payload.hotSceneChapters || '').trim().slice(0, 160),
    synopsis: String(payload.synopsis || '').trim().slice(0, 12000),
    genres,
    tropes,
    driveUrl,
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
    if (payload.driveUrl === null) {
      return Response.json({ error: 'Вставьте ссылку с drive.google.com или docs.google.com.' }, { status: 400 });
    }

    const db = await ensureDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const slug = await uniqueSlug(db, slugify(payload.requestedSlug || payload.title));
    await db.prepare(
      `INSERT INTO books
       (id, slug, title, original_title, series_title, series_number, author, dedication, trigger_warnings, has_hot_scenes, hot_scene_chapters, synopsis, genres, tropes, drive_url, status, progress, cover_key, published, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, slug, payload.title, payload.originalTitle, payload.seriesTitle, payload.seriesNumber, payload.author, payload.dedication, JSON.stringify(payload.triggerWarnings), payload.hasHotScenes ? 1 : 0, payload.hotSceneChapters, payload.synopsis,
      JSON.stringify(payload.genres), JSON.stringify(payload.tropes), payload.driveUrl, payload.status, payload.progress, payload.coverKey,
      payload.published ? 1 : 0, now, now,
    ).run();

    return Response.json({ id, slug }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось добавить книгу.' }, { status: 500 });
  }
}
