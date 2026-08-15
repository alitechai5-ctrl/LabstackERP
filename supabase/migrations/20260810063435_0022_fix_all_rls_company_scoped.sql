/*
# Fix RLS: Replace all USING(true) policies with proper company-scoped checks

## Problem
All tables had RLS enabled but used USING(true) / WITH CHECK (true) policies,
meaning any authenticated user could read/modify ANY company's data.

## Solution
Replace every USING(true) policy with a company-scoped check:
  auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = <table>.company_id)

### Tables with company_id (direct scope) — 41 tables
### Child tables (scope through parent) — 10 tables
### Global reference tables (roles, permissions, role_permissions, system_status) — shared
### audit_logs — scoped by user_id = auth.uid()
*/

-- Helper function to check company membership
CREATE OR REPLACE FUNCTION is_company_member(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_users
    WHERE company_id = cid
    AND auth_user_id = auth.uid()
  );
$$;

-- ============================================================
-- TABLES WITH DIRECT company_id COLUMN
-- ============================================================

-- app_users
DROP POLICY IF EXISTS "auth_delete_app_users" ON app_users;
DROP POLICY IF EXISTS "auth_insert_app_users" ON app_users;
DROP POLICY IF EXISTS "auth_select_app_users" ON app_users;
DROP POLICY IF EXISTS "auth_update_app_users" ON app_users;
DROP POLICY IF EXISTS "anon_insert_app_users_setup" ON app_users;
DROP POLICY IF EXISTS "select_app_users" ON app_users;
DROP POLICY IF EXISTS "insert_app_users" ON app_users;
DROP POLICY IF EXISTS "update_app_users" ON app_users;
DROP POLICY IF EXISTS "delete_app_users" ON app_users;
CREATE POLICY "select_app_users" ON app_users FOR SELECT
  TO authenticated USING (is_company_member(app_users.company_id));
CREATE POLICY "insert_app_users" ON app_users FOR INSERT
  TO authenticated WITH CHECK (is_company_member(app_users.company_id));
CREATE POLICY "update_app_users" ON app_users FOR UPDATE
  TO authenticated USING (is_company_member(app_users.company_id))
  WITH CHECK (is_company_member(app_users.company_id));
CREATE POLICY "delete_app_users" ON app_users FOR DELETE
  TO authenticated USING (is_company_member(app_users.company_id));

-- appointments
DROP POLICY IF EXISTS "select_appointments" ON appointments;
DROP POLICY IF EXISTS "insert_appointments" ON appointments;
DROP POLICY IF EXISTS "update_appointments" ON appointments;
DROP POLICY IF EXISTS "delete_appointments" ON appointments;
CREATE POLICY "select_appointments" ON appointments FOR SELECT
  TO authenticated USING (is_company_member(appointments.company_id));
CREATE POLICY "insert_appointments" ON appointments FOR INSERT
  TO authenticated WITH CHECK (is_company_member(appointments.company_id));
CREATE POLICY "update_appointments" ON appointments FOR UPDATE
  TO authenticated USING (is_company_member(appointments.company_id))
  WITH CHECK (is_company_member(appointments.company_id));
CREATE POLICY "delete_appointments" ON appointments FOR DELETE
  TO authenticated USING (is_company_member(appointments.company_id));

-- attendance
DROP POLICY IF EXISTS "auth_delete_att" ON attendance;
DROP POLICY IF EXISTS "auth_insert_att" ON attendance;
DROP POLICY IF EXISTS "auth_select_att" ON attendance;
DROP POLICY IF EXISTS "auth_update_att" ON attendance;
DROP POLICY IF EXISTS "select_attendance" ON attendance;
DROP POLICY IF EXISTS "insert_attendance" ON attendance;
DROP POLICY IF EXISTS "update_attendance" ON attendance;
DROP POLICY IF EXISTS "delete_attendance" ON attendance;
CREATE POLICY "select_attendance" ON attendance FOR SELECT
  TO authenticated USING (is_company_member(attendance.company_id));
CREATE POLICY "insert_attendance" ON attendance FOR INSERT
  TO authenticated WITH CHECK (is_company_member(attendance.company_id));
CREATE POLICY "update_attendance" ON attendance FOR UPDATE
  TO authenticated USING (is_company_member(attendance.company_id))
  WITH CHECK (is_company_member(attendance.company_id));
CREATE POLICY "delete_attendance" ON attendance FOR DELETE
  TO authenticated USING (is_company_member(attendance.company_id));

-- biometric_machines
DROP POLICY IF EXISTS "auth_delete_biometric" ON biometric_machines;
DROP POLICY IF EXISTS "auth_insert_biometric" ON biometric_machines;
DROP POLICY IF EXISTS "auth_select_biometric" ON biometric_machines;
DROP POLICY IF EXISTS "auth_update_biometric" ON biometric_machines;
DROP POLICY IF EXISTS "select_biometric_machines" ON biometric_machines;
DROP POLICY IF EXISTS "insert_biometric_machines" ON biometric_machines;
DROP POLICY IF EXISTS "update_biometric_machines" ON biometric_machines;
DROP POLICY IF EXISTS "delete_biometric_machines" ON biometric_machines;
CREATE POLICY "select_biometric_machines" ON biometric_machines FOR SELECT
  TO authenticated USING (is_company_member(biometric_machines.company_id));
CREATE POLICY "insert_biometric_machines" ON biometric_machines FOR INSERT
  TO authenticated WITH CHECK (is_company_member(biometric_machines.company_id));
CREATE POLICY "update_biometric_machines" ON biometric_machines FOR UPDATE
  TO authenticated USING (is_company_member(biometric_machines.company_id))
  WITH CHECK (is_company_member(biometric_machines.company_id));
CREATE POLICY "delete_biometric_machines" ON biometric_machines FOR DELETE
  TO authenticated USING (is_company_member(biometric_machines.company_id));

-- branches
DROP POLICY IF EXISTS "auth_delete_branches" ON branches;
DROP POLICY IF EXISTS "auth_insert_branches" ON branches;
DROP POLICY IF EXISTS "auth_select_branches" ON branches;
DROP POLICY IF EXISTS "auth_update_branches" ON branches;
DROP POLICY IF EXISTS "select_branches" ON branches;
DROP POLICY IF EXISTS "insert_branches" ON branches;
DROP POLICY IF EXISTS "update_branches" ON branches;
DROP POLICY IF EXISTS "delete_branches" ON branches;
CREATE POLICY "select_branches" ON branches FOR SELECT
  TO authenticated USING (is_company_member(branches.company_id));
CREATE POLICY "insert_branches" ON branches FOR INSERT
  TO authenticated WITH CHECK (is_company_member(branches.company_id));
CREATE POLICY "update_branches" ON branches FOR UPDATE
  TO authenticated USING (is_company_member(branches.company_id))
  WITH CHECK (is_company_member(branches.company_id));
CREATE POLICY "delete_branches" ON branches FOR DELETE
  TO authenticated USING (is_company_member(branches.company_id));

-- categories
DROP POLICY IF EXISTS "auth_delete_categories" ON categories;
DROP POLICY IF EXISTS "auth_insert_categories" ON categories;
DROP POLICY IF EXISTS "auth_select_categories" ON categories;
DROP POLICY IF EXISTS "auth_update_categories" ON categories;
DROP POLICY IF EXISTS "select_categories" ON categories;
DROP POLICY IF EXISTS "insert_categories" ON categories;
DROP POLICY IF EXISTS "update_categories" ON categories;
DROP POLICY IF EXISTS "delete_categories" ON categories;
CREATE POLICY "select_categories" ON categories FOR SELECT
  TO authenticated USING (is_company_member(categories.company_id));
CREATE POLICY "insert_categories" ON categories FOR INSERT
  TO authenticated WITH CHECK (is_company_member(categories.company_id));
CREATE POLICY "update_categories" ON categories FOR UPDATE
  TO authenticated USING (is_company_member(categories.company_id))
  WITH CHECK (is_company_member(categories.company_id));
CREATE POLICY "delete_categories" ON categories FOR DELETE
  TO authenticated USING (is_company_member(categories.company_id));

-- chart_of_accounts
DROP POLICY IF EXISTS "auth_delete_coa" ON chart_of_accounts;
DROP POLICY IF EXISTS "auth_insert_coa" ON chart_of_accounts;
DROP POLICY IF EXISTS "auth_select_coa" ON chart_of_accounts;
DROP POLICY IF EXISTS "auth_update_coa" ON chart_of_accounts;
DROP POLICY IF EXISTS "select_coa" ON chart_of_accounts;
DROP POLICY IF EXISTS "insert_coa" ON chart_of_accounts;
DROP POLICY IF EXISTS "update_coa" ON chart_of_accounts;
DROP POLICY IF EXISTS "delete_coa" ON chart_of_accounts;
CREATE POLICY "select_coa" ON chart_of_accounts FOR SELECT
  TO authenticated USING (is_company_member(chart_of_accounts.company_id));
CREATE POLICY "insert_coa" ON chart_of_accounts FOR INSERT
  TO authenticated WITH CHECK (is_company_member(chart_of_accounts.company_id));
CREATE POLICY "update_coa" ON chart_of_accounts FOR UPDATE
  TO authenticated USING (is_company_member(chart_of_accounts.company_id))
  WITH CHECK (is_company_member(chart_of_accounts.company_id));
CREATE POLICY "delete_coa" ON chart_of_accounts FOR DELETE
  TO authenticated USING (is_company_member(chart_of_accounts.company_id));

