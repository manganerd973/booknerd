import { NextResponse } from 'next/server';
import {
  createReaderAccessToken,
  getReaderPassword,
  READER_ACCESS_COOKIE,
} from '../../../lib/reader-access.js';

function safeNext(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/';
}

export async function POST(request) {
  const formData = await request.formData();
  const submittedPassword = String(formData.get('password') || '');
  const next = safeNext(String(formData.get('next') || '/'));
  const configuredPassword = getReaderPassword();

  if (!configuredPassword || submittedPassword !== configuredPassword) {
    const deniedUrl = new URL('/reader-access', request.url);
    deniedUrl.searchParams.set('error', '1');
    deniedUrl.searchParams.set('next', next);
    return NextResponse.redirect(deniedUrl, 303);
  }

  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.cookies.set({
    name: READER_ACCESS_COOKIE,
    value: await createReaderAccessToken(configuredPassword),
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
