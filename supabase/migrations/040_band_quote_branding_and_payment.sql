-- ====================================================================
-- Migration: 040_band_quote_branding_and_payment.sql
-- Description: Add quote branding, sign-off, payment details, and storage bucket for quotes/logos
-- ====================================================================

ALTER TABLE public.bands
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS signature_url TEXT,
  ADD COLUMN IF NOT EXISTS signer_name TEXT,
  ADD COLUMN IF NOT EXISTS signer_role TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS legal_company_name TEXT,
  ADD COLUMN IF NOT EXISTS tax_vat_id TEXT,
  ADD COLUMN IF NOT EXISTS legal_address TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_holder TEXT,
  ADD COLUMN IF NOT EXISTS bank_iban TEXT,
  ADD COLUMN IF NOT EXISTS bank_bic_swift TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS default_payment_terms TEXT DEFAULT '20% initial deposit upon booking; 80% balance due before event';

-- Create storage bucket for shared quote PDFs and band branding assets if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('quotes', 'quotes', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public read access for quotes bucket'
  ) THEN
    CREATE POLICY "Public read access for quotes bucket"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'quotes');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can upload quotes'
  ) THEN
    CREATE POLICY "Authenticated users can upload quotes"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'quotes' AND auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can update quotes'
  ) THEN
    CREATE POLICY "Authenticated users can update quotes"
      ON storage.objects FOR UPDATE
      USING (bucket_id = 'quotes' AND auth.role() = 'authenticated');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
