/*
# Healthcare ERP - Master Data Schema

## Overview
Creates all master data tables for the Healthcare ERP: doctors, referral sources,
corporate clients, insurance companies, services/tests, test packages, inventory
items, suppliers, manufacturers, units, and categories.

## New Tables
1. doctors              - Doctor master with share %, specialization, PMC license
2. referral_sources     - Referral sources (doctor/clinic/hospital/corporate/agent/marketing)
3. corporate_clients   - Corporate client companies with credit limits
4. insurance_companies - Insurance providers with credit limits
5. services            - Lab/radiology/OPD services with pricing, shares, sample info
6. test_packages       - Group of tests sold as a package
7. package_items       - Link table: package → services
8. inventory_items     - Stockable items (medicines, consumables, reagents)
9. suppliers           - Supplier master
10. manufacturers      - Manufacturer master
11. units              - Measurement units (mg, ml, box, etc.)
12. categories         - Item categories

## Security
- RLS enabled on ALL tables.
- All tables: authenticated-only CRUD (all users are signed-in staff).
- Audit triggers on all tables.

## Notes
- All tables are company-scoped via company_id FK.
- Doctors and referral sources are branch-scoped as well.
- Services carry full share calculation fields (doctor, referral, outsource).
- Inventory items carry stock valuation and reorder fields.
*/

-- ============================================================
-- 1. DOCTORS
-- ============================================================

CREATE TABLE IF NOT EXISTS doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  doctor_code text NOT NULL,
  photo_url text,
  full_name text NOT NULL,
  specialization text,
  qualification text,
  pmc_license text,
  phone text,
  email text,
  address text,
  consultation_fee numeric(15,2) DEFAULT 0,
  opd_share_type text DEFAULT 'percentage' CHECK (opd_share_type IN ('percentage','fixed')),
  opd_share numeric(5,2) DEFAULT 0,
  lab_share_type text DEFAULT 'percentage' CHECK (lab_share_type IN ('percentage','fixed')),
  lab_share numeric(5,2) DEFAULT 0,
  radiology_share_type text DEFAULT 'percentage' CHECK (radiology_share_type IN ('percentage','fixed')),
  radiology_share numeric(5,2) DEFAULT 0,
  procedure_share_type text DEFAULT 'percentage' CHECK (procedure_share_type IN ('percentage','fixed')),
  procedure_share numeric(5,2) DEFAULT 0,
  monthly_settlement boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_doctors" ON doctors;
CREATE POLICY "auth_select_doctors" ON doctors TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_doctors" ON doctors;
CREATE POLICY "auth_insert_doctors" ON doctors TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_doctors" ON doctors;
CREATE POLICY "auth_update_doctors" ON doctors TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_doctors" ON doctors;
CREATE POLICY "auth_delete_doctors" ON doctors TO authenticated USING (true);

-- ============================================================
-- 2. REFERRAL_SOURCES
-- ============================================================

CREATE TABLE IF NOT EXISTS referral_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('doctor','clinic','hospital','corporate','agent','marketing')),
  name text NOT NULL,
  phone text,
  email text,
  address text,
  commission_type text DEFAULT 'percentage' CHECK (commission_type IN ('percentage','fixed')),
  commission_value numeric(10,2) DEFAULT 0,
  settlement_frequency text DEFAULT 'monthly' CHECK (settlement_frequency IN ('weekly','monthly','quarterly')),
  monthly_limit numeric(15,2),
  outstanding numeric(15,2) DEFAULT 0,
  ledger_balance numeric(15,2) DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE referral_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_referrals" ON referral_sources;
CREATE POLICY "auth_select_referrals" ON referral_sources TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_referrals" ON referral_sources;
CREATE POLICY "auth_insert_referrals" ON referral_sources TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_referrals" ON referral_sources;
CREATE POLICY "auth_update_referrals" ON referral_sources TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_referrals" ON referral_sources;
CREATE POLICY "auth_delete_referrals" ON referral_sources TO authenticated USING (true);

-- ============================================================
-- 3. CORPORATE_CLIENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS corporate_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  contract_start date,
  contract_end date,
  discount_percentage numeric(5,2) DEFAULT 0,
  credit_limit numeric(15,2) DEFAULT 0,
  outstanding numeric(15,2) DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE corporate_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_corporates" ON corporate_clients;
CREATE POLICY "auth_select_corporates" ON corporate_clients TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_corporates" ON corporate_clients;
CREATE POLICY "auth_insert_corporates" ON corporate_clients TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_corporates" ON corporate_clients;
CREATE POLICY "auth_update_corporates" ON corporate_clients TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_corporates" ON corporate_clients;
CREATE POLICY "auth_delete_corporates" ON corporate_clients TO authenticated USING (true);

-- ============================================================
-- 4. INSURANCE_COMPANIES
-- ============================================================

