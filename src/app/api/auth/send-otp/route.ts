import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { patientIdExists, getPatientByCredentials } from '@/lib/epr';
import { createOtpCookie, sendSmsOtp } from '@/lib/auth';

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

    const exists = await patientIdExists(patientId);
    if (!exists) {
      return NextResponse.json({ error: 'patientNotRegistered' }, { status: 401 });
    }

    const patient = await getPatientByCredentials(patientId, phone);
    if (!patient) {
      return NextResponse.json({ error: 'invalidCredentials' }, { status: 401 });
    }

    const { otp, cookie } = await createOtpCookie(patientId, phone);
    const smsPhone = phone.startsWith('+') ? phone : `+964${phone.replace(/^0/, '')}`;
    const devOtp = await sendSmsOtp(smsPhone, otp);

    const res = NextResponse.json({ success: true, ...(devOtp ? { devOtp } : {}) });
    res.headers.set('Set-Cookie', cookie);
    return res;
  } catch (err) {
    console.error('[send-otp]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
