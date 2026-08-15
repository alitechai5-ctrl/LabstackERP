/*
# Add corporate_client_id to lab_orders

Allows linking an invoice to a corporate/insurance panel so panel rates
and corporate billing terms (credit, outstanding) can be applied.
*/

ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS corporate_client_id uuid REFERENCES corporate_clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lab_orders_corporate ON lab_orders(corporate_client_id);
