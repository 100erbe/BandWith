-- 097 · Rehearsal poll: place, room cost and focus songs.
--
-- The iPad poll composer (Figma iPad · 05 "Rehearsal / New · Poll
-- availability", card "Place, cost & songs") lets the admin set where the
-- rehearsal will be, what the room costs and which songs to work on before
-- the band votes. When the admin locks in a slot, finalizePollIntoRehearsal
-- copies them onto the rehearsal: venue, events.fee (private since 081) and
-- a setlist with the songs.
--
--   location        text, nullable: the rehearsal place.
--   room_cost       numeric, nullable: the room's total cost. Members are
--                   shown only their share ("€12 each"), never as a fee.
--   focus_song_ids  uuid[]: songs from the band's repertoire, in order.
--
-- Read access: rehearsal_polls keeps table-level SELECT for authenticated
-- (no column REVOKE, unlike events in 081), and RLS limits rows to the band's
-- members, so these columns need no extra GRANT. Writes stay as they are
-- (RLS: the poll's admin). Nothing reads them on older apps, so it is safe
-- to apply before the app ships.
--
-- Idempotent; safe to re-run.

BEGIN;

ALTER TABLE public.rehearsal_polls
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS room_cost numeric(10, 2),
  ADD COLUMN IF NOT EXISTS focus_song_ids uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE public.rehearsal_polls
  DROP CONSTRAINT IF EXISTS rehearsal_polls_room_cost_check;
ALTER TABLE public.rehearsal_polls
  ADD CONSTRAINT rehearsal_polls_room_cost_check CHECK (room_cost IS NULL OR room_cost >= 0);

COMMENT ON COLUMN public.rehearsal_polls.location IS
  'Rehearsal place set in the poll; copied to the event venue on lock-in.';
COMMENT ON COLUMN public.rehearsal_polls.room_cost IS
  'Room total cost; copied to events.fee on lock-in. Members see only their share.';
COMMENT ON COLUMN public.rehearsal_polls.focus_song_ids IS
  'Songs to work on, in order; become the rehearsal setlist on lock-in.';

COMMIT;
