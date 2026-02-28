import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get recent messages
const { data: messages, error: msgError } = await supabase
  .from('messages')
  .select('id, chat_id, sender_id, content, created_at')
  .order('created_at', { ascending: false })
  .limit(10);

console.log('=== RECENT MESSAGES ===');
if (msgError) console.log('Error:', msgError);
messages?.forEach(m => {
  const sender = m.sender_id === '494df886-3530-400b-ac9e-8f2abad7c163' ? 'Gianluca' : 'jablabdz';
  console.log(`[${m.created_at}] ${sender}: "${m.content}" (chat: ${m.chat_id.substring(0,8)}...)`);
});

// Get all chats with participant count
const { data: chats } = await supabase
  .from('chats')
  .select('id, type, name, created_at')
  .order('created_at', { ascending: false })
  .limit(10);

console.log('\n=== CHATS ===');
for (const chat of chats || []) {
  const { data: parts } = await supabase
    .from('chat_participants')
    .select('user_id')
    .eq('chat_id', chat.id);
  
  const { count: msgCount } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('chat_id', chat.id);
  
  console.log(`${chat.id.substring(0,8)}... | type: ${chat.type} | participants: ${parts?.length || 0} | messages: ${msgCount || 0}`);
}

// Check if RLS is blocking - test as Gianluca
console.log('\n=== RLS TEST (as Gianluca) ===');
const anonClient = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// We can't easily sign in, so let's check policy definitions
const { data: policies } = await supabase.rpc('get_policies_info').catch(() => ({ data: null }));
if (policies) {
  console.log('Policies:', policies);
} else {
  console.log('Cannot query policies directly');
}
