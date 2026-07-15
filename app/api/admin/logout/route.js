import { NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE } from '../../../../lib/admin-auth.js';

export async function GET(request) {
  const response = NextResponse.redirect(new URL('/', request.url), 303);
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  return response;
}
