-- 073 · Baseline: row-level security as it is live in production (2026-11-13).
--
-- Production and the repo had drifted: some policies existed only in
-- production (created by hand), and some repo policies had been replaced there.
-- This file is the read-only export of production, so from now on the repo is
-- the source of truth for RLS. It changes nothing on production: running it there drops and
-- recreates the same policies with the same definitions.
--
-- Covers: the 20 helper functions the policies call, RLS on all 46 public
-- tables, and all 156 policies on public, storage and realtime.
-- It also drops 14 policies that only exist in older repo migrations.
--
-- Exported with pg_policies / pg_get_functiondef. Later phases (2.2 setlists,
-- 2.3 money data) change these policies in their own migrations.

begin;

-- ── Helper functions used by the policies ─────────────────────────────

CREATE OR REPLACE FUNCTION public.bw_can_add_chat_participant(p_chat_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.bw_can_manage_event(p_event_id uuid, p_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = p_event_id
      AND (
        (e.band_id IS NOT NULL AND public.bw_is_band_admin(e.band_id, p_user_id))
        OR (e.band_id IS NULL AND e.created_by = p_user_id)
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.bw_can_notify(p_recipient uuid, p_band_id uuid, p_type text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.bw_can_view_event(p_event_id uuid, p_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = p_event_id
      AND (
        (e.band_id IS NOT NULL AND public.bw_is_band_member(e.band_id, p_user_id))
        OR (e.band_id IS NULL AND e.created_by = p_user_id)
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.bw_event_band_id(p_event_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT band_id FROM events WHERE id = p_event_id;
$function$;

CREATE OR REPLACE FUNCTION public.bw_has_pending_invite(p_band_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.band_invitations bi
    WHERE bi.band_id = p_band_id
      AND lower(bi.email) = lower(auth.jwt() ->> 'email')
      AND bi.status = 'pending'
      AND (bi.expires_at IS NULL OR bi.expires_at > now())
  );
$function$;

CREATE OR REPLACE FUNCTION public.bw_is_band_admin(p_band_id uuid, p_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM band_members
    WHERE band_id = p_band_id AND user_id = p_user_id
      AND role = 'admin' AND COALESCE(is_active, true)
  );
$function$;

CREATE OR REPLACE FUNCTION public.bw_is_band_member(p_band_id uuid, p_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM band_members
    WHERE band_id = p_band_id AND user_id = p_user_id AND COALESCE(is_active, true)
  );
$function$;

CREATE OR REPLACE FUNCTION public.bw_is_event_participant(p_event_id uuid, p_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = p_event_id
      AND (
        e.created_by = p_user_id
        OR (e.band_id IS NOT NULL AND public.bw_is_band_admin(e.band_id, p_user_id))
        OR EXISTS (
          SELECT 1 FROM event_members em
          WHERE em.event_id = e.id AND em.user_id = p_user_id
            AND COALESCE(em.status, '') <> 'declined'
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.bw_is_quote_admin(p_quote_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM quotes q
    WHERE q.id = p_quote_id AND public.bw_is_band_admin(q.band_id)
  );
$function$;

CREATE OR REPLACE FUNCTION public.bw_my_admin_band_ids()
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(array_agg(band_id::text), '{}')
  FROM band_members
  WHERE user_id = auth.uid() AND role = 'admin' AND COALESCE(is_active, true);
$function$;

CREATE OR REPLACE FUNCTION public.bw_my_band_ids()
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(array_agg(band_id::text), '{}')
  FROM band_members
  WHERE user_id = auth.uid() AND COALESCE(is_active, true);
$function$;

CREATE OR REPLACE FUNCTION public.bw_my_chat_ids()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(array_agg(chat_id), '{}') FROM chat_participants WHERE user_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.bw_presence_topic_allowed(p_topic text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.bw_shares_band(p_other uuid, p_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM band_members a
    JOIN band_members b ON b.band_id = a.band_id
    WHERE a.user_id = p_user_id AND COALESCE(a.is_active, true)
      AND b.user_id = p_other  AND COALESCE(b.is_active, true)
  );
$function$;

CREATE OR REPLACE FUNCTION public.bw_shares_chat(p_other uuid, p_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM chat_participants a
    JOIN chat_participants b ON b.chat_id = a.chat_id
    WHERE a.user_id = p_user_id AND b.user_id = p_other
  );
$function$;

CREATE OR REPLACE FUNCTION public.bw_shares_event(p_other uuid, p_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM event_members a
    JOIN event_members b ON b.event_id = a.event_id
    WHERE a.user_id = p_user_id AND b.user_id = p_other
  ) OR EXISTS (
    SELECT 1
    FROM event_members em
    JOIN events e ON e.id = em.event_id
    JOIN band_members bm ON bm.band_id = e.band_id AND coalesce(bm.is_active, true)
    WHERE (em.user_id = p_other AND bm.user_id = p_user_id)
       OR (em.user_id = p_user_id AND bm.user_id = p_other)
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_member_propose_rehearsal(p_band_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Band admins are never rate-limited
    IF EXISTS (
        SELECT 1 FROM public.band_members
        WHERE band_id = p_band_id
          AND user_id = p_user_id
          AND role = 'admin'
          AND (is_active IS NULL OR is_active = TRUE)
    ) THEN
        RETURN TRUE;
    END IF;

    -- User must be an active member of the band
    IF NOT EXISTS (
        SELECT 1 FROM public.band_members
        WHERE band_id = p_band_id
          AND user_id = p_user_id
          AND (is_active IS NULL OR is_active = TRUE)
    ) THEN
        RETURN FALSE;
    END IF;

    -- Standard member limit: 0 proposals in the last 7 days
    RETURN NOT EXISTS (
        SELECT 1 FROM public.rehearsal_polls
        WHERE band_id = p_band_id
          AND created_by = p_user_id
          AND creator_role = 'member'
          AND created_at > (NOW() - INTERVAL '7 days')
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_band_ids(check_user_id uuid)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT band_id FROM band_members WHERE user_id = check_user_id;
$function$;

CREATE OR REPLACE FUNCTION public.is_user_band_admin(check_user_id uuid, check_band_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM band_members
    WHERE user_id = check_user_id
      AND band_id = check_band_id
      AND role = 'admin'
      AND COALESCE(is_active, true)
  );
$function$;

-- ── Row-level security on every public table ──────────────────────────

alter table public."band_deputies" enable row level security;
alter table public."band_invitations" enable row level security;
alter table public."band_members" enable row level security;
alter table public."bands" enable row level security;
alter table public."beta_requests" enable row level security;
alter table public."bw_email_log" enable row level security;
alter table public."bw_product_updates" enable row level security;
alter table public."chat_participants" enable row level security;
alter table public."chats" enable row level security;
alter table public."contracts" enable row level security;
alter table public."event_drafts" enable row level security;
alter table public."event_members" enable row level security;
alter table public."events" enable row level security;
alter table public."import_jobs" enable row level security;
alter table public."inventory" enable row level security;
alter table public."kv_store_c689d939" enable row level security;
alter table public."member_invites" enable row level security;
alter table public."messages" enable row level security;
alter table public."notification_logs" enable row level security;
alter table public."notifications" enable row level security;
alter table public."onboarding_progress" enable row level security;
alter table public."playlist_songs" enable row level security;
alter table public."playlists" enable row level security;
alter table public."profiles" enable row level security;
alter table public."proposal_votes" enable row level security;
alter table public."proposals" enable row level security;
alter table public."push_subscriptions" enable row level security;
alter table public."push_tokens" enable row level security;
alter table public."quote_items" enable row level security;
alter table public."quote_musicians" enable row level security;
alter table public."quote_number_counters" enable row level security;
alter table public."quotes" enable row level security;
alter table public."rehearsal_poll_options" enable row level security;
alter table public."rehearsal_poll_votes" enable row level security;
alter table public."rehearsal_polls" enable row level security;
alter table public."rehearsal_setlist" enable row level security;
alter table public."rehearsal_tasks" enable row level security;
alter table public."setlist_songs" enable row level security;
alter table public."setlists" enable row level security;
alter table public."song_folders" enable row level security;
alter table public."song_proposals" enable row level security;
alter table public."songs" enable row level security;
alter table public."subscriptions" enable row level security;
alter table public."task_templates" enable row level security;
alter table public."tasks" enable row level security;
alter table public."transactions" enable row level security;

-- ── Policies from older repo migrations that production no longer has ──

drop policy if exists "Band admins can manage members" on public."band_members";
drop policy if exists "Band members can view members" on public."band_members";
drop policy if exists "Band admins can update bands" on public."bands";
drop policy if exists "Band members can view bands" on public."bands";
drop policy if exists "Users can create bands" on public."bands";
drop policy if exists "Band members can manage event members" on public."event_members";
drop policy if exists "Band members can view event members" on public."event_members";
drop policy if exists "Band members can create events" on public."events";
drop policy if exists "Band members can view events" on public."events";
drop policy if exists "Chat participants can send messages" on public."messages";
drop policy if exists "Chat participants can view messages" on public."messages";
drop policy if exists "Profiles are viewable by authenticated users" on public."profiles";
drop policy if exists "Band admins can manage quotes" on public."quotes";
drop policy if exists "Band members can manage songs" on public."songs";

-- ── Policies (production, 2026-11-13) ─────────────────────────────────

-- public.band_deputies
drop policy if exists "band_deputies_admin_delete" on public."band_deputies";
create policy "band_deputies_admin_delete" on public."band_deputies"
  as permissive for delete to authenticated
  using (bw_is_band_admin(band_id));
drop policy if exists "band_deputies_admin_insert" on public."band_deputies";
create policy "band_deputies_admin_insert" on public."band_deputies"
  as permissive for insert to authenticated
  with check (bw_is_band_admin(band_id));
drop policy if exists "band_deputies_admin_select" on public."band_deputies";
create policy "band_deputies_admin_select" on public."band_deputies"
  as permissive for select to authenticated
  using (bw_is_band_admin(band_id));
drop policy if exists "band_deputies_admin_update" on public."band_deputies";
create policy "band_deputies_admin_update" on public."band_deputies"
  as permissive for update to authenticated
  using (bw_is_band_admin(band_id))
  with check (bw_is_band_admin(band_id));

-- public.band_invitations
drop policy if exists "Band admins can manage invitations" on public."band_invitations";
create policy "Band admins can manage invitations" on public."band_invitations"
  as permissive for all to authenticated
  using (bw_is_band_admin(band_id))
  with check (bw_is_band_admin(band_id));
drop policy if exists "Users can accept own invitations" on public."band_invitations";
create policy "Users can accept own invitations" on public."band_invitations"
  as permissive for update to public
  using ((lower(email) = lower((auth.jwt() ->> 'email'::text))));
drop policy if exists "Users can see their invitations" on public."band_invitations";
create policy "Users can see their invitations" on public."band_invitations"
  as permissive for select to authenticated
  using ((email = lower((auth.jwt() ->> 'email'::text))));

-- public.band_members
drop policy if exists "Users can join via invitation" on public."band_members";
create policy "Users can join via invitation" on public."band_members"
  as permissive for insert to authenticated
  with check (((user_id = auth.uid()) AND (role = 'member'::user_role) AND bw_has_pending_invite(band_id)));
drop policy if exists "band_members_delete_policy" on public."band_members";
create policy "band_members_delete_policy" on public."band_members"
  as permissive for delete to public
  using (((user_id = auth.uid()) OR is_user_band_admin(auth.uid(), band_id)));
drop policy if exists "band_members_insert_admin" on public."band_members";
create policy "band_members_insert_admin" on public."band_members"
  as permissive for insert to authenticated
  with check (bw_is_band_admin(band_id));
drop policy if exists "band_members_select_policy" on public."band_members";
create policy "band_members_select_policy" on public."band_members"
  as permissive for select to public
  using ((band_id IN ( SELECT get_user_band_ids(auth.uid()) AS get_user_band_ids)));
drop policy if exists "band_members_update_policy" on public."band_members";
create policy "band_members_update_policy" on public."band_members"
  as permissive for update to public
  using (is_user_band_admin(auth.uid(), band_id));

-- public.bands
drop policy if exists "Band admins can update band details and pricing" on public."bands";
create policy "Band admins can update band details and pricing" on public."bands"
  as permissive for update to public
  using ((EXISTS ( SELECT 1
   FROM band_members
  WHERE ((band_members.band_id = bands.id) AND (band_members.user_id = auth.uid()) AND (band_members.role = 'admin'::user_role) AND (band_members.is_active = true)))));
drop policy if exists "Band members can view band" on public."bands";
create policy "Band members can view band" on public."bands"
  as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM band_members
  WHERE ((band_members.band_id = bands.id) AND (band_members.user_id = auth.uid()) AND (band_members.is_active = true)))));
drop policy if exists "bands_delete_policy" on public."bands";
create policy "bands_delete_policy" on public."bands"
  as permissive for delete to public
  using (is_user_band_admin(auth.uid(), id));
drop policy if exists "bands_insert_policy" on public."bands";
create policy "bands_insert_policy" on public."bands"
  as permissive for insert to public
  with check ((auth.uid() IS NOT NULL));
drop policy if exists "bands_select_policy" on public."bands";
create policy "bands_select_policy" on public."bands"
  as permissive for select to public
  using (((id IN ( SELECT get_user_band_ids(auth.uid()) AS get_user_band_ids)) OR (created_by = auth.uid())));
drop policy if exists "bands_update_policy" on public."bands";
create policy "bands_update_policy" on public."bands"
  as permissive for update to public
  using (is_user_band_admin(auth.uid(), id));

-- public.beta_requests
drop policy if exists "Anyone can request beta access" on public."beta_requests";
create policy "Anyone can request beta access" on public."beta_requests"
  as permissive for insert to anon, authenticated
  with check (((status = 'pending'::text) AND (invited_at IS NULL)));

-- public.chat_participants
drop policy if exists "Users can delete own chat participation" on public."chat_participants";
create policy "Users can delete own chat participation" on public."chat_participants"
  as permissive for delete to public
  using ((auth.uid() = user_id));
drop policy if exists "Users can update own chat participation" on public."chat_participants";
create policy "Users can update own chat participation" on public."chat_participants"
  as permissive for update to public
  using ((auth.uid() = user_id));
drop policy if exists "chat_participants_insert" on public."chat_participants";
create policy "chat_participants_insert" on public."chat_participants"
  as permissive for insert to authenticated
  with check (bw_can_add_chat_participant(chat_id, user_id));
drop policy if exists "chat_participants_select_own" on public."chat_participants";
create policy "chat_participants_select_own" on public."chat_participants"
  as permissive for select to public
  using ((user_id = auth.uid()));
drop policy if exists "chat_participants_select_same_chat" on public."chat_participants";
create policy "chat_participants_select_same_chat" on public."chat_participants"
  as permissive for select to authenticated
  using ((chat_id = ANY (bw_my_chat_ids())));
drop policy if exists "cp_delete" on public."chat_participants";
create policy "cp_delete" on public."chat_participants"
  as permissive for delete to public
  using ((user_id = auth.uid()));
drop policy if exists "cp_update" on public."chat_participants";
create policy "cp_update" on public."chat_participants"
  as permissive for update to public
  using ((user_id = auth.uid()));

-- public.chats
drop policy if exists "chats_insert" on public."chats";
create policy "chats_insert" on public."chats"
  as permissive for insert to authenticated
  with check (((created_by = auth.uid()) AND ((band_id IS NULL) OR bw_is_band_member(band_id)) AND ((event_id IS NULL) OR bw_is_event_participant(event_id))));
drop policy if exists "chats_select_creator" on public."chats";
create policy "chats_select_creator" on public."chats"
  as permissive for select to authenticated
  using ((created_by = auth.uid()));
drop policy if exists "chats_select_participant" on public."chats";
create policy "chats_select_participant" on public."chats"
  as permissive for select to public
  using ((id IN ( SELECT chat_participants.chat_id
   FROM chat_participants
  WHERE (chat_participants.user_id = auth.uid()))));
drop policy if exists "chats_upd" on public."chats";
create policy "chats_upd" on public."chats"
  as permissive for update to authenticated
  using ((created_by = auth.uid()))
  with check ((created_by = auth.uid()));

-- public.contracts
drop policy if exists "Admins can delete contracts" on public."contracts";
create policy "Admins can delete contracts" on public."contracts"
  as permissive for delete to public
  using ((EXISTS ( SELECT 1
   FROM band_members
  WHERE ((band_members.band_id = contracts.band_id) AND (band_members.user_id = auth.uid()) AND (band_members.role = 'admin'::user_role) AND (band_members.is_active = true)))));
drop policy if exists "Admins can insert contracts" on public."contracts";
create policy "Admins can insert contracts" on public."contracts"
  as permissive for insert to public
  with check ((EXISTS ( SELECT 1
   FROM band_members
  WHERE ((band_members.band_id = contracts.band_id) AND (band_members.user_id = auth.uid()) AND (band_members.role = 'admin'::user_role) AND (band_members.is_active = true)))));
drop policy if exists "Admins can update contracts" on public."contracts";
create policy "Admins can update contracts" on public."contracts"
  as permissive for update to public
  using ((EXISTS ( SELECT 1
   FROM band_members
  WHERE ((band_members.band_id = contracts.band_id) AND (band_members.user_id = auth.uid()) AND (band_members.role = 'admin'::user_role) AND (band_members.is_active = true)))));
drop policy if exists "Users can view contracts of their bands" on public."contracts";
create policy "Users can view contracts of their bands" on public."contracts"
  as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM band_members
  WHERE ((band_members.band_id = contracts.band_id) AND (band_members.user_id = auth.uid()) AND (band_members.is_active = true)))));

-- public.event_drafts
drop policy if exists "event_drafts_own" on public."event_drafts";
create policy "event_drafts_own" on public."event_drafts"
  as permissive for all to authenticated
  using ((user_id = auth.uid()))
  with check (((user_id = auth.uid()) AND ((band_id IS NULL) OR bw_is_band_admin(band_id))));

-- public.event_members
drop policy if exists "event_members_delete" on public."event_members";
create policy "event_members_delete" on public."event_members"
  as permissive for delete to authenticated
  using (((user_id = auth.uid()) OR bw_can_manage_event(event_id)));
drop policy if exists "event_members_insert" on public."event_members";
create policy "event_members_insert" on public."event_members"
  as permissive for insert to authenticated
  with check ((bw_can_manage_event(event_id) AND ((bw_event_band_id(event_id) IS NOT NULL) OR (user_id = auth.uid()))));
drop policy if exists "event_members_select" on public."event_members";
create policy "event_members_select" on public."event_members"
  as permissive for select to authenticated
  using (((user_id = auth.uid()) OR bw_can_view_event(event_id)));
drop policy if exists "event_members_update_manager" on public."event_members";
create policy "event_members_update_manager" on public."event_members"
  as permissive for update to authenticated
  using (bw_can_manage_event(event_id))
  with check (bw_can_manage_event(event_id));
drop policy if exists "event_members_update_own" on public."event_members";
create policy "event_members_update_own" on public."event_members"
  as permissive for update to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));

-- public.events
drop policy if exists "Users can delete own personal events" on public."events";
create policy "Users can delete own personal events" on public."events"
  as permissive for delete to public
  using (((auth.uid() IS NOT NULL) AND (band_id IS NULL) AND (created_by = auth.uid())));
drop policy if exists "Users can insert own personal events" on public."events";
create policy "Users can insert own personal events" on public."events"
  as permissive for insert to public
  with check (((auth.uid() IS NOT NULL) AND (band_id IS NULL) AND (created_by = auth.uid())));
drop policy if exists "Users can update own personal events" on public."events";
create policy "Users can update own personal events" on public."events"
  as permissive for update to public
  using (((auth.uid() IS NOT NULL) AND (band_id IS NULL) AND (created_by = auth.uid())))
  with check (((auth.uid() IS NOT NULL) AND (band_id IS NULL) AND (created_by = auth.uid())));
drop policy if exists "Users can view own personal events" on public."events";
create policy "Users can view own personal events" on public."events"
  as permissive for select to public
  using (((auth.uid() IS NOT NULL) AND (band_id IS NULL) AND (created_by = auth.uid())));
drop policy if exists "events_delete_policy" on public."events";
create policy "events_delete_policy" on public."events"
  as permissive for delete to authenticated
  using (((band_id IS NOT NULL) AND bw_is_band_admin(band_id)));
drop policy if exists "events_insert_policy" on public."events";
create policy "events_insert_policy" on public."events"
  as permissive for insert to authenticated
  with check (((band_id IS NOT NULL) AND bw_is_band_admin(band_id)));
drop policy if exists "events_select_policy" on public."events";
create policy "events_select_policy" on public."events"
  as permissive for select to authenticated
  using (((band_id IS NOT NULL) AND bw_is_band_member(band_id)));
drop policy if exists "events_update_policy" on public."events";
create policy "events_update_policy" on public."events"
  as permissive for update to authenticated
  using (((band_id IS NOT NULL) AND bw_is_band_admin(band_id)))
  with check (((band_id IS NOT NULL) AND bw_is_band_admin(band_id)));

-- public.import_jobs
drop policy if exists "Users can manage own imports" on public."import_jobs";
create policy "Users can manage own imports" on public."import_jobs"
  as permissive for all to public
  using ((user_id = auth.uid()));

-- public.inventory
drop policy if exists "Admins can delete inventory" on public."inventory";
create policy "Admins can delete inventory" on public."inventory"
  as permissive for delete to public
  using ((EXISTS ( SELECT 1
   FROM band_members
  WHERE ((band_members.band_id = inventory.band_id) AND (band_members.user_id = auth.uid()) AND (band_members.role = 'admin'::user_role) AND (band_members.is_active = true)))));
drop policy if exists "Admins can insert inventory" on public."inventory";
create policy "Admins can insert inventory" on public."inventory"
  as permissive for insert to public
  with check ((EXISTS ( SELECT 1
   FROM band_members
  WHERE ((band_members.band_id = inventory.band_id) AND (band_members.user_id = auth.uid()) AND (band_members.role = 'admin'::user_role) AND (band_members.is_active = true)))));
drop policy if exists "Admins can update inventory" on public."inventory";
create policy "Admins can update inventory" on public."inventory"
  as permissive for update to public
  using ((EXISTS ( SELECT 1
   FROM band_members
  WHERE ((band_members.band_id = inventory.band_id) AND (band_members.user_id = auth.uid()) AND (band_members.role = 'admin'::user_role) AND (band_members.is_active = true)))));
drop policy if exists "Users can view inventory of their bands" on public."inventory";
create policy "Users can view inventory of their bands" on public."inventory"
  as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM band_members
  WHERE ((band_members.band_id = inventory.band_id) AND (band_members.user_id = auth.uid()) AND (band_members.is_active = true)))));

-- public.member_invites
drop policy if exists "Band admins can manage invites" on public."member_invites";
create policy "Band admins can manage invites" on public."member_invites"
  as permissive for all to public
  using ((band_id IN ( SELECT band_members.band_id
   FROM band_members
  WHERE ((band_members.user_id = auth.uid()) AND (band_members.role = 'admin'::user_role)))));
drop policy if exists "Users can view their invites" on public."member_invites";
create policy "Users can view their invites" on public."member_invites"
  as permissive for select to public
  using (((email)::text = ( SELECT profiles.email
   FROM profiles
  WHERE (profiles.id = auth.uid()))));

-- public.messages
drop policy if exists "messages_delete_own" on public."messages";
create policy "messages_delete_own" on public."messages"
  as permissive for delete to authenticated
  using ((sender_id = auth.uid()));
drop policy if exists "messages_insert_participant" on public."messages";
create policy "messages_insert_participant" on public."messages"
  as permissive for insert to authenticated
  with check (((sender_id = auth.uid()) AND (chat_id = ANY (bw_my_chat_ids()))));
drop policy if exists "messages_select_participant" on public."messages";
create policy "messages_select_participant" on public."messages"
  as permissive for select to authenticated
  using ((chat_id = ANY (bw_my_chat_ids())));
drop policy if exists "messages_update_own" on public."messages";
create policy "messages_update_own" on public."messages"
  as permissive for update to authenticated
  using ((sender_id = auth.uid()))
  with check (((sender_id = auth.uid()) AND (chat_id = ANY (bw_my_chat_ids()))));

-- public.notification_logs
drop policy if exists "Users can view their notification logs" on public."notification_logs";
create policy "Users can view their notification logs" on public."notification_logs"
  as permissive for select to public
  using ((user_id = auth.uid()));

-- public.notifications
drop policy if exists "notifications_delete_own" on public."notifications";
create policy "notifications_delete_own" on public."notifications"
  as permissive for delete to public
  using ((user_id = auth.uid()));
drop policy if exists "notifications_insert" on public."notifications";
create policy "notifications_insert" on public."notifications"
  as permissive for insert to authenticated
  with check (bw_can_notify(user_id, band_id, type));
drop policy if exists "notifications_select_own" on public."notifications";
create policy "notifications_select_own" on public."notifications"
  as permissive for select to public
  using ((user_id = auth.uid()));
drop policy if exists "notifications_update_own" on public."notifications";
create policy "notifications_update_own" on public."notifications"
  as permissive for update to public
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));

-- public.onboarding_progress
drop policy if exists "Users can manage own onboarding" on public."onboarding_progress";
create policy "Users can manage own onboarding" on public."onboarding_progress"
  as permissive for all to public
  using ((user_id = auth.uid()));

-- public.playlist_songs
drop policy if exists "Manage playlist songs" on public."playlist_songs";
create policy "Manage playlist songs" on public."playlist_songs"
  as permissive for all to public
  using ((playlist_id IN ( SELECT playlists.id
   FROM playlists
  WHERE (playlists.band_id IN ( SELECT band_members.band_id
           FROM band_members
          WHERE ((band_members.user_id = auth.uid()) AND (band_members.role = 'admin'::user_role)))))));
drop policy if exists "View playlist songs" on public."playlist_songs";
create policy "View playlist songs" on public."playlist_songs"
  as permissive for select to public
  using ((playlist_id IN ( SELECT playlists.id
   FROM playlists
  WHERE (playlists.band_id IN ( SELECT band_members.band_id
           FROM band_members
          WHERE (band_members.user_id = auth.uid()))))));

-- public.playlists
drop policy if exists "Band admins can manage playlists" on public."playlists";
create policy "Band admins can manage playlists" on public."playlists"
  as permissive for all to public
  using ((band_id IN ( SELECT band_members.band_id
   FROM band_members
  WHERE ((band_members.user_id = auth.uid()) AND (band_members.role = 'admin'::user_role)))));
drop policy if exists "Band members can view playlists" on public."playlists";
create policy "Band members can view playlists" on public."playlists"
  as permissive for select to public
  using ((band_id IN ( SELECT band_members.band_id
   FROM band_members
  WHERE (band_members.user_id = auth.uid()))));

-- public.profiles
drop policy if exists "Users can insert own profile" on public."profiles";
create policy "Users can insert own profile" on public."profiles"
  as permissive for insert to public
  with check ((auth.uid() = id));
drop policy if exists "Users can update own profile" on public."profiles";
create policy "Users can update own profile" on public."profiles"
  as permissive for update to public
  using ((auth.uid() = id));
drop policy if exists "profiles_select_related" on public."profiles";
create policy "profiles_select_related" on public."profiles"
  as permissive for select to authenticated
  using (((id = auth.uid()) OR bw_shares_band(id) OR bw_shares_chat(id) OR bw_shares_event(id)));

-- public.proposal_votes
drop policy if exists "Band members can view votes" on public."proposal_votes";
create policy "Band members can view votes" on public."proposal_votes"
  as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM ((song_proposals sp
     JOIN events e ON ((e.id = sp.event_id)))
     JOIN band_members bm ON ((bm.band_id = e.band_id)))
  WHERE ((sp.id = proposal_votes.proposal_id) AND (bm.user_id = auth.uid())))));
