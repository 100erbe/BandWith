-- ====================================================================
-- Migration: 042_security_hardening.sql
-- Description: Close the access-control holes found in the Nov 2026 audit.
--
--   1. Remove the arbitrary-SQL backdoor (exec_sql).
--   2. Re-enable RLS on every public table that has policies
--      (024/025 disabled it on chats, messages, chat_participants,
--       songs, setlists, setlist_songs "for dev mode").
--   3. band_invitations: drop the "anyone can read every invitation" policy.
--   4. chats / chat_participants: only eligible users may create chats or be
--      added to them (removed members can no longer re-join and read history).
--   5. notifications: users may only notify people they share a band/chat with.
--   6. get_user_chats(): callers can only read their own chats.
--   7. events: only band admins (or the event creator) may update band events;
--      members may not change their own fee on event_members.
--   8. quotes: only band admins can read quotes; members see only their own
--      quote_musicians row.
--   9. storage: quote PDFs can only be written by admins of the band in the
--      path; avatars only into the uploader's own folder; no bucket listing.
--
-- Idempotent: safe to run on a database where some ad-hoc fix_*.sql scripts
-- were already applied. Review in a staging/branch database first.
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 0. Helper functions (SECURITY DEFINER avoids RLS recursion on band_members)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bw_is_band_member(p_band_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM band_members
    WHERE band_id = p_band_id AND user_id = p_user_id AND COALESCE(is_active, true)
  );
$$;

CREATE OR REPLACE FUNCTION public.bw_is_band_admin(p_band_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM band_members
    WHERE band_id = p_band_id AND user_id = p_user_id
      AND role = 'admin' AND COALESCE(is_active, true)
  );
$$;

CREATE OR REPLACE FUNCTION public.bw_shares_band(p_other uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM band_members a
    JOIN band_members b ON b.band_id = a.band_id
    WHERE a.user_id = p_user_id AND COALESCE(a.is_active, true)
      AND b.user_id = p_other  AND COALESCE(b.is_active, true)
  );
$$;

CREATE OR REPLACE FUNCTION public.bw_shares_chat(p_other uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM chat_participants a
    JOIN chat_participants b ON b.chat_id = a.chat_id
    WHERE a.user_id = p_user_id AND b.user_id = p_other
  );
$$;

-- A user may take part in an event (chat) if they created it, are a
-- non-declined member of it, or are an admin of its band.
CREATE OR REPLACE FUNCTION public.bw_is_event_participant(p_event_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Can the current user add p_user_id to chat p_chat_id?
CREATE OR REPLACE FUNCTION public.bw_can_add_chat_participant(p_chat_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
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

  -- Direct / other chats: the actor must own or already be in the chat, and
  -- may only add themselves, the creator, existing participants, or people
  -- they share a band with.
  IF NOT (
    c.created_by = actor
    OR EXISTS (SELECT 1 FROM chat_participants WHERE chat_id = p_chat_id AND user_id = actor)
  ) THEN
    RETURN false;
  END IF;

  RETURN p_user_id = actor
      OR p_user_id = c.created_by
      OR EXISTS (SELECT 1 FROM chat_participants WHERE chat_id = p_chat_id AND user_id = p_user_id)
      OR public.bw_shares_band(p_user_id, actor);
END;
$$;

-- Band ids (as text) where the current user is an active admin; used by
-- storage policies without casting arbitrary path segments to uuid.
CREATE OR REPLACE FUNCTION public.bw_my_admin_band_ids()
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(band_id::text), '{}')
  FROM band_members
  WHERE user_id = auth.uid() AND role = 'admin' AND COALESCE(is_active, true);
$$;

REVOKE ALL ON FUNCTION public.bw_my_admin_band_ids() FROM anon;
REVOKE ALL ON FUNCTION public.bw_is_band_member(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.bw_is_band_admin(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.bw_shares_band(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.bw_shares_chat(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.bw_is_event_participant(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.bw_can_add_chat_participant(uuid, uuid) FROM anon;

-- --------------------------------------------------------------------
-- 1. Remove the arbitrary-SQL backdoor
-- --------------------------------------------------------------------
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'exec_sql' AND n.nspname = 'public'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s', f.sig);
  END LOOP;
END $$;

-- --------------------------------------------------------------------
-- 2. Re-enable RLS on every public table that has at least one policy.
--    Tables without policies are reported (enabling RLS on them would
--    block all client access); add policies for them before enabling.
-- --------------------------------------------------------------------
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tablename) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    ELSE
      RAISE NOTICE 'RLS not enabled on public.% (no policies defined) - review manually', t.tablename;
    END IF;
  END LOOP;
END $$;

-- --------------------------------------------------------------------
-- 3. band_invitations: no anonymous / global read.
--    The joiner flow uses the setup-invite-rls edge function instead.
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can lookup invitations by email" ON public.band_invitations;

-- --------------------------------------------------------------------
-- 4. chats / chat_participants
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "chats_insert" ON public.chats;
CREATE POLICY "chats_insert" ON public.chats
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (band_id IS NULL OR public.bw_is_band_member(band_id))
    AND (event_id IS NULL OR public.bw_is_event_participant(event_id))
  );

DROP POLICY IF EXISTS "chat_participants_insert" ON public.chat_participants;
DROP POLICY IF EXISTS "Users can insert participants for own chats" ON public.chat_participants;
CREATE POLICY "chat_participants_insert" ON public.chat_participants
  FOR INSERT TO authenticated
  WITH CHECK (public.bw_can_add_chat_participant(chat_id, user_id));

-- get_user_chats: ignore other users' ids (was SECURITY DEFINER with no check)
CREATE OR REPLACE FUNCTION public.get_user_chats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'id', c.id,
      'band_id', c.band_id,
      'event_id', c.event_id,
      'type', c.type,
      'name', c.name,
      'created_by', c.created_by,
      'created_at', c.created_at,
      'updated_at', c.updated_at,
      'participants', (
        SELECT JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'id', cp.id,
            'chat_id', cp.chat_id,
            'user_id', cp.user_id,
            'last_read_at', cp.last_read_at,
            'muted', cp.muted,
            'joined_at', cp.joined_at
          )
        )
        FROM chat_participants cp
        WHERE cp.chat_id = c.id
      )
    )
    ORDER BY c.updated_at DESC NULLS LAST
  ) INTO result
  FROM chats c
  WHERE c.id IN (
    SELECT cp.chat_id FROM chat_participants cp WHERE cp.user_id = auth.uid()
  );

  RETURN COALESCE(result, '[]'::JSONB);
