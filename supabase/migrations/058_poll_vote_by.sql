-- ====================================================================
-- 058: Rehearsal poll vote-by date
--
-- Adds rehearsal_polls.vote_by (date, nullable): the day members should
-- answer by. The poll vote sheet (RehearsalPollVoteSheet) shows
-- "Vote by {day} · N of M voted" when it is set, and just "N of M voted"
-- when it is null, so existing polls are unaffected.
--
-- Nothing writes it yet: the poll builder needs a "Vote by" field that
-- sends vote_by on insert/update of rehearsal_polls.
--
-- No policy changes: rehearsal_polls RLS already covers the whole row.
-- Idempotent; safe to re-run.
-- ====================================================================

ALTER TABLE public.rehearsal_polls
  ADD COLUMN IF NOT EXISTS vote_by date;

COMMENT ON COLUMN public.rehearsal_polls.vote_by IS
  'Optional day members should vote by (shown in the poll vote sheet).';
