-- 083 · Member stats through an aggregated RPC (Phase 4.4).
--
-- For one band and a date range, per member: gigs played and coming up,
-- rehearsals attended, invitations declined, answers still pending, and the
-- fees earned and already paid for the gigs played.
--
-- Privacy (decided 2026-11-13): an active admin of the band gets every
-- member's row; any other active member gets only their own. Nobody else
-- gets rows. Nothing else becomes readable: the fees still come only from
-- event_members through this SECURITY DEFINER function.
--
-- p_today is the caller's local date, so "played" matches the app's clock.

BEGIN;

CREATE OR REPLACE FUNCTION public.bw_member_stats(
  p_band_id uuid,
  p_from date,
  p_to date,
  p_today date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  user_id uuid,
  is_active boolean,
  gigs_played integer,
  gigs_upcoming integer,
  rehearsals integer,
  declined integer,
  pending integer,
  earned numeric,
  paid numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH ev AS (
    SELECT e.id,
           e.event_date,
           (lower(coalesce(e.event_type, '')) = 'rehearsal') AS is_rehearsal,
           lower(coalesce(e.status, '')) AS ev_status
    FROM events e
    WHERE e.band_id = p_band_id
      AND e.event_date BETWEEN p_from AND p_to
  ),
  mine AS (
    SELECT em.user_id,
           lower(coalesce(em.status, '')) AS answer,
           em.fee,
           em.paid_at,
           ev.event_date,
           ev.is_rehearsal,
           ev.ev_status
    FROM event_members em
    JOIN ev ON ev.id = em.event_id
  ),
  marked AS (
    SELECT m.*,
           (NOT m.is_rehearsal AND m.ev_status IN ('confirmed', 'completed') AND m.answer = 'confirmed') AS booked_gig,
           (m.ev_status IN ('cancelled', 'canceled')) AS cancelled
    FROM mine m
  )
  SELECT bm.user_id,
         coalesce(bool_or(coalesce(bm.is_active, true)), true) AS is_active,
         count(*) FILTER (WHERE r.booked_gig AND r.event_date < p_today)::int AS gigs_played,
         count(*) FILTER (WHERE r.booked_gig AND r.event_date >= p_today)::int AS gigs_upcoming,
         count(*) FILTER (WHERE r.is_rehearsal AND NOT r.cancelled AND r.answer = 'confirmed' AND r.event_date < p_today)::int AS rehearsals,
         count(*) FILTER (WHERE r.answer = 'declined')::int AS declined,
         count(*) FILTER (WHERE r.answer = 'pending' AND NOT r.cancelled AND r.event_date >= p_today)::int AS pending,
         coalesce(sum(r.fee) FILTER (WHERE r.booked_gig AND r.event_date < p_today), 0)::numeric AS earned,
         coalesce(sum(r.fee) FILTER (WHERE r.booked_gig AND r.event_date < p_today AND r.paid_at IS NOT NULL), 0)::numeric AS paid
  FROM band_members bm
  LEFT JOIN marked r ON r.user_id = bm.user_id
  WHERE auth.uid() IS NOT NULL
    AND bm.band_id = p_band_id
    AND bm.user_id IS NOT NULL
    AND (
      public.bw_is_band_admin(p_band_id, auth.uid())
      OR (bm.user_id = auth.uid() AND public.bw_is_band_member(p_band_id, auth.uid()))
    )
  GROUP BY bm.user_id;
$$;

REVOKE ALL ON FUNCTION public.bw_member_stats(uuid, date, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_member_stats(uuid, date, date, date) TO authenticated;

COMMIT;