-- corporate_clients
DROP POLICY IF EXISTS "auth_delete_corporate" ON corporate_clients;
DROP POLICY IF EXISTS "auth_insert_corporate" ON corporate_clients;
DROP POLICY IF EXISTS "auth_select_corporate" ON corporate_clients;
DROP POLICY IF EXISTS "auth_update_corporate" ON corporate_clients;
DROP POLICY IF EXISTS "select_corporate_clients" ON corporate_clients;
DROP POLICY IF EXISTS "insert_corporate_clients" ON corporate_clients;
DROP POLICY IF EXISTS "update_corporate_clients" ON corporate_clients;
DROP POLICY IF EXISTS "delete_corporate_clients" ON corporate_clients;
CREATE POLICY "select_corporate_clients" ON corporate_clients FOR SELECT
  TO authenticated USING (is_company_member(corporate_clients.company_id));
CREATE POLICY "insert_corporate_clients" ON corporate_clients FOR INSERT
  TO authenticated WITH CHECK (is_company_member(corporate_clients.company_id));
CREATE POLICY "update_corporate_clients" ON corporate_clients FOR UPDATE
  TO authenticated USING (is_company_member(corporate_clients.company_id))
  WITH CHECK (is_company_member(corporate_clients.company_id));
CREATE POLICY "delete_corporate_clients" ON corporate_clients FOR DELETE
  TO authenticated USING (is_company_member(corporate_clients.company_id));

-- departments
DROP POLICY IF EXISTS "auth_delete_departments" ON departments;
DROP POLICY IF EXISTS "auth_insert_departments" ON departments;
DROP POLICY IF EXISTS "auth_select_departments" ON departments;
DROP POLICY IF EXISTS "auth_update_departments" ON departments;
DROP POLICY IF EXISTS "select_departments" ON departments;
DROP POLICY IF EXISTS "insert_departments" ON departments;
DROP POLICY IF EXISTS "update_departments" ON departments;
DROP POLICY IF EXISTS "delete_departments" ON departments;
CREATE POLICY "select_departments" ON departments FOR SELECT
  TO authenticated USING (is_company_member(departments.company_id));
CREATE POLICY "insert_departments" ON departments FOR INSERT
  TO authenticated WITH CHECK (is_company_member(departments.company_id));
CREATE POLICY "update_departments" ON departments FOR UPDATE
  TO authenticated USING (is_company_member(departments.company_id))
  WITH CHECK (is_company_member(departments.company_id));
CREATE POLICY "delete_departments" ON departments FOR DELETE
  TO authenticated USING (is_company_member(departments.company_id));

-- designations
DROP POLICY IF EXISTS "auth_delete_designations" ON designations;
DROP POLICY IF EXISTS "auth_insert_designations" ON designations;
DROP POLICY IF EXISTS "auth_select_designations" ON designations;
DROP POLICY IF EXISTS "auth_update_designations" ON designations;
DROP POLICY IF EXISTS "select_designations" ON designations;
DROP POLICY IF EXISTS "insert_designations" ON designations;
DROP POLICY IF EXISTS "update_designations" ON designations;
DROP POLICY IF EXISTS "delete_designations" ON designations;
CREATE POLICY "select_designations" ON designations FOR SELECT
  TO authenticated USING (is_company_member(designations.company_id));
CREATE POLICY "insert_designations" ON designations FOR INSERT
  TO authenticated WITH CHECK (is_company_member(designations.company_id));
CREATE POLICY "update_designations" ON designations FOR UPDATE
  TO authenticated USING (is_company_member(designations.company_id))
  WITH CHECK (is_company_member(designations.company_id));
CREATE POLICY "delete_designations" ON designations FOR DELETE
  TO authenticated USING (is_company_member(designations.company_id));

-- doctor_schedules
DROP POLICY IF EXISTS "auth_delete_doc_schedules" ON doctor_schedules;
DROP POLICY IF EXISTS "auth_insert_doc_schedules" ON doctor_schedules;
DROP POLICY IF EXISTS "auth_select_doc_schedules" ON doctor_schedules;
DROP POLICY IF EXISTS "auth_update_doc_schedules" ON doctor_schedules;
DROP POLICY IF EXISTS "select_doctor_schedules" ON doctor_schedules;
DROP POLICY IF EXISTS "insert_doctor_schedules" ON doctor_schedules;
DROP POLICY IF EXISTS "update_doctor_schedules" ON doctor_schedules;
DROP POLICY IF EXISTS "delete_doctor_schedules" ON doctor_schedules;
CREATE POLICY "select_doctor_schedules" ON doctor_schedules FOR SELECT
  TO authenticated USING (is_company_member(doctor_schedules.company_id));
CREATE POLICY "insert_doctor_schedules" ON doctor_schedules FOR INSERT
  TO authenticated WITH CHECK (is_company_member(doctor_schedules.company_id));
CREATE POLICY "update_doctor_schedules" ON doctor_schedules FOR UPDATE
  TO authenticated USING (is_company_member(doctor_schedules.company_id))
  WITH CHECK (is_company_member(doctor_schedules.company_id));
CREATE POLICY "delete_doctor_schedules" ON doctor_schedules FOR DELETE
  TO authenticated USING (is_company_member(doctor_schedules.company_id));

-- doctor_settlements
DROP POLICY IF EXISTS "auth_delete_doc_settlements" ON doctor_settlements;
DROP POLICY IF EXISTS "auth_insert_doc_settlements" ON doctor_settlements;
DROP POLICY IF EXISTS "auth_select_doc_settlements" ON doctor_settlements;
DROP POLICY IF EXISTS "auth_update_doc_settlements" ON doctor_settlements;
DROP POLICY IF EXISTS "select_doctor_settlements" ON doctor_settlements;
DROP POLICY IF EXISTS "insert_doctor_settlements" ON doctor_settlements;
DROP POLICY IF EXISTS "update_doctor_settlements" ON doctor_settlements;
DROP POLICY IF EXISTS "delete_doctor_settlements" ON doctor_settlements;
CREATE POLICY "select_doctor_settlements" ON doctor_settlements FOR SELECT
  TO authenticated USING (is_company_member(doctor_settlements.company_id));
CREATE POLICY "insert_doctor_settlements" ON doctor_settlements FOR INSERT
  TO authenticated WITH CHECK (is_company_member(doctor_settlements.company_id));
CREATE POLICY "update_doctor_settlements" ON doctor_settlements FOR UPDATE
  TO authenticated USING (is_company_member(doctor_settlements.company_id))
  WITH CHECK (is_company_member(doctor_settlements.company_id));
CREATE POLICY "delete_doctor_settlements" ON doctor_settlements FOR DELETE
  TO authenticated USING (is_company_member(doctor_settlements.company_id));

-- doctors
DROP POLICY IF EXISTS "auth_delete_doctors" ON doctors;
DROP POLICY IF EXISTS "auth_insert_doctors" ON doctors;
DROP POLICY IF EXISTS "auth_select_doctors" ON doctors;
DROP POLICY IF EXISTS "auth_update_doctors" ON doctors;
DROP POLICY IF EXISTS "select_doctors" ON doctors;
DROP POLICY IF EXISTS "insert_doctors" ON doctors;
DROP POLICY IF EXISTS "update_doctors" ON doctors;
DROP POLICY IF EXISTS "delete_doctors" ON doctors;
CREATE POLICY "select_doctors" ON doctors FOR SELECT
  TO authenticated USING (is_company_member(doctors.company_id));
CREATE POLICY "insert_doctors" ON doctors FOR INSERT
  TO authenticated WITH CHECK (is_company_member(doctors.company_id));
CREATE POLICY "update_doctors" ON doctors FOR UPDATE
  TO authenticated USING (is_company_member(doctors.company_id))
  WITH CHECK (is_company_member(doctors.company_id));
CREATE POLICY "delete_doctors" ON doctors FOR DELETE
  TO authenticated USING (is_company_member(doctors.company_id));

-- employees
DROP POLICY IF EXISTS "auth_delete_employees" ON employees;
DROP POLICY IF EXISTS "auth_insert_employees" ON employees;
DROP POLICY IF EXISTS "auth_select_employees" ON employees;
DROP POLICY IF EXISTS "auth_update_employees" ON employees;
DROP POLICY IF EXISTS "select_employees" ON employees;
DROP POLICY IF EXISTS "insert_employees" ON employees;
DROP POLICY IF EXISTS "update_employees" ON employees;
DROP POLICY IF EXISTS "delete_employees" ON employees;
CREATE POLICY "select_employees" ON employees FOR SELECT
  TO authenticated USING (is_company_member(employees.company_id));
CREATE POLICY "insert_employees" ON employees FOR INSERT
  TO authenticated WITH CHECK (is_company_member(employees.company_id));
CREATE POLICY "update_employees" ON employees FOR UPDATE
  TO authenticated USING (is_company_member(employees.company_id))
  WITH CHECK (is_company_member(employees.company_id));
CREATE POLICY "delete_employees" ON employees FOR DELETE
  TO authenticated USING (is_company_member(employees.company_id));

-- financial_years
DROP POLICY IF EXISTS "auth_delete_fy" ON financial_years;
DROP POLICY IF EXISTS "auth_insert_fy" ON financial_years;
DROP POLICY IF EXISTS "auth_select_fy" ON financial_years;
DROP POLICY IF EXISTS "auth_update_fy" ON financial_years;
DROP POLICY IF EXISTS "select_financial_years" ON financial_years;
DROP POLICY IF EXISTS "insert_financial_years" ON financial_years;
DROP POLICY IF EXISTS "update_financial_years" ON financial_years;
DROP POLICY IF EXISTS "delete_financial_years" ON financial_years;
CREATE POLICY "select_financial_years" ON financial_years FOR SELECT
  TO authenticated USING (is_company_member(financial_years.company_id));
