import { getOrCreateVapidKeys } from '../../../../lib/push-notifications.js';

export async function GET() {
  try {
    const keys = await getOrCreateVapidKeys();
    return Response.json({ publicKey: keys.publicKey });
  } catch {
    return Response.json({ error: 'Уведомления временно недоступны.' }, { status: 503 });
  }
}
