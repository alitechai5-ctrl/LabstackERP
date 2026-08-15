/*
# Create appointments table

1. New Tables
- `appointments`
  - `id` (uuid, primary key)
  - `company_id` (uuid, FK -> companies)
  - `branch_id` (uuid, nullable, FK -> branches)
  - `patient_id` (uuid, FK -> patients)
  - `doctor_id` (uuid, nullable, FK -> doctors)
  - `department_id` (uuid, nullable, FK -> departments)
  - `appointment_date` (date, not null)
  - `appointment_time` (time, nullable)
  - `status` (text: scheduled, checked_in, completed, cancelled, no_show, walk_in, follow_up)
  - `type` (text: new, follow_up, walk_in)
  - `reason` (text, nullable)
  - `notes` (text, nullable)
  - `created_by` (uuid, nullable)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

2. Security
- RLS enabled with company-scoped CRUD for authenticated users.
*/

CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES doctors(id) ON DELETE SET NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  appointment_date date NOT NULL,
  appointment_time time,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'checked_in', 'completed', 'cancelled', 'no_show', 'walk_in')),
  type text NOT NULL DEFAULT 'new' CHECK (type IN ('new', 'follow_up', 'walk_in')),
  reason text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_company ON appointments(company_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_appointments" ON appointments;
CREATE POLICY "select_appointments" ON appointments FOR SELECT
  TO authenticated USING (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = appointments.company_id));

DROP POLICY IF EXISTS "insert_appointments" ON appointments;
CREATE POLICY "insert_appointments" ON appointments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = appointments.company_id));

DROP POLICY IF EXISTS "update_appointments" ON appointments;
CREATE POLICY "update_appointments" ON appointments FOR UPDATE
  TO authenticated USING (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = appointments.company_id))
  WITH CHECK (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = appointments.company_id));

DROP POLICY IF EXISTS "delete_appointments" ON appointments;
CREATE POLICY "delete_appointments" ON appointments FOR DELETE
  TO authenticated USING (auth.uid() IN (SELECT auth_user_id FROM app_users WHERE company_id = appointments.company_id));