CREATE POLICY "insert_financial_years" ON financial_years FOR INSERT
  TO authenticated WITH CHECK (is_company_member(financial_years.company_id));
CREATE POLICY "update_financial_years" ON financial_years FOR UPDATE
  TO authenticated USING (is_company_member(financial_years.company_id))
  WITH CHECK (is_company_member(financial_years.company_id));
CREATE POLICY "delete_financial_years" ON financial_years FOR DELETE
  TO authenticated USING (is_company_member(financial_years.company_id));

-- goods_receipt_notes
DROP POLICY IF EXISTS "auth_delete_grn" ON goods_receipt_notes;
DROP POLICY IF EXISTS "auth_insert_grn" ON goods_receipt_notes;
DROP POLICY IF EXISTS "auth_select_grn" ON goods_receipt_notes;
DROP POLICY IF EXISTS "auth_update_grn" ON goods_receipt_notes;
DROP POLICY IF EXISTS "select_grn" ON goods_receipt_notes;
DROP POLICY IF EXISTS "insert_grn" ON goods_receipt_notes;
DROP POLICY IF EXISTS "update_grn" ON goods_receipt_notes;
DROP POLICY IF EXISTS "delete_grn" ON goods_receipt_notes;
CREATE POLICY "select_grn" ON goods_receipt_notes FOR SELECT
  TO authenticated USING (is_company_member(goods_receipt_notes.company_id));
CREATE POLICY "insert_grn" ON goods_receipt_notes FOR INSERT
  TO authenticated WITH CHECK (is_company_member(goods_receipt_notes.company_id));
CREATE POLICY "update_grn" ON goods_receipt_notes FOR UPDATE
  TO authenticated USING (is_company_member(goods_receipt_notes.company_id))
  WITH CHECK (is_company_member(goods_receipt_notes.company_id));
CREATE POLICY "delete_grn" ON goods_receipt_notes FOR DELETE
  TO authenticated USING (is_company_member(goods_receipt_notes.company_id));

-- insurance_companies
DROP POLICY IF EXISTS "auth_delete_insurance" ON insurance_companies;
DROP POLICY IF EXISTS "auth_insert_insurance" ON insurance_companies;
DROP POLICY IF EXISTS "auth_select_insurance" ON insurance_companies;
DROP POLICY IF EXISTS "auth_update_insurance" ON insurance_companies;
DROP POLICY IF EXISTS "select_insurance" ON insurance_companies;
DROP POLICY IF EXISTS "insert_insurance" ON insurance_companies;
DROP POLICY IF EXISTS "update_insurance" ON insurance_companies;
DROP POLICY IF EXISTS "delete_insurance" ON insurance_companies;
CREATE POLICY "select_insurance" ON insurance_companies FOR SELECT
  TO authenticated USING (is_company_member(insurance_companies.company_id));
CREATE POLICY "insert_insurance" ON insurance_companies FOR INSERT
  TO authenticated WITH CHECK (is_company_member(insurance_companies.company_id));
CREATE POLICY "update_insurance" ON insurance_companies FOR UPDATE
  TO authenticated USING (is_company_member(insurance_companies.company_id))
  WITH CHECK (is_company_member(insurance_companies.company_id));
CREATE POLICY "delete_insurance" ON insurance_companies FOR DELETE
  TO authenticated USING (is_company_member(insurance_companies.company_id));

-- inventory_adjustments
DROP POLICY IF EXISTS "auth_delete_inv_adj" ON inventory_adjustments;
DROP POLICY IF EXISTS "auth_insert_inv_adj" ON inventory_adjustments;
DROP POLICY IF EXISTS "auth_select_inv_adj" ON inventory_adjustments;
DROP POLICY IF EXISTS "auth_update_inv_adj" ON inventory_adjustments;
DROP POLICY IF EXISTS "select_inv_adj" ON inventory_adjustments;
DROP POLICY IF EXISTS "insert_inv_adj" ON inventory_adjustments;
DROP POLICY IF EXISTS "update_inv_adj" ON inventory_adjustments;
DROP POLICY IF EXISTS "delete_inv_adj" ON inventory_adjustments;
CREATE POLICY "select_inv_adj" ON inventory_adjustments FOR SELECT
  TO authenticated USING (is_company_member(inventory_adjustments.company_id));
CREATE POLICY "insert_inv_adj" ON inventory_adjustments FOR INSERT
  TO authenticated WITH CHECK (is_company_member(inventory_adjustments.company_id));
CREATE POLICY "update_inv_adj" ON inventory_adjustments FOR UPDATE
  TO authenticated USING (is_company_member(inventory_adjustments.company_id))
  WITH CHECK (is_company_member(inventory_adjustments.company_id));
CREATE POLICY "delete_inv_adj" ON inventory_adjustments FOR DELETE
  TO authenticated USING (is_company_member(inventory_adjustments.company_id));

-- inventory_issues
DROP POLICY IF EXISTS "auth_delete_inv_issues" ON inventory_issues;
DROP POLICY IF EXISTS "auth_insert_inv_issues" ON inventory_issues;
DROP POLICY IF EXISTS "auth_select_inv_issues" ON inventory_issues;
DROP POLICY IF EXISTS "auth_update_inv_issues" ON inventory_issues;
DROP POLICY IF EXISTS "select_inv_issues" ON inventory_issues;
DROP POLICY IF EXISTS "insert_inv_issues" ON inventory_issues;
DROP POLICY IF EXISTS "update_inv_issues" ON inventory_issues;
DROP POLICY IF EXISTS "delete_inv_issues" ON inventory_issues;
CREATE POLICY "select_inv_issues" ON inventory_issues FOR SELECT
  TO authenticated USING (is_company_member(inventory_issues.company_id));
CREATE POLICY "insert_inv_issues" ON inventory_issues FOR INSERT
  TO authenticated WITH CHECK (is_company_member(inventory_issues.company_id));
CREATE POLICY "update_inv_issues" ON inventory_issues FOR UPDATE
  TO authenticated USING (is_company_member(inventory_issues.company_id))
  WITH CHECK (is_company_member(inventory_issues.company_id));
CREATE POLICY "delete_inv_issues" ON inventory_issues FOR DELETE
  TO authenticated USING (is_company_member(inventory_issues.company_id));

-- inventory_items
DROP POLICY IF EXISTS "auth_delete_inv_items" ON inventory_items;
DROP POLICY IF EXISTS "auth_insert_inv_items" ON inventory_items;
DROP POLICY IF EXISTS "auth_select_inv_items" ON inventory_items;
DROP POLICY IF EXISTS "auth_update_inv_items" ON inventory_items;
DROP POLICY IF EXISTS "select_inv_items" ON inventory_items;
DROP POLICY IF EXISTS "insert_inv_items" ON inventory_items;
DROP POLICY IF EXISTS "update_inv_items" ON inventory_items;
DROP POLICY IF EXISTS "delete_inv_items" ON inventory_items;
CREATE POLICY "select_inv_items" ON inventory_items FOR SELECT
  TO authenticated USING (is_company_member(inventory_items.company_id));
CREATE POLICY "insert_inv_items" ON inventory_items FOR INSERT
  TO authenticated WITH CHECK (is_company_member(inventory_items.company_id));
CREATE POLICY "update_inv_items" ON inventory_items FOR UPDATE
  TO authenticated USING (is_company_member(inventory_items.company_id))
  WITH CHECK (is_company_member(inventory_items.company_id));
CREATE POLICY "delete_inv_items" ON inventory_items FOR DELETE
  TO authenticated USING (is_company_member(inventory_items.company_id));

-- inventory_transfers
DROP POLICY IF EXISTS "auth_delete_inv_transfers" ON inventory_transfers;
DROP POLICY IF EXISTS "auth_insert_inv_transfers" ON inventory_transfers;
DROP POLICY IF EXISTS "auth_select_inv_transfers" ON inventory_transfers;
DROP POLICY IF EXISTS "auth_update_inv_transfers" ON inventory_transfers;
DROP POLICY IF EXISTS "select_inv_transfers" ON inventory_transfers;
DROP POLICY IF EXISTS "insert_inv_transfers" ON inventory_transfers;
DROP POLICY IF EXISTS "update_inv_transfers" ON inventory_transfers;
DROP POLICY IF EXISTS "delete_inv_transfers" ON inventory_transfers;
CREATE POLICY "select_inv_transfers" ON inventory_transfers FOR SELECT
  TO authenticated USING (is_company_member(inventory_transfers.company_id));
CREATE POLICY "insert_inv_transfers" ON inventory_transfers FOR INSERT
  TO authenticated WITH CHECK (is_company_member(inventory_transfers.company_id));
CREATE POLICY "update_inv_transfers" ON inventory_transfers FOR UPDATE
  TO authenticated USING (is_company_member(inventory_transfers.company_id))
  WITH CHECK (is_company_member(inventory_transfers.company_id));
CREATE POLICY "delete_inv_transfers" ON inventory_transfers FOR DELETE
  TO authenticated USING (is_company_member(inventory_transfers.company_id));

