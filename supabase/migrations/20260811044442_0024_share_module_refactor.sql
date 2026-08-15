/*
# Share Module Refactor - Phase 1: Database Schema

## Purpose
Extend the existing share_rules table to support doctor_type, referral_source_id, 
effective_to dates, and IN/OUT source fields. Create new tables for panel share 
configuration, panel settlements, and share audit logging.

## Changes to share_rules (ALTER, no data loss)
- Add doctor_type column (opd_doctor / performing_doctor) to distinguish OPD vs Performing doctor shares
- Add referral_source_id FK to link referral share rules to specific referral sources
- Add corporate_client_id FK to link rules to specific panels (for panel-scoped rules)
- Add effective_to date for configuration expiration/history
- Add created_by, updated_by UUID columns for audit tracking
- Add in_source_share_type, in_source_share_value, in_source_calculation_basis for IN SOURCE referral shares
- Add out_source_share_type, out_source_share_value, out_source_calculation_basis for OUT SOURCE referral shares

## New Tables
1. panel_share_rules - Panel-specific share configuration with hierarchy (panel/department/section/service)
2. panel_settlements - Settlement records for panel shares (mirrors doctor/referral settlements)
3. share_audit_log - Audit trail for all share configuration changes

## Security
- RLS enabled on all new tables
- Company-scoped policies using the existing is_company_member() helper function
- All policies TO authenticated only (app has sign-in)
*/

-- ============================================================
-- 1. EXTEND share_rules TABLE
-- ============================================================

DO $$ BEGIN
  ALTER TABLE share_rules ADD COLUMN IF NOT EXISTS doctor_type text DEFAULT 'performing_doctor';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE share_rules ADD COLUMN IF NOT EXISTS referral_source_id uuid;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE share_rules ADD COLUMN IF NOT EXISTS corporate_client_id uuid;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE share_rules ADD COLUMN IF NOT EXISTS effective_to date;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE share_rules ADD COLUMN IF NOT EXISTS created_by uuid;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE share_rules ADD COLUMN IF NOT EXISTS updated_by uuid;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- IN SOURCE referral share fields
DO $$ BEGIN
  ALTER TABLE share_rules ADD COLUMN IF NOT EXISTS in_source_share_type text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE share_rules ADD COLUMN IF NOT EXISTS in_source_share_value numeric DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE share_rules ADD COLUMN IF NOT EXISTS in_source_calculation_basis text DEFAULT 'net_amount';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- OUT SOURCE referral share fields