END;
$$;
REVOKE ALL ON FUNCTION public.get_user_chats(uuid) FROM anon;

-- --------------------------------------------------------------------
-- 5. notifications: no more WITH CHECK (true)
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.bw_shares_band(user_id)
    OR public.bw_shares_chat(user_id)
  );

-- --------------------------------------------------------------------
-- 7. events / event_members (mirror src/lib/permissions.ts)
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Band members can update events" ON public.events;
DROP POLICY IF EXISTS "Band admins can update events" ON public.events;
CREATE POLICY "Band admins can update events" ON public.events
  FOR UPDATE TO authenticated
  USING (
    band_id IS NOT NULL
    AND (public.bw_is_band_admin(band_id) OR created_by = auth.uid())
  )
  WITH CHECK (
    band_id IS NOT NULL
    AND (public.bw_is_band_admin(band_id) OR created_by = auth.uid())
  );
-- (personal gigs keep "Users can update own personal events" from 029)

-- Members may RSVP on their own event_members row, but not change their fee
-- or role. Admins (and the creator of a personal gig) still can.
CREATE OR REPLACE FUNCTION public.bw_guard_event_member_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev record;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW; -- service role / server-side jobs
  END IF;
  IF NEW.fee IS NOT DISTINCT FROM OLD.fee AND NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;
  SELECT band_id, created_by INTO ev FROM events WHERE id = NEW.event_id;
  IF (ev.band_id IS NOT NULL AND public.bw_is_band_admin(ev.band_id))
     OR (ev.band_id IS NULL AND ev.created_by = auth.uid()) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Only band admins can change fees or roles' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS bw_guard_event_member_update ON public.event_members;
CREATE TRIGGER bw_guard_event_member_update
  BEFORE UPDATE ON public.event_members
  FOR EACH ROW EXECUTE FUNCTION public.bw_guard_event_member_update();

-- --------------------------------------------------------------------
-- 8. quotes: admins only (members never see quotes in the app)
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Band members can view quotes" ON public.quotes;
DROP POLICY IF EXISTS "Band members can view quote musicians" ON public.quote_musicians;
CREATE POLICY "Band members can view quote musicians" ON public.quote_musicians
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
-- (admins keep the "Band admins can manage quotes / quote musicians" ALL policies)

-- --------------------------------------------------------------------
-- 9. Storage
-- --------------------------------------------------------------------
-- Quote PDFs: paths are quotes/<band_id>/<file>. The bucket stays public so
-- clients can open shared links, but nobody can list it and only admins of
-- the band in the path can write/overwrite/delete (prevents IBAN-swap fraud).
DROP POLICY IF EXISTS "Public read access for quotes bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload quotes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update quotes" ON storage.objects;
DROP POLICY IF EXISTS "bw_quotes_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "bw_quotes_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "bw_quotes_admin_delete" ON storage.objects;
DROP POLICY IF EXISTS "bw_quotes_admin_select" ON storage.objects;

CREATE POLICY "bw_quotes_admin_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'quotes'
    AND (storage.foldername(name))[1] = 'quotes'
    AND (storage.foldername(name))[2] = ANY (public.bw_my_admin_band_ids())
  );
CREATE POLICY "bw_quotes_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'quotes'
    AND (storage.foldername(name))[1] = 'quotes'
    AND (storage.foldername(name))[2] = ANY (public.bw_my_admin_band_ids())
  );
CREATE POLICY "bw_quotes_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'quotes'
    AND (storage.foldername(name))[1] = 'quotes'
    AND (storage.foldername(name))[2] = ANY (public.bw_my_admin_band_ids())
  );
CREATE POLICY "bw_quotes_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'quotes'
    AND (storage.foldername(name))[1] = 'quotes'
    AND (storage.foldername(name))[2] = ANY (public.bw_my_admin_band_ids())
  );

-- Avatars: users may only write inside their own <user_id>/ folder.
-- (Public URLs keep working because the bucket is public; listing is removed.)
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "bw_avatars_own_insert" ON storage.objects;
DROP POLICY IF EXISTS "bw_avatars_own_select" ON storage.objects;
-- upsert needs SELECT on the uploader's own objects
CREATE POLICY "bw_avatars_own_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "bw_avatars_own_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
-- ("Users can update their own avatars" from 037 is already folder-scoped.)

COMMIT;

NOTIFY pgrst, 'reload schema';