-- journal_entries
DROP POLICY IF EXISTS "auth_delete_journal" ON journal_entries;
DROP POLICY IF EXISTS "auth_insert_journal" ON journal_entries;
DROP POLICY IF EXISTS "auth_select_journal" ON journal_entries;
DROP POLICY IF EXISTS "auth_update_journal" ON journal_entries;
DROP POLICY IF EXISTS "select_journal" ON journal_entries;
DROP POLICY IF EXISTS "insert_journal" ON journal_entries;
DROP POLICY IF EXISTS "update_journal" ON journal_entries;
DROP POLICY IF EXISTS "delete_journal" ON journal_entries;
CREATE POLICY "select_journal" ON journal_entries FOR SELECT
  TO authenticated USING (is_company_member(journal_entries.company_id));
CREATE POLICY "insert_journal" ON journal_entries FOR INSERT
  TO authenticated WITH CHECK (is_company_member(journal_entries.company_id));
CREATE POLICY "update_journal" ON journal_entries FOR UPDATE
  TO authenticated USING (is_company_member(journal_entries.company_id))
  WITH CHECK (is_company_member(journal_entries.company_id));
CREATE POLICY "delete_journal" ON journal_entries FOR DELETE
  TO authenticated USING (is_company_member(journal_entries.company_id));

-- lab_order_payments
DROP POLICY IF EXISTS "auth_delete_lab_payments" ON lab_order_payments;
DROP POLICY IF EXISTS "auth_insert_lab_payments" ON lab_order_payments;
DROP POLICY IF EXISTS "auth_select_lab_payments" ON lab_order_payments;
DROP POLICY IF EXISTS "auth_update_lab_payments" ON lab_order_payments;
DROP POLICY IF EXISTS "select_lab_payments" ON lab_order_payments;
DROP POLICY IF EXISTS "insert_lab_payments" ON lab_order_payments;
DROP POLICY IF EXISTS "update_lab_payments" ON lab_order_payments;
DROP POLICY IF EXISTS "delete_lab_payments" ON lab_order_payments;
CREATE POLICY "select_lab_payments" ON lab_order_payments FOR SELECT
  TO authenticated USING (is_company_member(lab_order_payments.company_id));
CREATE POLICY "insert_lab_payments" ON lab_order_payments FOR INSERT
  TO authenticated WITH CHECK (is_company_member(lab_order_payments.company_id));
CREATE POLICY "update_lab_payments" ON lab_order_payments FOR UPDATE
  TO authenticated USING (is_company_member(lab_order_payments.company_id))
  WITH CHECK (is_company_member(lab_order_payments.company_id));
CREATE POLICY "delete_lab_payments" ON lab_order_payments FOR DELETE
  TO authenticated USING (is_company_member(lab_order_payments.company_id));

-- lab_orders
DROP POLICY IF EXISTS "auth_delete_lab_orders" ON lab_orders;
DROP POLICY IF EXISTS "auth_insert_lab_orders" ON lab_orders;
DROP POLICY IF EXISTS "auth_select_lab_orders" ON lab_orders;
DROP POLICY IF EXISTS "auth_update_lab_orders" ON lab_orders;
DROP POLICY IF EXISTS "select_lab_orders" ON lab_orders;
DROP POLICY IF EXISTS "insert_lab_orders" ON lab_orders;
DROP POLICY IF EXISTS "update_lab_orders" ON lab_orders;
DROP POLICY IF EXISTS "delete_lab_orders" ON lab_orders;
CREATE POLICY "select_lab_orders" ON lab_orders FOR SELECT
  TO authenticated USING (is_company_member(lab_orders.company_id));
CREATE POLICY "insert_lab_orders" ON lab_orders FOR INSERT
  TO authenticated WITH CHECK (is_company_member(lab_orders.company_id));
CREATE POLICY "update_lab_orders" ON lab_orders FOR UPDATE
  TO authenticated USING (is_company_member(lab_orders.company_id))
  WITH CHECK (is_company_member(lab_orders.company_id));
CREATE POLICY "delete_lab_orders" ON lab_orders FOR DELETE
  TO authenticated USING (is_company_member(lab_orders.company_id));

-- manufacturers
DROP POLICY IF EXISTS "auth_delete_manufacturers" ON manufacturers;
DROP POLICY IF EXISTS "auth_insert_manufacturers" ON manufacturers;
DROP POLICY IF EXISTS "auth_select_manufacturers" ON manufacturers;
DROP POLICY IF EXISTS "auth_update_manufacturers" ON manufacturers;
DROP POLICY IF EXISTS "select_manufacturers" ON manufacturers;
DROP POLICY IF EXISTS "insert_manufacturers" ON manufacturers;
DROP POLICY IF EXISTS "update_manufacturers" ON manufacturers;
DROP POLICY IF EXISTS "delete_manufacturers" ON manufacturers;
CREATE POLICY "select_manufacturers" ON manufacturers FOR SELECT
  TO authenticated USING (is_company_member(manufacturers.company_id));
CREATE POLICY "insert_manufacturers" ON manufacturers FOR INSERT
  TO authenticated WITH CHECK (is_company_member(manufacturers.company_id));
CREATE POLICY "update_manufacturers" ON manufacturers FOR UPDATE
  TO authenticated USING (is_company_member(manufacturers.company_id))
  WITH CHECK (is_company_member(manufacturers.company_id));
CREATE POLICY "delete_manufacturers" ON manufacturers FOR DELETE
  TO authenticated USING (is_company_member(manufacturers.company_id));

-- panel_rates
DROP POLICY IF EXISTS "auth_delete_panel_rates" ON panel_rates;
DROP POLICY IF EXISTS "auth_insert_panel_rates" ON panel_rates;
DROP POLICY IF EXISTS "auth_select_panel_rates" ON panel_rates;
DROP POLICY IF EXISTS "auth_update_panel_rates" ON panel_rates;
DROP POLICY IF EXISTS "select_panel_rates" ON panel_rates;
DROP POLICY IF EXISTS "insert_panel_rates" ON panel_rates;
DROP POLICY IF EXISTS "update_panel_rates" ON panel_rates;
DROP POLICY IF EXISTS "delete_panel_rates" ON panel_rates;
CREATE POLICY "select_panel_rates" ON panel_rates FOR SELECT
  TO authenticated USING (is_company_member(panel_rates.company_id));
CREATE POLICY "insert_panel_rates" ON panel_rates FOR INSERT
  TO authenticated WITH CHECK (is_company_member(panel_rates.company_id));
CREATE POLICY "update_panel_rates" ON panel_rates FOR UPDATE
  TO authenticated USING (is_company_member(panel_rates.company_id))
  WITH CHECK (is_company_member(panel_rates.company_id));
CREATE POLICY "delete_panel_rates" ON panel_rates FOR DELETE
  TO authenticated USING (is_company_member(panel_rates.company_id));

-- patients
DROP POLICY IF EXISTS "auth_delete_patients" ON patients;
DROP POLICY IF EXISTS "auth_insert_patients" ON patients;
DROP POLICY IF EXISTS "auth_select_patients" ON patients;
DROP POLICY IF EXISTS "auth_update_patients" ON patients;
DROP POLICY IF EXISTS "select_patients" ON patients;
DROP POLICY IF EXISTS "insert_patients" ON patients;
DROP POLICY IF EXISTS "update_patients" ON patients;
DROP POLICY IF EXISTS "delete_patients" ON patients;
CREATE POLICY "select_patients" ON patients FOR SELECT
  TO authenticated USING (is_company_member(patients.company_id));
CREATE POLICY "insert_patients" ON patients FOR INSERT
  TO authenticated WITH CHECK (is_company_member(patients.company_id));
CREATE POLICY "update_patients" ON patients FOR UPDATE
  TO authenticated USING (is_company_member(patients.company_id))
  WITH CHECK (is_company_member(patients.company_id));
CREATE POLICY "delete_patients" ON patients FOR DELETE
  TO authenticated USING (is_company_member(patients.company_id));

-- payroll
DROP POLICY IF EXISTS "auth_delete_payroll" ON payroll;
DROP POLICY IF EXISTS "auth_insert_payroll" ON payroll;
DROP POLICY IF EXISTS "auth_select_payroll" ON payroll;
DROP POLICY IF EXISTS "auth_update_payroll" ON payroll;
DROP POLICY IF EXISTS "select_payroll" ON payroll;
DROP POLICY IF EXISTS "insert_payroll" ON payroll;
DROP POLICY IF EXISTS "update_payroll" ON payroll;
DROP POLICY IF EXISTS "delete_payroll" ON payroll;
CREATE POLICY "select_payroll" ON payroll FOR SELECT
  TO authenticated USING (is_company_member(payroll.company_id));
CREATE POLICY "insert_payroll" ON payroll FOR INSERT
  TO authenticated WITH CHECK (is_company_member(payroll.company_id));
CREATE POLICY "update_payroll" ON payroll FOR UPDATE
  TO authenticated USING (is_company_member(payroll.company_id))
  WITH CHECK (is_company_member(payroll.company_id));
CREATE POLICY "delete_payroll" ON payroll FOR DELETE
  TO authenticated USING (is_company_member(payroll.company_id));