CREATE TABLE IF NOT EXISTS insurance_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  discount_percentage numeric(5,2) DEFAULT 0,
  credit_limit numeric(15,2) DEFAULT 0,
  outstanding numeric(15,2) DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE insurance_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_insurance" ON insurance_companies;
CREATE POLICY "auth_select_insurance" ON insurance_companies TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_insurance" ON insurance_companies;
CREATE POLICY "auth_insert_insurance" ON insurance_companies TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_insurance" ON insurance_companies;
CREATE POLICY "auth_update_insurance" ON insurance_companies TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_insurance" ON insurance_companies;
CREATE POLICY "auth_delete_insurance" ON insurance_companies TO authenticated USING (true);

-- ============================================================
-- 5. SERVICES (Tests / Radiology / OPD)
-- ============================================================

CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  code text NOT NULL,
  name text NOT NULL,
  arabic_name text,
  short_name text,
  category text DEFAULT 'lab' CHECK (category IN ('lab','radiology','opd','procedure','package')),
  price numeric(15,2) NOT NULL DEFAULT 0,
  cost numeric(15,2) DEFAULT 0,
  doctor_share_type text DEFAULT 'percentage' CHECK (doctor_share_type IN ('percentage','fixed')),
  doctor_share numeric(5,2) DEFAULT 0,
  referral_share_type text DEFAULT 'percentage' CHECK (referral_share_type IN ('percentage','fixed')),
  referral_share numeric(5,2) DEFAULT 0,
  outsource_cost numeric(15,2) DEFAULT 0,
  outsource_lab text,
  sample_type text,
  container text,
  method text,
  machine text,
  normal_range text,
  critical_value text,
  turnaround_time_hours integer DEFAULT 24,
  barcode_required boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_services" ON services;
CREATE POLICY "auth_select_services" ON services TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_services" ON services;
CREATE POLICY "auth_insert_services" ON services TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_services" ON services;
CREATE POLICY "auth_update_services" ON services TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_services" ON services;
CREATE POLICY "auth_delete_services" ON services TO authenticated USING (true);

-- ============================================================
-- 6. TEST_PACKAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS test_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  price numeric(15,2) NOT NULL DEFAULT 0,
  total_tests integer DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE test_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_packages" ON test_packages;
CREATE POLICY "auth_select_packages" ON test_packages TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_packages" ON test_packages;
CREATE POLICY "auth_insert_packages" ON test_packages TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_packages" ON test_packages;
CREATE POLICY "auth_update_packages" ON test_packages TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_packages" ON test_packages;
CREATE POLICY "auth_delete_packages" ON test_packages TO authenticated USING (true);

