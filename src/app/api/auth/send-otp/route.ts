import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPatientByCredentials } from '@/lib/epr';
import { createOtpCookie, sendSmsOtp } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';

const schema = z.object({
  patientId: z.string().regex(/^\d{12}$/, 'invalidPatientIdFormat'),
  phone: z.string().min(7).max(20),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalidPatientIdFormat' }, { status: 400 });
    }

    const { patientId, phone } = parsed.data;

    // 3 OTP sends per patient per 10 minutes — stops SMS bombing and cost abuse
    if (!rateLimit(`send-otp:${patientId}`, 3, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'tooManyAttempts' }, { status: 429 });
    }

    const patient = await getPatientByCredentials(patientId, phone);
    if (!patient) {
      // Single generic error — don't reveal whether the patient ID exists
      return NextResponse.json({ error: 'invalidCredentials' }, { status: 401 });
    }

    const { otp, cookie } = await createOtpCookie(patientId, phone);
    const smsPhone = phone.startsWith('+') ? phone : `+964${phone.replace(/^0/, '')}`;
    const devOtp = await sendSmsOtp(smsPhone, otp);

    // Never expose the OTP in the response outside local development
    const exposeDevOtp = devOtp && process.env.NODE_ENV !== 'production';
    const res = NextResponse.json({ success: true, ...(exposeDevOtp ? { devOtp } : {}) });
    res.headers.set('Set-Cookie', cookie);
    return res;
  } catch (err) {
    console.error('[send-otp]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
