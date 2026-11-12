-- 071: what a band member can do directly against the database (G16-B)
--
-- Until now several rules lived only in the app: a member calling Supabase
-- directly could read everyone's fees, edit the lineup, rename or delete
-- tasks, publish a rehearsal poll, send any notification to bandmates, read
-- the band ledger and message anyone privately. This migration moves those
-- rules into the database.
--
--  1. Admin checks follow bw_is_band_admin (active admins only).
--  2. band_members: only admins change role, is_active or fees (trigger).
--  3. event_members: admins (or the creator of a personal gig) manage the
--     lineup; a member only answers on their own row (status, note, reason).
--     Fees and payouts are no longer readable column by column:
--     bw_event_member_money() returns them to admins, and to each member
--     only their own.
--  4. rehearsal_tasks: admins add, rename and delete; members tick them off.
--  5. rehearsal_polls: a member can only propose (status 'proposed');
--     creator_role comes from the real role.
--  6. notifications: a member can notify bandmates only with the kinds the
--     app sends (RSVP answers to admins, songs, proposals, chat).
--  7. transactions: band ledger readable by admins only.
--  8. Direct chats: a member can open one only with an admin of a shared band.
--  9. subscriptions: drop the policy that let anyone write the table.
-- 10. accept_pending_invitations(): dropped (bw_accept_invitation replaces it).
-- 11. band_invitations.email_sent_at: rate limit for the invite email.
-- 12. Presence: private channel per band (Realtime Authorization).

BEGIN;

-- ---------------------------------------------------------------- helpers --

-- Legacy helper used by band_members policies: now ignores inactive admins
-- and pins search_path like the bw_* helpers.
CREATE OR REPLACE FUNCTION public.is_user_band_admin(check_user_id uuid, check_band_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM band_members
    WHERE user_id = check_user_id
      AND band_id = check_band_id
      AND role = 'admin'
      AND COALESCE(is_active, true)
  );
$$;

-- Who manages an event: an active admin of its band, or the creator of a
-- personal gig (no band).
CREATE OR REPLACE FUNCTION public.bw_can_manage_event(p_event_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = p_event_id
      AND (
        (e.band_id IS NOT NULL AND public.bw_is_band_admin(e.band_id, p_user_id))
        OR (e.band_id IS NULL AND e.created_by = p_user_id)
      )
  );
$$;

