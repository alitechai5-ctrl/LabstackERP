/*
# Test Parameters Table

Allows defining multiple parameters per service (e.g. CBC -> Hemoglobin, WBC, RBC, etc.)
Each parameter has its own unit, reference range, and display order.

Also adds a `lab_result_parameters` table to store individual parameter results
linked to a lab_result, enabling multi-parameter result entry.
*/

CREATE TABLE IF NOT EXISTS test_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text,
  normal_range text,
  low_critical numeric,
  high_critical numeric,
  display_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_test_parameters_service ON test_parameters(service_id);

ALTER TABLE test_parameters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_test_parameters" ON test_parameters;
CREATE POLICY "auth_select_test_parameters" ON test_parameters FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_test_parameters" ON test_parameters;
CREATE POLICY "auth_insert_test_parameters" ON test_parameters FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_test_parameters" ON test_parameters;
CREATE POLICY "auth_update_test_parameters" ON test_parameters FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_test_parameters" ON test_parameters;
CREATE POLICY "auth_delete_test_parameters" ON test_parameters FOR DELETE TO authenticated USING (true);

DROP TRIGGER IF EXISTS set_updated_at ON test_parameters;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON test_parameters FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Store individual parameter results per lab_result
CREATE TABLE IF NOT EXISTS lab_result_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_result_id uuid NOT NULL REFERENCES lab_results(id) ON DELETE CASCADE,
  test_parameter_id uuid REFERENCES test_parameters(id) ON DELETE SET NULL,
  parameter_name text NOT NULL,
  result_value text,
  unit text,
  normal_range text,
  flag text DEFAULT 'normal' CHECK (flag IN ('normal','low','high','critical')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_result_parameters_result ON lab_result_parameters(lab_result_id);

ALTER TABLE lab_result_parameters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_lab_result_parameters" ON lab_result_parameters;
CREATE POLICY "auth_select_lab_result_parameters" ON lab_result_parameters FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_lab_result_parameters" ON lab_result_parameters;
CREATE POLICY "auth_insert_lab_result_parameters" ON lab_result_parameters FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_lab_result_parameters" ON lab_result_parameters;
CREATE POLICY "auth_update_lab_result_parameters" ON lab_result_parameters FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_lab_result_parameters" ON lab_result_parameters;
CREATE POLICY "auth_delete_lab_result_parameters" ON lab_result_parameters FOR DELETE TO authenticated USING (true);

DROP TRIGGER IF EXISTS set_updated_at ON lab_result_parameters;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON lab_result_parameters FOR EACH ROW EXECUTE FUNCTION set_updated_at();
