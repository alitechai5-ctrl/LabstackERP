/*
# Healthcare ERP - Foundation Schema

## Overview
Creates the foundational database schema for the Healthcare ERP (Diagnostic Lab + OPD + Pharmacy).
This migration establishes core tables for system initialization, authentication, master data,
and audit logging.

## New Tables
1. system_status     - Singleton tracking setup completion (readable by anon for pre-login check)
2. companies         - Organization info (name, address, currency, tax)
3. branches          - Branch offices per company
4. departments       - Departments per branch (lab, radiology, pharmacy, OPD, admin)
5. designations      - Job titles per company
6. roles             - System roles (super_admin, admin, doctor, pathologist, etc.)
7. permissions       - Granular module+action permissions (~90 entries across 14 modules)
8. role_permissions  - Many-to-many role ↔ permission mapping
9. employees        - Employee records (HRM link)
10. app_users        - Application users linked to auth.users, roles, branches
11. chart_of_accounts- Hierarchical accounting COA (asset/liability/equity/revenue/expense)
12. financial_years  - Financial year periods per company
13. system_settings  - Key-value settings store (inventory, OPD, lab, pharmacy, accounting)
14. audit_logs       - Audit trail for data changes via triggers

## Security
- RLS enabled on ALL tables.
- system_status + system_settings: anon can SELECT (needed to check setup state before login).
- All other tables: authenticated-only CRUD (all users are signed-in staff).
- Role-based menu/module/action restrictions enforced at the application layer.
- Audit logging via database triggers on key tables.

## Notes
- gen_random_uuid() used for all PKs (built-in in Postgres 13+).
- updated_at auto-maintained by trigger on every table that has the column.
- Idempotent: uses IF NOT EXISTS / DROP ... IF EXISTS throughout.
*/

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_record_id text;
  v_old jsonb;
  v_new jsonb;
  v_action text;
BEGIN
  v_user_id := auth.uid();

  IF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_old := to_jsonb(OLD);
    v_record_id := (OLD).id::text;
    v_new := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := (NEW).id::text;
  ELSIF TG_OP = 'INSERT' THEN
    v_action := 'INSERT';
    v_old := NULL;
    v_new := to_jsonb(NEW);
    v_record_id := (NEW).id::text;
  END IF;

  INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, user_id)
  VALUES (TG_TABLE_NAME, v_record_id, v_action, v_old, v_new, v_user_id);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. SYSTEM STATUS (singleton)
-- ============================================================

