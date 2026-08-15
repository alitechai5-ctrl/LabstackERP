/*
# Add missing company fields and share calculation basis

1. Modified Tables
- `companies`: add registration_number, address_line_2, timezone, language
  - These fields are required by the company setup specification
- `share_rules`: add calculation_basis column
  - Supports: total_amount, net_amount, total_minus_discount, cash, total_minus_referral_share
  - This enables the share calculation engine to use different bases

2. Security
- No RLS changes needed — existing policies on companies and share_rules remain unchanged

3. Notes
- All new columns are nullable to avoid breaking existing data
- calculation_basis defaults to 'net_amount' which is the most common basis
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'registration_number') THEN
    ALTER TABLE companies ADD COLUMN registration_number text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'address_line_2') THEN
    ALTER TABLE companies ADD COLUMN address_line_2 text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'timezone') THEN
    ALTER TABLE companies ADD COLUMN timezone text DEFAULT 'Asia/Karachi';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'language') THEN
    ALTER TABLE companies ADD COLUMN language text DEFAULT 'en';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'share_rules' AND column_name = 'calculation_basis') THEN
    ALTER TABLE share_rules ADD COLUMN calculation_basis text NOT NULL DEFAULT 'net_amount'
      CHECK (calculation_basis IN ('total_amount', 'net_amount', 'total_minus_discount', 'cash', 'total_minus_referral_share'));
  END IF;
END $$;
