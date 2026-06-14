import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error("Missing VITE_SUPABASE_URL environment variable!");
  process.exit(1);
}

async function runMigration() {
  console.log("Running migration: Fix band_members -> profiles relationship\n");

  // Try with service role key first (needed for schema changes)
  let supabase;
  if (supabaseServiceRoleKey) {
    console.log("Using service role key...");
    supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  } else {
    console.log("No service role key found. Trying with anon key (may fail for schema changes)...");
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }

  const sql = fs.readFileSync('supabase/migrations/023_fix_band_members_profiles_relationship.sql', 'utf8');
  
  console.log("Executing SQL...\n");
  
  // Split by semicolons and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    // Skip comments-only parts
    if (stmt.startsWith('--')) continue;
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' });
      if (error) {
        console.log(`Statement: ${stmt.substring(0, 80)}...`);
        console.log(`  Error: ${error.message}\n`);
      } else {
        console.log(`  ✓ OK: ${stmt.substring(0, 80)}...\n`);
      }
    } catch (e) {
      console.log(`Statement: ${stmt.substring(0, 80)}...`);
      console.log(`  Error: ${e.message || e}\n`);
    }
  }

  console.log("\nDone! Checking if the fix worked...");
  
  // Test: try to query band_members with profiles join
  const { data, error } = await supabase
    .from('band_members')
    .select(`
      *,
      profile:profiles (
        id,
        email,
        full_name,
        avatar_url
      )
    `)
    .limit(5);

  if (error) {
    console.log(`\nTest query failed: ${error.message}`);
    console.log("\nYou may need to run the SQL manually in the Supabase SQL editor.");
  } else {
    console.log(`\n✓ Test query succeeded! Found ${data?.length || 0} members with profiles.`);
    if (data && data.length > 0) {
      console.log("Sample data:", JSON.stringify(data[0], null, 2));
    }
  }
}

runMigration().catch(console.error);