CREATE TABLE IF NOT EXISTS system_status (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  setup_complete boolean NOT NULL DEFAULT false,
  setup_completed_at timestamptz,
  current_company_id uuid,
  version text DEFAULT '1.0.0',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO system_status (id, setup_complete)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE system_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_system_status" ON system_status;
CREATE POLICY "anon_read_system_status" ON system_status
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_update_system_status" ON system_status;
CREATE POLICY "auth_update_system_status" ON system_status
  TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 2. COMPANIES
-- ============================================================

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  address text,
  city text,
  state text,
  country text DEFAULT 'Pakistan',
  postal_code text,
  phone text,
  email text,
  website text,
  logo_url text,
  currency text NOT NULL DEFAULT 'PKR',
  currency_symbol text NOT NULL DEFAULT 'Rs',
  tax_number text,
  tax_percentage numeric(5,2) DEFAULT 0,
  fiscal_year_start_month integer DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_companies" ON companies;
CREATE POLICY "auth_select_companies" ON companies
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_companies" ON companies;
CREATE POLICY "auth_insert_companies" ON companies
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_companies" ON companies;
CREATE POLICY "auth_update_companies" ON companies
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_companies" ON companies;
CREATE POLICY "auth_delete_companies" ON companies
  TO authenticated USING (true);

-- ============================================================
-- 3. BRANCHES
-- ============================================================

CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  address text,
  city text,
  state text,
  country text DEFAULT 'Pakistan',
  postal_code text,
  phone text,
  email text,
  is_head_office boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_branches" ON branches;
CREATE POLICY "auth_select_branches" ON branches
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_branches" ON branches;
CREATE POLICY "auth_insert_branches" ON branches
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_branches" ON branches;
CREATE POLICY "auth_update_branches" ON branches
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_branches" ON branches;
CREATE POLICY "auth_delete_branches" ON branches
  TO authenticated USING (true);

-- ============================================================
-- 4. DEPARTMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  type text NOT NULL DEFAULT 'clinical',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_departments" ON departments;
CREATE POLICY "auth_select_departments" ON departments
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_departments" ON departments;
CREATE POLICY "auth_insert_departments" ON departments
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_departments" ON departments;
CREATE POLICY "auth_update_departments" ON departments
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_departments" ON departments;
CREATE POLICY "auth_delete_departments" ON departments
  TO authenticated USING (true);

-- ============================================================
-- 5. DESIGNATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS designations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE designations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_designations" ON designations;
CREATE POLICY "auth_select_designations" ON designations
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_designations" ON designations;
CREATE POLICY "auth_insert_designations" ON designations
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_designations" ON designations;
CREATE POLICY "auth_update_designations" ON designations
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_designations" ON designations;
CREATE POLICY "auth_delete_designations" ON designations
  TO authenticated USING (true);

-- ============================================================
-- 6. ROLES
-- ============================================================

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_roles" ON roles;
CREATE POLICY "auth_select_roles" ON roles
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_roles" ON roles;
CREATE POLICY "auth_insert_roles" ON roles
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_roles" ON roles;
CREATE POLICY "auth_update_roles" ON roles
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_roles" ON roles;
CREATE POLICY "auth_delete_roles" ON roles
  TO authenticated USING (true);

-- ============================================================
-- 7. PERMISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  action text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(module, action)
);

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_permissions" ON permissions;
CREATE POLICY "auth_select_permissions" ON permissions
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_permissions" ON permissions;
CREATE POLICY "auth_insert_permissions" ON permissions
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_permissions" ON permissions;
CREATE POLICY "auth_update_permissions" ON permissions
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_permissions" ON permissions;
CREATE POLICY "auth_delete_permissions" ON permissions
  TO authenticated USING (true);

-- ============================================================
-- 8. ROLE_PERMISSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_role_permissions" ON role_permissions;
CREATE POLICY "auth_select_role_permissions" ON role_permissions
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_role_permissions" ON role_permissions;
CREATE POLICY "auth_insert_role_permissions" ON role_permissions
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_role_permissions" ON role_permissions;
CREATE POLICY "auth_update_role_permissions" ON role_permissions
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_role_permissions" ON role_permissions;
CREATE POLICY "auth_delete_role_permissions" ON role_permissions
  TO authenticated USING (true);

-- ============================================================
-- 9. EMPLOYEES
-- ============================================================

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  designation_id uuid REFERENCES designations(id) ON DELETE SET NULL,
  employee_code text,
  full_name text NOT NULL,
  gender text,
  date_of_birth date,
  phone text,
  email text,
  address text,
  hire_date date,
  salary numeric(15,2) DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_employees" ON employees;
CREATE POLICY "auth_select_employees" ON employees
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_employees" ON employees;
CREATE POLICY "auth_insert_employees" ON employees
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_employees" ON employees;
CREATE POLICY "auth_update_employees" ON employees
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_employees" ON employees;
CREATE POLICY "auth_delete_employees" ON employees
  TO authenticated USING (true);

-- ============================================================
-- 10. APP_USERS (links auth.users → roles/branches/companies)
-- ============================================================

CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  role_id uuid NOT NULL REFERENCES roles(id),
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_app_users" ON app_users;
CREATE POLICY "auth_select_app_users" ON app_users
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_app_users" ON app_users;
CREATE POLICY "auth_insert_app_users" ON app_users
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_app_users" ON app_users;
CREATE POLICY "auth_update_app_users" ON app_users
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_app_users" ON app_users;
CREATE POLICY "auth_delete_app_users" ON app_users
  TO authenticated USING (true);

-- ============================================================
-- 11. CHART_OF_ACCOUNTS
-- ============================================================

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('asset','liability','equity','revenue','expense')),
  parent_id uuid REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  is_group boolean NOT NULL DEFAULT false,
  opening_balance numeric(15,2) DEFAULT 0,
  current_balance numeric(15,2) DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_coa" ON chart_of_accounts;
