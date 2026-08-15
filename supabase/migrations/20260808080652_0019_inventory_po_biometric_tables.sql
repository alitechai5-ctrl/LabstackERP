/*
# Create inventory PO/GRN/Issue tables and biometric machine config

1. New Tables
- `purchase_orders` — PO header with supplier, status, totals
- `purchase_order_items` — line items per PO
- `goods_receipt_notes` — GRN header linked to PO
- `goods_receipt_items` — line items per GRN
- `inventory_issues` — issue header (department/recipient)
- `inventory_issue_items` — line items per issue
- `biometric_machines` — machine config (IP, port, model, active)

2. Security
- RLS enabled on all tables with company-scoped CRUD for authenticated users.
*/

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  po_number text NOT NULL,
  po_date date NOT NULL DEFAULT CURRENT_DATE,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','partial','received','cancelled')),
  total_amount numeric NOT NULL DEFAULT 0,
  received_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_po_company ON purchase_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_purchase_orders" ON purchase_orders;
CREATE POLICY "select_purchase_orders" ON purchase_orders FOR SELECT TO authenticated USING (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = purchase_orders.company_id));
DROP POLICY IF EXISTS "insert_purchase_orders" ON purchase_orders;
CREATE POLICY "insert_purchase_orders" ON purchase_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = purchase_orders.company_id));
DROP POLICY IF EXISTS "update_purchase_orders" ON purchase_orders;
CREATE POLICY "update_purchase_orders" ON purchase_orders FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = purchase_orders.company_id)) WITH CHECK (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = purchase_orders.company_id));
DROP POLICY IF EXISTS "delete_purchase_orders" ON purchase_orders;
CREATE POLICY "delete_purchase_orders" ON purchase_orders FOR DELETE TO authenticated USING (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = purchase_orders.company_id));

-- Purchase Order Items
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 1,
  unit_cost numeric NOT NULL DEFAULT 0,
  received_qty numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_purchase_order_items" ON purchase_order_items;
CREATE POLICY "select_purchase_order_items" ON purchase_order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM purchase_orders WHERE id = purchase_order_items.po_id AND auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = purchase_orders.company_id)));
DROP POLICY IF EXISTS "insert_purchase_order_items" ON purchase_order_items;
CREATE POLICY "insert_purchase_order_items" ON purchase_order_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM purchase_orders WHERE id = purchase_order_items.po_id AND auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = purchase_orders.company_id)));
DROP POLICY IF EXISTS "update_purchase_order_items" ON purchase_order_items;
CREATE POLICY "update_purchase_order_items" ON purchase_order_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM purchase_orders WHERE id = purchase_order_items.po_id AND auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = purchase_orders.company_id)));
DROP POLICY IF EXISTS "delete_purchase_order_items" ON purchase_order_items;
CREATE POLICY "delete_purchase_order_items" ON purchase_order_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM purchase_orders WHERE id = purchase_order_items.po_id AND auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = purchase_orders.company_id)));

-- Goods Receipt Notes
CREATE TABLE IF NOT EXISTS goods_receipt_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  grn_number text NOT NULL,
  grn_date date NOT NULL DEFAULT CURRENT_DATE,
  po_id uuid REFERENCES purchase_orders(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','cancelled')),
  total_amount numeric NOT NULL DEFAULT 0,
  notes text,
  received_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_grn_company ON goods_receipt_notes(company_id);
CREATE INDEX IF NOT EXISTS idx_grn_po ON goods_receipt_notes(po_id);
ALTER TABLE goods_receipt_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_goods_receipt_notes" ON goods_receipt_notes;
CREATE POLICY "select_goods_receipt_notes" ON goods_receipt_notes FOR SELECT TO authenticated USING (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = goods_receipt_notes.company_id));
DROP POLICY IF EXISTS "insert_goods_receipt_notes" ON goods_receipt_notes;
CREATE POLICY "insert_goods_receipt_notes" ON goods_receipt_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = goods_receipt_notes.company_id));
DROP POLICY IF EXISTS "update_goods_receipt_notes" ON goods_receipt_notes;
CREATE POLICY "update_goods_receipt_notes" ON goods_receipt_notes FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = goods_receipt_notes.company_id)) WITH CHECK (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = goods_receipt_notes.company_id));
DROP POLICY IF EXISTS "delete_goods_receipt_notes" ON goods_receipt_notes;
CREATE POLICY "delete_goods_receipt_notes" ON goods_receipt_notes FOR DELETE TO authenticated USING (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = goods_receipt_notes.company_id));

