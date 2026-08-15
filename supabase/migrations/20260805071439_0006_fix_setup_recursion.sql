/*
# Fix: Infinite recursion in setup RLS policies

## Problem
The anon INSERT/UPDATE policies check `NOT EXISTS (SELECT 1 FROM system_status WHERE setup_complete = true)`.
When this check runs on the system_status table itself, Postgres evaluates the policy
while querying the table, which triggers the policy again — infinite recursion.

## Fix
1. Create a SECURITY DEFINER function `is_setup_in_progress()` that reads
   system_status with RLS bypassed (SECURITY DEFINER + explicit search_path).
2. Replace all `NOT EXISTS (SELECT 1 FROM system_status ...)` checks in policies
   with `is_setup_in_progress()`.
3. The function returns true when setup_complete is false (or row missing),
   false once setup is marked complete.

## Security
- The function is SECURITY DEFINER so it bypasses RLS when reading system_status.
- search_path is locked to public to prevent injection.
- The function is read-only (SELECT only).
*/

CREATE OR REPLACE FUNCTION is_setup_in_progress()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT COALESCE(
    (SELECT setup_complete FROM system_status WHERE id = 1),
    false
  );
$$;

-- Replace the recursive system_status anon UPDATE policy
DROP POLICY IF EXISTS "anon_update_system_status_setup" ON system_status;
CREATE POLICY "anon_update_system_status_setup" ON system_status
  TO anon USING (is_setup_in_progress())
  WITH CHECK (is_setup_in_progress());

-- Replace all other setup policies to use the function instead of subquery

DROP POLICY IF EXISTS "anon_insert_companies_setup" ON companies;
CREATE POLICY "anon_insert_companies_setup" ON companies
  TO anon WITH CHECK (is_setup_in_progress());

DROP POLICY IF EXISTS "anon_insert_branches_setup" ON branches;
CREATE POLICY "anon_insert_branches_setup" ON branches
  TO anon WITH CHECK (is_setup_in_progress());

DROP POLICY IF EXISTS "anon_insert_departments_setup" ON departments;
CREATE POLICY "anon_insert_departments_setup" ON departments
  TO anon WITH CHECK (is_setup_in_progress());

DROP POLICY IF EXISTS "anon_insert_designations_setup" ON designations;
CREATE POLICY "anon_insert_designations_setup" ON designations
  TO anon WITH CHECK (is_setup_in_progress());

DROP POLICY IF EXISTS "anon_insert_coa_setup" ON chart_of_accounts;
CREATE POLICY "anon_insert_coa_setup" ON chart_of_accounts
  TO anon WITH CHECK (is_setup_in_progress());

DROP POLICY IF EXISTS "anon_insert_financial_years_setup" ON financial_years;
CREATE POLICY "anon_insert_financial_years_setup" ON financial_years
  TO anon WITH CHECK (is_setup_in_progress());

DROP POLICY IF EXISTS "anon_insert_system_settings_setup" ON system_settings;
CREATE POLICY "anon_insert_system_settings_setup" ON system_settings
  TO anon WITH CHECK (is_setup_in_progress());

DROP POLICY IF EXISTS "anon_insert_employees_setup" ON employees;
CREATE POLICY "anon_insert_employees_setup" ON employees
  TO anon WITH CHECK (is_setup_in_progress());

DROP POLICY IF EXISTS "anon_insert_app_users_setup" ON app_users;
CREATE POLICY "anon_insert_app_users_setup" ON app_users
  TO anon WITH CHECK (is_setup_in_progress());
