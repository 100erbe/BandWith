-- 077 · Band banking, tax and pricing through an RPC (step 1 of 2).
--
-- Every member can read every column of their bands today: the pricing
-- settings (rates, markup, IBAN, BIC, bank, account holder, payment terms,
-- signature), the rate columns, VAT number, legal details and Stripe id.
-- Decided on 2026-11-13: members see only their own fee and the logistics
-- data, never the band's money or banking details.
--
-- Step 1 (this migration):
--   1. bw_band_private() returns those columns, as one JSON object per band,
--      to the active admins of the band only.
--   2. pricing_currency follows pricing_settings.currency (trigger + one-off
--      backfill). Members need the currency for their own fee, and after
--      step 2 they will read it from pricing_currency, which today is stale
--      for one band (EUR while the settings say USD).
-- Nothing is revoked yet, so installed apps keep working.
--
-- Step 2 (once the apps are updated): revoke direct SELECT on the private
-- columns, like event_members in 071.
--
-- Note: 076 is band_member_fees; the band_members revoke planned as "077" in
-- the notes of 076 becomes a later number.

BEGIN;

-- ── 1. Private band data for admins ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bw_band_private(p_band_ids uuid[])
RETURNS TABLE (band_id uuid, private jsonb)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT b.id, jsonb_build_object(
    'pricing_settings', b.pricing_settings,
    'pricing_rules', b.pricing_rules,
    'extra_services', b.extra_services,
    'core_musician_fee', b.core_musician_fee,
    'additional_musician_fee', b.additional_musician_fee,
    'ceremony_musician_fee', b.ceremony_musician_fee,
    'cocktail_musician_fee', b.cocktail_musician_fee,
    'dj_hourly_rate', b.dj_hourly_rate,
    'production_standard_fee', b.production_standard_fee,
    'production_pro_fee', b.production_pro_fee,
    'production_extra_location_fee', b.production_extra_location_fee,
    'travel_rate_per_km', b.travel_rate_per_km,
    'default_payment_terms', b.default_payment_terms,
    'bank_account_holder', b.bank_account_holder,
    'bank_iban', b.bank_iban,
    'bank_bic_swift', b.bank_bic_swift,
    'bank_name', b.bank_name,
    'tax_vat_id', b.tax_vat_id,
    'legal_company_name', b.legal_company_name,
    'legal_address', b.legal_address,
    'signature_url', b.signature_url,
    'signer_name', b.signer_name,
    'signer_role', b.signer_role,
    'contact_email', b.contact_email,
    'contact_phone', b.contact_phone,
    'stripe_customer_id', b.stripe_customer_id
  )
  FROM bands b
  WHERE auth.uid() IS NOT NULL
    AND b.id = ANY (p_band_ids)
    AND public.bw_is_band_admin(b.id);
$$;

REVOKE ALL ON FUNCTION public.bw_band_private(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_band_private(uuid[]) TO authenticated;

-- ── 2. pricing_currency follows pricing_settings.currency ─────────────────
CREATE OR REPLACE FUNCTION public.bw_sync_band_currency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(NEW.pricing_settings->>'currency', '') <> '' THEN
    NEW.pricing_currency := NEW.pricing_settings->>'currency';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bw_sync_band_currency ON public.bands;
CREATE TRIGGER bw_sync_band_currency
  BEFORE INSERT OR UPDATE OF pricing_settings ON public.bands
  FOR EACH ROW EXECUTE FUNCTION public.bw_sync_band_currency();

UPDATE public.bands
SET pricing_currency = pricing_settings->>'currency'
WHERE COALESCE(pricing_settings->>'currency', '') <> ''
  AND pricing_currency IS DISTINCT FROM pricing_settings->>'currency';

COMMIT;