drop policy if exists "Band members can vote" on public."proposal_votes";
create policy "Band members can vote" on public."proposal_votes"
  as permissive for insert to public
  with check (((user_id = auth.uid()) AND (proposal_id IN ( SELECT proposals.id
   FROM proposals
  WHERE (proposals.band_id IN ( SELECT band_members.band_id
           FROM band_members
          WHERE ((band_members.user_id = auth.uid()) AND (band_members.is_active = true))))))));
drop policy if exists "Users can delete own vote" on public."proposal_votes";
create policy "Users can delete own vote" on public."proposal_votes"
  as permissive for delete to public
  using ((user_id = auth.uid()));
drop policy if exists "Users can manage their votes" on public."proposal_votes";
create policy "Users can manage their votes" on public."proposal_votes"
  as permissive for all to public
  using ((user_id = auth.uid()));
drop policy if exists "Users can update own vote" on public."proposal_votes";
create policy "Users can update own vote" on public."proposal_votes"
  as permissive for update to public
  using ((user_id = auth.uid()));

-- public.proposals
drop policy if exists "Band members can create proposals" on public."proposals";
create policy "Band members can create proposals" on public."proposals"
  as permissive for insert to public
  with check (((proposed_by = auth.uid()) AND (band_id IN ( SELECT band_members.band_id
   FROM band_members
  WHERE ((band_members.user_id = auth.uid()) AND (band_members.is_active = true))))));
