import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function signInAndCreate() {
  console.log("Signing in...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "admin@bandwith.com",
    password: "Password123!"
  });

  if (authError || !authData.user) {
    console.error("Sign in failed:", authError);
    return;
  }
  
  console.log("Signed in successfully as:", authData.user.id);

  console.log("Attempting to create band...");
  const { data: bandData, error: bandError } = await supabase.from('bands').insert({
    name: "The Admin Band",
    created_by: authData.user.id
  }).select().single();
  
  if (bandError) {
    console.error("Band Creation Error:", bandError);
  } else {
    console.log("Band created successfully:", bandData);
  }
}

signInAndCreate();
