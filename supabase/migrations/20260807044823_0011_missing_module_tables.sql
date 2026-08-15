/*
# Missing Module Tables

## New Tables

### inventory_transfers
Stock transfers between branches.

### inventory_adjustments
Manual stock quantity adjustments (damage, expiry, loss, correction).

### pharmacy_purchases
Purchase orders for pharmacy/inventory items from suppliers.

### pharmacy_returns
Returns of purchased items to suppliers.

### attendance
Daily employee attendance tracking.

### payroll
Monthly payroll records per employee.
*/

-- ============================================================
-- 1. INVENTORY_TRANSFERS
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  from_branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  to_branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  transfer_number text NOT NULL,
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity numeric(15,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_transit','received','cancelled')),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_transfers_number ON inventory_transfers(company_id, transfer_number);
CREATE INDEX IF NOT EXISTS idx_inv_transfers_date ON inventory_transfers(transfer_date);

ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_inv_transfers" ON inventory_transfers;
CREATE POLICY "auth_select_inv_transfers" ON inventory_transfers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_inv_transfers" ON inventory_transfers;
CREATE POLICY "auth_insert_inv_transfers" ON inventory_transfers FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_inv_transfers" ON inventory_transfers;
CREATE POLICY "auth_update_inv_transfers" ON inventory_transfers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_inv_transfers" ON inventory_transfers;
CREATE POLICY "auth_delete_inv_transfers" ON inventory_transfers FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 2. INVENTORY_ADJUSTMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  adjustment_number text NOT NULL,
  adjustment_date date NOT NULL DEFAULT CURRENT_DATE,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity_change numeric(15,2) NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT 'correction',
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_adj_number ON inventory_adjustments(company_id, adjustment_number);
CREATE INDEX IF NOT EXISTS idx_inv_adj_date ON inventory_adjustments(adjustment_date);

ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_inv_adj" ON inventory_adjustments;
CREATE POLICY "auth_select_inv_adj" ON inventory_adjustments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_inv_adj" ON inventory_adjustments;
CREATE POLICY "auth_insert_inv_adj" ON inventory_adjustments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_inv_adj" ON inventory_adjustments;
CREATE POLICY "auth_update_inv_adj" ON inventory_adjustments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_inv_adj" ON inventory_adjustments;
CREATE POLICY "auth_delete_inv_adj" ON inventory_adjustments FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 3. PHARMACY_PURCHASES
-- ============================================================

CREATE TABLE IF NOT EXISTS pharmacy_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  purchase_number text NOT NULL,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity numeric(15,2) NOT NULL DEFAULT 0,
  unit_cost numeric(15,2) NOT NULL DEFAULT 0,
  total_cost numeric(15,2) NOT NULL DEFAULT 0,
  batch_number text,
  expiry_date date,
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid')),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pharm_pur_number ON pharmacy_purchases(company_id, purchase_number);
CREATE INDEX IF NOT EXISTS idx_pharm_pur_date ON pharmacy_purchases(purchase_date);

ALTER TABLE pharmacy_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_pharm_pur" ON pharmacy_purchases;
CREATE POLICY "auth_select_pharm_pur" ON pharmacy_purchases FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_pharm_pur" ON pharmacy_purchases;
CREATE POLICY "auth_insert_pharm_pur" ON pharmacy_purchases FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_pharm_pur" ON pharmacy_purchases;
CREATE POLICY "auth_update_pharm_pur" ON pharmacy_purchases FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_pharm_pur" ON pharmacy_purchases;
CREATE POLICY "auth_delete_pharm_pur" ON pharmacy_purchases FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 4. PHARMACY_RETURNS
-- ============================================================

CREATE TABLE IF NOT EXISTS pharmacy_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  return_number text NOT NULL,
  return_date date NOT NULL DEFAULT CURRENT_DATE,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_id uuid REFERENCES pharmacy_purchases(id) ON DELETE SET NULL,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity numeric(15,2) NOT NULL DEFAULT 0,
  unit_cost numeric(15,2) NOT NULL DEFAULT 0,
  total_amount numeric(15,2) NOT NULL DEFAULT 0,
  reason text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pharm_ret_number ON pharmacy_returns(company_id, return_number);
CREATE INDEX IF NOT EXISTS idx_pharm_ret_date ON pharmacy_returns(return_date);

ALTER TABLE pharmacy_returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_pharm_ret" ON pharmacy_returns;
CREATE POLICY "auth_select_pharm_ret" ON pharmacy_returns FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_pharm_ret" ON pharmacy_returns;
CREATE POLICY "auth_insert_pharm_ret" ON pharmacy_returns FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_pharm_ret" ON pharmacy_returns;
CREATE POLICY "auth_update_pharm_ret" ON pharmacy_returns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_pharm_ret" ON pharmacy_returns;
CREATE POLICY "auth_delete_pharm_ret" ON pharmacy_returns FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 5. ATTENDANCE
-- ============================================================

CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date date NOT NULL,
  check_in time,
  check_out time,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','late','half_day','leave','holiday')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_att_emp_date ON attendance(company_id, employee_id, date);
CREATE INDEX IF NOT EXISTS idx_att_date ON attendance(date);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_att" ON attendance;
CREATE POLICY "auth_select_att" ON attendance FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_att" ON attendance;
CREATE POLICY "auth_insert_att" ON attendance FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_att" ON attendance;
CREATE POLICY "auth_update_att" ON attendance FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_att" ON attendance;
CREATE POLICY "auth_delete_att" ON attendance FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 6. PAYROLL
-- ============================================================

CREATE TABLE IF NOT EXISTS payroll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  pay_period_month integer NOT NULL CHECK (pay_period_month BETWEEN 1 AND 12),
  pay_period_year integer NOT NULL,
  basic_salary numeric(15,2) NOT NULL DEFAULT 0,
  allowances numeric(15,2) DEFAULT 0,
  deductions numeric(15,2) DEFAULT 0,
  net_salary numeric(15,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  paid_at timestamptz,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_emp_period ON payroll(company_id, employee_id, pay_period_month, pay_period_year);
CREATE INDEX IF NOT EXISTS idx_payroll_period ON payroll(pay_period_year, pay_period_month);

ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_payroll" ON payroll;
CREATE POLICY "auth_select_payroll" ON payroll FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_payroll" ON payroll;
CREATE POLICY "auth_insert_payroll" ON payroll FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_payroll" ON payroll;
CREATE POLICY "auth_update_payroll" ON payroll FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_payroll" ON payroll;
CREATE POLICY "auth_delete_payroll" ON payroll FOR DELETE TO authenticated USING (true);

-- ============================================================
-- TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS set_updated_at ON inventory_transfers;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON inventory_transfers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON inventory_adjustments;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON inventory_adjustments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON pharmacy_purchases;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON pharmacy_purchases FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON pharmacy_returns;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON pharmacy_returns FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON attendance;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON attendance FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON payroll;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON payroll FOR EACH ROW EXECUTE FUNCTION set_updated_at();
