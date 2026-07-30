import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function createFreshUser() {
  const email = `rockstar_${Date.now()}@example.com`;
  const password = "Password123!";
  
  console.log(`Attempting to sign up: ${email} / ${password}`);
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: "Rockstar User" }
    }
  });

  if (error) {
    console.error("Sign up failed:", error.message);
    if (error.message.includes('rate limit')) {
      console.log("--> RATE LIMIT HIT: You must wait ~1 hour or use the Supabase dashboard to create a user.");
    }
  } else {
    console.log("SUCCESS! Use these exact credentials to log in:");
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    
    // Test login immediately
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (!loginError) console.log("--> API Login confirmed working!");
  }
}

createFreshUser();
