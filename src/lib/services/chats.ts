import { supabase } from '../supabase';
import { sendPushToUsers } from './notifications';

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
  muted: boolean;
  joined_at: string;
  profile?: {
    id: string;
    full_name?: string;
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
    avatar_url?: string;
  };
}

// ============================================
// CHATS CRUD
// ============================================

export const getChats = async (
  bandId?: string
): Promise<{ data: ChatWithDetails[] | null; error: Error | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
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

    // Get chats with details
    // Show ALL chats the user participates in (direct + band + event)
    // If bandId is provided, we still show all chats but could filter in UI
    const { data: chats, error: chatsError } = await supabase
      .from('chats')
      .select(`
        *,
        chat_participants (
          id,
          user_id,
          last_read_at,
          muted,
          joined_at,
          profile:profiles (id, full_name, avatar_url)
        )
      `)
      .in('id', chatIds)
      .order('updated_at', { ascending: false });

    if (chatsError) throw chatsError;

    // Get last message for each chat and unread count
    const chatsWithDetails = await Promise.all(
      (chats || []).map(async (chat) => {
        // Get last message
        const { data: messages } = await supabase
          .from('messages')
          .select('*, sender:profiles(id, full_name, avatar_url)')
          .eq('chat_id', chat.id)
          .order('created_at', { ascending: false })
          .limit(1);

        // Get unread count
        const userParticipant = chat.chat_participants?.find(
          (p: ChatParticipant) => p.user_id === user.id
        );
        const lastReadAt = userParticipant?.last_read_at;

        let unreadCount = 0;
        if (lastReadAt) {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('chat_id', chat.id)
            .neq('sender_id', user.id)
            .gt('created_at', lastReadAt);
          unreadCount = count || 0;
        } else {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('chat_id', chat.id)
            .neq('sender_id', user.id);
          unreadCount = count || 0;
        }

        return {
          ...chat,
          participants: chat.chat_participants || [],
          last_message: messages?.[0] || undefined,
          unread_count: unreadCount,
        } as ChatWithDetails;
      })
    );

    return { data: chatsWithDetails, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const getChat = async (
  chatId: string
): Promise<{ data: ChatWithDetails | null; error: Error | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: chat, error } = await supabase
      .from('chats')
      .select(`
        *,
        chat_participants (
          id,
          user_id,
          last_read_at,
          muted,
          joined_at,
          profile:profiles (id, full_name, avatar_url)
        )
      `)
      .eq('id', chatId)
      .single();

    if (error) throw error;

    return {
      data: {
        ...chat,
        participants: chat.chat_participants || [],
        unread_count: 0,
      },
      error: null,
    };
  } catch (error: any) {
    return { data: null, error };
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const allParticipants = [...new Set([user.id, ...data.participant_ids])];

    // For direct chats, check if one already exists between these exact participants
    if (data.type === 'direct' && allParticipants.length === 2) {
      const existingChat = await findExistingDirectChat(allParticipants[0], allParticipants[1]);
      if (existingChat) {
        console.log('[createChat] Found existing direct chat:', existingChat.id);
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
        .single();
      
      if (existingBandChat) {
        console.log('[createChat] Found existing band chat:', existingBandChat.id);
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
        .single();
      
      if (existingEventChat) {
        console.log('[createChat] Found existing event chat:', existingEventChat.id);
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

    // Add participants (including creator)
    const participantInserts = allParticipants.map(userId => ({
      chat_id: chat.id,
      user_id: userId,
    }));

    const { error: partError } = await supabase
      .from('chat_participants')
      .insert(participantInserts);

    if (partError) throw partError;

    return { data: chat, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

// Find existing direct chat between two users
const findExistingDirectChat = async (userId1: string, userId2: string): Promise<Chat | null> => {
  try {
    // Get all direct chats where user1 is a participant
    const { data: user1Chats } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('user_id', userId1);

    if (!user1Chats || user1Chats.length === 0) return null;

    const chatIds = user1Chats.map(c => c.chat_id);

    // Find which of these chats also has user2 and is of type 'direct'
    const { data: directChats } = await supabase
      .from('chats')
      .select('*')
      .in('id', chatIds)
      .eq('type', 'direct');

    if (!directChats || directChats.length === 0) return null;

    // Check which of these has exactly user2 as the other participant
    for (const chat of directChats) {
      const { data: participants } = await supabase
        .from('chat_participants')
        .select('user_id')
        .eq('chat_id', chat.id);

      if (participants && participants.length === 2) {
        const participantIds = participants.map(p => p.user_id);
        if (participantIds.includes(userId1) && participantIds.includes(userId2)) {
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

// ============================================
// MESSAGES CRUD
// ============================================

export const getMessages = async (
  chatId: string,
  options?: { limit?: number; before?: string }
): Promise<{ data: Message[] | null; error: Error | null }> => {
  try {
    console.log('[getMessages] Fetching messages for chat:', chatId);
    
    // Note: removed .eq('deleted', false) - column doesn't exist in DB
    // Include reply_to message for quoting feature
    let query = supabase
      .from('messages')
      .select(`
        *,
        sender:profiles(id, full_name, avatar_url),
        reply_to:messages!reply_to_id(
          id,
          content,
          sender_id,
          sender:profiles(id, full_name)
        )
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false });

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
    
    // Return in ascending order for display
    return { data: (data || []).reverse(), error: null };
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get chat to find band_id
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('band_id')
      .eq('id', chatId)
      .single();

    if (chatError) throw chatError;
    
    // Get ALL participants for this chat (separate query to work around RLS)
    const { data: participants, error: partError } = await supabase
      .from('chat_participants')
      .select('user_id')
      .eq('chat_id', chatId);
    
    if (partError) {
      console.warn('[sendMessage] Could not get participants:', partError);
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
      .select('*, sender:profiles(id, full_name, avatar_url)')
      .single();

    if (error) throw error;

    // Update chat's updated_at
    await supabase
      .from('chats')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatId);

    // Send push notifications AND create in-app notifications for other participants
    try {
      console.log('[sendMessage] Participants from DB:', JSON.stringify(participants));
      const otherParticipants = (participants || [])
        .map((p: any) => p.user_id)
        .filter((id: string) => id !== user.id);

      console.log('[sendMessage] Other participants to notify:', otherParticipants);

      if (otherParticipants.length > 0) {
        // Get sender's name
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        const senderName = profile?.full_name || user.email?.split('@')[0] || 'Someone';
        console.log('[sendMessage] Sending push to', otherParticipants.length, 'users from', senderName);

        // Send push notification (Edge Function also creates in-app notifications)
        // IMPORTANT: Use chat_id (snake_case) for consistency with notifications table
        const pushResult = await sendPushToUsers(otherParticipants, 'chat_message', {
          senderName,
          content: content.substring(0, 100),
          chatId,
          chat_id: chatId, // For in-app notifications lookup
          band_id: chat.band_id,
        });
        console.log('[sendMessage] Push result:', JSON.stringify(pushResult));
      } else {
        console.log('[sendMessage] No other participants to notify');
      }
    } catch (pushErr) {
      console.warn('[sendMessage] Push/notification error (non-critical):', pushErr);
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('chat_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('chat_id', chatId)
      .eq('user_id', user.id);

    if (error) throw error;

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

// Get chat participants with their last_read_at for message read status
export const getChatParticipants = async (
  chatId: string
): Promise<{ data: ChatParticipant[] | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('chat_participants')
      .select(`
        id,
        chat_id,
        user_id,
        last_read_at,
        muted,
        joined_at,
        profile:profiles(id, full_name, avatar_url)
      `)
      .eq('chat_id', chatId);

    if (error) throw error;

    return { data: data as ChatParticipant[], error: null };
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
          .select('*, sender:profiles(id, full_name, avatar_url)')
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
    console.log('[subscribeToChat] Unsubscribing from chat:', chatId);
    channel.unsubscribe();
  };
};

export const subscribeToNewMessages = (
  onMessage: (message: Message & { chat_id: string }) => void
) => {
  const channel = supabase
    .channel('new-messages')
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
          .select('*, sender:profiles(id, full_name, avatar_url)')
          .eq('id', payload.new.id)
          .single();

        if (data) {
          onMessage(data as Message & { chat_id: string });
        }
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const results: SearchResult[] = [];
    const searchPattern = `%${query.toLowerCase()}%`;

    // 1. Search in chat names
    const { data: chatNameResults } = await supabase
      .from('chats')
      .select(`
        id,
        name,
        type,
        chat_participants!inner(user_id)
      `)
      .ilike('name', searchPattern)
      .eq('chat_participants.user_id', user.id)
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
    // First get user's chats
    const { data: userChats } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('user_id', user.id);

    if (userChats && userChats.length > 0) {
      const chatIds = userChats.map(c => c.chat_id);

      const { data: messageResults } = await supabase
        .from('messages')
        .select(`
          id,
          chat_id,
          content,
          created_at,
          sender:profiles(full_name)
        `)
        .in('chat_id', chatIds)
        .ilike('content', searchPattern)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (messageResults) {
        for (const msg of messageResults) {
          // Get chat info
          const { data: chatInfo } = await supabase
            .from('chats')
            .select('name, type')
            .eq('id', msg.chat_id)
            .single();

          results.push({
            type: 'message',
            chat_id: msg.chat_id,
            chat_name: chatInfo?.name || 'Chat',
            chat_type: chatInfo?.type as ChatType,
            message_id: msg.id,
            message_content: msg.content,
            message_sender: (msg.sender as any)?.full_name || 'Unknown',
            message_date: msg.created_at,
            match_text: msg.content,
          });
        }
      }

      // 3. Search in participant names
      const { data: participantResults } = await supabase
        .from('chat_participants')
        .select(`
          chat_id,
          profile:profiles(full_name)
        `)
        .in('chat_id', chatIds)
        .not('user_id', 'eq', user.id);

      if (participantResults) {
        const matchingParticipants = participantResults.filter(p => 
          (p.profile as any)?.full_name?.toLowerCase().includes(query.toLowerCase())
        );

        for (const p of matchingParticipants.slice(0, limit)) {
          const { data: chatInfo } = await supabase
            .from('chats')
            .select('name, type')
            .eq('id', p.chat_id)
            .single();

          // Avoid duplicates
          if (!results.some(r => r.chat_id === p.chat_id && r.type === 'participant')) {
            results.push({
              type: 'participant',
              chat_id: p.chat_id,
              chat_name: chatInfo?.name || 'Chat',
              chat_type: chatInfo?.type as ChatType,
              participant_name: (p.profile as any)?.full_name,
              match_text: (p.profile as any)?.full_name || 'Unknown',
            });
          }
        }
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
