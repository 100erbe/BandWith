-- 081 · Gig price, payments and client: no direct read (2.3e step 2 of 2).
--
-- Apply only once every installed app reads events with EVENT_PUBLIC_COLUMNS
-- and the private data through bw_event_private() (078). An older app that
-- still asks for select('*') or events(*) would get "permission denied".
--
-- SELECT on the public columns only. New columns on events must be added
-- here if members may read them. Writes are unchanged (RLS: band admins,
-- or the creator of a personal gig).

BEGIN;

REVOKE SELECT ON public.events FROM anon, authenticated;
GRANT SELECT (id, band_id, title, description, event_type, venue, address, date, time, duration_hours, status, notes, created_by, created_at, updated_at, currency, dress_code, quote_id, event_date, start_time, end_time, venue_name, venue_address, venue_city, venue_country, venue_coordinates, indoor_outdoor, load_in_time, soundcheck_time, setlist_id, attachments, is_recurring, recurrence_rule, parent_event_id, capacity)
  ON public.events TO authenticated;

COMMIT;
