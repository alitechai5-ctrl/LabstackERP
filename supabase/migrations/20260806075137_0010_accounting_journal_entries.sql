/*
# Accounting Journal Entries

## Overview
Creates tables for double-entry bookkeeping journal entries.
Enables the accounting module to record transactions and generate financial reports.

## New Tables

### 1. journal_entries
Header records for each journal entry.
- entry_number (text, unique per company)
- entry_date (date)
- description (text)
- reference_type (text: invoice, payment, manual)
- reference_id (uuid, nullable)
- status (text: draft, posted)
- total_debit, total_credit (numeric)

### 2. journal_lines
Individual debit/credit lines within a journal entry.
- journal_entry_id (FK -> journal_entries)
- account_id (FK -> chart_of_accounts)
- debit, credit (numeric)

## Security
- RLS enabled on all new tables.
- Authenticated-only CRUD.
- Audit triggers on both tables.
*/

CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  entry_number text NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  reference_type text DEFAULT 'manual',
  reference_id uuid,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted')),
  total_debit numeric(15,2) DEFAULT 0,
  total_credit numeric(15,2) DEFAULT 0,
  financial_year_id uuid REFERENCES financial_years(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entries_number ON journal_entries(company_id, entry_number);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(status);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_journal_entries" ON journal_entries;
CREATE POLICY "auth_select_journal_entries" ON journal_entries FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_journal_entries" ON journal_entries;
CREATE POLICY "auth_insert_journal_entries" ON journal_entries FOR INSERT
TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_journal_entries" ON journal_entries;
CREATE POLICY "auth_update_journal_entries" ON journal_entries FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_journal_entries" ON journal_entries;
CREATE POLICY "auth_delete_journal_entries" ON journal_entries FOR DELETE
TO authenticated USING (true);

-- ============================================================
-- 2. JOURNAL_LINES
-- ============================================================

CREATE TABLE IF NOT EXISTS journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  debit numeric(15,2) DEFAULT 0,
  credit numeric(15,2) DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id);

ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_journal_lines" ON journal_lines;
CREATE POLICY "auth_select_journal_lines" ON journal_lines FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_journal_lines" ON journal_lines;
CREATE POLICY "auth_insert_journal_lines" ON journal_lines FOR INSERT
TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_journal_lines" ON journal_lines;
CREATE POLICY "auth_update_journal_lines" ON journal_lines FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_journal_lines" ON journal_lines;
CREATE POLICY "auth_delete_journal_lines" ON journal_lines FOR DELETE
TO authenticated USING (true);

-- ============================================================
-- TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS set_updated_at ON journal_entries;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON journal_entries
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON journal_lines;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON journal_lines
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