drop policy if exists "Band members can view proposals" on public."proposals";
create policy "Band members can view proposals" on public."proposals"
  as permissive for select to public
  using ((band_id IN ( SELECT band_members.band_id
   FROM band_members
  WHERE ((band_members.user_id = auth.uid()) AND (band_members.is_active = true)))));
drop policy if exists "Proposer or admin can delete proposals" on public."proposals";
create policy "Proposer or admin can delete proposals" on public."proposals"
  as permissive for delete to public
  using (((proposed_by = auth.uid()) OR (band_id IN ( SELECT band_members.band_id
   FROM band_members
  WHERE ((band_members.user_id = auth.uid()) AND (band_members.role = 'admin'::user_role) AND (band_members.is_active = true))))));
drop policy if exists "Proposer or admin can update proposals" on public."proposals";
create policy "Proposer or admin can update proposals" on public."proposals"
  as permissive for update to public
  using (((proposed_by = auth.uid()) OR (band_id IN ( SELECT band_members.band_id
   FROM band_members
  WHERE ((band_members.user_id = auth.uid()) AND (band_members.role = 'admin'::user_role) AND (band_members.is_active = true))))));

-- public.push_subscriptions
drop policy if exists "Users can delete own subscriptions" on public."push_subscriptions";
create policy "Users can delete own subscriptions" on public."push_subscriptions"
  as permissive for delete to public
  using ((auth.uid() = user_id));
