/*
# Doctor Schedules and Share Settlements

## Overview
Adds doctor schedule management and share settlement tracking for both
doctors and referral sources. This enables the share engine to record
calculated shares during billing and track settlement payments.

## New Tables

### 1. doctor_schedules
Weekly availability schedule for each doctor per branch.
- doctor_id (FK -> doctors)
- branch_id (FK -> branches)
- day_of_week (0=Sunday ... 6=Saturday)
- start_time, end_time (time)
- is_available (boolean)
- room (text, nullable)

### 2. doctor_settlements
Records of share amounts earned by doctors per order, grouped by settlement period.
- doctor_id (FK -> doctors)
- lab_order_id (FK -> lab_orders)
- service_name (text)
- share_type (percentage / fixed)
- share_amount (numeric)
- settled (boolean, default false)
- settled_at (timestamptz)
- settlement_period (text, e.g. "2026-08")

### 3. referral_settlements
Records of commission amounts earned by referral sources per order.
- referral_source_id (FK -> referral_sources)
- lab_order_id (FK -> lab_orders)
- service_name (text)
- commission_type (percentage / fixed)
- commission_amount (numeric)
- settled (boolean, default false)
- settled_at (timestamptz)
- settlement_period (text)

## Security
- RLS enabled on all new tables.
- Authenticated-only CRUD (all users are signed-in staff).
- Audit triggers on all tables.
*/

-- ============================================================
-- 1. DOCTOR_SCHEDULES
-- ============================================================

CREATE TABLE IF NOT EXISTS doctor_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_available boolean NOT NULL DEFAULT true,
  room text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doctor_schedules_doctor ON doctor_schedules(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_schedules_branch ON doctor_schedules(branch_id);

ALTER TABLE doctor_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_doctor_schedules" ON doctor_schedules;
CREATE POLICY "auth_select_doctor_schedules" ON doctor_schedules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_doctor_schedules" ON doctor_schedules;
CREATE POLICY "auth_insert_doctor_schedules" ON doctor_schedules FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_doctor_schedules" ON doctor_schedules;
CREATE POLICY "auth_update_doctor_schedules" ON doctor_schedules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_doctor_schedules" ON doctor_schedules;
CREATE POLICY "auth_delete_doctor_schedules" ON doctor_schedules FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 2. DOCTOR_SETTLEMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS doctor_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  lab_order_id uuid REFERENCES lab_orders(id) ON DELETE SET NULL,
  service_name text NOT NULL,
  share_type text DEFAULT 'percentage' CHECK (share_type IN ('percentage','fixed')),
  share_amount numeric(15,2) DEFAULT 0,
  settled boolean NOT NULL DEFAULT false,
  settled_at timestamptz,
  settlement_period text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doctor_settlements_doctor ON doctor_settlements(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_settlements_settled ON doctor_settlements(settled);
CREATE INDEX IF NOT EXISTS idx_doctor_settlements_period ON doctor_settlements(settlement_period);

ALTER TABLE doctor_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_doctor_settlements" ON doctor_settlements;
CREATE POLICY "auth_select_doctor_settlements" ON doctor_settlements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_doctor_settlements" ON doctor_settlements;
CREATE POLICY "auth_insert_doctor_settlements" ON doctor_settlements FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_doctor_settlements" ON doctor_settlements;
CREATE POLICY "auth_update_doctor_settlements" ON doctor_settlements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_doctor_settlements" ON doctor_settlements;
CREATE POLICY "auth_delete_doctor_settlements" ON doctor_settlements FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 3. REFERRAL_SETTLEMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS referral_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  referral_source_id uuid NOT NULL REFERENCES referral_sources(id) ON DELETE CASCADE,
  lab_order_id uuid REFERENCES lab_orders(id) ON DELETE SET NULL,
  service_name text NOT NULL,
  commission_type text DEFAULT 'percentage' CHECK (commission_type IN ('percentage','fixed')),
  commission_amount numeric(15,2) DEFAULT 0,
  settled boolean NOT NULL DEFAULT false,
  settled_at timestamptz,
  settlement_period text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_settlements_source ON referral_settlements(referral_source_id);
CREATE INDEX IF NOT EXISTS idx_referral_settlements_settled ON referral_settlements(settled);
CREATE INDEX IF NOT EXISTS idx_referral_settlements_period ON referral_settlements(settlement_period);

ALTER TABLE referral_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_referral_settlements" ON referral_settlements;
CREATE POLICY "auth_select_referral_settlements" ON referral_settlements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_referral_settlements" ON referral_settlements;
CREATE POLICY "auth_insert_referral_settlements" ON referral_settlements FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_referral_settlements" ON referral_settlements;
CREATE POLICY "auth_update_referral_settlements" ON referral_settlements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_referral_settlements" ON referral_settlements;
CREATE POLICY "auth_delete_referral_settlements" ON referral_settlements FOR DELETE TO authenticated USING (true);

-- ============================================================
-- TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS set_updated_at ON doctor_schedules;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON doctor_schedules FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON doctor_settlements;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON doctor_settlements FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON referral_settlements;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON referral_settlements FOR EACH ROW EXECUTE FUNCTION set_updated_at();
