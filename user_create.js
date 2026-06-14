import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function registerTestUser() {
  const email = "bandwith@example.com";
  const password = "Password123!";
  
  console.log(`Signing up user: ${email}`);
  
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: "Test Admin" } }
  });

  if (authError) {
    if (authError.message.includes('already registered') || authError.status === 429) {
        console.log(`User ${email} already exists or rate limit hit. You can use these credentials.`);
    } else {
        console.error("Auth Error:", authError);
    }
    return;
  }
  
  console.log("Success! You can now log in with these credentials.");
}

registerTestUser();
