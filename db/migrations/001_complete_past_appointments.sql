-- Migration: 001_complete_past_appointments.sql
--
-- Auto-marks appointments as 'completed' when their date has passed and their
-- status is still 'scheduled'.
--
-- HOW TO APPLY
-- ─────────────
-- 1. Connect to your database (psql or Neon SQL console).
-- 2. Run this entire file once:
--       psql $DATABASE_URL -f db/migrations/001_complete_past_appointments.sql
--
-- The file is safe to re-run (idempotent: CREATE OR REPLACE, DO blocks
-- swallow duplicate-job errors).
--
-- NOTE ON status COLUMN TYPE
-- If your appointments table stores status as a PostgreSQL enum (you'll see
-- a cast error like "invalid input value for enum"), change the UPDATE lines to:
--   SET status = 'completed'::<your_enum_type_name>
-- You can find the type name with:
--   SELECT pg_typeof(status) FROM appointments LIMIT 1;

-- ── Step 1: Immediate back-fill ───────────────────────────────────────────────
-- Mark every already-past appointment that was never closed out.
UPDATE appointments
SET    status = 'completed'
WHERE  status = 'scheduled'
  AND  (starttime AT TIME ZONE 'UTC')::date < CURRENT_DATE;

-- ── Step 2: Maintenance function ──────────────────────────────────────────────
-- Called by the scheduled job every night. Safe to call manually at any time.
CREATE OR REPLACE FUNCTION mark_past_appointments_completed()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE appointments
  SET    status = 'completed'
  WHERE  status = 'scheduled'
    AND  (starttime AT TIME ZONE 'UTC')::date < CURRENT_DATE;
$$;

-- ── Step 3: Schedule with pg_cron ────────────────────────────────────────────
-- pg_cron is available on Neon — enable it once in the Neon dashboard under
-- "Extensions", or run:  CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- The job runs at 00:05 UTC every day (5-minute buffer after midnight).
-- Remove the block comment (/* ... */) to activate.

/*
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  -- Remove any existing schedule with this name so re-running is safe.
  PERFORM cron.unschedule('complete-past-appointments');
EXCEPTION WHEN OTHERS THEN
  NULL; -- job didn't exist yet, that's fine
END$$;

SELECT cron.schedule(
  'complete-past-appointments',
  '5 0 * * *',
  $$ SELECT mark_past_appointments_completed(); $$
);
*/

-- ── Verify ────────────────────────────────────────────────────────────────────
-- After running, confirm the back-fill worked:
--
--   SELECT status, COUNT(*) FROM appointments GROUP BY status ORDER BY status;
--
-- And confirm the scheduled job (if you enabled pg_cron):
--
--   SELECT jobname, schedule, command, active FROM cron.job;
