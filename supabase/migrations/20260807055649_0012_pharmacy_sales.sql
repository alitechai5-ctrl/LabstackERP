/*
# Pharmacy Sales (POS) Tables

1. New Tables
- `pharmacy_sales`: header record for a point-of-sale transaction (sale number, date, customer info, totals, payment mode/status). Mirrors the structure of `pharmacy_purchases`.
- `pharmacy_sale_items`: line items for each sale (item_id, quantity, unit_price, discount, line_total). One sale has many items.

2. Security
- RLS enabled on both tables.
- CRUD policies for `authenticated` role (the app has a sign-in screen, so all policies are `TO authenticated`).
- Policies use `USING (true)` / `WITH CHECK (true)` because access is controlled by the app's role/permission system, not per-row ownership.

3. Indexes
- Unique index on `(company_id, sale_number)` for pharmacy_sales.
- Index on `sale_date` for date-range queries.
- Index on `pharmacy_sale_items.sale_id` for join performance.

4. Triggers
- `set_updated_at` trigger on both tables.
*/

CREATE TABLE IF NOT EXISTS pharmacy_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  sale_number text NOT NULL,
  sale_date timestamptz NOT NULL DEFAULT now(),
  patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
  customer_name text,
  customer_phone text,
  subtotal numeric(15,2) NOT NULL DEFAULT 0,
  discount_amount numeric(15,2) NOT NULL DEFAULT 0,
  tax_amount numeric(15,2) NOT NULL DEFAULT 0,
  net_amount numeric(15,2) NOT NULL DEFAULT 0,
  paid_amount numeric(15,2) NOT NULL DEFAULT 0,
  payment_mode text NOT NULL DEFAULT 'cash' CHECK (payment_mode IN ('cash','card','mobile','credit')),
  payment_status text NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('unpaid','partial','paid')),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pharm_sale_number ON pharmacy_sales(company_id, sale_number);
CREATE INDEX IF NOT EXISTS idx_pharm_sale_date ON pharmacy_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_pharm_sale_patient ON pharmacy_sales(patient_id);

ALTER TABLE pharmacy_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_pharm_sale" ON pharmacy_sales;
CREATE POLICY "auth_select_pharm_sale" ON pharmacy_sales FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_pharm_sale" ON pharmacy_sales;
CREATE POLICY "auth_insert_pharm_sale" ON pharmacy_sales FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_pharm_sale" ON pharmacy_sales;
CREATE POLICY "auth_update_pharm_sale" ON pharmacy_sales FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_pharm_sale" ON pharmacy_sales;
CREATE POLICY "auth_delete_pharm_sale" ON pharmacy_sales FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS pharmacy_sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES pharmacy_sales(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  item_name text NOT NULL,
  quantity numeric(15,2) NOT NULL DEFAULT 1,
  unit_price numeric(15,2) NOT NULL DEFAULT 0,
  discount_amount numeric(15,2) NOT NULL DEFAULT 0,
  line_total numeric(15,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharm_sale_items_sale ON pharmacy_sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_pharm_sale_items_item ON pharmacy_sale_items(item_id);

ALTER TABLE pharmacy_sale_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_pharm_sale_items" ON pharmacy_sale_items;
CREATE POLICY "auth_select_pharm_sale_items" ON pharmacy_sale_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_pharm_sale_items" ON pharmacy_sale_items;
CREATE POLICY "auth_insert_pharm_sale_items" ON pharmacy_sale_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_pharm_sale_items" ON pharmacy_sale_items;
CREATE POLICY "auth_update_pharm_sale_items" ON pharmacy_sale_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_pharm_sale_items" ON pharmacy_sale_items;
CREATE POLICY "auth_delete_pharm_sale_items" ON pharmacy_sale_items FOR DELETE TO authenticated USING (true);

DROP TRIGGER IF EXISTS set_updated_at ON pharmacy_sales;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON pharmacy_sales FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON pharmacy_sale_items;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON pharmacy_sale_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
