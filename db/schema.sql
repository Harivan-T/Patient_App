-- HealthPortal EPR Schema
-- Run this against the EPR_DB_NAME database before starting the app.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Patients ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    TEXT UNIQUE NOT NULL,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  date_of_birth DATE,
  gender        TEXT,
  phone_number  TEXT NOT NULL,
  address       TEXT,
  blood_type    TEXT,
  allergies     TEXT[],
  ehr_id        TEXT,           -- openEHR EHR ID (ehr_id/value)
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Appointments ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       TEXT NOT NULL REFERENCES patients(patient_id),
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  doctor_name      TEXT NOT NULL,
  hospital_name    TEXT NOT NULL,
  department       TEXT,
  type             TEXT NOT NULL DEFAULT 'appointment', -- 'appointment' | 'operation'
  status           TEXT NOT NULL DEFAULT 'upcoming',    -- 'upcoming' | 'past' | 'cancelled'
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date   ON appointments(appointment_date DESC);

-- ── Medications ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id        TEXT NOT NULL REFERENCES patients(patient_id),
  medication_name   TEXT NOT NULL,
  generic_name      TEXT,
  dosage            TEXT NOT NULL,
  frequency         TEXT NOT NULL,
  start_date        DATE NOT NULL,
  end_date          DATE,
  prescribing_doctor TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'current',  -- 'current' | 'past'
  instructions      TEXT,
  refillable        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medications_patient ON medications(patient_id);

-- ── Lab Orders ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lab_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    TEXT NOT NULL REFERENCES patients(patient_id),
  order_date    DATE NOT NULL,
  doctor_name   TEXT NOT NULL,
  hospital_name TEXT,
  status        TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'completed' | 'partial'
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_orders_patient ON lab_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_date    ON lab_orders(order_date DESC);

-- ── Lab Tests ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lab_tests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
  test_name    TEXT NOT NULL,
  result       TEXT,
  unit         TEXT,
  normal_range TEXT,
  is_abnormal  BOOLEAN DEFAULT FALSE,
  status       TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'completed'
  result_date  DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_tests_order ON lab_tests(order_id);

-- ── Body Map Annotations ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS body_map_annotations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  TEXT NOT NULL REFERENCES patients(patient_id),
  area        TEXT NOT NULL,
  side        TEXT NOT NULL CHECK (side IN ('front', 'back')),
  x           NUMERIC(5,1) NOT NULL,
  y           NUMERIC(5,1) NOT NULL,
  severity    SMALLINT NOT NULL CHECK (severity BETWEEN 1 AND 5),
  description TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bodymap_patient ON body_map_annotations(patient_id);

-- ── Pharmacy Renewal Requests ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pharmacy_renewal_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    TEXT NOT NULL REFERENCES patients(patient_id),
  medication_id UUID NOT NULL REFERENCES medications(id),
  requested_at  TIMESTAMPTZ DEFAULT NOW(),
  status        TEXT NOT NULL DEFAULT 'pending',
  UNIQUE (patient_id, medication_id)
);

-- ── Sample patient for dev/test ───────────────────────────────────────────────
-- INSERT INTO patients (patient_id, first_name, last_name, date_of_birth, gender, phone_number, blood_type, allergies, ehr_id)
-- VALUES ('P-001', 'Ahmad', 'Ibrahim', '1985-04-12', 'Male', '+9647701234567', 'O+', ARRAY['Penicillin'], 'your-ehr-id-here');
