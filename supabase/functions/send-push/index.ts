// Supabase Edge Function: Send Push Notification (Zero External Dependencies)
import { adminClient, allowedRecipients, HttpError, requireCaller } from '../_shared/auth.ts';

const APNS_KEY_ID = Deno.env.get('APNS_KEY_ID');
const APNS_TEAM_ID = Deno.env.get('APNS_TEAM_ID');
const APNS_PRIVATE_KEY = Deno.env.get('APNS_PRIVATE_KEY'); 
const APNS_BUNDLE_ID = 'app.bandwith.mobile';

// Xcode/debug builds get sandbox tokens, TestFlight/App Store builds get
// production tokens. Try the preferred host first and fall back to the other
// one on BadDeviceToken, so one deployment serves both kinds of build.
// APNS_PRODUCTION=true only changes which host is tried first.
const APNS_PROD_HOST = 'api.push.apple.com';
const APNS_SANDBOX_HOST = 'api.sandbox.push.apple.com';
const APNS_HOSTS = Deno.env.get('APNS_PRODUCTION') === 'false'
  ? [APNS_SANDBOX_HOST, APNS_PROD_HOST]
  : [APNS_PROD_HOST, APNS_SANDBOX_HOST];

const FCM_PROJECT_ID = Deno.env.get('FCM_PROJECT_ID');
const FCM_CLIENT_EMAIL = Deno.env.get('FCM_CLIENT_EMAIL');
const FCM_PRIVATE_KEY = Deno.env.get('FCM_PRIVATE_KEY');

interface PushRequest {
  user_id?: string;
  user_ids?: string[];
  title: string;
  subtitle?: string;
  tag?: string;
  channel_id?: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  sound?: string;
  create_in_app?: boolean; 
}

// Pure JS Base64URL encoder to avoid external std library imports
function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// Apple rejects provider tokens refreshed more than once every 20 minutes
// (TooManyProviderTokenUpdates) and expires them after 60: reuse for 50.
let cachedApnsJwt: { token: string; at: number } | null = null;

async function generateAPNsJWT(): Promise<string> {
  if (cachedApnsJwt && Date.now() - cachedApnsJwt.at < 50 * 60 * 1000) return cachedApnsJwt.token;
  const token = await signAPNsJWT();
  cachedApnsJwt = { token, at: Date.now() };
  return token;
}

async function signAPNsJWT(): Promise<string> {
  if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_PRIVATE_KEY) {
    throw new Error(`APNs credentials missing`);
  }

  const header = { alg: 'ES256', kid: APNS_KEY_ID };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: APNS_TEAM_ID, iat: now };

  const encoder = new TextEncoder();
  const encodedHeader = encodeBase64Url(encoder.encode(JSON.stringify(header)));
  const encodedPayload = encodeBase64Url(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  let pemContent = APNS_PRIVATE_KEY;
  if (pemContent.includes('-----BEGIN PRIVATE KEY-----')) {
    pemContent = pemContent
      .replace(/\\n/g, '\n')
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\s/g, '');
  } else {
    pemContent = pemContent.replace(/\\n/g, '').replace(/\s/g, '');
  }

  const binaryKey = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey as any,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  return `${unsignedToken}.${encodeBase64Url(new Uint8Array(signature))}`;
}