-- pharmacy_purchases
DROP POLICY IF EXISTS "auth_delete_pharm_purch" ON pharmacy_purchases;
DROP POLICY IF EXISTS "auth_insert_pharm_purch" ON pharmacy_purchases;
DROP POLICY IF EXISTS "auth_select_pharm_purch" ON pharmacy_purchases;
DROP POLICY IF EXISTS "auth_update_pharm_purch" ON pharmacy_purchases;
DROP POLICY IF EXISTS "select_pharm_purch" ON pharmacy_purchases;
DROP POLICY IF EXISTS "insert_pharm_purch" ON pharmacy_purchases;
DROP POLICY IF EXISTS "update_pharm_purch" ON pharmacy_purchases;
DROP POLICY IF EXISTS "delete_pharm_purch" ON pharmacy_purchases;
CREATE POLICY "select_pharm_purch" ON pharmacy_purchases FOR SELECT
  TO authenticated USING (is_company_member(pharmacy_purchases.company_id));
CREATE POLICY "insert_pharm_purch" ON pharmacy_purchases FOR INSERT
  TO authenticated WITH CHECK (is_company_member(pharmacy_purchases.company_id));
CREATE POLICY "update_pharm_purch" ON pharmacy_purchases FOR UPDATE
  TO authenticated USING (is_company_member(pharmacy_purchases.company_id))
  WITH CHECK (is_company_member(pharmacy_purchases.company_id));
CREATE POLICY "delete_pharm_purch" ON pharmacy_purchases FOR DELETE
  TO authenticated USING (is_company_member(pharmacy_purchases.company_id));

-- pharmacy_returns
DROP POLICY IF EXISTS "auth_delete_pharm_ret" ON pharmacy_returns;
DROP POLICY IF EXISTS "auth_insert_pharm_ret" ON pharmacy_returns;
DROP POLICY IF EXISTS "auth_select_pharm_ret" ON pharmacy_returns;
DROP POLICY IF EXISTS "auth_update_pharm_ret" ON pharmacy_returns;
DROP POLICY IF EXISTS "select_pharm_ret" ON pharmacy_returns;
DROP POLICY IF EXISTS "insert_pharm_ret" ON pharmacy_returns;
DROP POLICY IF EXISTS "update_pharm_ret" ON pharmacy_returns;
DROP POLICY IF EXISTS "delete_pharm_ret" ON pharmacy_returns;
CREATE POLICY "select_pharm_ret" ON pharmacy_returns FOR SELECT
  TO authenticated USING (is_company_member(pharmacy_returns.company_id));
CREATE POLICY "insert_pharm_ret" ON pharmacy_returns FOR INSERT
  TO authenticated WITH CHECK (is_company_member(pharmacy_returns.company_id));
CREATE POLICY "update_pharm_ret" ON pharmacy_returns FOR UPDATE
  TO authenticated USING (is_company_member(pharmacy_returns.company_id))
  WITH CHECK (is_company_member(pharmacy_returns.company_id));
CREATE POLICY "delete_pharm_ret" ON pharmacy_returns FOR DELETE
  TO authenticated USING (is_company_member(pharmacy_returns.company_id));

-- pharmacy_sales
DROP POLICY IF EXISTS "auth_delete_pharm_sales" ON pharmacy_sales;
DROP POLICY IF EXISTS "auth_insert_pharm_sales" ON pharmacy_sales;
DROP POLICY IF EXISTS "auth_select_pharm_sales" ON pharmacy_sales;
DROP POLICY IF EXISTS "auth_update_pharm_sales" ON pharmacy_sales;
DROP POLICY IF EXISTS "select_pharm_sales" ON pharmacy_sales;
DROP POLICY IF EXISTS "insert_pharm_sales" ON pharmacy_sales;
DROP POLICY IF EXISTS "update_pharm_sales" ON pharmacy_sales;
DROP POLICY IF EXISTS "delete_pharm_sales" ON pharmacy_sales;
CREATE POLICY "select_pharm_sales" ON pharmacy_sales FOR SELECT
  TO authenticated USING (is_company_member(pharmacy_sales.company_id));
CREATE POLICY "insert_pharm_sales" ON pharmacy_sales FOR INSERT
  TO authenticated WITH CHECK (is_company_member(pharmacy_sales.company_id));
CREATE POLICY "update_pharm_sales" ON pharmacy_sales FOR UPDATE
  TO authenticated USING (is_company_member(pharmacy_sales.company_id))
  WITH CHECK (is_company_member(pharmacy_sales.company_id));
CREATE POLICY "delete_pharm_sales" ON pharmacy_sales FOR DELETE
  TO authenticated USING (is_company_member(pharmacy_sales.company_id));

-- purchase_orders
DROP POLICY IF EXISTS "auth_delete_po" ON purchase_orders;
DROP POLICY IF EXISTS "auth_insert_po" ON purchase_orders;
DROP POLICY IF EXISTS "auth_select_po" ON purchase_orders;
DROP POLICY IF EXISTS "auth_update_po" ON purchase_orders;
DROP POLICY IF EXISTS "select_po" ON purchase_orders;
DROP POLICY IF EXISTS "insert_po" ON purchase_orders;
DROP POLICY IF EXISTS "update_po" ON purchase_orders;
DROP POLICY IF EXISTS "delete_po" ON purchase_orders;
CREATE POLICY "select_po" ON purchase_orders FOR SELECT
  TO authenticated USING (is_company_member(purchase_orders.company_id));
CREATE POLICY "insert_po" ON purchase_orders FOR INSERT
  TO authenticated WITH CHECK (is_company_member(purchase_orders.company_id));
CREATE POLICY "update_po" ON purchase_orders FOR UPDATE
  TO authenticated USING (is_company_member(purchase_orders.company_id))
  WITH CHECK (is_company_member(purchase_orders.company_id));
CREATE POLICY "delete_po" ON purchase_orders FOR DELETE
  TO authenticated USING (is_company_member(purchase_orders.company_id));

-- referral_settlements
DROP POLICY IF EXISTS "auth_delete_ref_settlements" ON referral_settlements;
DROP POLICY IF EXISTS "auth_insert_ref_settlements" ON referral_settlements;
DROP POLICY IF EXISTS "auth_select_ref_settlements" ON referral_settlements;
DROP POLICY IF EXISTS "auth_update_ref_settlements" ON referral_settlements;
DROP POLICY IF EXISTS "select_ref_settlements" ON referral_settlements;
DROP POLICY IF EXISTS "insert_ref_settlements" ON referral_settlements;
DROP POLICY IF EXISTS "update_ref_settlements" ON referral_settlements;
DROP POLICY IF EXISTS "delete_ref_settlements" ON referral_settlements;
CREATE POLICY "select_ref_settlements" ON referral_settlements FOR SELECT
  TO authenticated USING (is_company_member(referral_settlements.company_id));
CREATE POLICY "insert_ref_settlements" ON referral_settlements FOR INSERT
  TO authenticated WITH CHECK (is_company_member(referral_settlements.company_id));
CREATE POLICY "update_ref_settlements" ON referral_settlements FOR UPDATE
  TO authenticated USING (is_company_member(referral_settlements.company_id))
  WITH CHECK (is_company_member(referral_settlements.company_id));
CREATE POLICY "delete_ref_settlements" ON referral_settlements FOR DELETE
  TO authenticated USING (is_company_member(referral_settlements.company_id));

-- referral_sources
DROP POLICY IF EXISTS "auth_delete_referrals" ON referral_sources;
DROP POLICY IF EXISTS "auth_insert_referrals" ON referral_sources;
DROP POLICY IF EXISTS "auth_select_referrals" ON referral_sources;
DROP POLICY IF EXISTS "auth_update_referrals" ON referral_sources;
DROP POLICY IF EXISTS "select_referrals" ON referral_sources;
DROP POLICY IF EXISTS "insert_referrals" ON referral_sources;
DROP POLICY IF EXISTS "update_referrals" ON referral_sources;
DROP POLICY IF EXISTS "delete_referrals" ON referral_sources;
CREATE POLICY "select_referrals" ON referral_sources FOR SELECT
  TO authenticated USING (is_company_member(referral_sources.company_id));
CREATE POLICY "insert_referrals" ON referral_sources FOR INSERT
  TO authenticated WITH CHECK (is_company_member(referral_sources.company_id));
CREATE POLICY "update_referrals" ON referral_sources FOR UPDATE
  TO authenticated USING (is_company_member(referral_sources.company_id))
  WITH CHECK (is_company_member(referral_sources.company_id));
CREATE POLICY "delete_referrals" ON referral_sources FOR DELETE
  TO authenticated USING (is_company_member(referral_sources.company_id));

-- services
DROP POLICY IF EXISTS "auth_delete_services" ON services;
DROP POLICY IF EXISTS "auth_insert_services" ON services;
DROP POLICY IF EXISTS "auth_select_services" ON services;
DROP POLICY IF EXISTS "auth_update_services" ON services;
DROP POLICY IF EXISTS "select_services" ON services;
DROP POLICY IF EXISTS "insert_services" ON services;
DROP POLICY IF EXISTS "update_services" ON services;
DROP POLICY IF EXISTS "delete_services" ON services;
CREATE POLICY "select_services" ON services FOR SELECT
  TO authenticated USING (is_company_member(services.company_id));
CREATE POLICY "insert_services" ON services FOR INSERT
  TO authenticated WITH CHECK (is_company_member(services.company_id));
CREATE POLICY "update_services" ON services FOR UPDATE
  TO authenticated USING (is_company_member(services.company_id))
  WITH CHECK (is_company_member(services.company_id));
CREATE POLICY "delete_services" ON services FOR DELETE
  TO authenticated USING (is_company_member(services.company_id));

