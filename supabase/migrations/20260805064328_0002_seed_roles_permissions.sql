/*
# Healthcare ERP - Seed Default Roles & Permissions

## Overview
Seeds the 13 system roles and ~90 module/action permissions, then maps
full permissions to super_admin and appropriate subsets to each role.

## Changes
1. Inserts 13 roles (super_admin, admin, manager, reception, doctor, pathologist,
   radiologist, lab_technician, pharmacist, cashier, accountant, hr, store_manager).
2. Inserts ~90 permissions across 14 modules (dashboard, patients, billing, lab,
   radiology, pharmacy, inventory, accounting, hr, reports, masters, settings,
   import_export, audit).
3. Maps permissions to roles:
   - super_admin: ALL permissions
   - admin: ALL except settings.delete
   - manager: most except user/role management & settings delete
   - role-specific subsets for each operational role

## Security
- No schema changes. Only data inserts.
- Idempotent via ON CONFLICT DO NOTHING.
*/

-- ============================================================
-- 1. ROLES
-- ============================================================

INSERT INTO roles (name, display_name, description, is_system) VALUES
  ('super_admin',     'Super Admin',      'Full system access', true),
  ('admin',           'Administrator',    'Full access except system deletion', true),
  ('manager',         'Manager',          'Operational management access', true),
  ('reception',       'Reception',        'Patient registration and front desk', true),
  ('doctor',          'Doctor',           'Doctor portal - OPD and results', true),
  ('pathologist',     'Pathologist',      'Lab result verification and approval', true),
  ('radiologist',     'Radiologist',      'Radiology reporting and approval', true),
  ('lab_technician',  'Lab Technician',   'Sample processing and result entry', true),
  ('pharmacist',      'Pharmacist',       'Pharmacy sales and inventory', true),
  ('cashier',         'Cashier',          'Billing and payment collection', true),
  ('accountant',      'Accountant',        'Accounting and financial reports', true),
  ('hr',              'HR',               'Human resource management', true),
  ('store_manager',   'Store Manager',     'Inventory and store management', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 2. PERMISSIONS
-- ============================================================

INSERT INTO permissions (module, action, description) VALUES
  -- Dashboard
  ('dashboard', 'view',      'View dashboard'),
  -- Patients
  ('patients', 'view',       'View patients'),
  ('patients', 'create',     'Register new patient'),
  ('patients', 'edit',       'Edit patient information'),
  ('patients', 'delete',     'Delete patient'),
  ('patients', 'export',    'Export patient list'),
  ('patients', 'import',    'Import patients'),
  -- Billing / Invoices
  ('billing', 'view',        'View invoices'),
  ('billing', 'create',     'Create invoice'),
  ('billing', 'edit',       'Edit invoice'),
  ('billing', 'delete',     'Delete invoice'),
  ('billing', 'cancel',     'Cancel invoice'),
  ('billing', 'refund',     'Process refund'),
  ('billing', 'export',      'Export invoices'),
  -- Lab
  ('lab', 'view',            'View lab orders'),
  ('lab', 'collect',         'Collect samples'),
  ('lab', 'process',         'Process samples'),
  ('lab', 'result_entry',    'Enter results'),
  ('lab', 'verify',          'Verify results'),
  ('lab', 'approve',         'Approve and release reports'),
  ('lab', 'export',          'Export lab reports'),
  -- Radiology
  ('radiology', 'view',      'View radiology orders'),
  ('radiology', 'capture',   'Capture images'),
  ('radiology', 'report',   'Enter findings'),
  ('radiology', 'approve',  'Approve radiology reports'),
  ('radiology', 'export',    'Export radiology reports'),
  -- Pharmacy
  ('pharmacy', 'view',       'View pharmacy'),
  ('pharmacy', 'sale',       'Process pharmacy sale'),
  ('pharmacy', 'purchase',   'Process pharmacy purchase'),
  ('pharmacy', 'return',     'Process returns'),
  ('pharmacy', 'adjust',     'Adjust pharmacy stock'),
  ('pharmacy', 'export',     'Export pharmacy data'),
  -- Inventory
  ('inventory', 'view',      'View inventory'),
  ('inventory', 'create',    'Create inventory items'),
  ('inventory', 'edit',      'Edit inventory items'),
  ('inventory', 'delete',    'Delete inventory items'),
  ('inventory', 'transfer',  'Transfer stock between branches'),
  ('inventory', 'adjust',    'Adjust stock'),
  ('inventory', 'import',    'Import inventory'),
  ('inventory', 'export',    'Export inventory'),
  -- Accounting
  ('accounting', 'view',     'View accounting'),
  ('accounting', 'journal',  'Create journal entries'),
  ('accounting', 'edit',     'Edit journal entries'),
  ('accounting', 'delete',   'Delete journal entries'),
  ('accounting', 'reports',  'View financial reports'),
  ('accounting', 'export',   'Export financial reports'),
  -- HR
  ('hr', 'view',             'View HR module'),
  ('hr', 'create',           'Create employee'),
  ('hr', 'edit',             'Edit employee'),
  ('hr', 'delete',           'Delete employee'),
  ('hr', 'payroll',          'Process payroll'),
  ('hr', 'attendance',       'Manage attendance'),
  ('hr', 'export',           'Export HR data'),
  -- Reports
  ('reports', 'view',        'View reports'),
  ('reports', 'export',      'Export reports'),
  -- Masters
  ('masters', 'view',        'View master data'),
  ('masters', 'create',      'Create master records'),
  ('masters', 'edit',        'Edit master records'),
  ('masters', 'delete',      'Delete master records'),
  ('masters', 'import',      'Import master data'),
  ('masters', 'export',      'Export master data'),
  -- Settings
  ('settings', 'view',       'View settings'),
  ('settings', 'edit',       'Edit settings'),
  ('settings', 'delete',     'Delete settings'),
  ('settings', 'users',      'Manage users'),
  ('settings', 'roles',      'Manage roles and permissions'),
  -- Import/Export Center
  ('import_export', 'view',  'View import/export center'),
  ('import_export', 'import','Import data'),
  ('import_export', 'export','Export data'),
  -- Audit
  ('audit', 'view',          'View audit logs'),
  ('audit', 'export',        'Export audit logs')
ON CONFLICT (module, action) DO NOTHING;

-- ============================================================
-- 3. ROLE-PERMISSION MAPPINGS
-- ============================================================

-- super_admin: ALL permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- admin: ALL except settings.delete
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'admin'
  AND NOT (p.module = 'settings' AND p.action = 'delete')
ON CONFLICT DO NOTHING;

-- manager: everything except user/role management & settings delete
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'manager'
  AND NOT (p.module = 'settings' AND p.action IN ('delete','users','roles'))
  AND NOT (p.module = 'audit' AND p.action = 'export')
ON CONFLICT DO NOTHING;

-- reception: patients, billing, dashboard, masters.view, reports.view
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'reception'
  AND (
    (p.module = 'dashboard' AND p.action = 'view')
    OR (p.module = 'patients')
    OR (p.module = 'billing' AND p.action IN ('view','create','edit','export'))
    OR (p.module = 'lab' AND p.action IN ('view','collect'))
    OR (p.module = 'radiology' AND p.action IN ('view'))
    OR (p.module = 'masters' AND p.action = 'view')
    OR (p.module = 'reports' AND p.action IN ('view','export'))
  )
ON CONFLICT DO NOTHING;

-- doctor: dashboard, patients.view, lab.view/verify, radiology.view, reports.view
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'doctor'
  AND (
    (p.module = 'dashboard' AND p.action = 'view')
    OR (p.module = 'patients' AND p.action IN ('view','export'))
    OR (p.module = 'lab' AND p.action IN ('view','verify','approve','export'))
    OR (p.module = 'radiology' AND p.action IN ('view','report','approve','export'))
    OR (p.module = 'reports' AND p.action IN ('view','export'))
  )
ON CONFLICT DO NOTHING;

-- pathologist: lab full + dashboard + patients.view + reports
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'pathologist'
  AND (
    (p.module = 'dashboard' AND p.action = 'view')
    OR (p.module = 'patients' AND p.action IN ('view','export'))
    OR (p.module = 'lab')
    OR (p.module = 'reports' AND p.action IN ('view','export'))
  )
ON CONFLICT DO NOTHING;

-- radiologist: radiology full + dashboard + patients.view + reports
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'radiologist'
  AND (
    (p.module = 'dashboard' AND p.action = 'view')
    OR (p.module = 'patients' AND p.action IN ('view','export'))
    OR (p.module = 'radiology')
    OR (p.module = 'reports' AND p.action IN ('view','export'))
  )
ON CONFLICT DO NOTHING;

-- lab_technician: lab view/collect/process/result_entry + dashboard
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'lab_technician'
  AND (
    (p.module = 'dashboard' AND p.action = 'view')
    OR (p.module = 'lab' AND p.action IN ('view','collect','process','result_entry','export'))
    OR (p.module = 'patients' AND p.action = 'view')
  )
ON CONFLICT DO NOTHING;

-- pharmacist: pharmacy full + dashboard + inventory view
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'pharmacist'
  AND (
    (p.module = 'dashboard' AND p.action = 'view')
    OR (p.module = 'pharmacy')
    OR (p.module = 'inventory' AND p.action IN ('view','export'))
    OR (p.module = 'reports' AND p.action IN ('view','export'))
  )
ON CONFLICT DO NOTHING;

-- cashier: billing full + dashboard + reports.view
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'cashier'
  AND (
    (p.module = 'dashboard' AND p.action = 'view')
    OR (p.module = 'billing')
    OR (p.module = 'patients' AND p.action IN ('view','export'))
    OR (p.module = 'reports' AND p.action IN ('view','export'))
  )
ON CONFLICT DO NOTHING;

-- accountant: accounting full + dashboard + reports + billing.view
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'accountant'
  AND (
    (p.module = 'dashboard' AND p.action = 'view')
    OR (p.module = 'accounting')
    OR (p.module = 'billing' AND p.action IN ('view','export'))
    OR (p.module = 'reports' AND p.action IN ('view','export'))
    OR (p.module = 'import_export' AND p.action IN ('view','export'))
  )
ON CONFLICT DO NOTHING;

-- hr: hr full + dashboard + reports
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'hr'
  AND (
    (p.module = 'dashboard' AND p.action = 'view')
    OR (p.module = 'hr')
    OR (p.module = 'reports' AND p.action IN ('view','export'))
  )
ON CONFLICT DO NOTHING;

-- store_manager: inventory full + dashboard + pharmacy.view + reports
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'store_manager'
  AND (
    (p.module = 'dashboard' AND p.action = 'view')
    OR (p.module = 'inventory')
    OR (p.module = 'pharmacy' AND p.action IN ('view','purchase','adjust','export'))
    OR (p.module = 'reports' AND p.action IN ('view','export'))
    OR (p.module = 'import_export' AND p.action IN ('view','import','export'))
  )
ON CONFLICT DO NOTHING;
