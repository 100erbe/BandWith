// Supabase Edge Function: Send Push Notification
// Supports iOS APNs and Android FCM
// Deploy with: supabase functions deploy send-push

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encode as base64url } from "https://deno.land/std@0.177.0/encoding/base64url.ts";

// APNs Configuration (for iOS)
const APNS_KEY_ID = Deno.env.get('APNS_KEY_ID');
const APNS_TEAM_ID = Deno.env.get('APNS_TEAM_ID');
const APNS_PRIVATE_KEY = Deno.env.get('APNS_PRIVATE_KEY'); // Content of .p8 file
const APNS_BUNDLE_ID = 'app.bandwith.mobile';

// Use production APNs for App Store builds, sandbox for development
const APNS_HOST = Deno.env.get('APNS_PRODUCTION') === 'true' 
  ? 'api.push.apple.com' 
  : 'api.sandbox.push.apple.com';

// FCM Configuration (for Android)
const FCM_PROJECT_ID = Deno.env.get('FCM_PROJECT_ID');
const FCM_CLIENT_EMAIL = Deno.env.get('FCM_CLIENT_EMAIL');
const FCM_PRIVATE_KEY = Deno.env.get('FCM_PRIVATE_KEY');

interface PushRequest {
  user_id?: string;
  user_ids?: string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  sound?: string;
  create_in_app?: boolean; // Also create in-app notification
}

// Generate JWT for APNs authentication (using crypto.subtle directly)
async function generateAPNsJWT(): Promise<string> {
  if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_PRIVATE_KEY) {
    const missing = [];
    if (!APNS_KEY_ID) missing.push('APNS_KEY_ID');
    if (!APNS_TEAM_ID) missing.push('APNS_TEAM_ID');
    if (!APNS_PRIVATE_KEY) missing.push('APNS_PRIVATE_KEY');
    throw new Error(`APNs credentials missing: ${missing.join(', ')}`);
  }
  
  console.log('[APNs] Generating JWT with keyId:', APNS_KEY_ID, 'teamId:', APNS_TEAM_ID);

  const header = {
    alg: 'ES256',
    kid: APNS_KEY_ID,
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: APNS_TEAM_ID,
    iat: now,
  };

  const encodedHeader = base64url(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // Import the private key and sign
  let pemContent = APNS_PRIVATE_KEY;
  
  // Handle different formats: might be the raw key or with headers
  if (pemContent.includes('-----BEGIN PRIVATE KEY-----')) {
    pemContent = pemContent
      .replace(/\\n/g, '\n')
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\s/g, '');
  } else {
    // Already just the base64 content, just remove whitespace and handle escape sequences
    pemContent = pemContent.replace(/\\n/g, '').replace(/\s/g, '');
  }
  
  console.log('[APNs] Key content length:', pemContent.length);

  let binaryKey: Uint8Array;
  try {
    binaryKey = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));
    console.log('[APNs] Binary key length:', binaryKey.length);
  } catch (e) {
    console.error('[APNs] Failed to decode base64 key:', e);
    throw new Error('Invalid APNs private key format - base64 decode failed');
  }

  let cryptoKey: CryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
    console.log('[APNs] Crypto key imported successfully');
  } catch (e) {
    console.error('[APNs] Failed to import key:', e);
    throw new Error('Invalid APNs private key - crypto import failed');
  }

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const encodedSignature = base64url(new Uint8Array(signature));
  return `${unsignedToken}.${encodedSignature}`;
}

