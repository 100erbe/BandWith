import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runFixes() {
  console.log("Checking for database structure errors using REST...");
  
  // Create dummy user
  const email = `fixer_${Date.now()}@example.com`;
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password: "Password123!"
  });
  
  if (authError) {
    console.log("Could not create test user (might be rate limited).");
    return;
  }
  
  const userId = authData.user.id;
  
  // Test band insertion exactly as OnboardingContext does it
  console.log("Testing band insert...");
  const { data: bandData, error: bandError } = await supabase.from('bands').insert({
    name: "Test Band",
    created_by: userId
  }).select().single();
  
  if (bandError) {
    console.error("Band insert failed:", bandError);
  } else {
    console.log("Band insert succeeded:", bandData);
  }
  
  // Test profile retrieval
  const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (profileError) {
    console.error("Profile fetch failed:", profileError);
  } else {
    console.log("Profile fetched:", profile);
  }
}

runFixes();
