/*
# Add verified_by_doctor_id to lab_order_items

1. Changes
- Add `verified_by_doctor_id` column to `lab_order_items` (uuid, nullable, FK -> doctors).
- This allows radiology reports to record which doctor verified/signed off the report,
  separate from the system user who entered the data.
2. Security
- No RLS policy changes. Existing policies remain in effect.
3. Notes
- The column is nullable so existing rows are unaffected.
- An index is added for efficient lookups by doctor.
*/

ALTER TABLE lab_order_items
  ADD COLUMN IF NOT EXISTS verified_by_doctor_id uuid REFERENCES doctors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lab_order_items_verified_doctor ON lab_order_items(verified_by_doctor_id);