-- share_rules
DROP POLICY IF EXISTS "auth_delete_share_rules" ON share_rules;
DROP POLICY IF EXISTS "auth_insert_share_rules" ON share_rules;
DROP POLICY IF EXISTS "auth_select_share_rules" ON share_rules;
DROP POLICY IF EXISTS "auth_update_share_rules" ON share_rules;
DROP POLICY IF EXISTS "select_share_rules" ON share_rules;
DROP POLICY IF EXISTS "insert_share_rules" ON share_rules;
DROP POLICY IF EXISTS "update_share_rules" ON share_rules;
DROP POLICY IF EXISTS "delete_share_rules" ON share_rules;
CREATE POLICY "select_share_rules" ON share_rules FOR SELECT
  TO authenticated USING (is_company_member(share_rules.company_id));
CREATE POLICY "insert_share_rules" ON share_rules FOR INSERT
  TO authenticated WITH CHECK (is_company_member(share_rules.company_id));
CREATE POLICY "update_share_rules" ON share_rules FOR UPDATE
  TO authenticated USING (is_company_member(share_rules.company_id))
  WITH CHECK (is_company_member(share_rules.company_id));
CREATE POLICY "delete_share_rules" ON share_rules FOR DELETE
  TO authenticated USING (is_company_member(share_rules.company_id));

-- suppliers
DROP POLICY IF EXISTS "auth_delete_suppliers" ON suppliers;
DROP POLICY IF EXISTS "auth_insert_suppliers" ON suppliers;
DROP POLICY IF EXISTS "auth_select_suppliers" ON suppliers;
DROP POLICY IF EXISTS "auth_update_suppliers" ON suppliers;
DROP POLICY IF EXISTS "select_suppliers" ON suppliers;
DROP POLICY IF EXISTS "insert_suppliers" ON suppliers;
DROP POLICY IF EXISTS "update_suppliers" ON suppliers;
DROP POLICY IF EXISTS "delete_suppliers" ON suppliers;
CREATE POLICY "select_suppliers" ON suppliers FOR SELECT
  TO authenticated USING (is_company_member(suppliers.company_id));
CREATE POLICY "insert_suppliers" ON suppliers FOR INSERT
  TO authenticated WITH CHECK (is_company_member(suppliers.company_id));
CREATE POLICY "update_suppliers" ON suppliers FOR UPDATE
  TO authenticated USING (is_company_member(suppliers.company_id))
  WITH CHECK (is_company_member(suppliers.company_id));
CREATE POLICY "delete_suppliers" ON suppliers FOR DELETE
  TO authenticated USING (is_company_member(suppliers.company_id));

-- system_settings
DROP POLICY IF EXISTS "auth_delete_settings" ON system_settings;
DROP POLICY IF EXISTS "auth_insert_settings" ON system_settings;
DROP POLICY IF EXISTS "auth_select_settings" ON system_settings;
DROP POLICY IF EXISTS "auth_update_settings" ON system_settings;
DROP POLICY IF EXISTS "select_settings" ON system_settings;
DROP POLICY IF EXISTS "insert_settings" ON system_settings;
DROP POLICY IF EXISTS "update_settings" ON system_settings;
DROP POLICY IF EXISTS "delete_settings" ON system_settings;
CREATE POLICY "select_settings" ON system_settings FOR SELECT
  TO authenticated USING (is_company_member(system_settings.company_id));
CREATE POLICY "insert_settings" ON system_settings FOR INSERT
  TO authenticated WITH CHECK (is_company_member(system_settings.company_id));
CREATE POLICY "update_settings" ON system_settings FOR UPDATE
  TO authenticated USING (is_company_member(system_settings.company_id))
  WITH CHECK (is_company_member(system_settings.company_id));
CREATE POLICY "delete_settings" ON system_settings FOR DELETE
  TO authenticated USING (is_company_member(system_settings.company_id));

-- test_packages
DROP POLICY IF EXISTS "auth_delete_packages" ON test_packages;
DROP POLICY IF EXISTS "auth_insert_packages" ON test_packages;
DROP POLICY IF EXISTS "auth_select_packages" ON test_packages;
DROP POLICY IF EXISTS "auth_update_packages" ON test_packages;
DROP POLICY IF EXISTS "select_packages" ON test_packages;
DROP POLICY IF EXISTS "insert_packages" ON test_packages;
DROP POLICY IF EXISTS "update_packages" ON test_packages;
DROP POLICY IF EXISTS "delete_packages" ON test_packages;
CREATE POLICY "select_packages" ON test_packages FOR SELECT
  TO authenticated USING (is_company_member(test_packages.company_id));
CREATE POLICY "insert_packages" ON test_packages FOR INSERT
  TO authenticated WITH CHECK (is_company_member(test_packages.company_id));
CREATE POLICY "update_packages" ON test_packages FOR UPDATE
  TO authenticated USING (is_company_member(test_packages.company_id))
  WITH CHECK (is_company_member(test_packages.company_id));
CREATE POLICY "delete_packages" ON test_packages FOR DELETE
  TO authenticated USING (is_company_member(test_packages.company_id));

-- test_parameters
DROP POLICY IF EXISTS "auth_delete_test_params" ON test_parameters;
DROP POLICY IF EXISTS "auth_insert_test_params" ON test_parameters;
DROP POLICY IF EXISTS "auth_select_test_params" ON test_parameters;
DROP POLICY IF EXISTS "auth_update_test_params" ON test_parameters;
DROP POLICY IF EXISTS "select_test_params" ON test_parameters;
DROP POLICY IF EXISTS "insert_test_params" ON test_parameters;
DROP POLICY IF EXISTS "update_test_params" ON test_parameters;
DROP POLICY IF EXISTS "delete_test_params" ON test_parameters;
CREATE POLICY "select_test_params" ON test_parameters FOR SELECT
  TO authenticated USING (is_company_member(test_parameters.company_id));
CREATE POLICY "insert_test_params" ON test_parameters FOR INSERT
  TO authenticated WITH CHECK (is_company_member(test_parameters.company_id));
CREATE POLICY "update_test_params" ON test_parameters FOR UPDATE
  TO authenticated USING (is_company_member(test_parameters.company_id))
  WITH CHECK (is_company_member(test_parameters.company_id));
CREATE POLICY "delete_test_params" ON test_parameters FOR DELETE
  TO authenticated USING (is_company_member(test_parameters.company_id));

-- units
DROP POLICY IF EXISTS "auth_delete_units" ON units;
DROP POLICY IF EXISTS "auth_insert_units" ON units;
DROP POLICY IF EXISTS "auth_select_units" ON units;
DROP POLICY IF EXISTS "auth_update_units" ON units;
DROP POLICY IF EXISTS "select_units" ON units;
DROP POLICY IF EXISTS "insert_units" ON units;
DROP POLICY IF EXISTS "update_units" ON units;
DROP POLICY IF EXISTS "delete_units" ON units;
CREATE POLICY "select_units" ON units FOR SELECT
  TO authenticated USING (is_company_member(units.company_id));
CREATE POLICY "insert_units" ON units FOR INSERT
  TO authenticated WITH CHECK (is_company_member(units.company_id));
CREATE POLICY "update_units" ON units FOR UPDATE
  TO authenticated USING (is_company_member(units.company_id))
  WITH CHECK (is_company_member(units.company_id));
CREATE POLICY "delete_units" ON units FOR DELETE
  TO authenticated USING (is_company_member(units.company_id));

-- ============================================================
-- CHILD TABLES (scope through parent's company_id)
-- ============================================================

-- goods_receipt_items
DROP POLICY IF EXISTS "auth_delete_grn_items" ON goods_receipt_items;
DROP POLICY IF EXISTS "auth_insert_grn_items" ON goods_receipt_items;
DROP POLICY IF EXISTS "auth_select_grn_items" ON goods_receipt_items;
DROP POLICY IF EXISTS "auth_update_grn_items" ON goods_receipt_items;
DROP POLICY IF EXISTS "select_grn_items" ON goods_receipt_items;
DROP POLICY IF EXISTS "insert_grn_items" ON goods_receipt_items;
DROP POLICY IF EXISTS "update_grn_items" ON goods_receipt_items;
DROP POLICY IF EXISTS "delete_grn_items" ON goods_receipt_items;
CREATE POLICY "select_grn_items" ON goods_receipt_items FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM goods_receipt_notes grn WHERE grn.id = goods_receipt_items.grn_id
    AND is_company_member(grn.company_id)));
CREATE POLICY "insert_grn_items" ON goods_receipt_items FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM goods_receipt_notes grn WHERE grn.id = goods_receipt_items.grn_id
    AND is_company_member(grn.company_id)));
CREATE POLICY "update_grn_items" ON goods_receipt_items FOR UPDATE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM goods_receipt_notes grn WHERE grn.id = goods_receipt_items.grn_id
    AND is_company_member(grn.company_id)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM goods_receipt_notes grn WHERE grn.id = goods_receipt_items.grn_id
    AND is_company_member(grn.company_id)));
CREATE POLICY "delete_grn_items" ON goods_receipt_items FOR DELETE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM goods_receipt_notes grn WHERE grn.id = goods_receipt_items.grn_id
    AND is_company_member(grn.company_id)));

