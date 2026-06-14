console.log(`When a user is created in auth.users, the Supabase trigger handle_new_user() runs to copy them to the profiles table.`);
console.log(`Because we see 0 rows, the trigger either crashed (schema mismatch) or isn't enabled.`);
