import { NextResponse } from 'next/server';
import { hasReaderAccess } from './lib/reader-access.js';

const ALWAYS_OPEN = [
  '/reader-access',
  '/api/reader-access',
  '/favicon.ico',
  '/robots.txt',
  '/sw.js',
  '/manifest.webmanifest',
  '/admin-manifest.webmanifest',
  '/booknerd-icon.svg',
  '/booknerd-icon-192.png',
  '/booknerd-icon-512.png',
  '/booknerd-icon-v2-192.png',
  '/booknerd-icon-v2-512.png',
  '/booknerd-icon-v2-1024.png',
  '/booknerd-apple-touch-icon.png',
  '/booknerd-apple-touch-icon-v2.png',
  '/booknerd-favicon-v2.ico',
];

export async function proxy(request) {
  const { pathname, search } = request.nextUrl;

  if (
    pathname.startsWith('/_next/') ||
    ALWAYS_OPEN.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  ) {
    return NextResponse.next();
  }

  if (await hasReaderAccess(request)) {
    return NextResponse.next();
  }

  const accessUrl = new URL('/reader-access', request.url);
  accessUrl.searchParams.set('next', `${pathname}${search}`);
  const response = NextResponse.redirect(accessUrl);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
