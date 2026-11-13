-- 078 · Gig price, payments and client through an RPC (step 1 of 2).
--
-- Every member of a band can read every column of the band's events today:
-- the gig price and fee, deposit, payment status, the client's name, email,
-- phone and company, the internal notes and the contract.
-- Decided on 2026-11-13: members see only their own fee (event_members, 071)
-- and the logistics data.
--
-- Step 1 (this migration): bw_event_private() returns those columns, as one
-- JSON object per event, to whoever manages the event: an active admin of
-- its band, or the creator of a personal gig (same rule as
-- bw_can_manage_event). Nothing is revoked yet, so installed apps keep
-- working.
--
-- Step 2 (once the apps are updated): revoke direct SELECT on the private
-- columns, like event_members in 071.

BEGIN;

CREATE OR REPLACE FUNCTION public.bw_event_private(p_event_ids uuid[])
RETURNS TABLE (event_id uuid, private jsonb)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT e.id, jsonb_build_object(
    'price', e.price,
    'fee', e.fee,
    'pay', e.pay,
    'deposit_amount', e.deposit_amount,
    'deposit_paid', e.deposit_paid,
    'payment_status', e.payment_status,
    'client_name', e.client_name,
    'client_email', e.client_email,
    'client_phone', e.client_phone,
    'client_company', e.client_company,
    'internal_notes', e.internal_notes,
    'contract_url', e.contract_url,
    'contract_signed', e.contract_signed
  )
  FROM events e
  WHERE auth.uid() IS NOT NULL
    AND e.id = ANY (p_event_ids)
    AND (
      (e.band_id IS NOT NULL AND public.bw_is_band_admin(e.band_id))
      OR (e.band_id IS NULL AND e.created_by = auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.bw_event_private(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_event_private(uuid[]) TO authenticated;

COMMIT;
