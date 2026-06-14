import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkProfile() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "rockstar_1781355953911@example.com",
    password: "Password123!"
  });

  if (authError || !authData.user) {
    console.error("Sign in failed:", authError);
    return;
  }
  
  console.log("Signed in successfully as:", authData.user.id);
  
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();
    
  if (profileError) {
     console.error("Profile error:", profileError);
  } else {
     console.log("Profile data:", profile);
  }
}

checkProfile();
