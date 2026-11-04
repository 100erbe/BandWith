-- ====================================================================
-- Migration: 038_rehearsal_polls.sql
-- Description: Rehearsal Proposal & Availability Poll system with 1-per-week member limit
-- ====================================================================

-- 1. Table: rehearsal_polls
CREATE TABLE IF NOT EXISTS public.rehearsal_polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    creator_role TEXT NOT NULL CHECK (creator_role IN ('admin', 'member')),
    title TEXT NOT NULL DEFAULT 'Rehearsal Proposal',
    notes TEXT,
    status TEXT NOT NULL CHECK (status IN ('proposed', 'polling', 'confirmed', 'cancelled', 'expired')) DEFAULT 'proposed',
    confirmed_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Table: rehearsal_poll_options
CREATE TABLE IF NOT EXISTS public.rehearsal_poll_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES public.rehearsal_polls(id) ON DELETE CASCADE,
    proposed_date DATE NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Table: rehearsal_poll_votes
CREATE TABLE IF NOT EXISTS public.rehearsal_poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES public.rehearsal_polls(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES public.rehearsal_poll_options(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (option_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rehearsal_polls_band ON public.rehearsal_polls(band_id);
CREATE INDEX IF NOT EXISTS idx_rehearsal_polls_creator ON public.rehearsal_polls(created_by, band_id, created_at);
CREATE INDEX IF NOT EXISTS idx_rehearsal_polls_status ON public.rehearsal_polls(status);
CREATE INDEX IF NOT EXISTS idx_rehearsal_poll_options_poll ON public.rehearsal_poll_options(poll_id);
CREATE INDEX IF NOT EXISTS idx_rehearsal_poll_votes_poll ON public.rehearsal_poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_rehearsal_poll_votes_user ON public.rehearsal_poll_votes(user_id);

-- 4. Database Enforcement for 1-Per-Week Member Limit
CREATE OR REPLACE FUNCTION public.can_member_propose_rehearsal(p_band_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- 5. Row Level Security Policies
ALTER TABLE public.rehearsal_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rehearsal_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rehearsal_poll_votes ENABLE ROW LEVEL SECURITY;

-- rehearsal_polls: SELECT
DROP POLICY IF EXISTS "band_members_can_select_polls" ON public.rehearsal_polls;
CREATE POLICY "band_members_can_select_polls" ON public.rehearsal_polls
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.band_members bm
            WHERE bm.band_id = rehearsal_polls.band_id
              AND bm.user_id = auth.uid()
        )
    );

-- rehearsal_polls: INSERT
DROP POLICY IF EXISTS "band_members_can_insert_polls" ON public.rehearsal_polls;
CREATE POLICY "band_members_can_insert_polls" ON public.rehearsal_polls
    FOR INSERT WITH CHECK (
        auth.uid() = created_by
        AND public.can_member_propose_rehearsal(band_id, auth.uid())
    );

-- rehearsal_polls: UPDATE
DROP POLICY IF EXISTS "admins_and_creators_can_update_polls" ON public.rehearsal_polls;
CREATE POLICY "admins_and_creators_can_update_polls" ON public.rehearsal_polls
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.band_members bm
            WHERE bm.band_id = rehearsal_polls.band_id
              AND bm.user_id = auth.uid()
              AND bm.role = 'admin'
        )
        OR (created_by = auth.uid() AND status = 'proposed')
    );

-- rehearsal_polls: DELETE
DROP POLICY IF EXISTS "admins_and_creators_can_delete_polls" ON public.rehearsal_polls;
CREATE POLICY "admins_and_creators_can_delete_polls" ON public.rehearsal_polls
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.band_members bm
            WHERE bm.band_id = rehearsal_polls.band_id
              AND bm.user_id = auth.uid()
              AND bm.role = 'admin'
        )
        OR (created_by = auth.uid() AND status = 'proposed')
    );

-- rehearsal_poll_options: SELECT
DROP POLICY IF EXISTS "band_members_can_select_options" ON public.rehearsal_poll_options;
CREATE POLICY "band_members_can_select_options" ON public.rehearsal_poll_options
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.rehearsal_polls rp
            JOIN public.band_members bm ON bm.band_id = rp.band_id
            WHERE rp.id = rehearsal_poll_options.poll_id
              AND bm.user_id = auth.uid()
        )
    );

-- rehearsal_poll_options: ALL (INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "admins_can_manage_options" ON public.rehearsal_poll_options;
CREATE POLICY "admins_can_manage_options" ON public.rehearsal_poll_options
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.rehearsal_polls rp
            JOIN public.band_members bm ON bm.band_id = rp.band_id
            WHERE rp.id = rehearsal_poll_options.poll_id
              AND bm.user_id = auth.uid()
              AND (bm.role = 'admin' OR rp.created_by = auth.uid())
        )
    );

-- rehearsal_poll_votes: SELECT
DROP POLICY IF EXISTS "band_members_can_select_votes" ON public.rehearsal_poll_votes;
CREATE POLICY "band_members_can_select_votes" ON public.rehearsal_poll_votes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.rehearsal_polls rp
            JOIN public.band_members bm ON bm.band_id = rp.band_id
            WHERE rp.id = rehearsal_poll_votes.poll_id
              AND bm.user_id = auth.uid()
        )
    );

-- rehearsal_poll_votes: INSERT
DROP POLICY IF EXISTS "users_can_insert_own_vote" ON public.rehearsal_poll_votes;
CREATE POLICY "users_can_insert_own_vote" ON public.rehearsal_poll_votes
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.rehearsal_polls rp
            JOIN public.band_members bm ON bm.band_id = rp.band_id
            WHERE rp.id = rehearsal_poll_votes.poll_id
              AND bm.user_id = auth.uid()
              AND rp.status = 'polling'
        )
    );

-- rehearsal_poll_votes: DELETE
DROP POLICY IF EXISTS "users_can_delete_own_vote" ON public.rehearsal_poll_votes;
CREATE POLICY "users_can_delete_own_vote" ON public.rehearsal_poll_votes
    FOR DELETE USING (
        auth.uid() = user_id
    );

-- 6. Safe Realtime Publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'rehearsal_polls'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE rehearsal_polls;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'rehearsal_poll_options'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE rehearsal_poll_options;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'rehearsal_poll_votes'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE rehearsal_poll_votes;
    END IF;
END $$;

ALTER TABLE public.rehearsal_polls REPLICA IDENTITY FULL;
ALTER TABLE public.rehearsal_poll_options REPLICA IDENTITY FULL;
ALTER TABLE public.rehearsal_poll_votes REPLICA IDENTITY FULL;

NOTIFY pgrst, 'reload schema';
