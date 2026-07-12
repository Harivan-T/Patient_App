---
name: verify
description: Build, run, and drive the Tibbna patient portal to verify changes end-to-end.
---

# Verifying the Tibbna Patient App

## Build & run

- `npm run dev` — dev server on :3000 (background it; ready in ~5s). Requires
  `.env.local` with `DATABASE_URL` (Neon) and `EHRBASE_*`; `JWT_SECRET` optional in dev.
- Production: `npm run build && npx next start -p 3001`. NOTE: `npm run dev` writes
  dev artifacts into `.next`, so always rebuild before `next start`.
- In dev, in-memory module state (e.g. `src/lib/rateLimit.ts` buckets) resets whenever
  Next compiles another route on demand — rate-limit counters look flaky in dev but
  are fine in production. Warm all routes first if testing limits in dev.

## Getting a session (OTP auth)

1. Find a test patient (read-only):
   `SELECT nationalid, phone FROM patients WHERE nationalid ~ '^[0-9]{12}$' AND phone IS NOT NULL LIMIT 3`
   (connect with `DATABASE_URL` from `.env.local`, strip `channel_binding` param, `rejectUnauthorized:false`).
2. `POST /api/auth/send-otp` `{patientId, phone}` with `-c jar.txt` — dev mode returns
   `devOtp` in the JSON; production logs `[DEV] OTP for <phone>: <otp>` to the server
   console instead (when Vonage creds are absent).
3. `POST /api/auth/verify-otp` `{patientId, phone, otp}` with `-b jar.txt -c jar.txt`
   → sets `hp_token` (long-lived). All subsequent requests just need `-b jar.txt`.

## Flows worth driving

- Pages: `/en/{dashboard,appointments,medications,labs,health,basket,profile,settings,bodymap,admin/drug-prices}`
  → all should 200 with the cookie; without it middleware 307s to `/{locale}/splash`.
- RTL: `/ar/...` and `/ku/...` must render `dir="rtl"`.
- Cart: `POST /api/cart` items → `GET /api/cart` (prices resolved via
  `src/lib/pricing.ts` against real pharmacy tables — "Paracetamol" resolves) →
  `PATCH/DELETE /api/cart/:itemId` → `POST /api/cart/submit`.
- Auth-gated APIs (401 without session): translate, news, daily-insights, support.
- OTP hardening: wrong OTP 5× increments `attempts` in the re-issued `hp_otp` cookie
  (base64-decode the JWT payload to inspect; it stores `otpHash`, never plaintext);
  6th attempt → 429 `tooManyAttempts`.

## Gotchas

- `hp_otp` / `hp_token` cookies are HttpOnly; use a curl cookie jar, and remember
  verify-otp RE-ISSUES `hp_otp` on failure — always pass `-c` as well as `-b`.
- The pg client prints an SSL security warning on connect — noise, not an error.