// Send push notification to iOS device via APNs
async function sendToAPNs(
  deviceToken: string, 
  title: string, 
  body: string,
  data?: Record<string, any>,
  badge?: number,
  sound?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const jwt = await generateAPNsJWT();

    const apnsPayload = {
      aps: {
        alert: {
          title,
          body,
        },
        badge: badge ?? 1,
        sound: sound ?? 'default',
        'mutable-content': 1,
        'content-available': 1,
      },
      ...data,
    };

    console.log(`[APNs] Sending to ${APNS_HOST} for device ${deviceToken.substring(0, 20)}...`);
    
    const response = await fetch(`https://${APNS_HOST}/3/device/${deviceToken}`, {
      method: 'POST',
      headers: {
        'Authorization': `bearer ${jwt}`,
        'apns-topic': APNS_BUNDLE_ID,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'apns-expiration': '0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apnsPayload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[APNs] Error ${response.status}:`, errorBody);
      
      // Handle invalid token
      if (response.status === 410 || response.status === 400) {
        return { success: false, error: 'invalid_token' };
      }
      
      return { success: false, error: `APNs error: ${response.status} - ${errorBody}` };
    }

    console.log(`[APNs] Successfully sent to iOS device: ${deviceToken.substring(0, 20)}...`);
    return { success: true };
  } catch (error) {
    console.error(`[APNs] Exception:`, error);
    return { success: false, error: error.message };
  }
}

// Generate OAuth2 access token for FCM v1 API
async function getFCMAccessToken(): Promise<string | null> {
  console.log('[FCM] Getting access token, hasEmail:', !!FCM_CLIENT_EMAIL, 'hasKey:', !!FCM_PRIVATE_KEY);
  
  if (!FCM_CLIENT_EMAIL || !FCM_PRIVATE_KEY) {
    console.warn('[FCM] Missing FCM_CLIENT_EMAIL or FCM_PRIVATE_KEY');
    return null;
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: FCM_CLIENT_EMAIL,
      sub: FCM_CLIENT_EMAIL,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
    };

    const encodedHeader = base64url(new TextEncoder().encode(JSON.stringify(header)));
    const encodedPayload = base64url(new TextEncoder().encode(JSON.stringify(payload)));
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;

    // Parse PEM private key - handle \n escape sequences properly
    let pemContent = FCM_PRIVATE_KEY;
    pemContent = pemContent
      .replace(/\\n/g, '\n')
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/[\n\r\s]/g, '');

    console.log('[FCM] PEM content length after processing:', pemContent.length);

    let binaryKey: Uint8Array;
    try {
      binaryKey = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));
      console.log('[FCM] Binary key length:', binaryKey.length);
    } catch (e) {
      console.error('[FCM] Base64 decode failed:', e);
      return null;
    }

    let cryptoKey: CryptoKey;
    try {
      cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        binaryKey,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
      );
      console.log('[FCM] Crypto key imported successfully');
    } catch (e) {
      console.error('[FCM] Crypto key import failed:', e);
      return null;
    }

    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      new TextEncoder().encode(unsignedToken)
    );

    const jwt = `${unsignedToken}.${base64url(new Uint8Array(signature))}`;
    console.log('[FCM] JWT generated, length:', jwt.length);

    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('[FCM] Token exchange failed:', tokenResponse.status, error);
      return null;
    }

    const tokenData = await tokenResponse.json();
    console.log('[FCM] Access token obtained successfully');
    return tokenData.access_token;
  } catch (error) {
    console.error('[FCM] Error getting access token:', error);
    return null;
  }
}