-- An active member of the event's band (or its manager).
CREATE OR REPLACE FUNCTION public.bw_can_view_event(p_event_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = p_event_id
      AND (
        (e.band_id IS NOT NULL AND public.bw_is_band_member(e.band_id, p_user_id))
        OR (e.band_id IS NULL AND e.created_by = p_user_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.bw_event_band_id(p_event_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT band_id FROM events WHERE id = p_event_id;
$$;

REVOKE EXECUTE ON FUNCTION public.bw_can_manage_event(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bw_can_view_event(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bw_event_band_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_can_manage_event(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bw_can_view_event(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bw_event_band_id(uuid) TO authenticated;

-- ------------------------------------------------------------ band_members --

CREATE OR REPLACE FUNCTION public.bw_guard_band_member_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW; -- service role / server-side jobs
  END IF;
  IF NEW.band_id IS DISTINCT FROM OLD.band_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'band_members: band_id and user_id cannot change' USING ERRCODE = '42501';
  END IF;
  IF (NEW.role IS DISTINCT FROM OLD.role
      OR NEW.is_active IS DISTINCT FROM OLD.is_active
      OR NEW.default_fee IS DISTINCT FROM OLD.default_fee
      OR NEW.fee_percentage IS DISTINCT FROM OLD.fee_percentage)
     AND NOT public.bw_is_band_admin(OLD.band_id) THEN
    RAISE EXCEPTION 'Only band admins can change roles, membership or fees' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bw_guard_band_member_update ON public.band_members;
CREATE TRIGGER bw_guard_band_member_update
  BEFORE UPDATE ON public.band_members
  FOR EACH ROW EXECUTE FUNCTION public.bw_guard_band_member_update();

-- Policies that may exist from old scripts (not live today).
DROP POLICY IF EXISTS bm_update_self ON public.band_members;
DROP POLICY IF EXISTS "Users can update own membership" ON public.band_members;

-- ----------------------------------------------------------- event_members --

DROP POLICY IF EXISTS "Manage event members" ON public.event_members;
DROP POLICY IF EXISTS "Users can delete own personal event members" ON public.event_members;
DROP POLICY IF EXISTS admins_can_delete_memberships ON public.event_members;
DROP POLICY IF EXISTS event_members_delete_own ON public.event_members;
DROP POLICY IF EXISTS "Users can insert own personal event members" ON public.event_members;
DROP POLICY IF EXISTS event_admins_can_insert_members ON public.event_members;
DROP POLICY IF EXISTS em_insert_self ON public.event_members;
DROP POLICY IF EXISTS "Users can select own personal event members" ON public.event_members;
DROP POLICY IF EXISTS "View event members" ON public.event_members;
DROP POLICY IF EXISTS admins_can_read_event_memberships ON public.event_members;
DROP POLICY IF EXISTS event_members_select ON public.event_members;
DROP POLICY IF EXISTS users_can_read_own_memberships ON public.event_members;
DROP POLICY IF EXISTS "Users can respond to events" ON public.event_members;
DROP POLICY IF EXISTS "Users can update own personal event members" ON public.event_members;
DROP POLICY IF EXISTS admins_can_update_memberships ON public.event_members;
DROP POLICY IF EXISTS users_can_update_own_membership ON public.event_members;

DROP POLICY IF EXISTS event_members_insert ON public.event_members;
DROP POLICY IF EXISTS event_members_update_manager ON public.event_members;
DROP POLICY IF EXISTS event_members_update_own ON public.event_members;
DROP POLICY IF EXISTS event_members_delete ON public.event_members;
-- Lineup (who, status, role) visible to the band; fees via the RPC below.
CREATE POLICY event_members_select ON public.event_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.bw_can_view_event(event_id));

-- Band events: admins. Personal gigs: the creator, for their own row.
CREATE POLICY event_members_insert ON public.event_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.bw_can_manage_event(event_id)
    AND (public.bw_event_band_id(event_id) IS NOT NULL OR user_id = auth.uid())
  );

CREATE POLICY event_members_update_manager ON public.event_members
  FOR UPDATE TO authenticated
  USING (public.bw_can_manage_event(event_id))
  WITH CHECK (public.bw_can_manage_event(event_id));

-- A member answers on their own row; the trigger limits the columns.
CREATE POLICY event_members_update_own ON public.event_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Managers remove anyone; a member can remove only their own row.
CREATE POLICY event_members_delete ON public.event_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.bw_can_manage_event(event_id));

-- Non-managers may change only their answer on their own row.
CREATE OR REPLACE FUNCTION public.bw_guard_event_member_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW; -- service role / server-side jobs
  END IF;
  IF public.bw_can_manage_event(NEW.event_id) THEN
    RETURN NEW;
  END IF;
  IF NEW.fee IS DISTINCT FROM OLD.fee
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only band admins can change fees, roles or payouts' USING ERRCODE = '42501';
  END IF;
  -- status, responded_at, decline_reason, notes: the member's answer.
  RETURN NEW;
END;
$$;

-- Fees and payouts: no column access for app users (admins included);
-- bw_event_member_money() returns what each caller may see.
-- New columns on event_members must be added to this GRANT.
REVOKE SELECT ON public.event_members FROM anon, authenticated;
GRANT SELECT (id, event_id, user_id, status, responded_at, created_at, decline_reason, role, notes)
  ON public.event_members TO authenticated;

-- Fee and payout rows the caller may see: every row of events they manage,
-- their own row elsewhere. p_event_ids NULL = all of the caller's own rows.
CREATE OR REPLACE FUNCTION public.bw_event_member_money(p_event_ids uuid[] DEFAULT NULL)
RETURNS TABLE (event_id uuid, user_id uuid, fee numeric, paid_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT em.event_id, em.user_id, em.fee::numeric, em.paid_at
  FROM event_members em
  WHERE auth.uid() IS NOT NULL
    AND (
      (p_event_ids IS NULL AND em.user_id = auth.uid())
      OR (
        p_event_ids IS NOT NULL
        AND em.event_id = ANY (p_event_ids)
        AND (em.user_id = auth.uid() OR public.bw_can_manage_event(em.event_id))
      )
    );
$$;

-- Admin "mark all paid" for an event; returns the rows it changed.
CREATE OR REPLACE FUNCTION public.bw_mark_event_paid(p_event_id uuid)
RETURNS TABLE (user_id uuid, paid_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.bw_can_manage_event(p_event_id) THEN
    RAISE EXCEPTION 'Only band admins can mark payouts' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    UPDATE event_members em
       SET paid_at = now()
     WHERE em.event_id = p_event_id
       AND em.paid_at IS NULL
       AND COALESCE(em.status, '') <> 'declined'
    RETURNING em.user_id, em.paid_at;
END;
$$;

-- Save an event's lineup (role and fee per person). New people are added
-- with the given status; people already in it keep their RSVP. Needed
-- because a client upsert (ON CONFLICT DO UPDATE) must read the fee column.
-- p_rows: [{user_id, role, fee, status}]
CREATE OR REPLACE FUNCTION public.bw_save_event_lineup(p_event_id uuid, p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  band uuid;
  n integer;
BEGIN
  IF NOT public.bw_can_manage_event(p_event_id) THEN
    RAISE EXCEPTION 'Only band admins can change the lineup' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_rows must be an array' USING ERRCODE = '22023';
  END IF;
  band := public.bw_event_band_id(p_event_id);
  IF band IS NULL AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_rows) r WHERE (r->>'user_id')::uuid IS DISTINCT FROM auth.uid()
  ) THEN
    RAISE EXCEPTION 'A personal gig has only your own row' USING ERRCODE = '42501';
  END IF;

  INSERT INTO event_members (event_id, user_id, role, fee, status)
  SELECT p_event_id,
         (r->>'user_id')::uuid,
         NULLIF(r->>'role', ''),
         COALESCE(NULLIF(r->>'fee', '')::numeric, 0),
         CASE WHEN r->>'status' IN ('pending', 'confirmed', 'declined', 'maybe', 'tentative')
              THEN r->>'status' ELSE 'pending' END
  FROM jsonb_array_elements(p_rows) r
  WHERE r->>'user_id' IS NOT NULL
    AND (band IS NULL OR public.bw_is_band_member(band, (r->>'user_id')::uuid))
  ON CONFLICT (event_id, user_id) DO UPDATE
    SET role = EXCLUDED.role,
        fee = EXCLUDED.fee;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bw_event_member_money(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bw_mark_event_paid(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bw_save_event_lineup(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_event_member_money(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bw_mark_event_paid(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bw_save_event_lineup(uuid, jsonb) TO authenticated;

-- --------------------------------------------------------- rehearsal_tasks --

DROP POLICY IF EXISTS "Band members can manage rehearsal tasks" ON public.rehearsal_tasks;
DROP POLICY IF EXISTS "Band members can manage tasks" ON public.rehearsal_tasks;
DROP POLICY IF EXISTS "Band members can view tasks" ON public.rehearsal_tasks;

DROP POLICY IF EXISTS rehearsal_tasks_select ON public.rehearsal_tasks;
DROP POLICY IF EXISTS rehearsal_tasks_insert ON public.rehearsal_tasks;
DROP POLICY IF EXISTS rehearsal_tasks_update ON public.rehearsal_tasks;
DROP POLICY IF EXISTS rehearsal_tasks_delete ON public.rehearsal_tasks;
CREATE POLICY rehearsal_tasks_select ON public.rehearsal_tasks
  FOR SELECT TO authenticated
  USING (public.bw_can_view_event(event_id));

CREATE POLICY rehearsal_tasks_insert ON public.rehearsal_tasks
  FOR INSERT TO authenticated
  WITH CHECK (public.bw_can_manage_event(event_id));

-- Members can tick tasks off; the trigger limits what they change.
CREATE POLICY rehearsal_tasks_update ON public.rehearsal_tasks
  FOR UPDATE TO authenticated
  USING (public.bw_can_view_event(event_id))
  WITH CHECK (public.bw_can_view_event(event_id));

CREATE POLICY rehearsal_tasks_delete ON public.rehearsal_tasks
  FOR DELETE TO authenticated
  USING (public.bw_can_manage_event(event_id));

CREATE OR REPLACE FUNCTION public.bw_guard_rehearsal_task_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.bw_can_manage_event(OLD.event_id) THEN
    RETURN NEW;
  END IF;
  IF NEW.event_id IS DISTINCT FROM OLD.event_id
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.notes IS DISTINCT FROM OLD.notes
     OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     OR NEW.due_date IS DISTINCT FROM OLD.due_date
     OR NEW.task_type IS DISTINCT FROM OLD.task_type
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only band admins can edit tasks; members can only mark them done' USING ERRCODE = '42501';
  END IF;
  RETURN NEW; -- is_completed, status, completed_at, updated_at
END;
$$;

DROP TRIGGER IF EXISTS bw_guard_rehearsal_task_update ON public.rehearsal_tasks;
CREATE TRIGGER bw_guard_rehearsal_task_update
  BEFORE UPDATE ON public.rehearsal_tasks
  FOR EACH ROW EXECUTE FUNCTION public.bw_guard_rehearsal_task_update();

-- --------------------------------------------------------- rehearsal_polls --

DROP POLICY IF EXISTS band_members_can_insert_polls ON public.rehearsal_polls;
DROP POLICY IF EXISTS band_members_can_select_polls ON public.rehearsal_polls;
DROP POLICY IF EXISTS admins_and_creators_can_update_polls ON public.rehearsal_polls;
DROP POLICY IF EXISTS admins_and_creators_can_delete_polls ON public.rehearsal_polls;

DROP POLICY IF EXISTS rehearsal_polls_select ON public.rehearsal_polls;
DROP POLICY IF EXISTS rehearsal_polls_insert ON public.rehearsal_polls;
DROP POLICY IF EXISTS rehearsal_polls_update ON public.rehearsal_polls;
DROP POLICY IF EXISTS rehearsal_polls_delete ON public.rehearsal_polls;
CREATE POLICY rehearsal_polls_select ON public.rehearsal_polls
  FOR SELECT TO authenticated
  USING (public.bw_is_band_member(band_id));

-- Members only propose (and are rate-limited); admins publish.
CREATE POLICY rehearsal_polls_insert ON public.rehearsal_polls
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.can_member_propose_rehearsal(band_id, auth.uid())
    AND (public.bw_is_band_admin(band_id) OR status = 'proposed')
  );

CREATE POLICY rehearsal_polls_update ON public.rehearsal_polls
  FOR UPDATE TO authenticated
  USING (
    public.bw_is_band_admin(band_id)
    OR (created_by = auth.uid() AND status = 'proposed' AND public.bw_is_band_member(band_id))
  )
  WITH CHECK (
    public.bw_is_band_admin(band_id)
    OR (created_by = auth.uid() AND status = 'proposed')
  );

CREATE POLICY rehearsal_polls_delete ON public.rehearsal_polls
  FOR DELETE TO authenticated
  USING (
    public.bw_is_band_admin(band_id)
    OR (created_by = auth.uid() AND status = 'proposed')
  );

-- creator_role reflects the real role at creation and is never chosen by
-- a member (it drives the weekly proposal limit).
CREATE OR REPLACE FUNCTION public.bw_guard_rehearsal_poll()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.creator_role := CASE WHEN public.bw_is_band_admin(NEW.band_id) THEN 'admin' ELSE 'member' END;
    RETURN NEW;
  END IF;
  IF NEW.band_id IS DISTINCT FROM OLD.band_id OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'rehearsal_polls: band and creator cannot change' USING ERRCODE = '42501';
  END IF;
  IF NOT public.bw_is_band_admin(OLD.band_id) THEN
    NEW.creator_role := OLD.creator_role;
    NEW.confirmed_event_id := OLD.confirmed_event_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bw_guard_rehearsal_poll ON public.rehearsal_polls;
CREATE TRIGGER bw_guard_rehearsal_poll
  BEFORE INSERT OR UPDATE ON public.rehearsal_polls
  FOR EACH ROW EXECUTE FUNCTION public.bw_guard_rehearsal_poll();

-- Options: admins, or the creator while the proposal is still a proposal.
DROP POLICY IF EXISTS admins_can_manage_options ON public.rehearsal_poll_options;
DROP POLICY IF EXISTS band_members_can_select_options ON public.rehearsal_poll_options;

DROP POLICY IF EXISTS rehearsal_poll_options_select ON public.rehearsal_poll_options;
DROP POLICY IF EXISTS rehearsal_poll_options_write ON public.rehearsal_poll_options;
CREATE POLICY rehearsal_poll_options_select ON public.rehearsal_poll_options
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM rehearsal_polls rp
    WHERE rp.id = rehearsal_poll_options.poll_id AND public.bw_is_band_member(rp.band_id)
  ));

CREATE POLICY rehearsal_poll_options_write ON public.rehearsal_poll_options
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM rehearsal_polls rp
    WHERE rp.id = rehearsal_poll_options.poll_id
      AND (public.bw_is_band_admin(rp.band_id)
           OR (rp.created_by = auth.uid() AND rp.status = 'proposed' AND public.bw_is_band_member(rp.band_id)))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM rehearsal_polls rp
    WHERE rp.id = rehearsal_poll_options.poll_id
      AND (public.bw_is_band_admin(rp.band_id)
           OR (rp.created_by = auth.uid() AND rp.status = 'proposed' AND public.bw_is_band_member(rp.band_id)))
  ));

-- ----------------------------------------------------------- notifications --

-- What the caller may send to p_recipient. Server-side notifications go
-- through bw_notify (SECURITY DEFINER) and are not affected.
CREATE OR REPLACE FUNCTION public.bw_can_notify(p_recipient uuid, p_band_id uuid, p_type text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF actor IS NULL OR p_recipient IS NULL THEN
    RETURN false;
  END IF;
  IF p_recipient = actor THEN
    RETURN true;
  END IF;

  IF p_band_id IS NULL THEN
    -- No band context: only chat notices between people who share a chat.
    RETURN p_type IN ('chat_message', 'chat_mention') AND public.bw_shares_chat(p_recipient, actor);
  END IF;

  IF NOT (public.bw_is_band_member(p_band_id, actor) AND public.bw_is_band_member(p_band_id, p_recipient)) THEN
    RETURN false;
  END IF;

  -- Admins run the band: lineup invites, polls, reminders, updates.
  IF public.bw_is_band_admin(p_band_id, actor) THEN
    RETURN true;
  END IF;

  -- Members to anyone in the band.
  IF p_type IN ('chat_message', 'chat_mention', 'song_added') THEN
    RETURN true;
  END IF;

  -- Members to the band's admins: RSVP answers, conflicts, proposals.
  IF p_type IN ('event_confirmed', 'member_dropped_out', 'event_update', 'rehearsal_proposal') THEN
    RETURN public.bw_is_band_admin(p_band_id, p_recipient);
  END IF;

  RETURN false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bw_can_notify(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_can_notify(uuid, uuid, text) TO authenticated;

DROP POLICY IF EXISTS notifications_insert ON public.notifications;
CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.bw_can_notify(user_id, band_id, type));

-- ------------------------------------------------------------ transactions --

DROP POLICY IF EXISTS "Users can view transactions of their bands" ON public.transactions;
DROP POLICY IF EXISTS "Admins can insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can delete transactions" ON public.transactions;

DROP POLICY IF EXISTS transactions_select_admin ON public.transactions;
DROP POLICY IF EXISTS transactions_insert_admin ON public.transactions;
DROP POLICY IF EXISTS transactions_update_admin ON public.transactions;
DROP POLICY IF EXISTS transactions_delete_admin ON public.transactions;
CREATE POLICY transactions_select_admin ON public.transactions
  FOR SELECT TO authenticated USING (public.bw_is_band_admin(band_id));
CREATE POLICY transactions_insert_admin ON public.transactions
  FOR INSERT TO authenticated WITH CHECK (public.bw_is_band_admin(band_id));
CREATE POLICY transactions_update_admin ON public.transactions
  FOR UPDATE TO authenticated
  USING (public.bw_is_band_admin(band_id)) WITH CHECK (public.bw_is_band_admin(band_id));
CREATE POLICY transactions_delete_admin ON public.transactions
  FOR DELETE TO authenticated USING (public.bw_is_band_admin(band_id));

-- ------------------------------------------------------------ direct chats --

-- Two people share an active band where at least one of them is an admin.
CREATE OR REPLACE FUNCTION public.bw_shares_band_with_admin(p_other uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM band_members a
    JOIN band_members b ON b.band_id = a.band_id
    WHERE a.user_id = p_user_id AND COALESCE(a.is_active, true)
      AND b.user_id = p_other  AND COALESCE(b.is_active, true)
      AND (a.role = 'admin' OR b.role = 'admin')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.bw_shares_band_with_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_shares_band_with_admin(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.bw_can_add_chat_participant(p_chat_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  c record;
  actor uuid := auth.uid();
BEGIN
  IF actor IS NULL THEN
    RETURN false;
  END IF;

  SELECT id, type, band_id, event_id, created_by INTO c FROM chats WHERE id = p_chat_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF c.type = 'band' AND c.band_id IS NOT NULL THEN
    RETURN public.bw_is_band_member(c.band_id, actor)
       AND public.bw_is_band_member(c.band_id, p_user_id);
  END IF;

  IF c.type = 'event' AND c.event_id IS NOT NULL THEN
    RETURN public.bw_is_event_participant(c.event_id, actor)
       AND public.bw_is_event_participant(c.event_id, p_user_id);
  END IF;

  -- Direct / other chats: the actor must own or already be in the chat.
  IF NOT (
    c.created_by = actor
    OR EXISTS (SELECT 1 FROM chat_participants WHERE chat_id = p_chat_id AND user_id = actor)
  ) THEN
    RETURN false;
  END IF;

  IF p_user_id = actor
     OR EXISTS (SELECT 1 FROM chat_participants WHERE chat_id = p_chat_id AND user_id = p_user_id) THEN
    RETURN true;
  END IF;

  -- Direct messages: members write only to admins of a band they share.
  IF c.type = 'direct' THEN
    RETURN public.bw_shares_band_with_admin(p_user_id, actor);
  END IF;

  RETURN p_user_id = c.created_by OR public.bw_shares_band(p_user_id, actor);
END;
$$;

-- ----------------------------------------------------------- subscriptions --

-- Service role bypasses RLS; this policy only opened the table to anyone.
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.subscriptions;

-- ---------------------------------------------------------------- presence --

-- Presence (PR-44) moves from one public channel for the whole app to one
-- private channel per band, "presence:band:<band id>". Realtime
-- Authorization lets in only the band's active members.
CREATE OR REPLACE FUNCTION public.bw_presence_topic_allowed(p_topic text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  band text;
BEGIN
  IF auth.uid() IS NULL OR p_topic IS NULL THEN
    RETURN false;
  END IF;
  band := substring(p_topic FROM '^presence:band:([0-9a-fA-F-]{36})$');
  IF band IS NULL THEN
    RETURN false;
  END IF;
  RETURN public.bw_is_band_member(band::uuid);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bw_presence_topic_allowed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bw_presence_topic_allowed(text) TO authenticated;

DROP POLICY IF EXISTS bw_band_presence_read ON realtime.messages;
CREATE POLICY bw_band_presence_read ON realtime.messages
  FOR SELECT TO authenticated
  USING (realtime.messages.extension = 'presence' AND public.bw_presence_topic_allowed(realtime.topic()));

DROP POLICY IF EXISTS bw_band_presence_write ON realtime.messages;
CREATE POLICY bw_band_presence_write ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (realtime.messages.extension = 'presence' AND public.bw_presence_topic_allowed(realtime.topic()));

-- --------------------------------------------------------- invite emails --

-- send-email (PR-11): an app user can only send the invite email of a
-- pending invitation, at most once every 10 minutes.
ALTER TABLE public.band_invitations ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;

-- -------------------------------------------- accept_pending_invitations --

DROP FUNCTION IF EXISTS public.accept_pending_invitations();

COMMIT;
