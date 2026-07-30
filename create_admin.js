import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createAdminAndBand() {
  const email = "admin@bandwith.com";
  const password = "Password123!";
  
  console.log(`Signing up user: ${email}`);
  
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: "Admin User"
      }
    }
  });

  if (authError) {
    console.error("Auth Error:", authError);
    return;
  }
  
  console.log("User created:", authData.user?.id);
  
  // Wait a second for triggers to run (like creating profile)
  await new Promise(r => setTimeout(r, 1000));
  
  console.log("Attempting to create band...");
  const { data: bandData, error: bandError } = await supabase.from('bands').insert({
    name: "The Admin Band",
    created_by: authData.user?.id
  }).select().single();
  
  if (bandError) {
    console.error("Band Creation Error:", bandError);
  } else {
    console.log("Band created successfully:", bandData);
  }
}

createAdminAndBand();
