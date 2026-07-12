import { NextResponse } from 'next/server';
import { buildClearCookie, buildClearOtpCookie } from '@/lib/auth';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.headers.append('Set-Cookie', buildClearCookie());
  res.headers.append('Set-Cookie', buildClearOtpCookie());
  return res;
}
