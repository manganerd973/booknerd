import { authorizeAdminRequest } from '../../../../lib/admin-auth.js';
import { ensureDb } from '../../../../lib/runtime.js';

export async function POST(request) {
  const auth = await authorizeAdminRequest(request, { ownerOnly: true });
  if (auth.response) return auth.response;
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return new Response(null, { status: 403 });
  const form = await request.formData();
  const card = String(form.get('card') || '').replace(/[ -]/g, '');
  const redirect = (result) => Response.redirect(new URL(`/admin/support?result=${result}`, request.url), 303);
  if (card && !/^\d{12,19}$/.test(card)) return redirect('invalid');
  try {
    const db = await ensureDb();
    await db.prepare(`INSERT INTO chapter_support (id, card_number) VALUES (1, ?)
      ON CONFLICT(id) DO UPDATE SET card_number = excluded.card_number`).bind(card).run();
    return redirect('saved');
  } catch {
    return redirect('failed');
  }
}
