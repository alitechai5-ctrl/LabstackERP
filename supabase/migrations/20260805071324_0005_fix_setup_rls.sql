/*
# Fix: Allow anon INSERT during First Time Setup

## Problem
The First Time Setup Wizard creates companies, branches, departments, etc.
BEFORE the super admin user exists. Since there is no authenticated session
at that point, the `TO authenticated` INSERT policies block all writes with
"new row violates row-level security policy".

## Fix
Add `TO anon` INSERT policies on all setup tables, guarded by a check that
`system_status.setup_complete` is still false. Once setup completes, anon
can no longer INSERT into these tables.

## Affected Tables
- companies
- branches
- departments
- designations
- chart_of_accounts
- financial_years
- system_settings
- employees (created after signUp, but adding as safety net)
- system_status (anon UPDATE during setup)

## Security
- Each anon policy checks `NOT EXISTS (SELECT 1 FROM system_status WHERE setup_complete = true)`
- After setup is marked complete, these policies evaluate to false and anon is blocked
- All existing authenticated policies remain unchanged
*/

-- Helper: check if setup is still in progress
-- We inline this in each policy since policy expressions can't call custom functions easily
-- with security definer concerns. The subquery is fast (singleton row).

-- companies: anon INSERT during setup
DROP POLICY IF EXISTS "anon_insert_companies_setup" ON companies;
CREATE POLICY "anon_insert_companies_setup" ON companies
  TO anon WITH CHECK (
    NOT EXISTS (SELECT 1 FROM system_status WHERE setup_complete = true)
  );

-- branches: anon INSERT during setup
DROP POLICY IF EXISTS "anon_insert_branches_setup" ON branches;
CREATE POLICY "anon_insert_branches_setup" ON branches
  TO anon WITH CHECK (
    NOT EXISTS (SELECT 1 FROM system_status WHERE setup_complete = true)
  );

-- departments: anon INSERT during setup
DROP POLICY IF EXISTS "anon_insert_departments_setup" ON departments;
CREATE POLICY "anon_insert_departments_setup" ON departments
  TO anon WITH CHECK (
    NOT EXISTS (SELECT 1 FROM system_status WHERE setup_complete = true)
  );

-- designations: anon INSERT during setup
DROP POLICY IF EXISTS "anon_insert_designations_setup" ON designations;
CREATE POLICY "anon_insert_designations_setup" ON designations
  TO anon WITH CHECK (
    NOT EXISTS (SELECT 1 FROM system_status WHERE setup_complete = true)
  );

-- chart_of_accounts: anon INSERT during setup
DROP POLICY IF EXISTS "anon_insert_coa_setup" ON chart_of_accounts;
CREATE POLICY "anon_insert_coa_setup" ON chart_of_accounts
  TO anon WITH CHECK (
    NOT EXISTS (SELECT 1 FROM system_status WHERE setup_complete = true)
  );

-- financial_years: anon INSERT during setup
DROP POLICY IF EXISTS "anon_insert_financial_years_setup" ON financial_years;
CREATE POLICY "anon_insert_financial_years_setup" ON financial_years
  TO anon WITH CHECK (
    NOT EXISTS (SELECT 1 FROM system_status WHERE setup_complete = true)
  );

-- system_settings: anon INSERT during setup
DROP POLICY IF EXISTS "anon_insert_system_settings_setup" ON system_settings;
CREATE POLICY "anon_insert_system_settings_setup" ON system_settings
  TO anon WITH CHECK (
    NOT EXISTS (SELECT 1 FROM system_status WHERE setup_complete = true)
  );

-- employees: anon INSERT during setup (safety net in case session isn't established yet)
DROP POLICY IF EXISTS "anon_insert_employees_setup" ON employees;
CREATE POLICY "anon_insert_employees_setup" ON employees
  TO anon WITH CHECK (
    NOT EXISTS (SELECT 1 FROM system_status WHERE setup_complete = true)
  );

-- app_users: anon INSERT during setup (safety net)
DROP POLICY IF EXISTS "anon_insert_app_users_setup" ON app_users;
CREATE POLICY "anon_insert_app_users_setup" ON app_users
  TO anon WITH CHECK (
    NOT EXISTS (SELECT 1 FROM system_status WHERE setup_complete = true)
  );

-- system_status: anon UPDATE during setup (to mark setup complete)
DROP POLICY IF EXISTS "anon_update_system_status_setup" ON system_status;
CREATE POLICY "anon_update_system_status_setup" ON system_status
  TO anon USING (
    NOT EXISTS (SELECT 1 FROM system_status s WHERE s.setup_complete = true)
  ) WITH CHECK (
    NOT EXISTS (SELECT 1 FROM system_status s WHERE s.setup_complete = true)
  );
