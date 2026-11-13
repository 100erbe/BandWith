-- 098 · Rehearsal poll: who is invited, and the vote-by time.
--
-- Figma iPad · 05 "Rehearsal / New · Poll availability": card 1 "Session &
-- roster" (pick the members) and card 4 "Vote deadline" (a day AND a time).
--
--   invited_user_ids  uuid[]: the members asked to vote. Empty = every active
--                     member of the band (all polls created before 098).
--   vote_by_time      time, nullable: with vote_by (058), "Vote by Fri 11 Dec,
--                     18:00". Shown to members; nothing closes the poll at
--                     that time (as with vote_by today).
--
-- Votes: only invited members may vote on a poll that has a list. The insert
-- policy below is the live one (073 baseline) plus that check.
--
-- Read access: rehearsal_polls keeps table-level SELECT for authenticated
-- and RLS limits rows to the band's members, so no extra GRANT is needed.
-- The app hides a poll from members who are not on its list.
--
-- Idempotent; safe to re-run.

BEGIN;

ALTER TABLE public.rehearsal_polls
  ADD COLUMN IF NOT EXISTS invited_user_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vote_by_time time;

COMMENT ON COLUMN public.rehearsal_polls.invited_user_ids IS
  'Members asked to vote; empty = every active member of the band.';
COMMENT ON COLUMN public.rehearsal_polls.vote_by_time IS
  'Time of day for vote_by (058); shown to members, not enforced.';

DROP POLICY IF EXISTS "users_can_insert_own_vote" ON public.rehearsal_poll_votes;
CREATE POLICY "users_can_insert_own_vote" ON public.rehearsal_poll_votes
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.rehearsal_polls rp
      JOIN public.band_members bm ON bm.band_id = rp.band_id
      WHERE rp.id = rehearsal_poll_votes.poll_id
        AND bm.user_id = auth.uid()
        AND rp.status = 'polling'
        AND (cardinality(rp.invited_user_ids) = 0 OR auth.uid() = ANY (rp.invited_user_ids))
    )
  );

COMMIT;
