-- Stage mode "follow the leader": one private Realtime channel per gig,
-- "stage:event:<event id>". Nothing is stored: the channel carries the
-- current song and the live setlist order from the band admin to everyone
-- who has Stage mode open (the order itself is saved in setlist_songs).
--
-- Realtime Authorization (RLS on realtime.messages):
--   * active members of the gig's band can join, receive and send presence
--     (presence tells the admin's app that someone opened Stage mode, so it
--     sends the current state again);
--   * only active band admins can send broadcasts, so a member's app cannot
--     move everyone else's song.

CREATE OR REPLACE FUNCTION public.bw_stage_topic_allowed(p_topic text, p_lead boolean DEFAULT false)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ev text;
  band uuid;
BEGIN
  IF auth.uid() IS NULL OR p_topic IS NULL THEN
    RETURN false;
  END IF;
  ev := substring(p_topic FROM '^stage:event:([0-9a-fA-F-]{36})$');
  IF ev IS NULL THEN
    RETURN false;
  END IF;
  SELECT e.band_id INTO band FROM public.events e WHERE e.id = ev::uuid;
  IF band IS NULL THEN
    RETURN false;
  END IF;
  IF p_lead THEN
    RETURN public.bw_is_band_admin(band);
  END IF;
  RETURN public.bw_is_band_member(band);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bw_stage_topic_allowed(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_stage_topic_allowed(text, boolean) TO authenticated;

DROP POLICY IF EXISTS bw_stage_read ON realtime.messages;
CREATE POLICY bw_stage_read ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    realtime.messages.extension IN ('broadcast', 'presence')
    AND public.bw_stage_topic_allowed(realtime.topic(), false)
  );

DROP POLICY IF EXISTS bw_stage_presence_write ON realtime.messages;
CREATE POLICY bw_stage_presence_write ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    realtime.messages.extension = 'presence'
    AND public.bw_stage_topic_allowed(realtime.topic(), false)
  );

DROP POLICY IF EXISTS bw_stage_broadcast_write ON realtime.messages;
CREATE POLICY bw_stage_broadcast_write ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    realtime.messages.extension = 'broadcast'
    AND public.bw_stage_topic_allowed(realtime.topic(), true)
  );