-- inventory_issue_items
DROP POLICY IF EXISTS "auth_delete_inv_issue_items" ON inventory_issue_items;
DROP POLICY IF EXISTS "auth_insert_inv_issue_items" ON inventory_issue_items;
DROP POLICY IF EXISTS "auth_select_inv_issue_items" ON inventory_issue_items;
DROP POLICY IF EXISTS "auth_update_inv_issue_items" ON inventory_issue_items;
DROP POLICY IF EXISTS "select_inv_issue_items" ON inventory_issue_items;
DROP POLICY IF EXISTS "insert_inv_issue_items" ON inventory_issue_items;
DROP POLICY IF EXISTS "update_inv_issue_items" ON inventory_issue_items;
DROP POLICY IF EXISTS "delete_inv_issue_items" ON inventory_issue_items;
CREATE POLICY "select_inv_issue_items" ON inventory_issue_items FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM inventory_issues ii WHERE ii.id = inventory_issue_items.issue_id
    AND is_company_member(ii.company_id)));
CREATE POLICY "insert_inv_issue_items" ON inventory_issue_items FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM inventory_issues ii WHERE ii.id = inventory_issue_items.issue_id
    AND is_company_member(ii.company_id)));
CREATE POLICY "update_inv_issue_items" ON inventory_issue_items FOR UPDATE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM inventory_issues ii WHERE ii.id = inventory_issue_items.issue_id
    AND is_company_member(ii.company_id)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM inventory_issues ii WHERE ii.id = inventory_issue_items.issue_id
    AND is_company_member(ii.company_id)));
CREATE POLICY "delete_inv_issue_items" ON inventory_issue_items FOR DELETE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM inventory_issues ii WHERE ii.id = inventory_issue_items.issue_id
    AND is_company_member(ii.company_id)));

-- journal_lines
DROP POLICY IF EXISTS "auth_delete_journal_lines" ON journal_lines;
DROP POLICY IF EXISTS "auth_insert_journal_lines" ON journal_lines;
DROP POLICY IF EXISTS "auth_select_journal_lines" ON journal_lines;
DROP POLICY IF EXISTS "auth_update_journal_lines" ON journal_lines;
DROP POLICY IF EXISTS "select_journal_lines" ON journal_lines;
DROP POLICY IF EXISTS "insert_journal_lines" ON journal_lines;
DROP POLICY IF EXISTS "update_journal_lines" ON journal_lines;
DROP POLICY IF EXISTS "delete_journal_lines" ON journal_lines;
CREATE POLICY "select_journal_lines" ON journal_lines FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM journal_entries je WHERE je.id = journal_lines.journal_entry_id
    AND is_company_member(je.company_id)));
CREATE POLICY "insert_journal_lines" ON journal_lines FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM journal_entries je WHERE je.id = journal_lines.journal_entry_id
    AND is_company_member(je.company_id)));
CREATE POLICY "update_journal_lines" ON journal_lines FOR UPDATE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM journal_entries je WHERE je.id = journal_lines.journal_entry_id
    AND is_company_member(je.company_id)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM journal_entries je WHERE je.id = journal_lines.journal_entry_id
    AND is_company_member(je.company_id)));
CREATE POLICY "delete_journal_lines" ON journal_lines FOR DELETE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM journal_entries je WHERE je.id = journal_lines.journal_entry_id
    AND is_company_member(je.company_id)));

-- lab_order_items
DROP POLICY IF EXISTS "auth_delete_lab_order_items" ON lab_order_items;
DROP POLICY IF EXISTS "auth_insert_lab_order_items" ON lab_order_items;
DROP POLICY IF EXISTS "auth_select_lab_order_items" ON lab_order_items;
DROP POLICY IF EXISTS "auth_update_lab_order_items" ON lab_order_items;
DROP POLICY IF EXISTS "select_lab_order_items" ON lab_order_items;
DROP POLICY IF EXISTS "insert_lab_order_items" ON lab_order_items;
DROP POLICY IF EXISTS "update_lab_order_items" ON lab_order_items;
DROP POLICY IF EXISTS "delete_lab_order_items" ON lab_order_items;
CREATE POLICY "select_lab_order_items" ON lab_order_items FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM lab_orders lo WHERE lo.id = lab_order_items.lab_order_id
    AND is_company_member(lo.company_id)));
CREATE POLICY "insert_lab_order_items" ON lab_order_items FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM lab_orders lo WHERE lo.id = lab_order_items.lab_order_id
    AND is_company_member(lo.company_id)));
CREATE POLICY "update_lab_order_items" ON lab_order_items FOR UPDATE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM lab_orders lo WHERE lo.id = lab_order_items.lab_order_id
    AND is_company_member(lo.company_id)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM lab_orders lo WHERE lo.id = lab_order_items.lab_order_id
    AND is_company_member(lo.company_id)));
CREATE POLICY "delete_lab_order_items" ON lab_order_items FOR DELETE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM lab_orders lo WHERE lo.id = lab_order_items.lab_order_id
    AND is_company_member(lo.company_id)));

-- lab_results
DROP POLICY IF EXISTS "auth_delete_lab_results" ON lab_results;
DROP POLICY IF EXISTS "auth_insert_lab_results" ON lab_results;
DROP POLICY IF EXISTS "auth_select_lab_results" ON lab_results;
DROP POLICY IF EXISTS "auth_update_lab_results" ON lab_results;
DROP POLICY IF EXISTS "select_lab_results" ON lab_results;
DROP POLICY IF EXISTS "insert_lab_results" ON lab_results;
DROP POLICY IF EXISTS "update_lab_results" ON lab_results;
DROP POLICY IF EXISTS "delete_lab_results" ON lab_results;
CREATE POLICY "select_lab_results" ON lab_results FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM lab_order_items loi
    JOIN lab_orders lo ON lo.id = loi.lab_order_id
    WHERE loi.id = lab_results.lab_order_item_id
    AND is_company_member(lo.company_id)));
CREATE POLICY "insert_lab_results" ON lab_results FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM lab_order_items loi
    JOIN lab_orders lo ON lo.id = loi.lab_order_id
    WHERE loi.id = lab_results.lab_order_item_id
    AND is_company_member(lo.company_id)));
CREATE POLICY "update_lab_results" ON lab_results FOR UPDATE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM lab_order_items loi
    JOIN lab_orders lo ON lo.id = loi.lab_order_id
    WHERE loi.id = lab_results.lab_order_item_id
    AND is_company_member(lo.company_id)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM lab_order_items loi
    JOIN lab_orders lo ON lo.id = loi.lab_order_id
    WHERE loi.id = lab_results.lab_order_item_id
    AND is_company_member(lo.company_id)));
CREATE POLICY "delete_lab_results" ON lab_results FOR DELETE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM lab_order_items loi
    JOIN lab_orders lo ON lo.id = loi.lab_order_id
    WHERE loi.id = lab_results.lab_order_item_id
    AND is_company_member(lo.company_id)));

-- lab_result_parameters
DROP POLICY IF EXISTS "auth_delete_lab_result_params" ON lab_result_parameters;
DROP POLICY IF EXISTS "auth_insert_lab_result_params" ON lab_result_parameters;
DROP POLICY IF EXISTS "auth_select_lab_result_params" ON lab_result_parameters;
DROP POLICY IF EXISTS "auth_update_lab_result_params" ON lab_result_parameters;
DROP POLICY IF EXISTS "select_lab_result_params" ON lab_result_parameters;
DROP POLICY IF EXISTS "insert_lab_result_params" ON lab_result_parameters;
DROP POLICY IF EXISTS "update_lab_result_params" ON lab_result_parameters;
DROP POLICY IF EXISTS "delete_lab_result_params" ON lab_result_parameters;
CREATE POLICY "select_lab_result_params" ON lab_result_parameters FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM lab_results lr
    JOIN lab_order_items loi ON loi.id = lr.lab_order_item_id
    JOIN lab_orders lo ON lo.id = loi.lab_order_id
    WHERE lr.id = lab_result_parameters.lab_result_id
    AND is_company_member(lo.company_id)));
CREATE POLICY "insert_lab_result_params" ON lab_result_parameters FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM lab_results lr
    JOIN lab_order_items loi ON loi.id = lr.lab_order_item_id
    JOIN lab_orders lo ON lo.id = loi.lab_order_id
    WHERE lr.id = lab_result_parameters.lab_result_id
    AND is_company_member(lo.company_id)));
CREATE POLICY "update_lab_result_params" ON lab_result_parameters FOR UPDATE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM lab_results lr
    JOIN lab_order_items loi ON loi.id = lr.lab_order_item_id
    JOIN lab_orders lo ON lo.id = loi.lab_order_id
    WHERE lr.id = lab_result_parameters.lab_result_id
    AND is_company_member(lo.company_id)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM lab_results lr
    JOIN lab_order_items loi ON loi.id = lr.lab_order_item_id
    JOIN lab_orders lo ON lo.id = loi.lab_order_id
    WHERE lr.id = lab_result_parameters.lab_result_id
    AND is_company_member(lo.company_id)));
CREATE POLICY "delete_lab_result_params" ON lab_result_parameters FOR DELETE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM lab_results lr
    JOIN lab_order_items loi ON loi.id = lr.lab_order_item_id
    JOIN lab_orders lo ON lo.id = loi.lab_order_id
    WHERE lr.id = lab_result_parameters.lab_result_id
    AND is_company_member(lo.company_id)));

-- package_items
DROP POLICY IF EXISTS "auth_delete_package_items" ON package_items;
DROP POLICY IF EXISTS "auth_insert_package_items" ON package_items;
DROP POLICY IF EXISTS "auth_select_package_items" ON package_items;
DROP POLICY IF EXISTS "auth_update_package_items" ON package_items;
DROP POLICY IF EXISTS "select_package_items" ON package_items;
DROP POLICY IF EXISTS "insert_package_items" ON package_items;
DROP POLICY IF EXISTS "update_package_items" ON package_items;
DROP POLICY IF EXISTS "delete_package_items" ON package_items;
CREATE POLICY "select_package_items" ON package_items FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM test_packages tp WHERE tp.id = package_items.package_id
    AND is_company_member(tp.company_id)));