async function sendToAPNs(
  deviceToken: string, 
  title: string, 
  subtitle: string | undefined,
  body: string,
  data?: Record<string, any>,
  badge?: number,
  sound?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const jwt = await generateAPNsJWT();
    const alert: Record<string, string> = { title, body };
    if (subtitle) {
      alert.subtitle = subtitle;
    }

    const apnsPayload = {
      aps: {
        alert,
        badge: badge ?? 1,
        sound: sound ?? 'default',
        'mutable-content': 1,
        'content-available': 1,
      },
      ...data,
    };
    
    let lastError = 'APNs: no host tried';
    let badTokenEverywhere = true;
    for (const host of APNS_HOSTS) {
      const response = await fetch(`https://${host}/3/device/${deviceToken}`, {
        method: 'POST',
        headers: {
          'Authorization': `bearer ${jwt}`,
          'apns-topic': APNS_BUNDLE_ID,
          'apns-push-type': 'alert',
          'apns-priority': '10',
          'apns-expiration': '0',
          ...(data?.tag ? { 'apns-collapse-id': String(data.tag).slice(0, 64) } : {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apnsPayload),
      });
      if (response.ok) return { success: true };

      const errorBody = await response.text();
      let reason = '';
      try { reason = JSON.parse(errorBody)?.reason || ''; } catch { /* not JSON */ }
      lastError = `APNs ${host} ${response.status} ${reason || errorBody}`;

      // 410 Unregistered: the app was removed from the device. Final.
      if (response.status === 410) return { success: false, error: 'invalid_token' };
      // Token from the other environment: try the next host.
      if (reason === 'BadDeviceToken' || reason === 'DeviceTokenNotForTopic') continue;
      // Anything else (bad payload, auth, throttling) is not the token's fault.
      badTokenEverywhere = false;
      break;
    }
    return { success: false, error: badTokenEverywhere ? 'invalid_token' : lastError };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

async function getFCMAccessToken(): Promise<string | null> {
  if (!FCM_CLIENT_EMAIL || !FCM_PRIVATE_KEY) return null;

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

    const encoder = new TextEncoder();
    const encodedHeader = encodeBase64Url(encoder.encode(JSON.stringify(header)));
    const encodedPayload = encodeBase64Url(encoder.encode(JSON.stringify(payload)));
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;

    let pemContent = FCM_PRIVATE_KEY;
    pemContent = pemContent
      .replace(/\\n/g, '\n')
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/[\n\r\s]/g, '');

    const binaryKey = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryKey as any,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      encoder.encode(unsignedToken)
    );

    const jwt = `${unsignedToken}.${encodeBase64Url(new Uint8Array(signature))}`;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!tokenResponse.ok) return null;
    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  } catch {
    return null;
  }
}

