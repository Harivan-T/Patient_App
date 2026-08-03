# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Tibbna — a Next.js 14 (App Router) patient portal for an Iraqi hospital system. Patients log in
with a national ID + phone OTP and view appointments, diagnoses, vitals, medications, lab results,
and order medications/home lab collection. UI is trilingual (English, Arabic, Kurdish Sorani) with
full RTL support.

## Commands

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # production build
npm run start    # run production build
npm run lint     # next lint (eslint-config-next)
```

There is no test suite configured in this repo.

Database setup: run `db/schema.sql` against the app-specific tables, then hit
`POST /api/admin/migrate` once (idempotent) to create the cart/order/catalog tables — see
"Two databases, two clients" below. `db/migrations/*.sql` are one-off scripts run manually via
`psql $DATABASE_URL -f db/migrations/<file>.sql` (not an automated migration runner).

### Required environment variables

- `DATABASE_URL` — Postgres connection string (Neon). Used by both `@/lib/db` and `@/lib/epr`.
- `JWT_SECRET` — signs session/OTP JWTs (also duplicated in Edge-safe form in `middleware.ts`).
- `EHRBASE_URL`, `EHRBASE_USER`, `EHRBASE_PASSWORD`, `EHRBASE_API_KEY` — openEHR/EHRbase server for
  clinical data (diagnoses, vitals, care plans, meds, labs).
- `VONAGE_API_KEY`, `VONAGE_API_SECRET` — SMS OTP delivery. Without real credentials, OTP is logged
  to the server console and returned as `devOtp` in the response (dev-only fallback).
- `ANTHROPIC_API_KEY` — used by `/api/translate` to translate content into ar/ku via Claude Haiku.
- `GNEWS_API_KEY`, `NEWSDATA_API_KEY` — personalized news/insights feeds.

## Architecture

### Two databases, two DB client modules — don't mix them up

- **`src/lib/epr.ts`** — talks to the hospital's real EPR/ERP/LIMS/pharmacy Postgres schema
  (`patients`, `appointments`, `staff`, `pharmacy_orders`, `pharmacy_order_items`, `lims_orders`,
  `accession_samples`, `test_results`, `hospital_dispenses`, `hospital_items`, `drugs`,
  `drug_batches`, `items`, `item_batches`, `pos_sale_items`, etc). Its `query()` returns rows
  directly (`Promise<T[]>`). This schema is **not** `db/schema.sql` — it's an external, pre-existing
  production schema this app reads from (and only writes to for a few app-owned tables like
  `body_map_annotations`, `patient_pain_records`, `pharmacy_renewal_requests`). Table/column names
  are lowercase-no-underscore in places (`patientid`, `nationalid`, `orderid`) because they mirror
  the source EPR system, not this app's conventions.
- **`src/lib/db.ts`** — a second, separate `pg.Pool` used only by this app's own feature tables
  (`carts`, `cart_items`, `orders`, `order_items`, `medications_catalog`, `chronic_disease_content`,
  `home_collection_requests`, `medications_catalog`). Its `query()` returns the raw pg
  `QueryResult` (`.rows`), unlike `epr.ts`'s `query()`. These tables are created by
  `POST /api/admin/migrate`, not `db/schema.sql`.
- **`src/lib/ehrbase.ts`** — talks to an EHRbase (openEHR) server via AQL over HTTP, not Postgres.
  Source of truth for clinical data: diagnoses, vitals, medical history, care plans, medications,
  lab orders/results. Each function maps openEHR archetype paths (`at0001`, `eval/data[...]`) to
  app types — see the comments above each query for which template/archetype it targets.

Many read paths try EHRbase first and fall back to Postgres free-text fields when EHRbase has no
data (e.g. `getMedications` in `epr.ts` tries `getMedicationsFromPharmacy`, callers elsewhere merge
EHRbase + DB results, or use `conditionMap.ts` to derive ICD-10 codes from free-text diagnosis
strings when EHRbase didn't supply a coded diagnosis). When adding a new clinical data source,
follow this pattern: try the structured source, catch and log, fall back to a degraded but
non-empty result rather than throwing.

### Pricing lookup chain (cart/catalog)

Medication prices aren't stored in one place. `catalogPrice()` in
[src/app/api/cart/route.ts](src/app/api/cart/route.ts) tries, in order: `items.selling_price` →
`drugs.selling_price` → `item_batches.selling_price` → `pharmacy_order_items.unitprice` (for
already-dispensed `disp:<uuid>` items) → `drug_batches.sellingprice` → `pos_sale_items.unitprice` →
`pharmacy_order_items.unitprice` (by name) → `pharmacy_invoice_lines.unitprice` →
`medications_catalog.price` (admin-maintained last resort). All prices are IQD. Cart items store a
`price_snapshot` at add-time; the GET route re-resolves price live for any item lacking a snapshot
(covers items added before this feature existed).

### Auth flow

Cookie-based, no server-side session store:
1. `POST /api/auth/send-otp` — validates national ID (12 digits) + phone against `epr.ts`, generates
   a 6-digit OTP, and stores it **inside a signed, HttpOnly JWT cookie** (`hp_otp`) rather than
   server memory — this is deliberate so the OTP survives across serverless function instances /
   hot reloads without a shared cache. SMS is sent via Vonage; without real credentials the OTP is
   logged and returned in the JSON response for local dev.
2. `POST /api/auth/verify-otp` — verifies the submitted code against the `hp_otp` cookie payload
   (tracks `attempts`, capped at 5), then issues a long-lived (10-year) session JWT in `hp_token`.
3. `src/middleware.ts` gates all non-API, non-`/login`, non-`/splash` routes by verifying `hp_token`
   using Web Crypto (`crypto.subtle`) instead of `jose`, because `jose` pulls in `CompressionStream`
   which isn't available in the Edge runtime middleware runs in. Keep `middleware.ts`'s manual JWT
   verification in sync with `src/lib/auth.ts`'s `jose`-based verification if the signing scheme
   changes.
4. Authenticated pages get `Cache-Control: no-store` so browser back/forward cache doesn't display
   stale authenticated content after logout; `AppShell` also double-checks the session on
   `pageshow` (bfcache restore) as a client-side belt-and-suspenders guard.

### i18n / locale routing

All pages live under `src/app/[locale]/` (`en` | `ar` | `ku`), routed by `next-intl` middleware
with `localePrefix: 'always'`. `src/i18n/config.ts` defines `locales`/`defaultLocale`/`rtlLocales`;
`ar` and `ku` are RTL — `[locale]/layout.tsx` sets `dir` on `<html>` accordingly. Translation
strings live in `src/i18n/locales/{en,ar,ku}/common.json`. Dynamic/DB-sourced content (e.g. chronic
disease education text) is pre-translated and stored per-language in the DB; `/api/translate` is
used for on-the-fly translation via Claude Haiku with a pass-through fallback if
`ANTHROPIC_API_KEY` is unset.

### Path alias

`@/*` maps to `src/*` (see `tsconfig.json`).