CREATE POLICY "insert_package_items" ON package_items FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM test_packages tp WHERE tp.id = package_items.package_id
    AND is_company_member(tp.company_id)));
CREATE POLICY "update_package_items" ON package_items FOR UPDATE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM test_packages tp WHERE tp.id = package_items.package_id
    AND is_company_member(tp.company_id)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM test_packages tp WHERE tp.id = package_items.package_id
    AND is_company_member(tp.company_id)));
CREATE POLICY "delete_package_items" ON package_items FOR DELETE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM test_packages tp WHERE tp.id = package_items.package_id
    AND is_company_member(tp.company_id)));

-- pharmacy_sale_items
DROP POLICY IF EXISTS "auth_delete_pharm_sale_items" ON pharmacy_sale_items;
DROP POLICY IF EXISTS "auth_insert_pharm_sale_items" ON pharmacy_sale_items;
DROP POLICY IF EXISTS "auth_select_pharm_sale_items" ON pharmacy_sale_items;
DROP POLICY IF EXISTS "auth_update_pharm_sale_items" ON pharmacy_sale_items;
DROP POLICY IF EXISTS "select_pharm_sale_items" ON pharmacy_sale_items;
DROP POLICY IF EXISTS "insert_pharm_sale_items" ON pharmacy_sale_items;
DROP POLICY IF EXISTS "update_pharm_sale_items" ON pharmacy_sale_items;
DROP POLICY IF EXISTS "delete_pharm_sale_items" ON pharmacy_sale_items;
CREATE POLICY "select_pharm_sale_items" ON pharmacy_sale_items FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM pharmacy_sales ps WHERE ps.id = pharmacy_sale_items.sale_id
    AND is_company_member(ps.company_id)));
CREATE POLICY "insert_pharm_sale_items" ON pharmacy_sale_items FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM pharmacy_sales ps WHERE ps.id = pharmacy_sale_items.sale_id
    AND is_company_member(ps.company_id)));
CREATE POLICY "update_pharm_sale_items" ON pharmacy_sale_items FOR UPDATE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM pharmacy_sales ps WHERE ps.id = pharmacy_sale_items.sale_id
    AND is_company_member(ps.company_id)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM pharmacy_sales ps WHERE ps.id = pharmacy_sale_items.sale_id
    AND is_company_member(ps.company_id)));
CREATE POLICY "delete_pharm_sale_items" ON pharmacy_sale_items FOR DELETE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM pharmacy_sales ps WHERE ps.id = pharmacy_sale_items.sale_id
    AND is_company_member(ps.company_id)));

-- purchase_order_items
DROP POLICY IF EXISTS "auth_delete_po_items" ON purchase_order_items;
DROP POLICY IF EXISTS "auth_insert_po_items" ON purchase_order_items;
DROP POLICY IF EXISTS "auth_select_po_items" ON purchase_order_items;
DROP POLICY IF EXISTS "auth_update_po_items" ON purchase_order_items;
DROP POLICY IF EXISTS "select_po_items" ON purchase_order_items;
DROP POLICY IF EXISTS "insert_po_items" ON purchase_order_items;
DROP POLICY IF EXISTS "update_po_items" ON purchase_order_items;
DROP POLICY IF EXISTS "delete_po_items" ON purchase_order_items;
CREATE POLICY "select_po_items" ON purchase_order_items FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM purchase_orders po WHERE po.id = purchase_order_items.po_id
    AND is_company_member(po.company_id)));
CREATE POLICY "insert_po_items" ON purchase_order_items FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM purchase_orders po WHERE po.id = purchase_order_items.po_id
    AND is_company_member(po.company_id)));
CREATE POLICY "update_po_items" ON purchase_order_items FOR UPDATE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM purchase_orders po WHERE po.id = purchase_order_items.po_id
    AND is_company_member(po.company_id)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM purchase_orders po WHERE po.id = purchase_order_items.po_id
    AND is_company_member(po.company_id)));
CREATE POLICY "delete_po_items" ON purchase_order_items FOR DELETE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM purchase_orders po WHERE po.id = purchase_order_items.po_id
    AND is_company_member(po.company_id)));

-- ============================================================
-- GLOBAL REFERENCE TABLES (shared system data)
-- ============================================================

-- roles
DROP POLICY IF EXISTS "auth_delete_roles" ON roles;
DROP POLICY IF EXISTS "auth_insert_roles" ON roles;
DROP POLICY IF EXISTS "auth_select_roles" ON roles;
DROP POLICY IF EXISTS "auth_update_roles" ON roles;
DROP POLICY IF EXISTS "select_roles" ON roles;
DROP POLICY IF EXISTS "insert_roles" ON roles;
DROP POLICY IF EXISTS "update_roles" ON roles;
DROP POLICY IF EXISTS "delete_roles" ON roles;
CREATE POLICY "select_roles" ON roles FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_roles" ON roles FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_roles" ON roles FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_roles" ON roles FOR DELETE
  TO authenticated USING (true);

-- permissions
DROP POLICY IF EXISTS "auth_delete_permissions" ON permissions;
DROP POLICY IF EXISTS "auth_insert_permissions" ON permissions;
DROP POLICY IF EXISTS "auth_select_permissions" ON permissions;
DROP POLICY IF EXISTS "auth_update_permissions" ON permissions;
DROP POLICY IF EXISTS "select_permissions" ON permissions;
DROP POLICY IF EXISTS "insert_permissions" ON permissions;
DROP POLICY IF EXISTS "update_permissions" ON permissions;
DROP POLICY IF EXISTS "delete_permissions" ON permissions;
CREATE POLICY "select_permissions" ON permissions FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_permissions" ON permissions FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_permissions" ON permissions FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_permissions" ON permissions FOR DELETE
  TO authenticated USING (true);

-- role_permissions
DROP POLICY IF EXISTS "auth_delete_role_perms" ON role_permissions;
DROP POLICY IF EXISTS "auth_insert_role_perms" ON role_permissions;
DROP POLICY IF EXISTS "auth_select_role_perms" ON role_permissions;
DROP POLICY IF EXISTS "auth_update_role_perms" ON role_permissions;
DROP POLICY IF EXISTS "select_role_perms" ON role_permissions;
DROP POLICY IF EXISTS "insert_role_perms" ON role_permissions;
DROP POLICY IF EXISTS "update_role_perms" ON role_permissions;
DROP POLICY IF EXISTS "delete_role_perms" ON role_permissions;
CREATE POLICY "select_role_perms" ON role_permissions FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_role_perms" ON role_permissions FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_role_perms" ON role_permissions FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_role_perms" ON role_permissions FOR DELETE
  TO authenticated USING (true);

-- system_status
DROP POLICY IF EXISTS "auth_delete_sys_status" ON system_status;
DROP POLICY IF EXISTS "auth_insert_sys_status" ON system_status;
DROP POLICY IF EXISTS "auth_select_sys_status" ON system_status;
DROP POLICY IF EXISTS "auth_update_sys_status" ON system_status;
DROP POLICY IF EXISTS "select_sys_status" ON system_status;
DROP POLICY IF EXISTS "insert_sys_status" ON system_status;
DROP POLICY IF EXISTS "update_sys_status" ON system_status;
DROP POLICY IF EXISTS "delete_sys_status" ON system_status;
CREATE POLICY "select_sys_status" ON system_status FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_sys_status" ON system_status FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_sys_status" ON system_status FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_sys_status" ON system_status FOR DELETE
  TO authenticated USING (true);

-- audit_logs
DROP POLICY IF EXISTS "auth_delete_audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "auth_insert_audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "auth_select_audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "auth_update_audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "select_audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "insert_audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "update_audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "delete_audit_logs" ON audit_logs;
CREATE POLICY "select_audit_logs" ON audit_logs FOR SELECT
  TO authenticated USING (auth.uid() = audit_logs.user_id);
CREATE POLICY "insert_audit_logs" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = audit_logs.user_id);
CREATE POLICY "update_audit_logs" ON audit_logs FOR UPDATE
  TO authenticated USING (auth.uid() = audit_logs.user_id)
  WITH CHECK (auth.uid() = audit_logs.user_id);
CREATE POLICY "delete_audit_logs" ON audit_logs FOR DELETE
  TO authenticated USING (auth.uid() = audit_logs.user_id);

-- companies
DROP POLICY IF EXISTS "auth_delete_companies" ON companies;
DROP POLICY IF EXISTS "auth_insert_companies" ON companies;
DROP POLICY IF EXISTS "auth_select_companies" ON companies;
DROP POLICY IF EXISTS "auth_update_companies" ON companies;
DROP POLICY IF EXISTS "select_companies" ON companies;
DROP POLICY IF EXISTS "insert_companies" ON companies;
DROP POLICY IF EXISTS "update_companies" ON companies;
DROP POLICY IF EXISTS "delete_companies" ON companies;
CREATE POLICY "select_companies" ON companies FOR SELECT
  TO authenticated USING (is_company_member(companies.id));
CREATE POLICY "insert_companies" ON companies FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_companies" ON companies FOR UPDATE
  TO authenticated USING (is_company_member(companies.id))
  WITH CHECK (is_company_member(companies.id));
CREATE POLICY "delete_companies" ON companies FOR DELETE
  TO authenticated USING (is_company_member(companies.id));