drop policy if exists "Users can insert own subscriptions" on public."push_subscriptions";
create policy "Users can insert own subscriptions" on public."push_subscriptions"
  as permissive for insert to public
  with check ((auth.uid() = user_id));
drop policy if exists "Users can manage own subscriptions" on public."push_subscriptions";
create policy "Users can manage own subscriptions" on public."push_subscriptions"
  as permissive for all to public
  using ((auth.uid() = user_id));
drop policy if exists "Users can select own subscriptions" on public."push_subscriptions";
create policy "Users can select own subscriptions" on public."push_subscriptions"
  as permissive for select to public
  using ((auth.uid() = user_id));
drop policy if exists "Users can update own subscriptions" on public."push_subscriptions";
create policy "Users can update own subscriptions" on public."push_subscriptions"
  as permissive for update to public
  using ((auth.uid() = user_id));

-- public.push_tokens
drop policy if exists "Users can manage their own push tokens" on public."push_tokens";
create policy "Users can manage their own push tokens" on public."push_tokens"
  as permissive for all to public
  using ((user_id = auth.uid()));

-- public.quote_items
drop policy if exists "quote_items_admin" on public."quote_items";
create policy "quote_items_admin" on public."quote_items"
  as permissive for all to authenticated
  using (bw_is_quote_admin(quote_id))
  with check (bw_is_quote_admin(quote_id));

