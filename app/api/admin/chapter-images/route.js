import { checkImageStorageBudget } from '../../../../lib/image-storage-budget.js';
import { authorizeAdminRequest } from '../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../lib/runtime.js';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 300 * 1024;

function extensionFor(type) {
  if (type === 'image/png') return 'png';
  if (type === 'image/jpeg') return 'jpg';
  return 'webp';
}

function hasExpectedSignature(bytes, type) {
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (type === 'image/webp') {
    return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
      && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  }
  return false;
}

export async function POST(request) {
  const auth = await authorizeAdminRequest(request);
  if (auth.response) return auth.response;
  try {
    const formData = await request.formData();
    const file = formData.get('image');
    if (!(file instanceof File)) return Response.json({ error: 'Выберите фото для текста главы.' }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return Response.json({ error: 'Поддерживаются JPG, PNG и WEBP.' }, { status: 400 });
    if (!file.size || file.size > MAX_IMAGE_BYTES) {
      return Response.json({ error: 'Фото должно занимать не больше 300 КБ после сжатия.' }, { status: 400 });
    }

    const data = await file.arrayBuffer();
    if (!hasExpectedSignature(new Uint8Array(data.slice(0, 16)), file.type)) {
      return Response.json({ error: 'Файл не похож на настоящее изображение.' }, { status: 400 });
    }

    await checkImageStorageBudget(await ensureDb(), file.size);
    const key = `chapter-images/${crypto.randomUUID()}.${extensionFor(file.type)}`;
    await (await ensureDb()).prepare(
      `INSERT INTO book_covers (key, content_type, data, created_at, uploaded_by) VALUES (?, ?, ?, ?, ?)`,
    ).bind(key, file.type, data, new Date().toISOString(), auth.email || auth.displayName || '').run();
    const imageUrl = `/api/covers/${key.split('/').map(encodeURIComponent).join('/')}`;
    return Response.json({ key, imageUrl, sizeBytes: file.size }, {
      status: 201,
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось сохранить фото.' }, { status: 503 });
  }
}
