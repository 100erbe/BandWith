import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkBandCreation() {
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: "rockstar_1781355953911@example.com",
    password: "Password123!"
  });

  const { data: bandData, error: bandError } = await supabase.from('bands').insert({
    name: "The New Rockstar Band",
    created_by: authData.user.id
  }).select().single();
  
  if (bandError) {
    console.error("Band Creation Error:", bandError);
  } else {
    console.log("Band created successfully:", bandData);
  }
}

checkBandCreation();
