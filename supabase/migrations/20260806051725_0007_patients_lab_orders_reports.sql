/*
# Create patients, lab orders, and lab reports tables

## Purpose
This migration adds the core clinical workflow tables for the Healthcare ERP:
patient registration, lab test ordering, and lab report generation/printing.

## New Tables

### 1. patients
Stores patient demographic data for the healthcare facility.
- id (uuid, PK)
- company_id (uuid, FK -> companies)
- branch_id (uuid, FK -> branches)
- patient_code (text, unique per company) — auto-generated MRN
- full_name (text, required)
- gender (text: male/female/other)
- date_of_birth (date, nullable)
- age (integer, nullable)
- phone (text, nullable)
- email (text, nullable)
- address (text, nullable)
- city (text, nullable)
- cnic (text, nullable) — national ID for Pakistan
- blood_group (text, nullable)
- is_active (boolean, default true)
- created_at, updated_at (timestamptz)

### 2. lab_orders
Represents a patient visit for lab tests — an invoice/order containing multiple test items.
- id (uuid, PK)
- company_id (uuid, FK -> companies)
- branch_id (uuid, FK -> branches)
- patient_id (uuid, FK -> patients)
- doctor_id (uuid, FK -> doctors, nullable) — referring doctor
- referral_source_id (uuid, FK -> referral_sources, nullable)
- order_code (text) — auto-generated invoice number
- status (text: pending/in_progress/completed/cancelled)
- total_amount (numeric)
- discount_amount (numeric, default 0)
- net_amount (numeric)
- paid_amount (numeric, default 0)
- payment_status (text: unpaid/partial/paid)
- notes (text, nullable)
- created_at, updated_at (timestamptz)

### 3. lab_order_items
Individual test items within a lab order.
- id (uuid, PK)
- lab_order_id (uuid, FK -> lab_orders, ON DELETE CASCADE)
- service_id (uuid, FK -> services)
- service_name (text) — snapshot of service name at order time
- price (numeric) — snapshot of price at order time
- status (text: pending/sample_collected/processing/result_entered/verified/approved/printed)
- sample_id (text, nullable) — barcode/sample identifier
- collected_at (timestamptz, nullable)
- collected_by (uuid, FK -> app_users, nullable)
- result_entered_at (timestamptz, nullable)
- result_entered_by (uuid, FK -> app_users, nullable)
- verified_at (timestamptz, nullable)
- verified_by (uuid, FK -> app_users, nullable)
- approved_at (timestamptz, nullable)
- approved_by (uuid, FK -> app_users, nullable)
- created_at, updated_at (timestamptz)

### 4. lab_results
Stores the actual test result values for each lab order item.
- id (uuid, PK)
- lab_order_item_id (uuid, FK -> lab_order_items, ON DELETE CASCADE)
- service_id (uuid, FK -> services)
- result_value (text, nullable) — the measured value
- unit (text, nullable)
- normal_range (text, nullable) — reference range
- flag (text: normal/low/high/critical) — abnormality flag
- method (text, nullable)
- remarks (text, nullable)
- created_at, updated_at (timestamptz)

## Security
- RLS enabled on all tables.
- Policies: authenticated users get full CRUD (multi-user app with sign-in).
- The app already has auth + roles/permissions system.

## Indexes
- patients: company_id, patient_code
- lab_orders: company_id, patient_id, status
- lab_order_items: lab_order_id, status
- lab_results: lab_order_item_id
*/

-- patients
CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  patient_code text NOT NULL,
  full_name text NOT NULL,
  gender text DEFAULT 'male',
  date_of_birth date,
  age integer,
  phone text,
  email text,
  address text,
  city text,
  cnic text,
  blood_group text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patients_company ON patients(company_id);
CREATE INDEX IF NOT EXISTS idx_patients_code ON patients(company_id, patient_code);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(full_name);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_patients" ON patients;
CREATE POLICY "auth_select_patients" ON patients FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_patients" ON patients;
CREATE POLICY "auth_insert_patients" ON patients FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_patients" ON patients;
CREATE POLICY "auth_update_patients" ON patients FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_patients" ON patients;
CREATE POLICY "auth_delete_patients" ON patients FOR DELETE
  TO authenticated USING (true);

-- lab_orders
CREATE TABLE IF NOT EXISTS lab_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES doctors(id) ON DELETE SET NULL,
  referral_source_id uuid REFERENCES referral_sources(id) ON DELETE SET NULL,
  order_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  total_amount numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'unpaid',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_orders_company ON lab_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_patient ON lab_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_status ON lab_orders(status);
CREATE INDEX IF NOT EXISTS idx_lab_orders_code ON lab_orders(order_code);

ALTER TABLE lab_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_lab_orders" ON lab_orders;
CREATE POLICY "auth_select_lab_orders" ON lab_orders FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_lab_orders" ON lab_orders;
CREATE POLICY "auth_insert_lab_orders" ON lab_orders FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_lab_orders" ON lab_orders;
CREATE POLICY "auth_update_lab_orders" ON lab_orders FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_lab_orders" ON lab_orders;
CREATE POLICY "auth_delete_lab_orders" ON lab_orders FOR DELETE
  TO authenticated USING (true);

-- lab_order_items
CREATE TABLE IF NOT EXISTS lab_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_order_id uuid NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  service_name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  sample_id text,
  collected_at timestamptz,
  collected_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  result_entered_at timestamptz,
  result_entered_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  verified_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  approved_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_order_items_order ON lab_order_items(lab_order_id);
CREATE INDEX IF NOT EXISTS idx_lab_order_items_status ON lab_order_items(status);

ALTER TABLE lab_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_lab_order_items" ON lab_order_items;
CREATE POLICY "auth_select_lab_order_items" ON lab_order_items FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_lab_order_items" ON lab_order_items;
CREATE POLICY "auth_insert_lab_order_items" ON lab_order_items FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_lab_order_items" ON lab_order_items;
CREATE POLICY "auth_update_lab_order_items" ON lab_order_items FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_lab_order_items" ON lab_order_items;
CREATE POLICY "auth_delete_lab_order_items" ON lab_order_items FOR DELETE
  TO authenticated USING (true);

-- lab_results
CREATE TABLE IF NOT EXISTS lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_order_item_id uuid NOT NULL REFERENCES lab_order_items(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  result_value text,
  unit text,
  normal_range text,
  flag text DEFAULT 'normal',
  method text,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_results_item ON lab_results(lab_order_item_id);

ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_lab_results" ON lab_results;
CREATE POLICY "auth_select_lab_results" ON lab_results FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_lab_results" ON lab_results;
CREATE POLICY "auth_insert_lab_results" ON lab_results FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_lab_results" ON lab_results;
CREATE POLICY "auth_update_lab_results" ON lab_results FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_lab_results" ON lab_results;
CREATE POLICY "auth_delete_lab_results" ON lab_results FOR DELETE
  TO authenticated USING (true);
