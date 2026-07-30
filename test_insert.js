import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDatabaseErrors() {
  console.log("Attempting to insert a mock band...");
  
  // We need to use a dummy user id for RLS testing
  const dummyUserId = "00000000-0000-0000-0000-000000000000";
  
  const { data: band, error: bandError } = await supabase
    .from('bands')
    .insert({
      name: "Test Band",
      created_by: dummyUserId,
    })
    .select()
    .single();
  
  if (bandError) {
    console.error("Insert failed! Error:", JSON.stringify(bandError, null, 2));
  } else {
    console.log("Insert succeeded!", band);
  }
}

checkDatabaseErrors();