// Send push notification to Android device via FCM v1 API
async function sendToFCM(
  deviceToken: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  if (!FCM_PROJECT_ID) {
    console.warn('[FCM] FCM_PROJECT_ID not configured');
    return { success: false, error: 'FCM not configured' };
  }

  const accessToken = await getFCMAccessToken();
  if (!accessToken) {
    return { success: false, error: 'Could not get FCM access token' };
  }

  try {
    console.log(`[FCM] Sending to device ${deviceToken.substring(0, 20)}...`);
    
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            notification: {
              title,
              body,
            },
            android: {
              priority: 'high',
              notification: {
                sound: 'default',
                channelId: 'bandwith_general',
              },
            },
            data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : undefined,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[FCM] Error ${response.status}:`, errorBody);
      
      if (errorBody.includes('UNREGISTERED') || errorBody.includes('INVALID_ARGUMENT')) {
        return { success: false, error: 'invalid_token' };
      }
      
      return { success: false, error: `FCM error: ${response.status}` };
    }

    const result = await response.json();
    console.log('[FCM] Success! Message ID:', result.name);
    return { success: true };
  } catch (error) {
    console.error('[FCM] Exception:', error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  console.log('[send-push] Request received:', req.method);
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Debug: Check configuration
    console.log('[send-push] Config:', { 
      hasApnsKey: !!APNS_KEY_ID, 
      hasApnsTeam: !!APNS_TEAM_ID, 
      hasApnsPrivateKey: !!APNS_PRIVATE_KEY,
      apnsHost: APNS_HOST,
      hasFcmProject: !!FCM_PROJECT_ID,
    });
    
    const body = await req.json();
    const { user_id, user_ids, title, body: notificationBody, data, badge, sound, create_in_app } = body as PushRequest;
    
    if (!title || !notificationBody) {
      throw new Error('Missing title or body');
    }

    // Get list of user IDs to notify
    const targetUserIds = user_ids || (user_id ? [user_id] : []);
    
    if (targetUserIds.length === 0) {
      throw new Error('No user IDs provided');
    }

    console.log(`[send-push] Sending to ${targetUserIds.length} user(s): "${title}", create_in_app: ${create_in_app}`);

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create in-app notifications if requested (uses service role, bypasses RLS)
    if (create_in_app !== false) {
      const notificationType = data?.type || 'chat_message';
      // Support both chatId and chat_id for compatibility
      const chatId = data?.chat_id || data?.chatId;
      
      const notifications = targetUserIds.map(userId => ({
        user_id: userId,
        type: notificationType,
        title: title,
        body: notificationBody,
        data: {
          ...data,
          chat_id: chatId, // Ensure consistent snake_case for lookups
        },
        read: false,
        band_id: data?.band_id || null,
        action_url: chatId ? `/chat/${chatId}` : null,
      }));

      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (notifError) {
        console.error('[send-push] Failed to create in-app notifications:', notifError);
      } else {
        console.log(`[send-push] Created ${notifications.length} in-app notification(s)`);
      }
    }

    // Get push tokens for users from push_tokens table
    const { data: tokens, error: tokenError } = await supabase
      .from('push_tokens')
      .select('*')
      .in('user_id', targetUserIds)
      .eq('is_active', true);

    if (tokenError) {
      console.error('[send-push] Database error:', tokenError);
      throw tokenError;
    }

    if (!tokens || tokens.length === 0) {
      console.log('[send-push] No active tokens found');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No active tokens found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-push] Found ${tokens.length} token(s)`);

    // Send push to each token based on platform
    const results = await Promise.allSettled(
      tokens.map(async (tokenRecord) => {
        const platform = tokenRecord.platform;
        const deviceToken = tokenRecord.token;

        console.log(`[send-push] Processing: platform=${platform}, token=${deviceToken.substring(0, 20)}...`);

        if (platform === 'ios') {
          const result = await sendToAPNs(deviceToken, title, notificationBody, data, badge, sound);
          
          // Deactivate invalid tokens
          if (!result.success && result.error === 'invalid_token') {
            console.log(`[send-push] Deactivating invalid iOS token: ${tokenRecord.id}`);
            await supabase.from('push_tokens').update({ is_active: false }).eq('id', tokenRecord.id);
          }
          
          return { token_id: tokenRecord.id, platform, ...result };
        } else if (platform === 'android') {
          const result = await sendToFCM(deviceToken, title, notificationBody, data);
          
          // Deactivate invalid tokens
          if (!result.success && result.error === 'invalid_token') {
            console.log(`[send-push] Deactivating invalid Android token: ${tokenRecord.id}`);
            await supabase.from('push_tokens').update({ is_active: false }).eq('id', tokenRecord.id);
          }
          
          return { token_id: tokenRecord.id, platform, ...result };
        }

        return { token_id: tokenRecord.id, platform, success: false, error: 'Unknown platform' };
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    console.log(`[send-push] Complete: ${successful} success, ${failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successful, 
        failed,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { error: 'promise_rejected' })
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[send-push] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
