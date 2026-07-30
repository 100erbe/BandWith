import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectBands() {
  const { data, error } = await supabase
    .from('bands')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Data:", data);
    if (data && data.length > 0) {
      console.log("Columns:", Object.keys(data[0]));
    } else {
      console.log("No data returned, cannot infer columns.");
      // Let's try inserting a dummy row with only name to see the error
      const { data: iData, error: iError } = await supabase.from('bands').insert({ name: 'test' }).select();
      console.log("Insert Error:", iError);
    }
  }
}

inspectBands();