-- public.quote_musicians
drop policy if exists "Band members can view quote musicians" on public."quote_musicians";
create policy "Band members can view quote musicians" on public."quote_musicians"
  as permissive for select to authenticated
  using ((user_id = auth.uid()));
drop policy if exists "quote_musicians_admin" on public."quote_musicians";
create policy "quote_musicians_admin" on public."quote_musicians"
  as permissive for all to authenticated
  using (bw_is_quote_admin(quote_id))
  with check (bw_is_quote_admin(quote_id));

-- public.quotes
drop policy if exists "quotes_delete_admin" on public."quotes";
create policy "quotes_delete_admin" on public."quotes"
  as permissive for delete to authenticated
  using (bw_is_band_admin(band_id));
drop policy if exists "quotes_insert_admin" on public."quotes";
create policy "quotes_insert_admin" on public."quotes"
  as permissive for insert to authenticated
  with check ((bw_is_band_admin(band_id) AND (created_by = auth.uid())));
drop policy if exists "quotes_select_admin" on public."quotes";
create policy "quotes_select_admin" on public."quotes"
  as permissive for select to authenticated
  using ((bw_is_band_admin(band_id) OR (created_by = auth.uid())));
drop policy if exists "quotes_update_admin" on public."quotes";
create policy "quotes_update_admin" on public."quotes"
  as permissive for update to authenticated
  using (bw_is_band_admin(band_id))
  with check (bw_is_band_admin(band_id));

