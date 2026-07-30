import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function registerTestUser2() {
  // Use a completely random email to avoid rate limits
  const email = `testuser_${Date.now()}@example.com`;
  const password = "Password123!";
  
  console.log(`Signing up user: ${email} password: ${password}`);
  
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: "Test User" } }
  });

  if (authError) {
    console.error("Auth Error:", authError);
    return;
  }
  
  console.log("Success! You can now log in with these credentials.");
}

registerTestUser2();
