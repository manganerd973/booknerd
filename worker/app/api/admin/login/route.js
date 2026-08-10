import { NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, authenticateAdmin } from '../../../../lib/admin-auth.js';
import { getOwnerPassword } from '../../../../lib/runtime.js';

function safeNext(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/admin';
}

export async function POST(request) {
  const formData = await request.formData();
  const password = String(formData.get('password') || '');
  const email = String(formData.get('email') || '');
  const next = safeNext(String(formData.get('next') || '/admin'));

  if (!getOwnerPassword()) {
    return NextResponse.redirect(new URL(`/admin/login?error=setup&next=${encodeURIComponent(next)}`, request.url), 303);
  }

  const session = await authenticateAdmin(password, email);
  if (!session) {
    return NextResponse.redirect(new URL(`/admin/login?error=1&next=${encodeURIComponent(next)}`, request.url), 303);
  }

  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: session.token,
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