-- public.rehearsal_poll_options
drop policy if exists "rehearsal_poll_options_select" on public."rehearsal_poll_options";
create policy "rehearsal_poll_options_select" on public."rehearsal_poll_options"
  as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM rehearsal_polls rp
  WHERE ((rp.id = rehearsal_poll_options.poll_id) AND bw_is_band_member(rp.band_id)))));
drop policy if exists "rehearsal_poll_options_write" on public."rehearsal_poll_options";
create policy "rehearsal_poll_options_write" on public."rehearsal_poll_options"
  as permissive for all to authenticated
  using ((EXISTS ( SELECT 1
   FROM rehearsal_polls rp
  WHERE ((rp.id = rehearsal_poll_options.poll_id) AND (bw_is_band_admin(rp.band_id) OR ((rp.created_by = auth.uid()) AND (rp.status = 'proposed'::text) AND bw_is_band_member(rp.band_id)))))))
  with check ((EXISTS ( SELECT 1
   FROM rehearsal_polls rp
  WHERE ((rp.id = rehearsal_poll_options.poll_id) AND (bw_is_band_admin(rp.band_id) OR ((rp.created_by = auth.uid()) AND (rp.status = 'proposed'::text) AND bw_is_band_member(rp.band_id)))))));

-- public.rehearsal_poll_votes
drop policy if exists "band_members_can_select_votes" on public."rehearsal_poll_votes";
create policy "band_members_can_select_votes" on public."rehearsal_poll_votes"
  as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM (rehearsal_polls rp
     JOIN band_members bm ON ((bm.band_id = rp.band_id)))
  WHERE ((rp.id = rehearsal_poll_votes.poll_id) AND (bm.user_id = auth.uid())))));
drop policy if exists "users_can_delete_own_vote" on public."rehearsal_poll_votes";
create policy "users_can_delete_own_vote" on public."rehearsal_poll_votes"
  as permissive for delete to public
  using ((auth.uid() = user_id));
drop policy if exists "users_can_insert_own_vote" on public."rehearsal_poll_votes";
create policy "users_can_insert_own_vote" on public."rehearsal_poll_votes"
  as permissive for insert to public
  with check (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM (rehearsal_polls rp
     JOIN band_members bm ON ((bm.band_id = rp.band_id)))
  WHERE ((rp.id = rehearsal_poll_votes.poll_id) AND (bm.user_id = auth.uid()) AND (rp.status = 'polling'::text))))));

-- public.rehearsal_polls
drop policy if exists "rehearsal_polls_delete" on public."rehearsal_polls";
create policy "rehearsal_polls_delete" on public."rehearsal_polls"
  as permissive for delete to authenticated
  using ((bw_is_band_admin(band_id) OR ((created_by = auth.uid()) AND (status = 'proposed'::text))));
drop policy if exists "rehearsal_polls_insert" on public."rehearsal_polls";
create policy "rehearsal_polls_insert" on public."rehearsal_polls"
  as permissive for insert to authenticated
  with check (((created_by = auth.uid()) AND can_member_propose_rehearsal(band_id, auth.uid()) AND (bw_is_band_admin(band_id) OR (status = 'proposed'::text))));
drop policy if exists "rehearsal_polls_select" on public."rehearsal_polls";
create policy "rehearsal_polls_select" on public."rehearsal_polls"
  as permissive for select to authenticated
  using (bw_is_band_member(band_id));
drop policy if exists "rehearsal_polls_update" on public."rehearsal_polls";
create policy "rehearsal_polls_update" on public."rehearsal_polls"
  as permissive for update to authenticated
  using ((bw_is_band_admin(band_id) OR ((created_by = auth.uid()) AND (status = 'proposed'::text) AND bw_is_band_member(band_id))))
  with check ((bw_is_band_admin(band_id) OR ((created_by = auth.uid()) AND (status = 'proposed'::text))));

-- public.rehearsal_setlist
drop policy if exists "Band members can manage rehearsal setlist" on public."rehearsal_setlist";
create policy "Band members can manage rehearsal setlist" on public."rehearsal_setlist"
  as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM (events e
     JOIN band_members bm ON ((bm.band_id = e.band_id)))
  WHERE ((e.id = rehearsal_setlist.event_id) AND (bm.user_id = auth.uid())))));

-- public.rehearsal_tasks
drop policy if exists "rehearsal_tasks_delete" on public."rehearsal_tasks";
create policy "rehearsal_tasks_delete" on public."rehearsal_tasks"
  as permissive for delete to authenticated
  using (bw_can_manage_event(event_id));
drop policy if exists "rehearsal_tasks_insert" on public."rehearsal_tasks";
create policy "rehearsal_tasks_insert" on public."rehearsal_tasks"
  as permissive for insert to authenticated
  with check (bw_can_manage_event(event_id));
drop policy if exists "rehearsal_tasks_select" on public."rehearsal_tasks";
create policy "rehearsal_tasks_select" on public."rehearsal_tasks"
  as permissive for select to authenticated
  using (bw_can_view_event(event_id));
drop policy if exists "rehearsal_tasks_update" on public."rehearsal_tasks";
create policy "rehearsal_tasks_update" on public."rehearsal_tasks"
  as permissive for update to authenticated
  using (bw_can_view_event(event_id))
  with check (bw_can_view_event(event_id));

-- public.setlist_songs
drop policy if exists "Band members can manage setlist songs" on public."setlist_songs";
create policy "Band members can manage setlist songs" on public."setlist_songs"
  as permissive for all to public
  using ((setlist_id IN ( SELECT setlists.id
   FROM setlists
  WHERE (setlists.band_id IN ( SELECT band_members.band_id
           FROM band_members
          WHERE (band_members.user_id = auth.uid()))))));