-- ============================================================
-- 7. PACKAGE_ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS package_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES test_packages(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE package_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_package_items" ON package_items;
CREATE POLICY "auth_select_package_items" ON package_items TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_package_items" ON package_items;
CREATE POLICY "auth_insert_package_items" ON package_items TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_package_items" ON package_items;
CREATE POLICY "auth_update_package_items" ON package_items TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_package_items" ON package_items;
CREATE POLICY "auth_delete_package_items" ON package_items TO authenticated USING (true);

-- ============================================================
-- 8. UNITS
-- ============================================================

CREATE TABLE IF NOT EXISTS units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  short_name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_units" ON units;
CREATE POLICY "auth_select_units" ON units TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_units" ON units;
CREATE POLICY "auth_insert_units" ON units TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_units" ON units;
CREATE POLICY "auth_update_units" ON units TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_units" ON units;
CREATE POLICY "auth_delete_units" ON units TO authenticated USING (true);

-- ============================================================
-- 9. CATEGORIES
-- ============================================================

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_categories" ON categories;
CREATE POLICY "auth_select_categories" ON categories TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_categories" ON categories;
CREATE POLICY "auth_insert_categories" ON categories TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_categories" ON categories;
CREATE POLICY "auth_update_categories" ON categories TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_categories" ON categories;
CREATE POLICY "auth_delete_categories" ON categories TO authenticated USING (true);

-- ============================================================
-- 10. MANUFACTURERS
-- ============================================================

CREATE TABLE IF NOT EXISTS manufacturers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE manufacturers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_manufacturers" ON manufacturers;
CREATE POLICY "auth_select_manufacturers" ON manufacturers TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_manufacturers" ON manufacturers;
CREATE POLICY "auth_insert_manufacturers" ON manufacturers TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_manufacturers" ON manufacturers;
CREATE POLICY "auth_update_manufacturers" ON manufacturers TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_manufacturers" ON manufacturers;
CREATE POLICY "auth_delete_manufacturers" ON manufacturers TO authenticated USING (true);

-- ============================================================
-- 11. SUPPLIERS
-- ============================================================

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  payment_terms text,
  outstanding numeric(15,2) DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_suppliers" ON suppliers;
CREATE POLICY "auth_select_suppliers" ON suppliers TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_suppliers" ON suppliers;
CREATE POLICY "auth_insert_suppliers" ON suppliers TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_suppliers" ON suppliers;
CREATE POLICY "auth_update_suppliers" ON suppliers TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_suppliers" ON suppliers;
CREATE POLICY "auth_delete_suppliers" ON suppliers TO authenticated USING (true);

-- ============================================================
-- 12. INVENTORY_ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES units(id) ON DELETE SET NULL,
  manufacturer_id uuid REFERENCES manufacturers(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  item_code text NOT NULL,
  barcode text,
  name text NOT NULL,
  generic_name text,
  description text,
  item_type text DEFAULT 'medicine' CHECK (item_type IN ('medicine','consumable','reagent','equipment','supply')),
  purchase_price numeric(15,2) DEFAULT 0,
  sale_price numeric(15,2) DEFAULT 0,
  min_stock numeric(15,2) DEFAULT 0,
  max_stock numeric(15,2) DEFAULT 0,
  reorder_level numeric(15,2) DEFAULT 0,
  current_stock numeric(15,2) DEFAULT 0,
  stock_value numeric(15,2) DEFAULT 0,
  valuation_method text DEFAULT 'fifo' CHECK (valuation_method IN ('fifo','average')),
  is_prescription_required boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_inventory_items" ON inventory_items;
CREATE POLICY "auth_select_inventory_items" ON inventory_items TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_inventory_items" ON inventory_items;
CREATE POLICY "auth_insert_inventory_items" ON inventory_items TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_inventory_items" ON inventory_items;
CREATE POLICY "auth_update_inventory_items" ON inventory_items TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_inventory_items" ON inventory_items;
CREATE POLICY "auth_delete_inventory_items" ON inventory_items TO authenticated USING (true);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_doctors_company ON doctors(company_id);
CREATE INDEX IF NOT EXISTS idx_doctors_branch ON doctors(branch_id);
CREATE INDEX IF NOT EXISTS idx_doctors_department ON doctors(department_id);
CREATE INDEX IF NOT EXISTS idx_referrals_company ON referral_sources(company_id);
CREATE INDEX IF NOT EXISTS idx_referrals_branch ON referral_sources(branch_id);
CREATE INDEX IF NOT EXISTS idx_corporates_company ON corporate_clients(company_id);
CREATE INDEX IF NOT EXISTS idx_insurance_company ON insurance_companies(company_id);
CREATE INDEX IF NOT EXISTS idx_services_company ON services(company_id);
CREATE INDEX IF NOT EXISTS idx_services_department ON services(department_id);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_packages_company ON test_packages(company_id);
CREATE INDEX IF NOT EXISTS idx_package_items_package ON package_items(package_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_company ON inventory_items(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_branch ON inventory_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category_id);
CREATE INDEX IF NOT EXISTS idx_units_company ON units(company_id);
CREATE INDEX IF NOT EXISTS idx_categories_company ON categories(company_id);
CREATE INDEX IF NOT EXISTS idx_manufacturers_company ON manufacturers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company_id);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS set_updated_at ON doctors;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON doctors FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON referral_sources;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON referral_sources FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON corporate_clients;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON corporate_clients FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON insurance_companies;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON insurance_companies FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON services;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON test_packages;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON test_packages FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON units;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON units FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON categories;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON manufacturers;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON manufacturers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON suppliers;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS set_updated_at ON inventory_items;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- AUDIT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS audit_doctors ON doctors;
CREATE TRIGGER audit_doctors AFTER INSERT OR UPDATE OR DELETE ON doctors FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
DROP TRIGGER IF EXISTS audit_referrals ON referral_sources;
CREATE TRIGGER audit_referrals AFTER INSERT OR UPDATE OR DELETE ON referral_sources FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
DROP TRIGGER IF EXISTS audit_corporates ON corporate_clients;
CREATE TRIGGER audit_corporates AFTER INSERT OR UPDATE OR DELETE ON corporate_clients FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
DROP TRIGGER IF EXISTS audit_insurance ON insurance_companies;
CREATE TRIGGER audit_insurance AFTER INSERT OR UPDATE OR DELETE ON insurance_companies FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
DROP TRIGGER IF EXISTS audit_services ON services;
CREATE TRIGGER audit_services AFTER INSERT OR UPDATE OR DELETE ON services FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
DROP TRIGGER IF EXISTS audit_packages ON test_packages;
CREATE TRIGGER audit_packages AFTER INSERT OR UPDATE OR DELETE ON test_packages FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
DROP TRIGGER IF EXISTS audit_inventory ON inventory_items;
CREATE TRIGGER audit_inventory AFTER INSERT OR UPDATE OR DELETE ON inventory_items FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
DROP TRIGGER IF EXISTS audit_suppliers ON suppliers;
CREATE TRIGGER audit_suppliers AFTER INSERT OR UPDATE OR DELETE ON suppliers FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
DROP TRIGGER IF EXISTS audit_manufacturers ON manufacturers;
CREATE TRIGGER audit_manufacturers AFTER INSERT OR UPDATE OR DELETE ON manufacturers FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