CREATE POLICY "auth_select_coa" ON chart_of_accounts
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_coa" ON chart_of_accounts;
CREATE POLICY "auth_insert_coa" ON chart_of_accounts
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_coa" ON chart_of_accounts;
CREATE POLICY "auth_update_coa" ON chart_of_accounts
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_coa" ON chart_of_accounts;
CREATE POLICY "auth_delete_coa" ON chart_of_accounts
  TO authenticated USING (true);

-- ============================================================
-- 12. FINANCIAL_YEARS
-- ============================================================

CREATE TABLE IF NOT EXISTS financial_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_closed boolean NOT NULL DEFAULT false,
  closed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE financial_years ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_financial_years" ON financial_years;
CREATE POLICY "auth_select_financial_years" ON financial_years
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_financial_years" ON financial_years;
CREATE POLICY "auth_insert_financial_years" ON financial_years
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_financial_years" ON financial_years;
CREATE POLICY "auth_update_financial_years" ON financial_years
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_financial_years" ON financial_years;
CREATE POLICY "auth_delete_financial_years" ON financial_years
  TO authenticated USING (true);

-- ============================================================
-- 13. SYSTEM_SETTINGS (key-value, company-scoped)
-- ============================================================

CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb,
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, key)
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_system_settings" ON system_settings;
CREATE POLICY "anon_select_system_settings" ON system_settings
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_system_settings" ON system_settings;
CREATE POLICY "auth_insert_system_settings" ON system_settings
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_system_settings" ON system_settings;
CREATE POLICY "auth_update_system_settings" ON system_settings
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_system_settings" ON system_settings;
CREATE POLICY "auth_delete_system_settings" ON system_settings
  TO authenticated USING (true);

-- ============================================================
-- 14. AUDIT_LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id text,
  action text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_audit_logs" ON audit_logs;
CREATE POLICY "auth_select_audit_logs" ON audit_logs
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_audit_logs" ON audit_logs;
CREATE POLICY "auth_insert_audit_logs" ON audit_logs
  TO authenticated WITH CHECK (true);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_branches_company ON branches(company_id);
CREATE INDEX IF NOT EXISTS idx_departments_branch ON departments(branch_id);
CREATE INDEX IF NOT EXISTS idx_departments_company ON departments(company_id);
CREATE INDEX IF NOT EXISTS idx_app_users_auth ON app_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role_id);
CREATE INDEX IF NOT EXISTS idx_app_users_branch ON app_users(branch_id);
CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_branch ON employees(branch_id);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_coa_company ON chart_of_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_coa_parent ON chart_of_accounts(parent_id);
CREATE INDEX IF NOT EXISTS idx_financial_years_company ON financial_years(company_id);
CREATE INDEX IF NOT EXISTS idx_settings_company ON system_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS set_updated_at ON system_status;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON system_status FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON companies;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON branches;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON departments;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON designations;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON designations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON roles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON app_users;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON app_users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON employees;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON chart_of_accounts;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON chart_of_accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON financial_years;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON financial_years FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON system_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- AUDIT TRIGGERS on key tables
-- ============================================================

DROP TRIGGER IF EXISTS audit_companies ON companies;
CREATE TRIGGER audit_companies AFTER INSERT OR UPDATE OR DELETE ON companies
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

DROP TRIGGER IF EXISTS audit_branches ON branches;
CREATE TRIGGER audit_branches AFTER INSERT OR UPDATE OR DELETE ON branches
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

DROP TRIGGER IF EXISTS audit_departments ON departments;
CREATE TRIGGER audit_departments AFTER INSERT OR UPDATE OR DELETE ON departments
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

DROP TRIGGER IF EXISTS audit_app_users ON app_users;
CREATE TRIGGER audit_app_users AFTER INSERT OR UPDATE OR DELETE ON app_users
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

DROP TRIGGER IF EXISTS audit_employees ON employees;
CREATE TRIGGER audit_employees AFTER INSERT OR UPDATE OR DELETE ON employees
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

DROP TRIGGER IF EXISTS audit_coa ON chart_of_accounts;
CREATE TRIGGER audit_coa AFTER INSERT OR UPDATE OR DELETE ON chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

DROP TRIGGER IF EXISTS audit_system_settings ON system_settings;
CREATE TRIGGER audit_system_settings AFTER INSERT OR UPDATE OR DELETE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
