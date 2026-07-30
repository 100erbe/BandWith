// Edge Function to setup RLS and create test invitation
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const { action, email, bandId, bandName, role, inviteId, notificationId, inviteeEmail, userId } = body;
    
    const results: string[] = [];

    if (action === 'setup_rls' || action === 'all') {
      // Apply RLS policy for anonymous invite lookup
      // We can't execute raw SQL, but we can work around by granting access
      results.push("Note: RLS policy must be applied via SQL Editor in Supabase Dashboard");
    }

    if (action === 'create_invite' || action === 'all') {
      // Create invitation
      if (!email || !bandId) {
        throw new Error("Missing email or bandId for invitation");
      }

      // First check if invite exists
      const { data: existing } = await supabaseAdmin
        .from('band_invitations')
        .select('id')
        .eq('band_id', bandId)
        .eq('email', email.toLowerCase())
        .single();
      
      let invite;
      let inviteError;
      
      if (existing) {
        // Update existing
        const result = await supabaseAdmin
          .from('band_invitations')
          .update({
            status: 'pending',
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();
        invite = result.data;
        inviteError = result.error;
      } else {
        // Insert new
        const result = await supabaseAdmin
          .from('band_invitations')
          .insert({
            band_id: bandId,
            email: email.toLowerCase(),
            role: role || 'member',
            status: 'pending',
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .select()
          .single();
        invite = result.data;
        inviteError = result.error;
      }

      if (inviteError) {
        throw inviteError;
      }

      results.push(`Invitation created for ${email} to band ${bandId}`);
    }

    if (action === 'list_bands') {
      // List all bands
      const { data: bands, error: bandsError } = await supabaseAdmin
        .from('bands')
        .select('id, name')
        .limit(10);
      
      if (bandsError) throw bandsError;
      
      return new Response(
        JSON.stringify({ success: true, bands }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'list_invites') {
      // List all invitations
      const { data: invites, error: invitesError } = await supabaseAdmin
        .from('band_invitations')
        .select('*, bands:band_id(id, name, logo_url, description)')
        .limit(20);
      
      if (invitesError) throw invitesError;
      
      return new Response(
        JSON.stringify({ success: true, invites }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'lookup_invites') {
      // Lookup invitations by email (for anonymous users during onboarding)
      if (!email) {
        throw new Error("Missing email for lookup");
      }

      const { data: invites, error: invitesError } = await supabaseAdmin
        .from('band_invitations')
        .select('*, bands:band_id(id, name, logo_url, description)')
        .eq('email', email.toLowerCase())
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());
      
      if (invitesError) throw invitesError;
      
      // Get member counts for each band
      const invitesWithCounts = await Promise.all(
        (invites || []).map(async (invite: any) => {
          const { count } = await supabaseAdmin
            .from('band_members')
            .select('*', { count: 'exact', head: true })
            .eq('band_id', invite.band_id);
          
          return {
            ...invite,
            band: invite.bands,
            member_count: count || 0,
          };
        })
      );
      
      return new Response(
        JSON.stringify({ success: true, invites: invitesWithCounts }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'cancel_invite') {
      // Cancel an invitation
      if (!inviteId) {
        throw new Error("Missing inviteId for cancellation");
      }

      const { error: deleteError } = await supabaseAdmin
        .from('band_invitations')
        .delete()
        .eq('id', inviteId);
      
      if (deleteError) throw deleteError;
      
      return new Response(
        JSON.stringify({ success: true, message: 'Invitation cancelled' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'resend_invite') {
      // Resend an invitation (update expiry date)
      const resendEmail = email;
      
      let invite;
      if (inviteId) {
        const { data, error } = await supabaseAdmin
          .from('band_invitations')
          .update({
            status: 'pending',
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq('id', inviteId)
          .select('*, bands:band_id(name)')
          .single();
        if (error) throw error;
        invite = data;
      } else if (resendEmail && bandId) {
        const { data, error } = await supabaseAdmin
          .from('band_invitations')
          .update({
            status: 'pending',
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq('email', resendEmail.toLowerCase())
          .eq('band_id', bandId)
          .select('*, bands:band_id(name)')
          .single();
        if (error) throw error;
        invite = data;
      } else {
        throw new Error("Missing inviteId or email+bandId for resend");
      }
      
      return new Response(
        JSON.stringify({ success: true, invite, message: 'Invitation resent' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'get_invite_details') {
      // Get full details of an invitation
      let query = supabaseAdmin
        .from('band_invitations')
        .select('*, bands:band_id(id, name, logo_url, description)');
      
      if (inviteId) {
        query = query.eq('id', inviteId);
      } else if (inviteeEmail && bandId) {
        query = query.eq('email', inviteeEmail.toLowerCase()).eq('band_id', bandId);
      } else {
        throw new Error("Missing inviteId or email+bandId");
      }
      
      const { data: invite, error } = await query.single();
      if (error) throw error;
      
      // Get member count
      const { count } = await supabaseAdmin
        .from('band_members')
        .select('*', { count: 'exact', head: true })
        .eq('band_id', invite.band_id);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          invite: { ...invite, band: invite.bands, member_count: count || 0 }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'list_pending_invites') {
      // List pending invites for a band
      const targetBandId = bandId;
      
      if (!targetBandId) {
        throw new Error("Missing bandId");
      }

      const { data: invites, error } = await supabaseAdmin
        .from('band_invitations')
        .select('*, bands:band_id(id, name)')
        .eq('band_id', targetBandId)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true, invites }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'list_all_notifications') {
      // List all notifications (for debugging)
      let query = supabaseAdmin
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (userId) {
        query = query.eq('user_id', userId);
      }
      
      const { data: notifs, error } = await query;
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true, notifications: notifs }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'accept_invite_for_user') {
      // Accept an invitation and add user to band
      // This simulates a user accepting an invite
      if (!email || !bandId) {
        throw new Error("Missing email or bandId");
      }

      // Find or create profile for the user
      let { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();

      let profileId = profile?.id;

      if (!profileId) {
        // Create a new profile for this user
        const newUserId = crypto.randomUUID();
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: newUserId,
            email: email.toLowerCase(),
            full_name: email.split('@')[0].split('.').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
          });
        
        if (profileError) throw profileError;
        profileId = newUserId;
      }

      // Check if already a band member
      const { data: existingMember } = await supabaseAdmin
        .from('band_members')
        .select('id, is_active')
        .eq('band_id', bandId)
        .eq('user_id', profileId)
        .single();

      if (existingMember) {
        if (!existingMember.is_active) {
          // Reactivate
          await supabaseAdmin
            .from('band_members')
            .update({ is_active: true, left_at: null })
            .eq('id', existingMember.id);
        }
      } else {
        // Add as new member
        const { error: memberError } = await supabaseAdmin
          .from('band_members')
          .insert({
            band_id: bandId,
            user_id: profileId,
            role: role || 'member',
            is_active: true,
          });
        
        if (memberError) throw memberError;
      }

      // Update invitation status
      await supabaseAdmin
        .from('band_invitations')
        .update({ status: 'accepted' })
        .eq('email', email.toLowerCase())
        .eq('band_id', bandId);

      return new Response(
        JSON.stringify({ success: true, message: `${email} is now a member of the band`, profileId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'update_notification_data') {
      // Update notification data
      if (!notificationId) {
        throw new Error("Missing notificationId");
      }

      const { data: notifData } = body;
      if (!notifData) {
        throw new Error("Missing data to update");
      }

      // Get existing notification
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from('notifications')
        .select('data')
        .eq('id', notificationId)
        .single();
      
      if (fetchError) throw fetchError;

      // Merge new data with existing
      const mergedData = { ...(existing?.data || {}), ...notifData };

      const { error: updateError } = await supabaseAdmin
        .from('notifications')
        .update({ data: mergedData, read: false })
        .eq('id', notificationId);
      
      if (updateError) throw updateError;
      
      return new Response(
        JSON.stringify({ success: true, message: 'Notification updated' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'delete_notification') {
      // Delete a notification
      if (!notificationId) {
        throw new Error("Missing notificationId");
      }

      const { error: deleteError } = await supabaseAdmin
        .from('notifications')
        .delete()
        .eq('id', notificationId);
      
      if (deleteError) throw deleteError;
      
      return new Response(
        JSON.stringify({ success: true, message: 'Notification deleted' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, results }),
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
