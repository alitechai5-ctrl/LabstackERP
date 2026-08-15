/*
# Add lab payment transaction ledger

1. Purpose
- Record every payment collected against a laboratory invoice as its own transaction.
- Support separate cash, online, and card reporting, including split payments over time.
- Keep the existing lab_orders paid_amount and payment_status summary fields for fast invoice display.

2. New Tables
- `lab_order_payments`
- `id` (uuid, primary key)
- `company_id` (uuid, required, linked to companies)
- `branch_id` (uuid, optional, linked to branches)
- `lab_order_id` (uuid, required, linked to lab_orders)
- `amount` (numeric, required, positive payment amount)
- `payment_method` (text: cash, online, or card)
- `transaction_reference` (text, optional reference for online/card payments)
- `received_at` (timestamptz, payment collection time)
- `received_by` (uuid, optional app user who collected it)
- `notes` (text, optional)
- `created_at` (timestamptz)

3. Modified Tables
- No existing data is deleted or changed.
- Existing `lab_orders.paid_amount` and `lab_orders.payment_status` remain as invoice summaries.

4. Security
- Row-level security is enabled on `lab_order_payments`.
- Authenticated staff can read, create, update, and delete payment transactions, matching the existing authenticated reception workflow.

5. Reporting
- Indexes support invoice, company, payment method, and collection-date reporting.
- Existing payment history is not backfilled because the old invoice summary did not preserve payment method or collection events.
*/

CREATE TABLE IF NOT EXISTS lab_order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  lab_order_id uuid NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'online', 'card')),
  transaction_reference text,
  received_at timestamptz NOT NULL DEFAULT now(),
  received_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_order_payments_order ON lab_order_payments(lab_order_id);
CREATE INDEX IF NOT EXISTS idx_lab_order_payments_company ON lab_order_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_lab_order_payments_method ON lab_order_payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_lab_order_payments_received_at ON lab_order_payments(received_at);

ALTER TABLE lab_order_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_lab_order_payments" ON lab_order_payments;
CREATE POLICY "auth_select_lab_order_payments" ON lab_order_payments FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_lab_order_payments" ON lab_order_payments;
CREATE POLICY "auth_insert_lab_order_payments" ON lab_order_payments FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_lab_order_payments" ON lab_order_payments;
CREATE POLICY "auth_update_lab_order_payments" ON lab_order_payments FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_lab_order_payments" ON lab_order_payments;
CREATE POLICY "auth_delete_lab_order_payments" ON lab_order_payments FOR DELETE
  TO authenticated USING (true);
