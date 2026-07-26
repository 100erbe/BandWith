/**
 * Diagnostic script — directly queries Supabase REST API to check DB state
 * Usage: node diagnose.mjs
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://oakhbfdhesktokscqxqo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ha2hiZmRoZXNrdG9rc2NxeHFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMTcyODEsImV4cCI6MjA5Njg5MzI4MX0.AYPTRdFYwmuQLstnCFUSrxXKeTrPDFRtrBmiRx5X4ek';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  // 1. Check RLS state by trying to query chat_participants as anonymous (should fail if RLS works)
  console.log('1. Testing chat_participants access (anonymous — should fail if RLS is ON)...');
  const { data: cpData, error: cpError } = await supabase.from('chat_participants').select('id').limit(1);
  console.log('   Result:', cpError ? `❌ ${cpError.message}` : `✅ Got ${cpData?.length || 0} rows`);
  if (cpError?.code === 'PGRST116') console.log('   (PGRST116 = empty result, RLS blocked it)');

  // 2. Test accessing as a different user (simulates member trying to see others' data)
  console.log('\n2. Testing notifications access...');
  const { data: notifData, error: notifError } = await supabase.from('notifications').select('id').limit(1);
  console.log('   Result:', notifError ? `❌ ${notifError.message}` : `✅ Got ${notifData?.length || 0} rows`);

  // 3. Check if we can view the auth session (to see current user)
  console.log('\n3. Current session:');
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) console.log('   ❌', sessionError.message);
  else if (session) console.log(`   ✅ Logged in as: ${session.user.email} (id: ${session.user.id})`);
  else console.log('   ⚠️ No active session — user needs to log in');

  // 4. Try a query that would indicate RLS status on chat_participants
  // If RLS is DISABLED, anon can read. If RLS is ENABLED with policy, anon still can't.
  console.log('\n4. Checking if user has any notifications (test markAsRead flow)...');
  const { data: userNotifs } = await supabase.from('notifications').select('id, read').limit(5);
  console.log(`   Found ${userNotifs?.length || 0} notifications`);
  if (userNotifs?.length > 0) {
    console.log(`   First notification: id=${userNotifs[0].id}, read=${userNotifs[0].read}`);
    // Try marking one as read
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', userNotifs[0].id);
    console.log(`   markAsRead test: ${updateError ? `❌ ${updateError.message}` : '✅ Success'}`);
  }

  // 5. Check chats
  console.log('\n5. Checking user chats...');
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: participations } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('user_id', user.id);
    console.log(`   chat_participants found: ${participations?.length || 0} rows`);
    if (participations?.length === 0) {
      console.log('   This is likely the root cause — user has NO chat participations at all.');
      console.log('   Freemium members joining via invite need to be added to the band chat automatically.');
    }
  }
}

main().catch(err => console.error('Fatal:', err.message));