drop policy if exists "Band members can view setlist songs" on public."setlist_songs";
create policy "Band members can view setlist songs" on public."setlist_songs"
  as permissive for select to public
  using ((setlist_id IN ( SELECT setlists.id
   FROM setlists
  WHERE (setlists.band_id IN ( SELECT band_members.band_id
           FROM band_members
          WHERE (band_members.user_id = auth.uid()))))));

-- public.setlists
drop policy if exists "Band members can manage setlists" on public."setlists";
create policy "Band members can manage setlists" on public."setlists"
  as permissive for all to public
  using ((band_id IN ( SELECT band_members.band_id
   FROM band_members
  WHERE (band_members.user_id = auth.uid()))));
drop policy if exists "Band members can view setlists" on public."setlists";
create policy "Band members can view setlists" on public."setlists"
  as permissive for select to public
  using ((band_id IN ( SELECT band_members.band_id
   FROM band_members
  WHERE (band_members.user_id = auth.uid()))));

-- public.song_folders
drop policy if exists "Band members can manage song folders" on public."song_folders";
create policy "Band members can manage song folders" on public."song_folders"
  as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM band_members bm
  WHERE ((bm.band_id = song_folders.band_id) AND (bm.user_id = auth.uid())))));

-- public.song_proposals
drop policy if exists "Band members can manage proposals" on public."song_proposals";
create policy "Band members can manage proposals" on public."song_proposals"
  as permissive for all to public
  using ((band_id IN ( SELECT band_members.band_id
   FROM band_members
  WHERE (band_members.user_id = auth.uid()))));
drop policy if exists "Band members can manage song proposals" on public."song_proposals";
create policy "Band members can manage song proposals" on public."song_proposals"
  as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM (events e
     JOIN band_members bm ON ((bm.band_id = e.band_id)))
  WHERE ((e.id = song_proposals.event_id) AND (bm.user_id = auth.uid())))));
drop policy if exists "Band members can view proposals" on public."song_proposals";
create policy "Band members can view proposals" on public."song_proposals"
  as permissive for select to public
  using ((band_id IN ( SELECT band_members.band_id
   FROM band_members
  WHERE (band_members.user_id = auth.uid()))));
drop policy if exists "Band members can view song proposals" on public."song_proposals";
create policy "Band members can view song proposals" on public."song_proposals"
  as permissive for select to public
  using ((band_id IN ( SELECT band_members.band_id
   FROM band_members
  WHERE (band_members.user_id = auth.uid()))));

-- public.songs
drop policy if exists "Band admins can manage songs" on public."songs";
create policy "Band admins can manage songs" on public."songs"
  as permissive for all to public
  using ((band_id IN ( SELECT band_members.band_id
   FROM band_members
  WHERE ((band_members.user_id = auth.uid()) AND (band_members.role = 'admin'::user_role)))));
drop policy if exists "Band members can view songs" on public."songs";
create policy "Band members can view songs" on public."songs"
  as permissive for select to public
  using ((band_id IN ( SELECT band_members.band_id
   FROM band_members
  WHERE (band_members.user_id = auth.uid()))));
drop policy if exists "songs_insert_member" on public."songs";
create policy "songs_insert_member" on public."songs"
  as permissive for insert to authenticated
  with check (((band_id)::text = ANY (bw_my_band_ids())));
drop policy if exists "songs_update_member" on public."songs";
create policy "songs_update_member" on public."songs"
  as permissive for update to authenticated
  using (((band_id)::text = ANY (bw_my_band_ids())))
  with check (((band_id)::text = ANY (bw_my_band_ids())));

-- public.subscriptions
drop policy if exists "Users can view own subscription" on public."subscriptions";
create policy "Users can view own subscription" on public."subscriptions"
  as permissive for select to public
  using ((user_id = auth.uid()));

-- public.task_templates
drop policy if exists "Admins can delete task templates" on public."task_templates";
create policy "Admins can delete task templates" on public."task_templates"
  as permissive for delete to public
  using ((EXISTS ( SELECT 1
   FROM band_members
  WHERE ((band_members.band_id = task_templates.band_id) AND (band_members.user_id = auth.uid()) AND (band_members.role = 'admin'::user_role) AND (band_members.is_active = true)))));
drop policy if exists "Admins can insert task templates" on public."task_templates";
create policy "Admins can insert task templates" on public."task_templates"
  as permissive for insert to public
  with check ((EXISTS ( SELECT 1
   FROM band_members
  WHERE ((band_members.band_id = task_templates.band_id) AND (band_members.user_id = auth.uid()) AND (band_members.role = 'admin'::user_role) AND (band_members.is_active = true)))));
drop policy if exists "Admins can update task templates" on public."task_templates";
create policy "Admins can update task templates" on public."task_templates"
  as permissive for update to public
  using ((EXISTS ( SELECT 1
   FROM band_members
  WHERE ((band_members.band_id = task_templates.band_id) AND (band_members.user_id = auth.uid()) AND (band_members.role = 'admin'::user_role) AND (band_members.is_active = true)))));
drop policy if exists "Band members can manage task templates" on public."task_templates";
create policy "Band members can manage task templates" on public."task_templates"
  as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM band_members bm
  WHERE ((bm.band_id = task_templates.band_id) AND (bm.user_id = auth.uid())))));
drop policy if exists "Users can view task templates of their bands" on public."task_templates";
create policy "Users can view task templates of their bands" on public."task_templates"
  as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM band_members
  WHERE ((band_members.band_id = task_templates.band_id) AND (band_members.user_id = auth.uid()) AND (band_members.is_active = true)))));

-- public.tasks
drop policy if exists "Assigned users can update their tasks" on public."tasks";
create policy "Assigned users can update their tasks" on public."tasks"
  as permissive for update to public
  using ((assigned_to = auth.uid()));
drop policy if exists "Band admins can manage tasks" on public."tasks";
create policy "Band admins can manage tasks" on public."tasks"
  as permissive for all to public
  using ((band_id IN ( SELECT band_members.band_id
   FROM band_members
  WHERE ((band_members.user_id = auth.uid()) AND (band_members.role = 'admin'::user_role)))));
drop policy if exists "Band members can view tasks" on public."tasks";
create policy "Band members can view tasks" on public."tasks"
  as permissive for select to public
  using ((band_id IN ( SELECT band_members.band_id
   FROM band_members
  WHERE (band_members.user_id = auth.uid()))));

-- public.transactions
drop policy if exists "transactions_delete_admin" on public."transactions";
create policy "transactions_delete_admin" on public."transactions"
  as permissive for delete to authenticated
  using (bw_is_band_admin(band_id));
