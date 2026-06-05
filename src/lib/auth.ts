import { SignJWT, jwtVerify, type JWTPayload as JosePayload } from 'jose';
import { cookies } from 'next/headers';
import type { JWTPayload } from '@/types';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'fallback-secret-change-in-production'
);
const TOKEN_COOKIE = 'hp_token';
const OTP_COOKIE   = 'hp_otp';
const SESSION_TIMEOUT = 30 * 24 * 60 * 60; // 30 days
const OTP_TTL         =  5 * 60; // seconds

// ── JWT / session ─────────────────────────────────────────────────────────────

export async function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT({ ...(payload as JosePayload) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TIMEOUT}s`)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getSessionFromCookies(): Promise<JWTPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function buildTokenCookie(token: string): string {
  const flags = [
    `Max-Age=${SESSION_TIMEOUT}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    ...(process.env.NODE_ENV === 'production' ? ['Secure'] : []),
  ];
  return `${TOKEN_COOKIE}=${token}; ${flags.join('; ')}`;
}

export function buildClearCookie(): string {
  return `${TOKEN_COOKIE}=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/`;
}

// ── OTP (cookie-based — no shared in-memory state) ───────────────────────────
//
// The OTP is stored as a signed JWT in an HttpOnly cookie so that both the
// send-otp and verify-otp API routes always read from the same place,
// regardless of Next.js bundle/module isolation.

interface OtpPayload {
  patientId: string;
  phone:     string;
  otp:       string;
  attempts:  number;
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function createOtpCookie(patientId: string, phone: string): Promise<{ otp: string; cookie: string }> {
  const otp = generateOtp();
  const token = await new SignJWT({ patientId, phone, otp, attempts: 0 } as JosePayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${OTP_TTL}s`)
    .sign(JWT_SECRET);

  const flags = [
    `Max-Age=${OTP_TTL}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    ...(process.env.NODE_ENV === 'production' ? ['Secure'] : []),
  ];
  const cookie = `${OTP_COOKIE}=${token}; ${flags.join('; ')}`;
  return { otp, cookie };
}

export async function verifyOtpCookie(
  otpToken: string,
  patientId: string,
  phone: string,
  submittedOtp: string
): Promise<'valid' | 'invalid' | 'expired' | 'too_many'> {
  let payload: OtpPayload;
  try {
    const result = await jwtVerify(otpToken, JWT_SECRET);
    payload = result.payload as unknown as OtpPayload;
  } catch {
    return 'expired';
  }

  if (payload.patientId !== patientId || payload.phone !== phone) return 'invalid';
  if (payload.attempts >= 5) return 'too_many';
  if (payload.otp !== submittedOtp) return 'invalid';
  return 'valid';
}

export function buildClearOtpCookie(): string {
  return `${OTP_COOKIE}=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/`;
}

// ── SMS ───────────────────────────────────────────────────────────────────────

/** Returns the OTP string in dev mode (no real SMS credentials), null otherwise. */
export async function sendSmsOtp(phone: string, otp: string): Promise<string | null> {
  const apiKey    = process.env.VONAGE_API_KEY;
  const apiSecret = process.env.VONAGE_API_SECRET;

  const hasRealCreds = Boolean(
    apiKey    && apiKey    !== 'your_vonage_api_key' &&
    apiSecret && apiSecret !== 'your_vonage_api_secret'
  );

  if (!hasRealCreds) {
    console.log(`\n[DEV] OTP for ${phone}: ${otp}\n`);
    return otp;
  }

  const body = new URLSearchParams({
    api_key:    apiKey!,
    api_secret: apiSecret!,
    from:       'HealthPortal',
    to:         phone,
    text:       `Your Tibbna verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`,
  });

  const res = await fetch('https://rest.nexmo.com/sms/json', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  const data = await res.json() as { messages: Array<{ status: string; 'error-text'?: string }> };
  const msg = data.messages?.[0];
  if (msg?.status !== '0') {
    throw new Error(`Vonage SMS error: ${msg?.['error-text'] ?? 'unknown error'}`);
  }
  return null;
}
