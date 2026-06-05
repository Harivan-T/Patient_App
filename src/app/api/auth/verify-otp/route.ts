import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyOtpCookie, signToken, buildTokenCookie, buildClearOtpCookie } from '@/lib/auth';

const schema = z.object({
  patientId: z.string().min(1),
  phone:     z.string().min(7).max(20),
  otp:       z.string().length(6).regex(/^\d{6}$/),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { patientId, phone, otp } = parsed.data;

    const otpToken = req.cookies.get('hp_otp')?.value;
    if (!otpToken) {
      return NextResponse.json({ error: 'otpExpired' }, { status: 401 });
    }

    const result = await verifyOtpCookie(otpToken, patientId, phone, otp);

    if (result === 'expired')   return NextResponse.json({ error: 'otpExpired' },      { status: 401 });
    if (result === 'too_many')  return NextResponse.json({ error: 'tooManyAttempts' }, { status: 429 });
    if (result === 'invalid')   return NextResponse.json({ error: 'invalidOtp' },      { status: 401 });

    const token = await signToken({ patientId, phone });
    const res = NextResponse.json({ success: true });
    res.headers.append('Set-Cookie', buildTokenCookie(token));
    res.headers.append('Set-Cookie', buildClearOtpCookie());
    return res;
  } catch (err) {
    console.error('[verify-otp]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
