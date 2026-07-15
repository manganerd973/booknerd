import { authorizeAdminRequest } from '../../../../lib/admin-auth.js';
import { requireBucket } from '../../../../lib/runtime.js';

const allowedTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

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
    if (file.size > 8 * 1024 * 1024) {
      return Response.json({ error: 'Обложка должна быть меньше 8 МБ.' }, { status: 400 });
    }

    const extension = allowedTypes.get(file.type);
    const key = `covers/${crypto.randomUUID()}.${extension}`;
    await requireBucket().put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' },
      customMetadata: { uploadedBy: auth.email },
    });
    const coverUrl = `/api/covers/${key.split('/').map(encodeURIComponent).join('/')}`;
    return Response.json({ key, coverUrl }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось загрузить обложку.' }, { status: 500 });
  }
}
