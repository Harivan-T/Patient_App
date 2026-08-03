import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyOtpCookie, signToken, buildTokenCookie, buildClearOtpCookie } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';

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

    // 10 verify attempts per patient per 5 minutes (the OTP TTL)
    if (!rateLimit(`verify-otp:${patientId}`, 10, 5 * 60 * 1000)) {
      return NextResponse.json({ error: 'tooManyAttempts' }, { status: 429 });
    }

    const otpToken = req.cookies.get('hp_otp')?.value;
    if (!otpToken) {
      return NextResponse.json({ error: 'otpExpired' }, { status: 401 });
    }

    const { status, retryCookie } = await verifyOtpCookie(otpToken, patientId, phone, otp);

    if (status === 'expired')  return NextResponse.json({ error: 'otpExpired' },      { status: 401 });
    if (status === 'too_many') return NextResponse.json({ error: 'tooManyAttempts' }, { status: 429 });
    if (status === 'invalid') {
      const res = NextResponse.json({ error: 'invalidOtp' }, { status: 401 });
      // Persist the incremented attempts counter so the 5-attempt cap holds
      if (retryCookie) res.headers.set('Set-Cookie', retryCookie);
      return res;
    }

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
