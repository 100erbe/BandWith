-- Stage mode visual click: let band members measure the leader's clock.
--
-- When the band admin starts the click, every member's app sends a few
-- "click-ping" broadcasts on the gig's stage channel and the admin's app
-- answers each with a "click-pong" carrying its time (src/lib/stageClick.ts,
-- useStageLive). Migration 085 lets only admins send broadcasts, so the
-- members' pings were dropped, no pong came back, and every member placed the
-- click on their own phone's clock instead of the leader's.
--
-- This adds one INSERT policy: an active member of the gig's band may send a
-- broadcast on "stage:event:<id>" only when its event is 'click-ping'. The
-- song state ('state') and the click itself ('click') stay admin-only
-- (bw_stage_broadcast_write, migration 085), so a member still can't move
-- anyone's song or start a click for the band. Setlists stay admin-only
-- (migration 074); nothing is stored.

DROP POLICY IF EXISTS bw_stage_click_ping_write ON realtime.messages;
CREATE POLICY bw_stage_click_ping_write ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    realtime.messages.extension = 'broadcast'
    AND realtime.messages.event = 'click-ping'
    AND public.bw_stage_topic_allowed(realtime.topic(), false)
  );
