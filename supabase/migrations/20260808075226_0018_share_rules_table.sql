/*
# Create share_rules table for share configuration engine

1. New Tables
- `share_rules`
  - `id` (uuid, primary key)
  - `company_id` (uuid, FK -> companies)
  - `branch_id` (uuid, nullable, FK -> branches)
  - `share_for` (text: referral_person, referral_doctor, performing_doctor)
  - `doctor_id` (uuid, nullable, FK -> doctors) — null means "all doctors"
  - `department_id` (uuid, nullable, FK -> departments) — null means "all departments"
  - `service_id` (uuid, nullable, FK -> services) — null means "all services"
  - `service_category` (text, nullable) — lab, radiology, opd, procedure, package; null means all categories
  - `share_type` (text: percentage, fixed)
  - `share_value` (numeric)
  - `effective_date` (date)
  - `priority` (integer, computed by app based on specificity)
  - `is_active` (boolean, default true)
  - `created_at`, `updated_at` (timestamptz)

2. Security
- RLS enabled with company-scoped CRUD for authenticated users.

3. Notes
- Priority is determined by specificity: specific doctor + specific service = highest, all doctors + all services = lowest.
- The app queries rules matching a transaction's doctor/service/department and picks the highest-priority match.
- Only one rule applies per transaction; the selected rule is stored with the transaction at creation time.
*/

CREATE TABLE IF NOT EXISTS share_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  share_for text NOT NULL CHECK (share_for IN ('referral_person', 'referral_doctor', 'performing_doctor')),
  doctor_id uuid REFERENCES doctors(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  service_category text,
  share_type text NOT NULL DEFAULT 'percentage' CHECK (share_type IN ('percentage', 'fixed')),
  share_value numeric NOT NULL DEFAULT 0,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_share_rules_company ON share_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_share_rules_for ON share_rules(share_for);
CREATE INDEX IF NOT EXISTS idx_share_rules_doctor ON share_rules(doctor_id);
CREATE INDEX IF NOT EXISTS idx_share_rules_active ON share_rules(is_active);

ALTER TABLE share_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_share_rules" ON share_rules;
CREATE POLICY "select_share_rules" ON share_rules FOR SELECT
  TO authenticated USING (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = share_rules.company_id));

DROP POLICY IF EXISTS "insert_share_rules" ON share_rules;
CREATE POLICY "insert_share_rules" ON share_rules FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = share_rules.company_id));

DROP POLICY IF EXISTS "update_share_rules" ON share_rules;
CREATE POLICY "update_share_rules" ON share_rules FOR UPDATE
  TO authenticated USING (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = share_rules.company_id))
  WITH CHECK (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = share_rules.company_id));

DROP POLICY IF EXISTS "delete_share_rules" ON share_rules;
CREATE POLICY "delete_share_rules" ON share_rules FOR DELETE
  TO authenticated USING (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = share_rules.company_id));
