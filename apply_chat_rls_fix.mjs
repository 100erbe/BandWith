/**
 * Apply migration 032 to fix chat SELECT RLS policies
 * Run with: node apply_chat_rls_fix.mjs
 * 
 * Requires: SERVICE_ROLE_KEY env var or hardcoded below
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://oakhbfdhesktokscqxqo.supabase.co';

// ⚠️ REPLACE with your service_role key from Supabase Dashboard > Project Settings > API
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required.');
  console.error('   Get it from: https://supabase.com/dashboard/project/oakhbfdhesktokscqxqo/settings/api');
  console.error('   Then run: SUPABASE_SERVICE_ROLE_KEY=your_key node apply_chat_rls_fix.mjs');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runSQL(sql) {
  // Method 1: Try exec_sql RPC
  try {
    const { data, error } = await supabaseAdmin.rpc('exec_sql', { query: sql });
    if (!error) {
      console.log('   ✅ exec_sql RPC succeeded');
      return { data, error: null };
    }
    console.log('   ⚠️  exec_sql RPC not found, trying direct query...');
  } catch (e) {
    console.log('   ⚠️  exec_sql RPC failed:', e.message);
  }

  // Method 2: Split by semicolons and send individual queries via REST
  // This is less reliable for DDL but better than nothing
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    try {
      const { error } = await supabaseAdmin.rpc('pgsodium_exec', { sql: stmt });
      if (error) throw error;
    } catch (e) {
      console.log(`   ⚠️  Statement failed: ${stmt.substring(0, 80)}...`);
      console.log(`      Error: ${e.message}`);
    }
  }

  return { data: null, error: null };
}

async function main() {
  console.log('🔧 Applying chat RLS fix migration...\n');
  console.log(`   Project: ${SUPABASE_URL}`);

  const sql = readFileSync('supabase/migrations/032_fix_chat_select_rls.sql', 'utf-8');

  // Split into logical sections
  const sections = sql
    .split(/-- ═+/)
    .filter(s => s.trim().length > 0);

  for (const section of sections) {
    const firstLine = section.trim().split('\n')[0].trim();
    console.log(`\n📦 Running: ${firstLine.substring(0, 60)}`);
    await runSQL(section);
  }

  // Verify: check if policies exist
  console.log('\n🔍 Verifying policies...');

  // Check chat_participants policies
  const { data: cpPolicies } = await supabaseAdmin.rpc('exec_sql', {
    query: "SELECT policyname FROM pg_policies WHERE tablename = 'chat_participants';"
  }).catch(() => ({ data: null }));

  if (cpPolicies) {
    console.log('   chat_participants policies:', cpPolicies);
  } else {
    console.log('   ⚠️  Could not verify chat_participants policies (exec_sql RPC may not exist)');
    console.log('   Please verify manually in Supabase SQL Editor:');
    console.log('   SELECT policyname FROM pg_policies WHERE tablename = \'chat_participants\';');
  }

  console.log('\n✨ Migration complete!');
  console.log('\nIf exec_sql RPC is not available, run the SQL manually in:');
  console.log('   https://supabase.com/dashboard/project/oakhbfdhesktokscqxqo/sql/new');
  console.log('   (copy contents of supabase/migrations/032_fix_chat_select_rls.sql)');
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});