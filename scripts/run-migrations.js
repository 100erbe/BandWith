/**
 * Script per eseguire le migrazioni SQL su Supabase
 * Esegui con: node scripts/run-migrations.js
 */

const SUPABASE_URL = 'https://elvlzpowkohjbhxjasvd.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsdmx6cG93a29oamJoeGphc3ZkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc5ODU4MSwiZXhwIjoyMDg0Mzc0NTgxfQ.ygK40BDOVYlxs56jJAhtwzG2feAXN7T4MRDAkjc3gU0';

async function runSQL(sql) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ sql }),
  });

  if (!response.ok) {
    // Try alternative method using pg endpoint
    const pgResponse = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    });
    
    if (!pgResponse.ok) {
      throw new Error(`SQL execution failed: ${await pgResponse.text()}`);
    }
    return pgResponse.json();
  }

  return response.json();
}

const migrations = [
  {
    name: '008_rehearsal_tables',
    sql: `
      -- Create rehearsal_tasks table
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
      CREATE INDEX IF NOT EXISTS idx_rehearsal_tasks_assigned_to ON rehearsal_tasks(assigned_to);
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

      -- Create song_proposals table
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

      -- Create rehearsal_setlist table
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

      -- Create proposal_votes table
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

      -- Create task_templates table
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

      GRANT ALL ON rehearsal_tasks TO authenticated;
      GRANT ALL ON song_proposals TO authenticated;
      GRANT ALL ON rehearsal_setlist TO authenticated;
      GRANT ALL ON proposal_votes TO authenticated;
      GRANT ALL ON task_templates TO authenticated;
    `
  },
  {
    name: '009_push_tokens',
    sql: `
      -- Create push_tokens table
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
      GRANT ALL ON push_tokens TO authenticated;

      -- Create notification_logs table
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
      GRANT SELECT ON notification_logs TO authenticated;
    `
  }
];

async function main() {
  console.log('🚀 Running migrations on Supabase...\n');
  
  for (const migration of migrations) {
    console.log(`📦 Running: ${migration.name}...`);
    try {
      await runSQL(migration.sql);
      console.log(`   ✅ ${migration.name} completed\n`);
    } catch (error) {
      console.log(`   ⚠️  ${migration.name}: ${error.message}`);
      console.log('   (Table may already exist or needs manual execution)\n');
    }
  }
  
  console.log('✨ Migration process finished!');
  console.log('\nNote: If you see errors, the tables may already exist or');
  console.log('you may need to run the SQL manually in Supabase Dashboard.');
}

main().catch(console.error);
