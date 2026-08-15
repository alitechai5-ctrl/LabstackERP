-- Add reception module permissions
-- Reception is the central working module for front-desk staff

INSERT INTO permissions (module, action, description)
VALUES
  ('reception', 'view', 'View reception dashboard'),
  ('reception', 'register', 'Register new patients'),
  ('reception', 'search', 'Search patients and track status'),
  ('reception', 'billing', 'Create and manage invoices'),
  ('reception', 'payment', 'Collect payments'),
  ('reception', 'print', 'Print invoices, receipts, barcodes, reports'),
  ('reception', 'reports', 'Access report center'),
  ('reception', 'appointments', 'Manage appointments')
ON CONFLICT (module, action) DO NOTHING;

-- Grant all reception permissions to reception, admin, super_admin, cashier roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.module = 'reception'
  AND r.name IN ('super_admin', 'admin', 'reception', 'cashier', 'manager')
ON CONFLICT DO NOTHING;

-- Also grant reception:view and reception:search to doctor, pathologist roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.module = 'reception' AND p.action IN ('view', 'search', 'reports')
  AND r.name IN ('doctor', 'pathologist', 'radiologist', 'lab_technician')
ON CONFLICT DO NOTHING;

-- Add administration module permissions (replaces masters for admin-only items)
INSERT INTO permissions (module, action, description)
VALUES
  ('administration', 'view', 'View administration section'),
  ('administration', 'companies', 'Manage companies'),
  ('administration', 'branches', 'Manage branches'),
  ('administration', 'users', 'Manage users'),
  ('administration', 'roles', 'Manage roles and permissions'),
  ('administration', 'financial_years', 'Manage financial years'),
  ('administration', 'audit', 'View audit logs'),
  ('administration', 'settings', 'Manage system settings')
ON CONFLICT (module, action) DO NOTHING;

-- Grant administration permissions to super_admin and admin only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.module = 'administration'
  AND r.name IN ('super_admin', 'admin')
ON CONFLICT DO NOTHING;
