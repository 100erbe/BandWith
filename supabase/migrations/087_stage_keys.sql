-- Stage mode over Bluetooth: one secret key per gig.
--
-- On stage without internet, the band admin's phone sends the current song
-- and live order over Bluetooth (no pairing). Anyone nearby can read that,
-- so every message carries an HMAC made with this key, and the Bluetooth
-- service id is derived from it: only apps that fetched the key while online
-- (the band's active members) find the gig's leader and accept its messages.
--
-- The table has RLS on and no policies: it is reached only through
-- bw_stage_key(), which creates the key on first use.

CREATE TABLE IF NOT EXISTS public.stage_keys (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stage_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stage_keys FROM anon, authenticated;

-- Key of a band gig (base64, 32 random bytes), for its active band members.
CREATE OR REPLACE FUNCTION public.bw_stage_key(p_event_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  band uuid;
  k text;
BEGIN
  IF auth.uid() IS NULL OR p_event_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT e.band_id INTO band FROM public.events e WHERE e.id = p_event_id;
  IF band IS NULL OR NOT public.bw_is_band_member(band) THEN
    RETURN NULL;
  END IF;
  SELECT s.key INTO k FROM public.stage_keys s WHERE s.event_id = p_event_id;
  IF k IS NULL THEN
    -- Two v4 UUIDs: 244 random bits, no extension needed.
    INSERT INTO public.stage_keys (event_id, key)
    VALUES (
      p_event_id,
      encode(
        decode(replace(gen_random_uuid()::text, '-', ''), 'hex') || decode(replace(gen_random_uuid()::text, '-', ''), 'hex'),
        'base64'
      )
    )
    ON CONFLICT (event_id) DO NOTHING;
    SELECT s.key INTO k FROM public.stage_keys s WHERE s.event_id = p_event_id;
  END IF;
  RETURN k;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bw_stage_key(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_stage_key(uuid) TO authenticated;
