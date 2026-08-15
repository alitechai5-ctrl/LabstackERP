/*
# Panel Rates Table

1. New Table
- `panel_rates`: stores per-corporate-client negotiated rates for individual services.
  - `corporate_client_id` (FK -> corporate_clients)
  - `service_id` (FK -> services)
  - `panel_price` (numeric, overrides the standard service price when billing to this panel)
  - Unique constraint on (corporate_client_id, service_id) so each panel has one rate per service.

2. Security
- RLS enabled, authenticated-only CRUD (app has sign-in screen).
- USING(true) / WITH CHECK(true) because access is controlled by the app's role/permission system.

3. Indexes
- Index on corporate_client_id for panel lookups.
- Index on service_id for reverse lookups.
*/

CREATE TABLE IF NOT EXISTS panel_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  corporate_client_id uuid NOT NULL REFERENCES corporate_clients(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  panel_price numeric(15,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_panel_rates_unique ON panel_rates(corporate_client_id, service_id);
CREATE INDEX IF NOT EXISTS idx_panel_rates_corporate ON panel_rates(corporate_client_id);
CREATE INDEX IF NOT EXISTS idx_panel_rates_service ON panel_rates(service_id);

ALTER TABLE panel_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_panel_rates" ON panel_rates;
CREATE POLICY "auth_select_panel_rates" ON panel_rates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_panel_rates" ON panel_rates;
CREATE POLICY "auth_insert_panel_rates" ON panel_rates FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_update_panel_rates" ON panel_rates;
CREATE POLICY "auth_update_panel_rates" ON panel_rates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_panel_rates" ON panel_rates;
CREATE POLICY "auth_delete_panel_rates" ON panel_rates FOR DELETE TO authenticated USING (true);

DROP TRIGGER IF EXISTS set_updated_at ON panel_rates;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON panel_rates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
