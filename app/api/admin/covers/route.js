import { authorizeAdminRequest } from '../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../lib/runtime.js';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxCoverBytes = 1_500_000;

export async function POST(request) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const formData = await request.formData();
    const file = formData.get('cover');
    if (!(file instanceof File)) {
      return Response.json({ error: 'Выберите изображение обложки.' }, { status: 400 });
    }
    if (!allowedTypes.has(file.type)) {
      return Response.json({ error: 'Поддерживаются JPG, PNG и WEBP.' }, { status: 400 });
    }
    if (file.size > maxCoverBytes) {
      return Response.json({ error: 'Не удалось уменьшить обложку. Выберите изображение поменьше.' }, { status: 400 });
    }

    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const key = `covers/${crypto.randomUUID()}.${extension}`;
    await (await ensureDb()).prepare(
      `INSERT INTO book_covers (key, content_type, data, created_at, uploaded_by) VALUES (?, ?, ?, ?, ?)`
    ).bind(key, file.type, await file.arrayBuffer(), new Date().toISOString(), auth.email).run();
    const coverUrl = `/api/covers/${key.split('/').map(encodeURIComponent).join('/')}`;
    return Response.json({ key, coverUrl }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось загрузить обложку.' }, { status: 500 });
  }
}
