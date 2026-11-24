import { NextResponse } from 'next/server';
import { route } from '@/server/api';
import { COOKIE, ORG_COOKIE } from '@/server/auth';

export const POST = route(async () => {
  const res = NextResponse.json({ ok: true, data: { done: true } });
  res.cookies.set(COOKIE, '', { path: '/', maxAge: 0 });
  res.cookies.set(ORG_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}, { auth: false });