async function sendToFCM(
  deviceToken: string,
  title: string,
  subtitle: string | undefined,
  body: string,
  data?: Record<string, any>,
  channelId?: string,
  tag?: string
): Promise<{ success: boolean; error?: string }> {
  if (!FCM_PROJECT_ID) return { success: false, error: 'FCM not configured' };
  const accessToken = await getFCMAccessToken();
  if (!accessToken) return { success: false, error: 'Could not get FCM access token' };

  try {
    const displayTitle = subtitle ? `${title} · ${subtitle}` : title;
    const androidNotification: Record<string, any> = {
      sound: 'default',
      channelId: channelId || 'bandwith_general',
      icon: 'ic_stat_notification',
      color: '#050505',
    };
    if (tag) androidNotification.tag = tag;

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
            notification: { title: displayTitle, body },
            android: {
              priority: 'high',
              notification: androidNotification,
            },
            data: {
              ...(data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {}),
              title,
              subtitle: subtitle || '',
              tag: tag || '',
              channel_id: channelId || 'bandwith_general',
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      if (errorBody.includes('UNREGISTERED') || errorBody.includes('INVALID_ARGUMENT')) {
        return { success: false, error: 'invalid_token' };
      }
      return { success: false, error: `FCM error: ${response.status}` };
    }
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    // SECURITY: require a signed-in caller (or a server call with the service
    // role key) and only deliver to users who share a band or chat with them.
    const supabase = adminClient();
    // The notifications trigger (migration 048) authenticates with a
    // database-generated secret instead of the service role key.
    const dispatchSecret = req.headers.get('x-bw-dispatch-secret');
    let caller: Awaited<ReturnType<typeof requireCaller>>;
    if (dispatchSecret) {
      const { data: ok, error } = await supabase.rpc('bw_verify_push_dispatch_secret', {
        p_secret: dispatchSecret,
      });
      if (error || ok !== true) throw new HttpError(401, 'Invalid dispatch secret');
      caller = { kind: 'service' };
    } else {
      caller = await requireCaller(req, supabase);
    }

    const body = await req.json();
    const {
      user_id,
      user_ids,
      title,
      subtitle,
      tag,
      channel_id,
      body: notificationBody,
      data,
      badge,
      sound,
      create_in_app
    } = body as PushRequest;

    if (!title || !notificationBody) throw new HttpError(400, 'Missing title or body');
    if (String(title).length > 200 || String(notificationBody).length > 2000) {
      throw new HttpError(400, 'Title or body too long');
    }
    const requestedIds = (user_ids || (user_id ? [user_id] : [])).slice(0, 200);
    if (requestedIds.length === 0) throw new HttpError(400, 'No user IDs provided');
    const targetUserIds = caller.kind === 'service'
      ? requestedIds
      : await allowedRecipients(supabase, caller.id, requestedIds);
    if (targetUserIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No permitted recipients' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const effectiveSubtitle = subtitle || data?.subtitle;
    const effectiveTag = tag || data?.tag;
    const notificationType = data?.type || 'chat_message';
    const effectiveChannel = channel_id || data?.channel_id || (
      notificationType.includes('chat') ? 'bandwith_messages' :
      notificationType.includes('quote') || notificationType.includes('payment') ? 'bandwith_finance' :
      notificationType.includes('event') || notificationType.includes('member_dropped_out') ? 'bandwith_events' :
      'bandwith_general'
    );

    if (create_in_app !== false) {
      const chatId = data?.chat_id || data?.chatId;
      
      const notifications = targetUserIds.map(userId => ({
        user_id: userId,
        type: notificationType,
        title: title,
        body: notificationBody,
        data: {
          ...data,
          subtitle: effectiveSubtitle,
          tag: effectiveTag,
          chat_id: chatId,
          // This function pushes these itself: the DB push trigger must skip them.
          skip_push: true,
        },
        read: false,
        band_id: data?.band_id || null,
        action_url: chatId ? `/chat/${chatId}` : null,
      }));

      await supabase.from('notifications').insert(notifications);
    }

    // Badge = real unread count when the push goes to one person.
    let effectiveBadge = badge;
    if (effectiveBadge === undefined && targetUserIds.length === 1) {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', targetUserIds[0])
        .eq('read', false);
      effectiveBadge = Math.max(1, count ?? 1);
    }

    const { data: tokens, error: tokenError } = await supabase
      .from('push_tokens')
      .select('*')
      .in('user_id', targetUserIds)
      .eq('is_active', true);

    if (tokenError) throw tokenError;

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No active tokens found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = await Promise.allSettled(
      tokens.map(async (tokenRecord: any) => {
        const platform = tokenRecord.platform;
        const deviceToken = tokenRecord.token;

        if (platform === 'ios') {
          const result = await sendToAPNs(deviceToken, title, effectiveSubtitle, notificationBody, data, effectiveBadge, sound);
          if (!result.success && result.error === 'invalid_token') {
            await supabase.from('push_tokens').update({ is_active: false }).eq('id', tokenRecord.id);
          }
          return { token_id: tokenRecord.id, platform, ...result };
        } else if (platform === 'android') {
          const result = await sendToFCM(deviceToken, title, effectiveSubtitle, notificationBody, data, effectiveChannel, effectiveTag);
          if (!result.success && result.error === 'invalid_token') {
            await supabase.from('push_tokens').update({ is_active: false }).eq('id', tokenRecord.id);
          }
          return { token_id: tokenRecord.id, platform, ...result };
        }
        return { token_id: tokenRecord.id, platform, success: false, error: 'Unknown platform' };
      })
    );

    const successful = results.filter((r: any) => r.status === 'fulfilled' && r.value.success).length;
    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successful, 
        results: results.map((r: any) => r.status === 'fulfilled' ? r.value : { error: 'promise_rejected' })
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    if (error instanceof HttpError) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: error.status }
      );
    }
    console.error('send-push error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
