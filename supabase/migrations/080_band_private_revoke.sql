-- 080 · Band banking, tax and pricing: no direct read (2.3d step 2 of 2).
--
-- Apply only once every installed app reads bands with BAND_PUBLIC_COLUMNS
-- and the private data through bw_band_private() (077). An older app that
-- still asks for select('*') or bands(*) would get "permission denied".
--
-- SELECT on the public columns only. New columns on bands must be added
-- here if members may read them. Writes are unchanged (admins only, RLS).

BEGIN;

REVOKE SELECT ON public.bands FROM anon, authenticated;
GRANT SELECT (id, name, logo_url, description, created_by, created_at, updated_at, slug, cover_url, location, website, social_links, settings, plan, genre, formed_date, standard_lineup_size, home_base_address, home_base_latitude, home_base_longitude, pricing_currency)
  ON public.bands TO authenticated;

COMMIT;