drop policy if exists "transactions_insert_admin" on public."transactions";
create policy "transactions_insert_admin" on public."transactions"
  as permissive for insert to authenticated
  with check (bw_is_band_admin(band_id));
drop policy if exists "transactions_select_admin" on public."transactions";
create policy "transactions_select_admin" on public."transactions"
  as permissive for select to authenticated
  using (bw_is_band_admin(band_id));
drop policy if exists "transactions_update_admin" on public."transactions";
create policy "transactions_update_admin" on public."transactions"
  as permissive for update to authenticated
  using (bw_is_band_admin(band_id))
  with check (bw_is_band_admin(band_id));

-- realtime.messages
drop policy if exists "bw_band_presence_read" on realtime."messages";
create policy "bw_band_presence_read" on realtime."messages"
  as permissive for select to authenticated
  using (((extension = 'presence'::text) AND bw_presence_topic_allowed(realtime.topic())));
drop policy if exists "bw_band_presence_write" on realtime."messages";
create policy "bw_band_presence_write" on realtime."messages"
  as permissive for insert to authenticated
  with check (((extension = 'presence'::text) AND bw_presence_topic_allowed(realtime.topic())));

-- storage.objects
drop policy if exists "Avatar authenticated delete" on storage."objects";
create policy "Avatar authenticated delete" on storage."objects"
  as permissive for delete to public
  using (((bucket_id = 'avatars'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
drop policy if exists "Avatar authenticated update" on storage."objects";
create policy "Avatar authenticated update" on storage."objects"
  as permissive for update to public
  using (((bucket_id = 'avatars'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
drop policy if exists "Avatar authenticated upload" on storage."objects";
create policy "Avatar authenticated upload" on storage."objects"
  as permissive for insert to public
  with check (((bucket_id = 'avatars'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
drop policy if exists "Avatar public read" on storage."objects";
create policy "Avatar public read" on storage."objects"
  as permissive for select to public
  using ((bucket_id = 'avatars'::text));
drop policy if exists "Users can delete their own avatars" on storage."objects";
create policy "Users can delete their own avatars" on storage."objects"
  as permissive for delete to authenticated
  using (((bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
drop policy if exists "Users can update their own avatars" on storage."objects";
create policy "Users can update their own avatars" on storage."objects"
  as permissive for update to authenticated
  using (((bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
drop policy if exists "bw_avatars_own_insert" on storage."objects";
create policy "bw_avatars_own_insert" on storage."objects"
  as permissive for insert to authenticated
  with check (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
drop policy if exists "bw_avatars_own_select" on storage."objects";
create policy "bw_avatars_own_select" on storage."objects"
  as permissive for select to authenticated
  using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
drop policy if exists "bw_branding_admin_delete" on storage."objects";
create policy "bw_branding_admin_delete" on storage."objects"
  as permissive for delete to authenticated
  using (((bucket_id = 'band-branding'::text) AND ((storage.foldername(name))[1] = ANY (bw_my_admin_band_ids()))));
drop policy if exists "bw_branding_admin_insert" on storage."objects";
create policy "bw_branding_admin_insert" on storage."objects"
  as permissive for insert to authenticated
  with check (((bucket_id = 'band-branding'::text) AND ((storage.foldername(name))[1] = ANY (bw_my_admin_band_ids()))));
drop policy if exists "bw_branding_admin_select" on storage."objects";
create policy "bw_branding_admin_select" on storage."objects"
  as permissive for select to authenticated
  using (((bucket_id = 'band-branding'::text) AND ((storage.foldername(name))[1] = ANY (bw_my_admin_band_ids()))));
drop policy if exists "bw_branding_admin_update" on storage."objects";
create policy "bw_branding_admin_update" on storage."objects"
  as permissive for update to authenticated
  using (((bucket_id = 'band-branding'::text) AND ((storage.foldername(name))[1] = ANY (bw_my_admin_band_ids()))));
drop policy if exists "bw_quotes_admin_delete" on storage."objects";
create policy "bw_quotes_admin_delete" on storage."objects"
  as permissive for delete to authenticated
  using (((bucket_id = 'quotes'::text) AND ((storage.foldername(name))[1] = 'quotes'::text) AND ((storage.foldername(name))[2] = ANY (bw_my_admin_band_ids()))));
drop policy if exists "bw_quotes_admin_insert" on storage."objects";
create policy "bw_quotes_admin_insert" on storage."objects"
  as permissive for insert to authenticated
  with check (((bucket_id = 'quotes'::text) AND ((storage.foldername(name))[1] = 'quotes'::text) AND ((storage.foldername(name))[2] = ANY (bw_my_admin_band_ids()))));
drop policy if exists "bw_quotes_admin_select" on storage."objects";
create policy "bw_quotes_admin_select" on storage."objects"
  as permissive for select to authenticated
  using (((bucket_id = 'quotes'::text) AND ((storage.foldername(name))[1] = 'quotes'::text) AND ((storage.foldername(name))[2] = ANY (bw_my_admin_band_ids()))));
drop policy if exists "bw_quotes_admin_update" on storage."objects";
create policy "bw_quotes_admin_update" on storage."objects"
  as permissive for update to authenticated
  using (((bucket_id = 'quotes'::text) AND ((storage.foldername(name))[1] = 'quotes'::text) AND ((storage.foldername(name))[2] = ANY (bw_my_admin_band_ids()))));
drop policy if exists "bw_song_files_member_delete" on storage."objects";
create policy "bw_song_files_member_delete" on storage."objects"
  as permissive for delete to authenticated
  using (((bucket_id = 'song-files'::text) AND ((storage.foldername(name))[1] = ANY (bw_my_band_ids()))));
drop policy if exists "bw_song_files_member_insert" on storage."objects";
create policy "bw_song_files_member_insert" on storage."objects"
  as permissive for insert to authenticated
  with check (((bucket_id = 'song-files'::text) AND ((storage.foldername(name))[1] = ANY (bw_my_band_ids()))));
drop policy if exists "bw_song_files_member_select" on storage."objects";
create policy "bw_song_files_member_select" on storage."objects"
  as permissive for select to authenticated
  using (((bucket_id = 'song-files'::text) AND ((storage.foldername(name))[1] = ANY (bw_my_band_ids()))));
drop policy if exists "bw_song_files_member_update" on storage."objects";
create policy "bw_song_files_member_update" on storage."objects"
  as permissive for update to authenticated
  using (((bucket_id = 'song-files'::text) AND ((storage.foldername(name))[1] = ANY (bw_my_band_ids()))));

commit;
