import { hasReaderAccess } from '../../../lib/reader-access.js';
import { verifyOrCreateReaderIdentity, jsonWithReaderIdentity } from '../../../lib/reader-identity.js';
import { createRecoveryCode, verifyRecoveryCode } from '../../../lib/reader-recovery.js';
export async function POST(request) {
  if (!(await hasReaderAccess(request))) return Response.json({ error: 'Сначала войдите на сайт.' }, { status: 401 });
  try {
    const payload = await request.json();
    if (payload.action === 'restore') {
      const visitorKey = await verifyRecoveryCode(payload.code);
      if (!visitorKey) return Response.json({ error: 'Код восстановления неверный.' }, { status: 400 });
      // A valid recovery code authorizes replacing an existing device identity.
      const identity = await verifyOrCreateReaderIdentity(new Request(request.url), visitorKey);
      const response = jsonWithReaderIdentity({ visitorKey }, identity, { headers: { 'cache-control': 'no-store' } });
      response.headers.append('set-cookie', `booknerd_visitor=${encodeURIComponent(visitorKey)}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`);
      return response;
    }
    if (payload.action !== 'create') return Response.json({ error: 'Неизвестное действие.' }, { status: 400 });
    const visitorKey = String(payload.visitorKey || '');
    if (!/^[a-zA-Z0-9:_-]{8,120}$/.test(visitorKey)) return Response.json({ error: 'Профиль не определён.' }, { status: 400 });
    const identity = await verifyOrCreateReaderIdentity(request, visitorKey);
    if (!identity.valid) return Response.json({ error: 'Этот браузер связан с другим профилем.' }, { status: 403 });
    return jsonWithReaderIdentity({ code: await createRecoveryCode(visitorKey) }, identity, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Не удалось восстановить доступ. Проверьте соединение и настройки доступа у администратора.' }, { status: 503 });
  }
}
