-- =============================================
-- REHEARSAL PERSISTENCE TABLES
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Create rehearsal_tasks table if not exists
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

-- Indexes for rehearsal_tasks
CREATE INDEX IF NOT EXISTS idx_rehearsal_tasks_event_id ON rehearsal_tasks(event_id);
CREATE INDEX IF NOT EXISTS idx_rehearsal_tasks_assigned_to ON rehearsal_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_rehearsal_tasks_completed ON rehearsal_tasks(is_completed);

-- RLS for rehearsal_tasks
ALTER TABLE rehearsal_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Band members can manage rehearsal tasks" ON rehearsal_tasks;
CREATE POLICY "Band members can manage rehearsal tasks" ON rehearsal_tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN band_members bm ON bm.band_id = e.band_id
      WHERE e.id = rehearsal_tasks.event_id
      AND bm.user_id = auth.uid()
    )
  );

-- 2. Create song_proposals table if not exists
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

-- Indexes for song_proposals
CREATE INDEX IF NOT EXISTS idx_song_proposals_event_id ON song_proposals(event_id);
CREATE INDEX IF NOT EXISTS idx_song_proposals_proposed_by ON song_proposals(proposed_by);
CREATE INDEX IF NOT EXISTS idx_song_proposals_status ON song_proposals(status);

-- RLS for song_proposals
ALTER TABLE song_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Band members can manage song proposals" ON song_proposals;
CREATE POLICY "Band members can manage song proposals" ON song_proposals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN band_members bm ON bm.band_id = e.band_id
      WHERE e.id = song_proposals.event_id
      AND bm.user_id = auth.uid()
    )
  );

-- 3. Create rehearsal_setlist table for practice setlists
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

-- Indexes for rehearsal_setlist
CREATE INDEX IF NOT EXISTS idx_rehearsal_setlist_event_id ON rehearsal_setlist(event_id);
CREATE INDEX IF NOT EXISTS idx_rehearsal_setlist_position ON rehearsal_setlist(event_id, position);

-- RLS for rehearsal_setlist
ALTER TABLE rehearsal_setlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Band members can manage rehearsal setlist" ON rehearsal_setlist;
CREATE POLICY "Band members can manage rehearsal setlist" ON rehearsal_setlist
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN band_members bm ON bm.band_id = e.band_id
      WHERE e.id = rehearsal_setlist.event_id
      AND bm.user_id = auth.uid()
    )
  );

-- 4. Create proposal_votes table to track who voted
CREATE TABLE IF NOT EXISTS proposal_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES song_proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(proposal_id, user_id)
);

-- Indexes for proposal_votes
CREATE INDEX IF NOT EXISTS idx_proposal_votes_proposal_id ON proposal_votes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_votes_user_id ON proposal_votes(user_id);

-- RLS for proposal_votes
ALTER TABLE proposal_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their votes" ON proposal_votes;
CREATE POLICY "Users can manage their votes" ON proposal_votes
  FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Band members can view votes" ON proposal_votes;
CREATE POLICY "Band members can view votes" ON proposal_votes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM song_proposals sp
      JOIN events e ON e.id = sp.event_id
      JOIN band_members bm ON bm.band_id = e.band_id
      WHERE sp.id = proposal_votes.proposal_id
      AND bm.user_id = auth.uid()
    )
  );

-- 5. Create task_templates table for reusable task checklists
CREATE TABLE IF NOT EXISTS task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'other' CHECK (category IN ('wedding', 'corporate', 'festival', 'private', 'rehearsal', 'other')),
  tasks JSONB DEFAULT '[]'::jsonb,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for task_templates
CREATE INDEX IF NOT EXISTS idx_task_templates_band_id ON task_templates(band_id);
CREATE INDEX IF NOT EXISTS idx_task_templates_category ON task_templates(category);

-- RLS for task_templates
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Band members can manage task templates" ON task_templates;
CREATE POLICY "Band members can manage task templates" ON task_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM band_members bm
      WHERE bm.band_id = task_templates.band_id
      AND bm.user_id = auth.uid()
    )
  );

-- 6. Grant permissions
GRANT ALL ON rehearsal_tasks TO authenticated;
GRANT ALL ON song_proposals TO authenticated;
GRANT ALL ON rehearsal_setlist TO authenticated;
GRANT ALL ON proposal_votes TO authenticated;
GRANT ALL ON task_templates TO authenticated;

-- 7. Enable realtime for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE rehearsal_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE song_proposals;
ALTER PUBLICATION supabase_realtime ADD TABLE rehearsal_setlist;