DO $$ BEGIN
  ALTER TABLE share_rules ADD COLUMN IF NOT EXISTS out_source_share_type text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE share_rules ADD COLUMN IF NOT EXISTS out_source_share_value numeric DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE share_rules ADD COLUMN IF NOT EXISTS out_source_calculation_basis text DEFAULT 'net_amount';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Add foreign keys (IF NOT EXISTS not supported for constraints, use DO block)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'share_rules_referral_source_id_fkey') THEN
    ALTER TABLE share_rules ADD CONSTRAINT share_rules_referral_source_id_fkey
      FOREIGN KEY (referral_source_id) REFERENCES referral_sources(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'share_rules_corporate_client_id_fkey') THEN
    ALTER TABLE share_rules ADD CONSTRAINT share_rules_corporate_client_id_fkey
      FOREIGN KEY (corporate_client_id) REFERENCES corporate_clients(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_share_rules_referral_source ON share_rules(referral_source_id);
CREATE INDEX IF NOT EXISTS idx_share_rules_corporate ON share_rules(corporate_client_id);
CREATE INDEX IF NOT EXISTS idx_share_rules_doctor_type ON share_rules(doctor_type);
CREATE INDEX IF NOT EXISTS idx_share_rules_effective_dates ON share_rules(effective_date, effective_to);

-- ============================================================
-- 2. EXTEND doctor_settlements TABLE
-- ============================================================

DO $$ BEGIN
  ALTER TABLE doctor_settlements ADD COLUMN IF NOT EXISTS gross_amount numeric DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE doctor_settlements ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE doctor_settlements ADD COLUMN IF NOT EXISTS net_amount numeric DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE doctor_settlements ADD COLUMN IF NOT EXISTS calculation_basis text DEFAULT 'net_amount';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE doctor_settlements ADD COLUMN IF NOT EXISTS share_rule_id uuid;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE doctor_settlements ADD COLUMN IF NOT EXISTS doctor_type text DEFAULT 'performing_doctor';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE doctor_settlements ADD COLUMN IF NOT EXISTS department_id uuid;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE doctor_settlements ADD COLUMN IF NOT EXISTS service_id uuid;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE doctor_settlements ADD COLUMN IF NOT EXISTS share_percentage numeric;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ============================================================
-- 3. EXTEND referral_settlements TABLE
-- ============================================================

DO $$ BEGIN
  ALTER TABLE referral_settlements ADD COLUMN IF NOT EXISTS gross_amount numeric DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE referral_settlements ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE referral_settlements ADD COLUMN IF NOT EXISTS net_amount numeric DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE referral_settlements ADD COLUMN IF NOT EXISTS calculation_basis text DEFAULT 'net_amount';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE referral_settlements ADD COLUMN IF NOT EXISTS share_rule_id uuid;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE referral_settlements ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'out_source';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE referral_settlements ADD COLUMN IF NOT EXISTS department_id uuid;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE referral_settlements ADD COLUMN IF NOT EXISTS service_id uuid;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE referral_settlements ADD COLUMN IF NOT EXISTS share_percentage numeric;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ============================================================
-- 4. CREATE panel_share_rules TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS panel_share_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  branch_id uuid,
  corporate_client_id uuid NOT NULL REFERENCES corporate_clients(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  section_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  share_type text NOT NULL DEFAULT 'percentage',
  share_value numeric NOT NULL DEFAULT 0,
  calculation_basis text NOT NULL DEFAULT 'net_amount',
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE panel_share_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_panel_share_rules" ON panel_share_rules;
CREATE POLICY "select_panel_share_rules" ON panel_share_rules FOR SELECT
  TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "insert_panel_share_rules" ON panel_share_rules;
CREATE POLICY "insert_panel_share_rules" ON panel_share_rules FOR INSERT
  TO authenticated WITH CHECK (is_company_member(company_id));

DROP POLICY IF EXISTS "update_panel_share_rules" ON panel_share_rules;
CREATE POLICY "update_panel_share_rules" ON panel_share_rules FOR UPDATE
  TO authenticated USING (is_company_member(company_id)) WITH CHECK (is_company_member(company_id));

DROP POLICY IF EXISTS "delete_panel_share_rules" ON panel_share_rules;
CREATE POLICY "delete_panel_share_rules" ON panel_share_rules FOR DELETE
  TO authenticated USING (is_company_member(company_id));

CREATE INDEX IF NOT EXISTS idx_panel_share_rules_corporate ON panel_share_rules(corporate_client_id);
CREATE INDEX IF NOT EXISTS idx_panel_share_rules_service ON panel_share_rules(service_id);
CREATE INDEX IF NOT EXISTS idx_panel_share_rules_priority ON panel_share_rules(priority DESC);

-- ============================================================
-- 5. CREATE panel_settlements TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS panel_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  corporate_client_id uuid NOT NULL REFERENCES corporate_clients(id) ON DELETE CASCADE,
  lab_order_id uuid REFERENCES lab_orders(id) ON DELETE SET NULL,
  service_name text NOT NULL,
  service_id uuid,
  department_id uuid,
  gross_amount numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  net_amount numeric DEFAULT 0,
  calculation_basis text DEFAULT 'net_amount',
  share_type text DEFAULT 'percentage',
  share_percentage numeric,
  share_amount numeric DEFAULT 0,
  share_rule_id uuid,
  settled boolean NOT NULL DEFAULT false,
  settled_at timestamptz,
  settlement_period text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE panel_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_panel_settlements" ON panel_settlements;
CREATE POLICY "select_panel_settlements" ON panel_settlements FOR SELECT
  TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "insert_panel_settlements" ON panel_settlements;
CREATE POLICY "insert_panel_settlements" ON panel_settlements FOR INSERT
  TO authenticated WITH CHECK (is_company_member(company_id));

DROP POLICY IF EXISTS "update_panel_settlements" ON panel_settlements;
CREATE POLICY "update_panel_settlements" ON panel_settlements FOR UPDATE
  TO authenticated USING (is_company_member(company_id)) WITH CHECK (is_company_member(company_id));

DROP POLICY IF EXISTS "delete_panel_settlements" ON panel_settlements;
CREATE POLICY "delete_panel_settlements" ON panel_settlements FOR DELETE
  TO authenticated USING (is_company_member(company_id));

CREATE INDEX IF NOT EXISTS idx_panel_settlements_corporate ON panel_settlements(corporate_client_id);
CREATE INDEX IF NOT EXISTS idx_panel_settlements_order ON panel_settlements(lab_order_id);
CREATE INDEX IF NOT EXISTS idx_panel_settlements_settled ON panel_settlements(settled);

-- ============================================================
-- 6. CREATE share_audit_log TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS share_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE share_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_share_audit_log" ON share_audit_log;
CREATE POLICY "select_share_audit_log" ON share_audit_log FOR SELECT
  TO authenticated USING (is_company_member(company_id));

DROP POLICY IF EXISTS "insert_share_audit_log" ON share_audit_log;
CREATE POLICY "insert_share_audit_log" ON share_audit_log FOR INSERT
  TO authenticated WITH CHECK (is_company_member(company_id));

CREATE INDEX IF NOT EXISTS idx_share_audit_entity ON share_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_share_audit_changed_at ON share_audit_log(changed_at DESC);

-- ============================================================
-- 7. Update existing share_rules: set doctor_type for existing rows
-- ============================================================

UPDATE share_rules 
SET doctor_type = 'performing_doctor' 
WHERE share_for = 'performing_doctor' AND doctor_type IS NULL;

UPDATE share_rules 
SET doctor_type = 'opd_doctor' 
WHERE share_for = 'opd_doctor' AND doctor_type IS NULL;

UPDATE share_rules
SET doctor_type = 'performing_doctor'
WHERE doctor_type IS NULL;