-- Goods Receipt Items
CREATE TABLE IF NOT EXISTS goods_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id uuid NOT NULL REFERENCES goods_receipt_notes(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  po_item_id uuid REFERENCES purchase_order_items(id) ON DELETE SET NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_cost numeric NOT NULL DEFAULT 0,
  batch_number text,
  expiry_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_grn_items_grn ON goods_receipt_items(grn_id);
ALTER TABLE goods_receipt_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_goods_receipt_items" ON goods_receipt_items;
CREATE POLICY "select_goods_receipt_items" ON goods_receipt_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM goods_receipt_notes WHERE id = goods_receipt_items.grn_id AND auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = goods_receipt_notes.company_id)));
DROP POLICY IF EXISTS "insert_goods_receipt_items" ON goods_receipt_items;
CREATE POLICY "insert_goods_receipt_items" ON goods_receipt_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM goods_receipt_notes WHERE id = goods_receipt_items.grn_id AND auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = goods_receipt_notes.company_id)));
DROP POLICY IF EXISTS "update_goods_receipt_items" ON goods_receipt_items;
CREATE POLICY "update_goods_receipt_items" ON goods_receipt_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM goods_receipt_notes WHERE id = goods_receipt_items.grn_id AND auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = goods_receipt_notes.company_id)));
DROP POLICY IF EXISTS "delete_goods_receipt_items" ON goods_receipt_items;
CREATE POLICY "delete_goods_receipt_items" ON goods_receipt_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM goods_receipt_notes WHERE id = goods_receipt_items.grn_id AND auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = goods_receipt_notes.company_id)));

-- Inventory Issues
CREATE TABLE IF NOT EXISTS inventory_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  issue_number text NOT NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  issued_to text,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','returned','cancelled')),
  notes text,
  issued_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_issues_company ON inventory_issues(company_id);
ALTER TABLE inventory_issues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_inventory_issues" ON inventory_issues;
CREATE POLICY "select_inventory_issues" ON inventory_issues FOR SELECT TO authenticated USING (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = inventory_issues.company_id));
DROP POLICY IF EXISTS "insert_inventory_issues" ON inventory_issues;
CREATE POLICY "insert_inventory_issues" ON inventory_issues FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = inventory_issues.company_id));
DROP POLICY IF EXISTS "update_inventory_issues" ON inventory_issues;
CREATE POLICY "update_inventory_issues" ON inventory_issues FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = inventory_issues.company_id)) WITH CHECK (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = inventory_issues.company_id));
DROP POLICY IF EXISTS "delete_inventory_issues" ON inventory_issues;
CREATE POLICY "delete_inventory_issues" ON inventory_issues FOR DELETE TO authenticated USING (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = inventory_issues.company_id));

-- Inventory Issue Items
CREATE TABLE IF NOT EXISTS inventory_issue_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES inventory_issues(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_issue_items_issue ON inventory_issue_items(issue_id);
ALTER TABLE inventory_issue_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_inventory_issue_items" ON inventory_issue_items;
CREATE POLICY "select_inventory_issue_items" ON inventory_issue_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM inventory_issues WHERE id = inventory_issue_items.issue_id AND auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = inventory_issues.company_id)));
DROP POLICY IF EXISTS "insert_inventory_issue_items" ON inventory_issue_items;
CREATE POLICY "insert_inventory_issue_items" ON inventory_issue_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM inventory_issues WHERE id = inventory_issue_items.issue_id AND auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = inventory_issues.company_id)));
DROP POLICY IF EXISTS "update_inventory_issue_items" ON inventory_issue_items;
CREATE POLICY "update_inventory_issue_items" ON inventory_issue_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM inventory_issues WHERE id = inventory_issue_items.issue_id AND auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = inventory_issues.company_id)));
DROP POLICY IF EXISTS "delete_inventory_issue_items" ON inventory_issue_items;
CREATE POLICY "delete_inventory_issue_items" ON inventory_issue_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM inventory_issues WHERE id = inventory_issue_items.issue_id AND auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = inventory_issues.company_id)));

-- Biometric Machines
CREATE TABLE IF NOT EXISTS biometric_machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  name text NOT NULL,
  ip_address text NOT NULL,
  port integer NOT NULL DEFAULT 4370,
  model text,
  location text,
  is_active boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_log text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_biometric_company ON biometric_machines(company_id);
ALTER TABLE biometric_machines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_biometric_machines" ON biometric_machines;
CREATE POLICY "select_biometric_machines" ON biometric_machines FOR SELECT TO authenticated USING (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = biometric_machines.company_id));
DROP POLICY IF EXISTS "insert_biometric_machines" ON biometric_machines;
CREATE POLICY "insert_biometric_machines" ON biometric_machines FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = biometric_machines.company_id));
DROP POLICY IF EXISTS "update_biometric_machines" ON biometric_machines;
CREATE POLICY "update_biometric_machines" ON biometric_machines FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = biometric_machines.company_id)) WITH CHECK (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = biometric_machines.company_id));
DROP POLICY IF EXISTS "delete_biometric_machines" ON biometric_machines;
CREATE POLICY "delete_biometric_machines" ON biometric_machines FOR DELETE TO authenticated USING (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = biometric_machines.company_id));
