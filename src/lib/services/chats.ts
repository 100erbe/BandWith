import { supabase, getSafeUser } from '../supabase';
import { sendPushToUsers } from './notifications';
import { personName } from '@/lib/personName';

// ============================================
// TYPES
// ============================================

export type ChatType = 'direct' | 'group' | 'band' | 'event';

export interface Chat {
  id: string;
  band_id?: string;
  event_id?: string;
  type: ChatType;
  name?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface ChatWithDetails extends Chat {
  participants: ChatParticipant[];
  last_message?: Message;
  unread_count: number;
}

export interface ChatParticipant {
  id: string;
  chat_id: string;
  user_id: string;
  last_read_at?: string;
  last_delivered_at?: string;
  cleared_at?: string;
  muted: boolean;
  joined_at: string;
  profile?: {
    id: string;
    full_name?: string;
    email?: string;
    avatar_url?: string;
  };
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  attachments?: unknown[];
  metadata?: Record<string, unknown>;
  edited: boolean;
  edited_at?: string;
  deleted: boolean;
  deleted_at?: string;
  created_at: string;
  reply_to_id?: string;
  reply_to?: Message; // The quoted message
  sender?: {
    id: string;
    full_name?: string;
    email?: string;
    avatar_url?: string;
  };
}

// ============================================
// RECEIPTS (WhatsApp-style ticks)
// ============================================

/** sending → clock · sent → ✓ · delivered → ✓✓ · read → ✓✓ coloured */
export type ReceiptStatus = 'sending' | 'sent' | 'delivered' | 'read';

const atOrAfter = (mark: string | null | undefined, createdAt: number) =>
  !!mark && new Date(mark).getTime() >= createdAt;

/**
 * Status of one of my messages given the OTHER participants of the chat.
 * Like WhatsApp groups: delivered/read only once everyone got/read it.
 */
export const receiptFor = (
  createdAt: string,
  others: Pick<ChatParticipant, 'last_read_at' | 'last_delivered_at' | 'joined_at'>[]
): ReceiptStatus => {
  const t = new Date(createdAt).getTime();
  // People who joined after the message was sent never "received" it.
  const audience = others.filter((p) => !p.joined_at || new Date(p.joined_at).getTime() <= t);
  if (audience.length === 0) return 'sent';
  if (audience.every((p) => atOrAfter(p.last_read_at, t))) return 'read';
  if (audience.every((p) => atOrAfter(p.last_delivered_at, t) || atOrAfter(p.last_read_at, t))) {
    return 'delivered';
  }
  return 'sent';
};

let lastDeliveredMark = 0;

/** Tell senders that this device has received their messages (server time). */
export const markChatsDelivered = async (force = false): Promise<void> => {
  const now = Date.now();
  if (!force && now - lastDeliveredMark < 4000) return;
  lastDeliveredMark = now;
  try {
    await supabase.rpc('bw_mark_chats_delivered');
  } catch {
    // Non-critical: ticks just stay at "sent".
  }
};

// ============================================
// CHATS CRUD
// ============================================

export const getChats = async (
  bandId?: string
): Promise<{ data: ChatWithDetails[] | null; error: Error | null }> => {
  try {
    const { data: { user } } = await getSafeUser();
    if (!user) throw new Error('Not authenticated');

    // Get chats where user is a participant
    const { data: participations, error: partError } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('user_id', user.id);

    if (partError) throw partError;
    if (!participations || participations.length === 0) {
      return { data: [], error: null };
    }

    const chatIds = participations.map(p => p.chat_id);

    // Get chats (separate query - avoid Supabase join which may 400 on FK cache miss)
    const { data: chats, error: chatsError } = await supabase
      .from('chats')
      .select('*')
      .in('id', chatIds);

    if (chatsError) {
      console.error('[getChats] Chats query failed:', {
        message: chatsError.message,
        details: (chatsError as any).details,
        hint: (chatsError as any).hint,
        code: (chatsError as any).code,
      });
      throw chatsError;
    }

    // Sort by updated_at descending in code
    (chats || []).sort((a, b) => {
      const da = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const db = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return db - da;
    });

    // Fetch participants for all chats in one batch
    const { data: allParticipants, error: participantsError } = await supabase
      .from('chat_participants')
      .select('*')
      .in('chat_id', chatIds);

    if (participantsError) {
      console.error('[getChats] Participants query failed:', {
        message: participantsError.message,
        details: (participantsError as any).details,
        hint: (participantsError as any).hint,
        code: (participantsError as any).code,
      });
      throw participantsError;
    }

    // Fetch participant profiles for all participants
    const allUserIds = Array.from(new Set((allParticipants || []).map((p: any) => p.user_id)));
    let profileMap = new Map<string, any>();
    if (allUserIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', allUserIds);
      if (profilesData) {
        profileMap = new Map(profilesData.map((pr: any) => [pr.id, pr]));
      }
    }

    // Group participants by chat_id with profiles attached
    const participantsByChat = new Map<string, any[]>();
    (allParticipants || []).forEach((p: any) => {
      const existing = participantsByChat.get(p.chat_id) || [];
      existing.push({
        ...p,
        profile: profileMap.get(p.user_id) || null,
      });
      participantsByChat.set(p.chat_id, existing);
    });

    // Enforce business rules:
    // Members should only be allowed to text admins or band/event they're in.
    const { data: myBandMemberships } = await supabase
      .from('band_members')
      .select('band_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true);

    const myBandIds = (myBandMemberships || []).map((b: any) => b.band_id);
    const myAdminBandIds = new Set((myBandMemberships || []).filter((b: any) => b.role === 'admin').map((b: any) => b.band_id));
    const allMyBandIds = new Set(myBandIds);

    const { data: myEventMemberships } = await supabase
      .from('event_members')
      .select('event_id, status')
      .eq('user_id', user.id);
    const myEventIds = new Set(
      (myEventMemberships || [])
        .filter((m: any) => m.status !== 'declined')
        .map((m: any) => m.event_id)
    );

    const directOtherUserIds = Array.from(new Set(
      (chats || [])
        .filter(c => c.type === 'direct')
        .flatMap(c => (participantsByChat.get(c.id) || []).map((p: any) => p.user_id).filter((id: string) => id !== user.id))
    ));

    let otherAdminUserIdsInSharedBands = new Set<string>();
    if (directOtherUserIds.length > 0 && myBandIds.length > 0) {
      const { data: otherAdmins } = await supabase
        .from('band_members')
        .select('user_id, band_id')
        .in('user_id', directOtherUserIds)
        .in('band_id', myBandIds)
        .eq('role', 'admin')
        .eq('is_active', true);
      otherAdminUserIdsInSharedBands = new Set((otherAdmins || []).map((o: any) => o.user_id));
    }

    const allowedChats = (chats || []).filter(chat => {
      if (chat.type === 'band' || chat.type === 'group') {
        return chat.band_id ? allMyBandIds.has(chat.band_id) : true;
      }
      if (chat.type === 'event') {
        const isBandAdmin = chat.band_id ? myAdminBandIds.has(chat.band_id) : false;
        const isInEvent = chat.event_id ? myEventIds.has(chat.event_id) : false;
        return isBandAdmin || isInEvent;
      }
      if (chat.type === 'direct') {
        const otherId = (participantsByChat.get(chat.id) || []).find((p: any) => p.user_id !== user.id)?.user_id;
        if (!otherId) return true;
        const isCurrentUserAdmin = chat.band_id ? myAdminBandIds.has(chat.band_id) : myAdminBandIds.size > 0;
        const isOtherUserAdmin = otherAdminUserIdsInSharedBands.has(otherId);
        return isCurrentUserAdmin || isOtherUserAdmin;
      }
      return true;
    });

    const targetChats = bandId ? allowedChats.filter(c => c.band_id === bandId) : allowedChats;

    // Fetch band info for all chats with band_id in one batch
    const allBandIds = Array.from(new Set(targetChats.map(c => c.band_id).filter(Boolean))) as string[];
    let bandMap = new Map<string, { id: string; name: string; logo_url?: string }>();
    if (allBandIds.length > 0) {
      const { data: bandsData } = await supabase
        .from('bands')
        .select('id, name, logo_url')
        .in('id', allBandIds);
      if (bandsData) {
        bandMap = new Map(bandsData.map((b: any) => [b.id, b]));
      }
    }

    // Get last message for each chat and unread count
    const chatsWithDetails = await Promise.all(
      targetChats.map(async (chat) => {
        const chatParticipants = participantsByChat.get(chat.id) || [];

        // Get last message
        const { data: messages } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_id', chat.id)
          .order('created_at', { ascending: false })
          .limit(1);

        const lastMessage = messages?.[0];

        // Check if current user cleared / deleted this chat
        const userParticipant = chatParticipants.find(
          (p: ChatParticipant) => p.user_id === user.id
        );

        if (userParticipant?.cleared_at) {
          const clearedTime = new Date(userParticipant.cleared_at).getTime();
          const lastMsgTime = lastMessage ? new Date(lastMessage.created_at).getTime() : 0;
          // If no messages or last message was sent before/at the time user deleted the chat, hide it
          if (lastMsgTime <= clearedTime) {
            return null;
          }
        }

        // Get unread count (respecting both last_read_at and cleared_at)
        const lastReadAt = userParticipant?.last_read_at;
        const clearedAt = userParticipant?.cleared_at;

        let unreadQuery = supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('chat_id', chat.id)
          .neq('sender_id', user.id);

        if (lastReadAt && clearedAt) {
          const cutOff = new Date(lastReadAt) > new Date(clearedAt) ? lastReadAt : clearedAt;
          unreadQuery = unreadQuery.gt('created_at', cutOff);
        } else if (lastReadAt) {
          unreadQuery = unreadQuery.gt('created_at', lastReadAt);
        } else if (clearedAt) {
          unreadQuery = unreadQuery.gt('created_at', clearedAt);
        }

        const { count } = await unreadQuery;
        const unreadCount = count || 0;

        const bandInfo = chat.band_id ? bandMap.get(chat.band_id) : null;
        const resolvedName = (chat.type === 'band' && bandInfo?.name) ? bandInfo.name : chat.name;

        return {
          ...chat,
          name: resolvedName,
          logo_url: bandInfo?.logo_url || (chat as any).logo_url,
          band: bandInfo || undefined,
          participants: chatParticipants,
          last_message: lastMessage || undefined,
          unread_count: unreadCount,
        } as ChatWithDetails;
      })
    );

    const validChats = chatsWithDetails.filter(Boolean) as ChatWithDetails[];
    // This device now has these messages: let the senders see ✓✓.
    void markChatsDelivered();
    return { data: validChats, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const getChat = async (
  chatId: string
): Promise<{ data: ChatWithDetails | null; error: Error | null }> => {
  try {
    const { data: { user } } = await getSafeUser();
    if (!user) throw new Error('Not authenticated');

    // Get chat (separate query - avoid Supabase join which may 400 on FK cache miss)
    const { data: chat, error } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chatId)
      .single();

    if (error) throw error;

    let bandInfo: { id: string; name: string; logo_url?: string } | null = null;
    if (chat.band_id) {
      const { data: b } = await supabase
        .from('bands')
        .select('id, name, logo_url')
        .eq('id', chat.band_id)
        .maybeSingle();
      if (b) bandInfo = b;
    }

    const resolvedName = (chat.type === 'band' && bandInfo?.name) ? bandInfo.name : chat.name;

    // Fetch participants separately
    const { data: chatParticipants, error: partError } = await supabase
      .from('chat_participants')
      .select('*')
      .eq('chat_id', chatId);

    if (partError) throw partError;

    // Fetch participant profiles
    const partIds = (chatParticipants || []).map((p: any) => p.user_id);
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', partIds);
    const profileMap = new Map((profilesData || []).map((p: any) => [p.id, { id: p.id, full_name: p.full_name, avatar_url: p.avatar_url }]));

    return {
      data: {
        ...chat,
        name: resolvedName,
        logo_url: bandInfo?.logo_url || (chat as any).logo_url,
        band: bandInfo || undefined,
        participants: (chatParticipants || []).map((p: any) => ({
          ...p,
          profile: profileMap.get(p.user_id) || null,
        })),
        unread_count: 0,
      },
      error: null,
    };
  } catch (error: any) {
    return { data: null, error };
  }
};

// Find existing direct chat between two users (handles case where one user cleared/left)
const findExistingDirectChat = async (userId1: string, userId2: string): Promise<Chat | null> => {
  try {
    // Find all direct chats where either user is currently a participant
    const { data: participations } = await supabase
      .from('chat_participants')
      .select('chat_id, user_id')
      .in('user_id', [userId1, userId2]);

    const chatIds = Array.from(new Set((participations || []).map(p => p.chat_id)));
    if (chatIds.length === 0) {
      // Fallback: check if there is an existing direct chat created by either
      const { data: createdChats } = await supabase
        .from('chats')
        .select('*')
        .in('created_by', [userId1, userId2])
        .eq('type', 'direct')
        .limit(10);
      
      for (const c of (createdChats || [])) {
        const { data: parts } = await supabase
          .from('chat_participants')
          .select('user_id')
          .eq('chat_id', c.id);
        const pIds = (parts || []).map(p => p.user_id);
        if (pIds.includes(userId1) || pIds.includes(userId2)) {
          return c;
        }
      }
      return null;
    }

    // Get direct chats from this list
    const { data: directChats } = await supabase
      .from('chats')
      .select('*')
      .in('id', chatIds)
      .eq('type', 'direct');

    if (!directChats || directChats.length === 0) return null;

    // Fetch all participants for these candidate direct chats
    const candidateIds = directChats.map(c => c.id);
    const { data: allParts } = await supabase
      .from('chat_participants')
      .select('chat_id, user_id')
      .in('chat_id', candidateIds);

    const partsByChat = new Map<string, string[]>();
    (allParts || []).forEach(p => {
      const list = partsByChat.get(p.chat_id) || [];
      list.push(p.user_id);
      partsByChat.set(p.chat_id, list);
    });

    for (const chat of directChats) {
      const pIds = partsByChat.get(chat.id) || [];
      // 1. Both are already participants
      if (pIds.includes(userId1) && pIds.includes(userId2)) {
        return chat;
      }
      // 2. Only one is recorded as participant (other user had deleted their participation)
      if (pIds.length === 1 && (pIds[0] === userId1 || pIds[0] === userId2)) {
        // Check message senders or creator to confirm it was between these two users
        const { data: msgSenders } = await supabase
          .from('messages')
          .select('sender_id')
          .eq('chat_id', chat.id)
          .limit(10);
        const senders = new Set((msgSenders || []).map(m => m.sender_id));
        if (senders.has(userId1) || senders.has(userId2) || chat.created_by === userId1 || chat.created_by === userId2) {
          return chat;
        }
      }
    }

    return null;
  } catch (error) {
    console.error('[findExistingDirectChat] Error:', error);
    return null;
  }
};

export const createChat = async (
  data: {
    type: ChatType;
    name?: string;
    band_id?: string;
    event_id?: string;
    participant_ids: string[];
  }
): Promise<{ data: Chat | null; error: Error | null }> => {
  try {
    const { data: { user } } = await getSafeUser();
    if (!user) throw new Error('Not authenticated');

    const allParticipants = [...new Set([user.id, ...data.participant_ids])];

    // Enforce business rules:
    // Members should only be allowed to text admins or band/event they're in.
    if (data.type === 'direct') {
      const targetUserId = data.participant_ids.find(id => id !== user.id);
      if (!targetUserId) throw new Error('Recipient is required');

      const { data: sharedMemberships, error: memErr } = await supabase
        .from('band_members')
        .select('band_id, role, user_id')
        .in('user_id', [user.id, targetUserId])
        .eq('is_active', true);

      if (memErr) throw memErr;

      const userBands = new Map<string, string>();
      const targetBands = new Map<string, string>();
      (sharedMemberships || []).forEach((m: any) => {
        if (m.user_id === user.id) userBands.set(m.band_id, m.role);
        if (m.user_id === targetUserId) targetBands.set(m.band_id, m.role);
      });

      let allowed = false;
      for (const [bandId, userRole] of userBands.entries()) {
        const targetRole = targetBands.get(bandId);
        if (targetRole && (userRole === 'admin' || targetRole === 'admin')) {
          allowed = true;
          break;
        }
      }

      if (!allowed) {
        return { data: null, error: new Error('Members are only allowed to direct message band admins.') };
      }
    } else if (data.type === 'band' && data.band_id) {
      const { data: bm } = await supabase
        .from('band_members')
        .select('id')
        .eq('band_id', data.band_id)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!bm) {
        return { data: null, error: new Error('You can only message bands you are a member of.') };
      }
    } else if (data.type === 'event' && data.event_id) {
      let allowed = false;
      if (data.band_id) {
        const { data: bm } = await supabase
          .from('band_members')
          .select('role')
          .eq('band_id', data.band_id)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();
        if (bm?.role === 'admin') allowed = true;
      }
      if (!allowed) {
        const { data: em } = await supabase
          .from('event_members')
          .select('id, status')
          .eq('event_id', data.event_id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (em && em.status !== 'declined') allowed = true;
      }
      if (!allowed) {
        return { data: null, error: new Error('You can only message in events you are participating in.') };
      }
    }

    // For direct chats, check if one already exists between these exact participants
    if (data.type === 'direct' && allParticipants.length === 2) {
      const existingChat = await findExistingDirectChat(allParticipants[0], allParticipants[1]);
      if (existingChat) {
        console.log('[createChat] Found existing direct chat:', existingChat.id);
        const targetUserId = data.participant_ids.find(id => id !== user.id) || allParticipants[1];
        // Ensure both participants exist in chat_participants and un-clear for current user
        await supabase
          .from('chat_participants')
          .upsert([
            { chat_id: existingChat.id, user_id: user.id, cleared_at: null },
            { chat_id: existingChat.id, user_id: targetUserId },
          ], { onConflict: 'chat_id,user_id' });

        return { data: existingChat, error: null };
      }
    }

    // For band chats, check if one already exists for this band
    if (data.type === 'band' && data.band_id) {
      const { data: existingBandChat } = await supabase
        .from('chats')
        .select('*')
        .eq('type', 'band')
        .eq('band_id', data.band_id)
        .maybeSingle();
      
      if (existingBandChat) {
        console.log('[createChat] Found existing band chat:', existingBandChat.id);
        // Ensure user is restored in chat_participants and cleared_at is reset
        await supabase
          .from('chat_participants')
          .upsert(
            { chat_id: existingBandChat.id, user_id: user.id, cleared_at: null },
            { onConflict: 'chat_id,user_id' }
          );
        return { data: existingBandChat, error: null };
      }
    }

    // For event chats, check if one already exists for this event
    if (data.type === 'event' && data.event_id) {
      const { data: existingEventChat } = await supabase
        .from('chats')
        .select('*')
        .eq('type', 'event')
        .eq('event_id', data.event_id)
        .maybeSingle();
      
      if (existingEventChat) {
        console.log('[createChat] Found existing event chat:', existingEventChat.id);
        // Ensure user is restored in chat_participants and cleared_at is reset
        await supabase
          .from('chat_participants')
          .upsert(
            { chat_id: existingEventChat.id, user_id: user.id, cleared_at: null },
            { onConflict: 'chat_id,user_id' }
          );
        return { data: existingEventChat, error: null };
      }
    }

    // Create new chat
    console.log('[createChat] Creating new chat of type:', data.type);
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .insert({
        type: data.type,
        name: data.name,
        band_id: data.band_id,
        event_id: data.event_id,
        created_by: user.id,
      })
      .select()
      .single();

    if (chatError) throw chatError;

    // Add participants (including creator) - non-critical, don't block
    const participantInserts = allParticipants.map(userId => ({
      chat_id: chat.id,
      user_id: userId,
      cleared_at: null,
    }));

    const { error: partError } = await supabase
      .from('chat_participants')
      .insert(participantInserts);

    if (partError) {
      console.warn('[createChat] Participant insert warning:', partError.message);
    }

    return { data: chat, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

// ============================================
// MESSAGES CRUD
// ============================================

export const getMessages = async (
  chatId: string,
  options?: { limit?: number; before?: string }
): Promise<{ data: Message[] | null; error: Error | null }> => {
  try {
    console.log('[getMessages] Fetching messages for chat:', chatId);
    const { data: { user } } = await getSafeUser();

    // Check if current user previously cleared / deleted this chat
    let clearedAt: string | null = null;
    if (user) {
      const { data: myPart } = await supabase
        .from('chat_participants')
        .select('cleared_at')
        .eq('chat_id', chatId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (myPart?.cleared_at) clearedAt = myPart.cleared_at;
    }
    
    // Note: removed .eq('deleted', false) - column doesn't exist in DB
    // Include reply_to message for quoting feature
    let query = supabase
      .from('messages')
      .select(`*`)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false });

    if (clearedAt) {
      query = query.gt('created_at', clearedAt);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.before) {
      query = query.lt('created_at', options.before);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[getMessages] Query error:', error);
      throw error;
    }

    console.log('[getMessages] Found', data?.length || 0, 'messages');

    // Attach sender profiles in one batch: the chat UI shows `sender.full_name`
    // above each message in group chats, and falls back to "Member" without it.
    const rows = data || [];
    const senderIds = [...new Set(rows.map((m: any) => m.sender_id).filter(Boolean))];
    if (senderIds.length > 0) {
      const { data: senders } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', senderIds);
      const byId = new Map((senders || []).map((p: any) => [p.id, p]));
      for (const m of rows as any[]) {
        if (!m.sender && byId.has(m.sender_id)) m.sender = byId.get(m.sender_id);
      }
    }

    // Return in ascending order for display
    return { data: rows.reverse(), error: null };
  } catch (error: any) {
    console.error('[getMessages] Exception:', error);
    return { data: null, error };
  }
};

export const sendMessage = async (
  chatId: string,
  content: string,
  messageType: string = 'text',
  replyToId?: string // Optional: ID of message being replied to
): Promise<{ data: Message | null; error: Error | null }> => {
  try {
    const { data: { user } } = await getSafeUser();
    if (!user) throw new Error('Not authenticated');

    // Get chat to find band_id, type, event_id, name, created_by
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('band_id, type, event_id, name, created_by')
      .eq('id', chatId)
      .single();

    if (chatError) throw chatError;
    
    // Ensure the sender is an active participant and clear any deletion timestamp
    await supabase
      .from('chat_participants')
      .upsert(
        { chat_id: chatId, user_id: user.id, cleared_at: null },
        { onConflict: 'chat_id,user_id' }
      );

    // Get ALL participants for this chat
    const { data: participants, error: partError } = await supabase
      .from('chat_participants')
      .select('user_id')
      .eq('chat_id', chatId);
    
    if (partError) {
      console.warn('[sendMessage] Could not get participants:', partError);
    }

    // Ensure missing participants are restored based on chat type
    if (chat.type === 'band' && chat.band_id) {
      const { data: bMembers } = await supabase
        .from('band_members')
        .select('user_id')
        .eq('band_id', chat.band_id)
        .eq('is_active', true);
      if (bMembers && bMembers.length > 0) {
        await supabase
          .from('chat_participants')
          .upsert(
            bMembers.map(bm => ({ chat_id: chatId, user_id: bm.user_id })),
            { onConflict: 'chat_id,user_id', ignoreDuplicates: true }
          );
      }
    } else if (chat.type === 'event' && chat.event_id) {
      const { data: eMembers } = await supabase
        .from('event_members')
        .select('user_id')
        .eq('event_id', chat.event_id)
        .neq('status', 'declined');
      if (eMembers && eMembers.length > 0) {
        await supabase
          .from('chat_participants')
          .upsert(
            eMembers.map(em => ({ chat_id: chatId, user_id: em.user_id })),
            { onConflict: 'chat_id,user_id', ignoreDuplicates: true }
          );
      }
    } else if (chat.type === 'direct') {
      const otherParticipant = (participants || []).find((p: any) => p.user_id !== user.id);
      if (!otherParticipant) {
        // If other participant was removed in an old hard delete, restore them from message history or creator
        const { data: priorMsgs } = await supabase
          .from('messages')
          .select('sender_id')
          .eq('chat_id', chatId)
          .neq('sender_id', user.id)
          .limit(1);
        const otherUserId = priorMsgs?.[0]?.sender_id || (chat.created_by !== user.id ? chat.created_by : null);
        if (otherUserId) {
          await supabase
            .from('chat_participants')
            .upsert({ chat_id: chatId, user_id: otherUserId }, { onConflict: 'chat_id,user_id' });
        }
      }
    }

    // Permission enforcement:
    // Members should only be allowed to text admins or band/event they're in.
    if (chat.type === 'direct') {
      const otherParticipant = (participants || []).find((p: any) => p.user_id !== user.id);
      if (otherParticipant) {
        const { data: sharedMemberships } = await supabase
          .from('band_members')
          .select('band_id, role, user_id')
          .in('user_id', [user.id, otherParticipant.user_id])
          .eq('is_active', true);

        const userBands = new Map<string, string>();
        const otherBands = new Map<string, string>();
        (sharedMemberships || []).forEach((m: any) => {
          if (m.user_id === user.id) userBands.set(m.band_id, m.role);
          if (m.user_id === otherParticipant.user_id) otherBands.set(m.band_id, m.role);
        });

        let allowed = false;
        for (const [bandId, userRole] of userBands.entries()) {
          const otherRole = otherBands.get(bandId);
          if (otherRole && (userRole === 'admin' || otherRole === 'admin')) {
            allowed = true;
            break;
          }
        }

        if (!allowed) {
          return { data: null, error: new Error('Direct messaging is only permitted with band admins.') };
        }
      }
    } else if (chat.type === 'band' && chat.band_id) {
      const { data: bm } = await supabase
        .from('band_members')
        .select('id')
        .eq('band_id', chat.band_id)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!bm) {
        return { data: null, error: new Error('You can only message in bands you are a member of.') };
      }
    } else if (chat.type === 'event' && chat.event_id) {
      let allowed = false;
      if (chat.band_id) {
        const { data: bm } = await supabase
          .from('band_members')
          .select('role')
          .eq('band_id', chat.band_id)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();
        if (bm?.role === 'admin') allowed = true;
      }
      if (!allowed) {
        const { data: em } = await supabase
          .from('event_members')
          .select('id, status')
          .eq('event_id', chat.event_id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (em && em.status !== 'declined') allowed = true;
      }
      if (!allowed) {
        return { data: null, error: new Error('You can only message in events you are participating in.') };
      }
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        sender_id: user.id,
        content,
        band_id: chat.band_id,
        reply_to_id: replyToId || null,
      })
      .select('*')
      .single();

    if (error) throw error;

    // Update chat's updated_at
    await supabase
      .from('chats')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatId);

    // Send push notifications AND create in-app notifications for other participants
    try {
      // Re-fetch all participants to ensure restored members are notified
      const { data: updatedParts } = await supabase
        .from('chat_participants')
        .select('user_id')
        .eq('chat_id', chatId);

      const otherParticipants = (updatedParts || participants || [])
        .map((p: any) => p.user_id)
        .filter((id: string) => id !== user.id);

      if (otherParticipants.length > 0) {
        // Get sender's name
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        const senderName = personName({ full_name: profile?.full_name, email: user.email }, 'Someone');

        // Resolve latest band name for notification
        let bandName = chat.name || undefined;
        if (chat.band_id) {
          const { data: b } = await supabase
            .from('bands')
            .select('name')
            .eq('id', chat.band_id)
            .maybeSingle();
          if (b?.name) bandName = b.name;
        }

        const isDirect = chat.type === 'direct';
        const subtitle = isDirect ? 'Private Message' : (bandName || 'Band Chat');
        const tag = isDirect ? 'Direct Message' : 'Band Message';

        // Send push notification (Edge Function also creates in-app notifications)
        // Uses service role so RLS is bypassed
        try {
          const pushResult = await sendPushToUsers(otherParticipants, 'chat_message', {
            senderName,
            content: content.substring(0, 120),
            chatId,
            chat_id: chatId,
            band_id: chat.band_id,
            chatType: chat.type,
            bandName,
            subtitle,
            tag,
            channel_id: 'bandwith_messages',
          });
          console.log('[sendMessage] Push result:', JSON.stringify(pushResult));
        } catch (pushErr) {
          console.warn('[sendMessage] Push notification error (non-critical):', pushErr);
        }
      }
    } catch (notifErr) {
      console.warn('[sendMessage] Notification error (non-critical):', notifErr);
    }

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const markChatAsRead = async (
  chatId: string
): Promise<{ error: Error | null }> => {
  try {
    // Server time, and only when there is something unread (no realtime churn).
    const { error } = await supabase.rpc('bw_mark_chat_read', { p_chat_id: chatId });
    if (error) {
      // Older database without migration 049: fall back to a direct update.
      const { data: { user } } = await getSafeUser();
      if (!user) throw new Error('Not authenticated');
      await supabase
        .from('chat_participants')
        .update({ last_read_at: new Date().toISOString() } as any)
        .eq('chat_id', chatId)
        .eq('user_id', user.id);
    }
    return { error: null };
  } catch (error: any) {
    // Read receipts are non-critical.
    console.warn('[markChatAsRead] Non-critical exception:', error);
    return { error: null };
  }
};

// Get chat participants with their last_read_at for message read status
export const getChatParticipants = async (
  chatId: string
): Promise<{ data: ChatParticipant[] | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('chat_participants')
      .select('*')
      .eq('chat_id', chatId);

    if (error) throw error;

    const userIds = Array.from(new Set((data || []).map((p: any) => p.user_id)));
    let profileMap = new Map<string, any>();
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', userIds);
      if (profilesData) {
        profileMap = new Map(profilesData.map((pr: any) => [pr.id, pr]));
      }
    }

    const mapped = (data || []).map((p: any) => ({
      ...p,
      profile: profileMap.get(p.user_id) || null,
    })) as ChatParticipant[];

    return { data: mapped, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const deleteMessage = async (
  messageId: string
): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase
      .from('messages')
      .update({
        deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', messageId);

    if (error) throw error;

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

export const deleteChat = async (
  chatId: string
): Promise<{ error: Error | null }> => {
  try {
    const { data: { user } } = await getSafeUser();
    if (!user) throw new Error('Not authenticated');

    // Soft delete / clear for current user:
    // Mark cleared_at timestamp so chat is hidden from chat hub until a new message arrives.
    // The chat and message history are preserved, and the chat will reappear if texting again.
    const { error: partError } = await supabase
      .from('chat_participants')
      .upsert(
        {
          chat_id: chatId,
          user_id: user.id,
          cleared_at: new Date().toISOString(),
        },
        { onConflict: 'chat_id,user_id' }
      );
    if (partError) throw partError;

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

// ============================================
// REALTIME SUBSCRIPTION
// ============================================

export const subscribeToChat = (
  chatId: string,
  onMessage: (message: Message) => void
) => {
  console.log('[subscribeToChat] Subscribing to chat:', chatId);
  
  const channel = supabase
    .channel(`chat-${chatId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`,
      },
      async (payload) => {
        console.log('[subscribeToChat] Received realtime message:', payload.new.id);
        // Get full message with sender info
        const { data } = await supabase
          .from('messages')
          .select('*')
          .eq('id', payload.new.id)
          .single();

        if (data) {
          console.log('[subscribeToChat] Delivering message to UI');
          onMessage(data as Message);
        }
      }
    )
    .subscribe((status) => {
      console.log('[subscribeToChat] Subscription status:', status);
    });

  return () => {
    supabase.removeChannel(channel);
  };
};

export const subscribeToNewMessages = (
  onMessage: (message: Message & { chat_id: string }) => void
) => {
  // Realtime postgres_changes respects RLS, so only messages from chats the
  // user participates in are delivered (requires RLS enabled on messages —
  // see migration 042). Unique channel name avoids collisions on remount.
  const channel = supabase
    .channel(`new-messages-${Math.random().toString(36).slice(2, 10)}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      },
      async (payload) => {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .eq('id', payload.new.id)
          .maybeSingle();

        if (data) {
          // Received while the app is open → delivered right away.
          void markChatsDelivered(true);
          onMessage(data as Message & { chat_id: string });
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

/**
 * Fires when someone in one of my chats receives or reads messages
 * (chat_participants updates, filtered by RLS to my chats).
 */
export const subscribeToReceipts = (onChange: (chatId: string) => void) => {
  const channel = supabase
    .channel(`receipts-${Math.random().toString(36).slice(2, 10)}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'chat_participants' },
      (payload) => {
        const chatId = (payload.new as { chat_id?: string })?.chat_id;
        if (chatId) onChange(chatId);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// ============================================
// SEARCH
// ============================================

export interface SearchResult {
  type: 'chat' | 'message' | 'participant';
  chat_id: string;
  chat_name?: string;
  chat_type?: ChatType;
  message_id?: string;
  message_content?: string;
  message_sender?: string;
  message_date?: string;
  participant_name?: string;
  match_text: string;
}

export const searchChatsAndMessages = async (
  query: string,
  limit: number = 20
): Promise<{ data: SearchResult[] | null; error: Error | null }> => {
  try {
    if (!query || query.length < 2) {
      return { data: [], error: null };
    }

    const { data: { user } } = await getSafeUser();
    if (!user) throw new Error('Not authenticated');

    const results: SearchResult[] = [];
    const searchPattern = `%${query.toLowerCase()}%`;

    // 1. Search in chat names
    // Only search within chats the user has permission to access
    const { data: allowedChats, error: allowedChatsErr } = await getChats();
    if (allowedChatsErr) throw allowedChatsErr;

    if (!allowedChats || allowedChats.length === 0) {
      return { data: [], error: null };
    }

    const userChatIds = allowedChats.map(c => c.id);
    const chatMap = new Map(allowedChats.map(c => [c.id, c]));

    const { data: chatNameResults } = await supabase
      .from('chats')
      .select('id, name, type')
      .in('id', userChatIds)
      .ilike('name', searchPattern)
      .limit(limit);

    if (chatNameResults) {
      chatNameResults.forEach(chat => {
        results.push({
          type: 'chat',
          chat_id: chat.id,
          chat_name: chat.name || 'Chat',
          chat_type: chat.type as ChatType,
          match_text: chat.name || 'Chat',
        });
      });
    }

    // 2. Search in messages content
    const { data: messageResults } = await supabase
      .from('messages')
      .select(`
        id,
        chat_id,
        content,
        created_at
      `)
      .in('chat_id', userChatIds)
      .ilike('content', searchPattern)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (messageResults) {
      for (const msg of messageResults) {
        const chatInfo = chatMap.get(msg.chat_id);

        results.push({
          type: 'message',
          chat_id: msg.chat_id,
          chat_name: chatInfo?.name || 'Chat',
          chat_type: chatInfo?.type as ChatType,
          message_id: msg.id,
          message_content: msg.content,
          message_sender: 'Unknown',
          message_date: msg.created_at,
          match_text: msg.content,
        });
      }
    }

    // Sort: chats first, then participants, then messages
    results.sort((a, b) => {
      const order = { chat: 0, participant: 1, message: 2 };
      return order[a.type] - order[b.type];
    });

    return { data: results.slice(0, limit), error: null };
  } catch (error: any) {
    console.error('[searchChatsAndMessages] Error:', error);
    return { data: null, error };
  }
};
