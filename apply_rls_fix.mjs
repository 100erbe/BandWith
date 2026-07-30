/**
 * Apply RLS fix migration to Supabase
 * Runs each SQL statement individually to avoid timeout issues
 * 
 * Usage: node apply_rls_fix.mjs
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://oakhbfdhesktokscqxqo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ha2hiZmRoZXNrdG9rc2NxeHFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMTcyODEsImV4cCI6MjA5Njg5MzI4MX0.AYPTRdFYwmuQLstnCFUSrxXKeTrPDFRtrBmiRx5X4ek';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Parse SQL into individual statements, skipping comments and empty lines
function parseStatements(sql) {
  return sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && s !== '');
}

async function main() {
  const fs = await import('fs');
  const sql = fs.readFileSync('supabase/migrations/032_fix_chat_select_rls.sql', 'utf-8');
  
  const statements = parseStatements(sql);
  console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    // Truncate for display
    const display = stmt.length > 80 ? stmt.substring(0, 77) + '...' : stmt;
    
    try {
      // Try direct SQL execution via Supabase REST API
      // This uses the /rest/v1/rpc/exec_sql endpoint if available
      const { error } = await supabase.rpc('exec_sql', { query: stmt });
      
      if (error) {
        // If exec_sql RPC doesn't exist, try sending raw SQL via the management API
        // Fallback: just try executing through the authenticated REST client
        console.log(`   ⚠️  exec_sql failed for statement ${i + 1}: ${error.message}`);
        console.log(`   → Statement: ${display}`);
        console.log(`   → This is expected if exec_sql RPC is not deployed.`);
        console.log(`   → The SQL must be run manually in Supabase SQL Editor.`);
        failed++;
        break; // Stop on first failure since rest will also fail
      }
      
      console.log(`   ✅ Statement ${i + 1}/${statements.length}: ${display}`);
      success++;
    } catch (err) {
      console.log(`   ❌ Error on statement ${i + 1}: ${err.message}`);
      console.log(`   → Statement: ${display}`);
      failed++;
      break; // Stop on first failure
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`✅ ${success} succeeded, ❌ ${failed} failed`);
  
  if (failed > 0) {
    console.log('\n📌 Manual steps required:');
    console.log('   Open this URL in your browser:');
    console.log('   https://supabase.com/dashboard/project/oakhbfdhesktokscqxqo/sql/new');
    console.log('   Then copy-paste the entire file: supabase/migrations/032_fix_chat_select_rls.sql');
    console.log('   and click "Run".');
  } else {
    console.log('\n🎉 Migration applied successfully!');
    console.log('   Refresh the app at http://localhost:5173 to see the fix.');
  }

  // Verify policies exist
  console.log('\n🔍 Verifying current policies...');
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      query: "SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename IN ('chats', 'chat_participants', 'messages', 'notifications') ORDER BY tablename, cmd;"
    });
    if (!error && data) {
      console.log('   Current policies:');
      const rows = Array.isArray(data) ? data : (data.data || []);
      rows.forEach(r => console.log(`   • ${r.tablename}: ${r.cmd} — ${r.policyname}`));
    } else {
      console.log('   ⚠️  Could not verify (exec_sql not available)');
    }
  } catch {
    console.log('   ⚠️  Could not verify policies');
  }
}

main().catch(err => {
  console.error('❌ Fatal:', err.message);
  process.exit(1);
});