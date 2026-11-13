-- 095 · Free-slot heatmap: how many band members are free, per day or slot.
--
-- Used by the date pickers and composers that plan rehearsals and gigs
-- (Figma "Next" pages: "Free-slot heatmap from band calendars, e.g. 5/5 free").
--
-- A member is busy on a day when, in ANY of their calendars, they have:
--   * an event they are on (event_members row not declined), or
--   * a personal event they created (band_id IS NULL),
-- that is not cancelled and not just a quote. With a time window, only events
-- overlapping it count; an event without a start time fills the whole day.
--
-- Privacy: only counts come back (free / total). No event, title, place,
-- member id or reason is returned. The caller must be an active member of the
-- band. Nothing becomes readable outside this SECURITY DEFINER function, so
-- no GRANT on table columns is needed.
--
-- p_start / p_end: optional window ("21:00"–"23:30"); an end at or before the
-- start runs past midnight. p_slot_minutes: with a window, one row per slot
-- (e.g. 60 → 19:00, 20:00, …) instead of one row per day.
-- p_exclude_event: the event being edited, so it does not mark its own lineup busy.

BEGIN;

CREATE OR REPLACE FUNCTION public.bw_band_free_slots(
  p_band_id uuid,
  p_from date,
  p_to date,
  p_start time DEFAULT NULL,
  p_end time DEFAULT NULL,
  p_slot_minutes integer DEFAULT NULL,
  p_exclude_event uuid DEFAULT NULL
)
RETURNS TABLE (
  day date,
  slot_start time,
  free_count integer,
  total_count integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH allowed AS (
    SELECT auth.uid() IS NOT NULL
       AND public.bw_is_band_member(p_band_id, auth.uid())
       AND p_from IS NOT NULL AND p_to IS NOT NULL
       AND p_to >= p_from
       AND p_to - p_from <= 62 AS ok
  ),
  members AS (
    SELECT DISTINCT bm.user_id
    FROM band_members bm, allowed a
    WHERE a.ok
      AND bm.band_id = p_band_id
      AND bm.user_id IS NOT NULL
      AND coalesce(bm.is_active, true)
      AND bm.left_at IS NULL
  ),
  days AS (
    SELECT d::date AS day
    FROM allowed a, generate_series(p_from, p_to, interval '1 day') d
    WHERE a.ok
  ),
  win AS (
    SELECT
      (extract(epoch FROM p_start) / 60)::int AS ws,
      CASE
        WHEN p_end IS NULL THEN NULL
        WHEN p_end <= p_start THEN (extract(epoch FROM p_end) / 60)::int + 1440
        ELSE (extract(epoch FROM p_end) / 60)::int
      END AS we
  ),
  slots AS (
    -- One row per day (whole window) or per slot inside the window.
    SELECT d.day,
           CASE WHEN w.ws IS NOT NULL AND w.we IS NOT NULL AND coalesce(p_slot_minutes, 0) >= 15
                THEN s.m ELSE w.ws END AS s_from,
           CASE WHEN w.ws IS NOT NULL AND w.we IS NOT NULL AND coalesce(p_slot_minutes, 0) >= 15
                THEN least(s.m + p_slot_minutes, w.we) ELSE w.we END AS s_to
    FROM days d
    CROSS JOIN win w
    CROSS JOIN LATERAL (
      SELECT generate_series(w.ws, w.we - 1, greatest(coalesce(p_slot_minutes, 0), 15)) AS m
      WHERE w.ws IS NOT NULL AND w.we IS NOT NULL AND coalesce(p_slot_minutes, 0) >= 15
      UNION ALL
      SELECT NULL::int
      WHERE NOT (w.ws IS NOT NULL AND w.we IS NOT NULL AND coalesce(p_slot_minutes, 0) >= 15)
    ) s
  ),
  busy_events AS (
    -- Every commitment of every member in the range, with its time span in minutes.
    SELECT x.user_id, x.event_date, x.e_from,
           CASE
             WHEN x.e_from IS NULL THEN NULL
             WHEN x.e_to IS NULL THEN x.e_from + 180
             WHEN x.e_to <= x.e_from THEN x.e_to + 1440
             ELSE x.e_to
           END AS e_to
    FROM (
      SELECT m.user_id,
             e.event_date,
             (extract(epoch FROM coalesce(e.start_time, e."time")) / 60)::int AS e_from,
             coalesce(
               (extract(epoch FROM e.end_time) / 60)::int,
               CASE WHEN e.duration_hours IS NOT NULL AND coalesce(e.start_time, e."time") IS NOT NULL
                    THEN (extract(epoch FROM coalesce(e.start_time, e."time")) / 60)::int + (e.duration_hours * 60)::int
               END
             ) AS e_to
      FROM members m
      JOIN events e
        ON e.event_date BETWEEN p_from AND p_to
       AND (p_exclude_event IS NULL OR e.id <> p_exclude_event)
       AND lower(coalesce(e.status, '')) NOT IN ('cancelled', 'canceled', 'quote', 'quoted')
       AND (
         EXISTS (
           SELECT 1 FROM event_members em
           WHERE em.event_id = e.id
             AND em.user_id = m.user_id
             AND lower(coalesce(em.status, '')) NOT IN ('declined', 'removed')
         )
         OR (e.band_id IS NULL AND e.created_by = m.user_id)
       )
    ) x
  ),
  busy AS (
    SELECT DISTINCT s.day, s.s_from, b.user_id
    FROM slots s
    JOIN busy_events b ON b.event_date = s.day
    WHERE s.s_from IS NULL
       OR b.e_from IS NULL
       OR (b.e_from < s.s_to AND s.s_from < b.e_to)
  )
  SELECT s.day,
         CASE WHEN s.s_from IS NULL THEN NULL
              ELSE make_time(((s.s_from / 60) % 24)::int, (s.s_from % 60)::int, 0) END AS slot_start,
         ((SELECT count(*) FROM members)
           - (SELECT count(*) FROM busy b WHERE b.day = s.day AND b.s_from IS NOT DISTINCT FROM s.s_from))::int AS free_count,
         (SELECT count(*) FROM members)::int AS total_count
  FROM slots s
  ORDER BY s.day, s.s_from NULLS FIRST;
$$;

REVOKE ALL ON FUNCTION public.bw_band_free_slots(uuid, date, date, time, time, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_band_free_slots(uuid, date, date, time, time, integer, uuid) TO authenticated;

COMMIT;
