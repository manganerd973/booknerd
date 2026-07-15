import { NextResponse } from 'next/server';
import { hasReaderAccess } from './lib/reader-access.js';

const ALWAYS_OPEN = [
  '/reader-access',
  '/api/reader-access',
  '/favicon.ico',
  '/robots.txt',
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
  return NextResponse.redirect(accessUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
