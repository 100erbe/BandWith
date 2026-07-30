import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testLogin() {
  console.log("Testing auth login...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "admin@bandwith.com",
    password: "Password123!"
  });

  if (error) {
    console.error("Login Error details:", JSON.stringify(error, null, 2));
  } else {
    console.log("Login successful! User ID:", data.user.id);
  }
}

testLogin();
