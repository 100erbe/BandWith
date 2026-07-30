// Supabase Edge Function for inviting members
// Uses Supabase Auth's built-in invite system (no custom domain needed)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  bandId: string;
  bandName: string;
  role: string;
  inviterName: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { email, bandId, bandName, role, inviterName } = (await req.json()) as InviteRequest;

    if (!email || !bandId) {
      throw new Error("Missing email or bandId");
    }

    console.log(`Inviting ${email} to band ${bandName} (${bandId})`);

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (existingUser) {
      // User exists - just add them to the band
      console.log("User exists, adding to band directly");
      
      // Check if already a member
      const { data: existingMember } = await supabaseAdmin
        .from('band_members')
        .select('id')
        .eq('band_id', bandId)
        .eq('user_id', existingUser.id)
        .single();
      
      if (!existingMember) {
        await supabaseAdmin
          .from('band_members')
          .insert({
            band_id: bandId,
            user_id: existingUser.id,
            role: role === 'admin' ? 'admin' : 'member',
            is_active: true,
          });
      }
      
      return new Response(
        JSON.stringify({ success: true, userExists: true, userId: existingUser.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // User doesn't exist - send invite via Supabase Auth
    // This will send an email using Supabase's email system
    const redirectUrl = `${supabaseUrl.replace('.supabase.co', '')}.supabase.co/auth/v1/callback?band=${bandId}`;
    
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        invited_to_band: bandId,
        band_name: bandName,
        invited_by: inviterName,
        role: role,
      },
      redirectTo: redirectUrl,
    });

    if (error) {
      console.error("Invite error:", error);
      throw error;
    }

    console.log("Invite sent successfully:", data);

    // Store the invitation in our table for tracking
    await supabaseAdmin
      .from('band_invitations')
      .upsert({
        band_id: bandId,
        email: email.toLowerCase(),
        role: role === 'admin' ? 'admin' : 'member',
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }, {
        onConflict: 'band_id,email',
      });

    return new Response(
      JSON.stringify({ success: true, invited: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
