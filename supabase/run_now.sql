-- =============================================
-- MIGRAZIONI DA ESEGUIRE ORA
-- Copia e incolla nel Supabase SQL Editor
-- =============================================

-- 1. Aggiungi colonna event_date se non esiste
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'event_date') THEN
    ALTER TABLE events ADD COLUMN event_date DATE;
  END IF;
END $$;

-- 2. Crea tabella rehearsal_tasks
CREATE TABLE IF NOT EXISTS rehearsal_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assigned_to UUID REFERENCES profiles(id),
  is_completed BOOLEAN DEFAULT false,
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rehearsal_tasks_event_id ON rehearsal_tasks(event_id);
ALTER TABLE rehearsal_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Band members can manage rehearsal tasks" ON rehearsal_tasks;
CREATE POLICY "Band members can manage rehearsal tasks" ON rehearsal_tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN band_members bm ON bm.band_id = e.band_id
      WHERE e.id = rehearsal_tasks.event_id AND bm.user_id = auth.uid()
    )
  );

-- 3. Crea tabella song_proposals
CREATE TABLE IF NOT EXISTS song_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  artist TEXT,
  proposed_by UUID NOT NULL REFERENCES profiles(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  votes_up INTEGER DEFAULT 0,
  votes_down INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_song_proposals_event_id ON song_proposals(event_id);
ALTER TABLE song_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Band members can manage song proposals" ON song_proposals;
CREATE POLICY "Band members can manage song proposals" ON song_proposals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN band_members bm ON bm.band_id = e.band_id
      WHERE e.id = song_proposals.event_id AND bm.user_id = auth.uid()
    )
  );

-- 4. Crea tabella rehearsal_setlist
CREATE TABLE IF NOT EXISTS rehearsal_setlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  artist TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  bpm INTEGER,
  key TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rehearsal_setlist_event_id ON rehearsal_setlist(event_id);
ALTER TABLE rehearsal_setlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Band members can manage rehearsal setlist" ON rehearsal_setlist;
CREATE POLICY "Band members can manage rehearsal setlist" ON rehearsal_setlist
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN band_members bm ON bm.band_id = e.band_id
      WHERE e.id = rehearsal_setlist.event_id AND bm.user_id = auth.uid()
    )
  );

-- 5. Crea tabella proposal_votes
CREATE TABLE IF NOT EXISTS proposal_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES song_proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(proposal_id, user_id)
);

ALTER TABLE proposal_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their votes" ON proposal_votes;
CREATE POLICY "Users can manage their votes" ON proposal_votes FOR ALL USING (user_id = auth.uid());

-- 6. Crea tabella task_templates
CREATE TABLE IF NOT EXISTS task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'other',
  tasks JSONB DEFAULT '[]'::jsonb,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Band members can manage task templates" ON task_templates;
CREATE POLICY "Band members can manage task templates" ON task_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM band_members bm WHERE bm.band_id = task_templates.band_id AND bm.user_id = auth.uid())
  );

-- 7. Crea tabella push_tokens
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own push tokens" ON push_tokens;
CREATE POLICY "Users can manage their own push tokens" ON push_tokens FOR ALL USING (user_id = auth.uid());

-- 8. Crea tabella notification_logs
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  title TEXT,
  body TEXT,
  data JSONB,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending'
);

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their notification logs" ON notification_logs;
CREATE POLICY "Users can view their notification logs" ON notification_logs FOR SELECT USING (user_id = auth.uid());

-- 9. Grants
GRANT ALL ON rehearsal_tasks TO authenticated;
GRANT ALL ON song_proposals TO authenticated;
GRANT ALL ON rehearsal_setlist TO authenticated;
GRANT ALL ON proposal_votes TO authenticated;
GRANT ALL ON task_templates TO authenticated;
GRANT ALL ON push_tokens TO authenticated;
GRANT SELECT ON notification_logs TO authenticated;

-- 10. Abilita realtime
DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE rehearsal_tasks;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE song_proposals;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE rehearsal_setlist;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- FATTO!
SELECT 'Migrazioni completate con successo!' as result;
