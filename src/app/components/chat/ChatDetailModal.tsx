import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Send, 
  Trash2,
  Users,
  User,
  Calendar,
  Music,
  Mic,
  FileText,
  Loader2,
  X,
  Reply,
  ArrowUpRight,
  Lock,
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { eventKindOf, type EventKind, HeaderAction, IconButton, NavBackButton, Tag, PillButton } from '@/app/components/bw';
import { supabase } from '@/lib/supabase';
import { getMessages, sendMessage, markChatAsRead, subscribeToChat, subscribeToReceipts, getChatParticipants, deleteChat, getChat, receiptFor } from '@/lib/services/chats';
import type { Message, ChatParticipant, ReceiptStatus } from '@/lib/services/chats';
import { ReceiptTicks } from '@/app/components/chat/ReceiptTicks';
import { DeleteChatSheet } from '@/app/components/chat/DeleteChatSheet';
import { toTitleCase } from '@/app/data/chats';
import { markChatNotificationsAsRead } from '@/lib/services/notifications';
import { setActiveChat } from '@/lib/services/activeChatTracker';
import { useAuth } from '@/lib/AuthContext';
import { useOnlinePresence } from '@/lib/services/presence';
import { Capacitor } from '@capacitor/core';
import { useT, intlLocale } from '@/lib/i18n';
import { CHAT_PAGE_SIZE, mergeLatestPage, prependOlder, normalizeChatType, type ChatKind } from '@/lib/chatMessages';

/**
 * Chat keyboard: it stays up while you read and tap around the chat. It
 * closes with a swipe down on the messages (like iMessage), with Back on
 * Android, or when you leave the chat.
 */
const hideChatKeyboard = () => {
  const a = document.activeElement as HTMLElement | null;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) a.blur();
  if (Capacitor.isNativePlatform()) {
    import('@capacitor/keyboard').then(({ Keyboard }) => Keyboard.hide()).catch(() => {});
  }
};
import { personName } from '@/lib/personName';

interface ChatDetailModalProps {
  chat: {
    id: string;
    type: 'direct' | 'band' | 'event';
    name: string;
    initials: string;
    avatarUrl?: string;
    unread: number;
    members?: number;
    isOnline?: boolean;
    /** Optional: tints/iconises event chats by event type (defaults to gig). */
    eventType?: string;
    /** Band of a direct or event chat, shown when the user is in several. */
    bandLabel?: string;
  };
  onClose: () => void;
}

/** Icon shown on an event chat tile, per event kind (Figma: music / mic / file). */
const EVENT_ICON: Record<EventKind, React.ComponentType<{ className?: string }>> = {
  gig: Music,
  rehearsal: Mic,
  quote: FileText,
  personal: User,
  past: Calendar,
};

const renderMessageContent = (content: string, isMe: boolean) => {
  const mentionRegex = /@(\w+(?:\s+\w+)?)/g;
  const parts = content.split(mentionRegex);
  
  if (parts.length === 1) return <span>{content}</span>;
  
  return (
    <>
      {parts.map((part, index) => {
        if (index % 2 === 1) {
          return (
            <span
              key={index}
              className={cn(
                "font-bold",
                isMe ? "underline decoration-accent-foreground/60" : "text-accent-ink"
              )}
            >
              @{part}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
};

export const ChatDetailModal: React.FC<ChatDetailModalProps> = ({ chat, onClose }) => {
  const { user } = useAuth();
  const t = useT();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const swipeStartY = useRef<number | null>(null);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [otherParticipants, setOtherParticipants] = useState<ChatParticipant[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [chatParticipants, setChatParticipants] = useState<Array<{id: string; name: string}>>([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [chatName, setChatName] = useState<string>(
    chat.name && chat.name !== 'New Chat' ? chat.name : ''
  );
  const [chatInitials, setChatInitials] = useState<string>(
    chat.initials && chat.initials !== 'NC' ? chat.initials : ''
  );
  const [chatAvatarUrl, setChatAvatarUrl] = useState<string | undefined>(chat.avatarUrl);
  const [canText, setCanText] = useState<boolean>(true);
  const [restrictionReason, setRestrictionReason] = useState<string>('');
  // Band admins (user ids) for the chat's band: drives the " · Admin" sender label.
  const [bandAdminIds, setBandAdminIds] = useState<Set<string>>(() => new Set());
  const onlineUserIds = useOnlinePresence(user?.id);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Push and notification opens don't know the chat type: getChat corrects it.
  const [chatType, setChatType] = useState<ChatKind>(chat.type);
  const chatTypeRef = useRef<ChatKind>(chat.type);
  const typeResolvedRef = useRef(false);
  // History: the first request brings the last CHAT_PAGE_SIZE messages.
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const lastIdRef = useRef<string | null>(null);
  const prependAnchorRef = useRef<{ height: number; top: number } | null>(null);

  useEffect(() => {
    if (chat.name && chat.name !== 'New Chat') {
      setChatName(chat.name);
      const initials = chat.name.split(' ').filter(Boolean).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
      if (initials) setChatInitials(initials);
    }
    if (chat.avatarUrl) setChatAvatarUrl(chat.avatarUrl);
  }, [chat.name, chat.initials, chat.avatarUrl]);
  
  const filteredParticipants = chatParticipants.filter(p => 
    p.name.toLowerCase().includes(mentionQuery.toLowerCase()) && p.id !== user?.id
  );
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setNewMessage(value);
    
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      if (!textAfterAt.includes(' ') || textAfterAt.split(' ').length <= 2) {
        setMentionQuery(textAfterAt);
        setMentionStartIndex(lastAtIndex);
        setShowMentionSuggestions(true);
        return;
      }
    }
    
    setShowMentionSuggestions(false);
    setMentionQuery('');
  };
  
  const insertMention = (participant: {id: string; name: string}) => {
    const beforeMention = newMessage.substring(0, mentionStartIndex);
    const afterMention = newMessage.substring(mentionStartIndex + mentionQuery.length + 1);
    setNewMessage(`${beforeMention}@${participant.name} ${afterMention}`);
    setShowMentionSuggestions(false);
    setMentionQuery('');
    inputRef.current?.focus();
  };
  
  const handleReply = (message: Message) => {
    setReplyingTo(message);
    inputRef.current?.focus();
  };
  
  const handleDeleteChat = async () => {
    setDeleting(true);
    const { error } = await deleteChat(chat.id);
    setDeleting(false);
    if (!error) {
      onClose();
    }
  };

  const statusFor = (message: Message): ReceiptStatus =>
    message.id.startsWith('temp-') ? 'sending' : receiptFor(message.created_at, otherParticipants);

  const loadParticipants = async () => {
    const { data: participants } = await getChatParticipants(chat.id);
    if (participants && user) {
      const otherParticipants = participants.filter(p => p.user_id !== user.id);
      setChatParticipants(
        otherParticipants.map(p => ({
          id: p.user_id,
          name: personName((p.profile as any))
        }))
      );
      
      // Only once getChat confirmed the type: a band chat opened from a push or a
      // notification arrives as "direct" and must not take a member's name.
      if (typeResolvedRef.current && chatTypeRef.current === 'direct' && otherParticipants.length > 0) {
        const otherProfile = (otherParticipants[0] as any)?.profile;
        const otherName = personName(otherProfile, '');
        if (otherName) {
          setChatName(otherName);
          const initials = otherName.split(' ').filter(Boolean).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
          if (initials) setChatInitials(initials);
        }
        if (otherProfile?.avatar_url) {
          setChatAvatarUrl(otherProfile.avatar_url);
        }
      }
      
      setOtherParticipants(otherParticipants);
    }
  };

  useEffect(() => {
    setChatType(chat.type);
    chatTypeRef.current = chat.type;
    typeResolvedRef.current = false;
    lastIdRef.current = null;
    nearBottomRef.current = true;
    setActiveChat(chat.id);
    loadMessages();
    loadParticipants();
    markChatAsRead(chat.id);
    markChatNotificationsAsRead(chat.id);

    // Fetch full chat record to ensure real title and avatar
    (async () => {
      const { data: fullChat } = await getChat(chat.id);
      if (fullChat) {
        const kind = normalizeChatType(fullChat.type);
        if (kind) {
          chatTypeRef.current = kind;
          setChatType(kind);
        }
        typeResolvedRef.current = true;
        if (fullChat.type === 'direct') {
          const other = fullChat.participants.find(p => p.user_id !== user?.id);
          const name = personName(other?.profile, '');
          if (name) {
            setChatName(name);
            const initials = name.split(' ').filter(Boolean).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
            if (initials) setChatInitials(initials);
          }
          if (other?.profile?.avatar_url) {
            setChatAvatarUrl(other.profile.avatar_url);
          }
        } else if (fullChat.type === 'band' || fullChat.type === 'event') {
          if (fullChat.type === 'band' && fullChat.band_id) {
            const { data: bData } = await supabase
              .from('bands')
              .select('name, logo_url')
              .eq('id', fullChat.band_id)
              .maybeSingle();
            const bName = bData?.name || fullChat.name;
            if (bName && bName !== 'New Chat') {
              setChatName(bName);
              const initials = bName.split(' ').filter(Boolean).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
              if (initials) setChatInitials(initials);
            }
            if (bData?.logo_url || (fullChat as any).logo_url || (fullChat as any).avatar_url) {
              setChatAvatarUrl(bData?.logo_url || (fullChat as any).logo_url || (fullChat as any).avatar_url);
            }
          } else if (fullChat.name && fullChat.name !== 'New Chat') {
            setChatName(fullChat.name);
            const initials = fullChat.name.split(' ').filter(Boolean).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
            if (initials) setChatInitials(initials);
            if ((fullChat as any).logo_url || (fullChat as any).avatar_url) {
              setChatAvatarUrl((fullChat as any).logo_url || (fullChat as any).avatar_url);
            }
          }
        }

        // One lookup per chat (not per message) for the band's admins.
        if ((fullChat.type === 'band' || fullChat.type === 'event') && fullChat.band_id) {
          const { data: admins } = await supabase
            .from('band_members')
            .select('user_id')
            .eq('band_id', fullChat.band_id)
            .eq('role', 'admin')
            .eq('is_active', true);
          setBandAdminIds(new Set((admins || []).map((a: { user_id: string }) => a.user_id)));
        }

        // Business rule check: members can only text admins or band/event they're in
        if (user) {
          let permitted = true;
          let reason = '';

          if (fullChat.type === 'direct') {
            const other = fullChat.participants.find(p => p.user_id !== user.id);
            if (other) {
              const { data: sharedMemberships } = await supabase
                .from('band_members')
                .select('band_id, role, user_id')
                .in('user_id', [user.id, other.user_id])
                .eq('is_active', true);

              const userBands = new Map<string, string>();
              const otherBands = new Map<string, string>();
              (sharedMemberships || []).forEach((m: any) => {
                if (m.user_id === user.id) userBands.set(m.band_id, m.role);
                if (m.user_id === other.user_id) otherBands.set(m.band_id, m.role);
              });

              let hasAdmin = false;
              for (const [bId, userRole] of userBands.entries()) {
                const otherRole = otherBands.get(bId);
                if (otherRole && (userRole === 'admin' || otherRole === 'admin')) {
                  hasAdmin = true;
                  break;
                }
              }

              if (!hasAdmin) {
                permitted = false;
                reason = t('Direct messaging is only available with band admins.');
              }
            }
          } else if (fullChat.type === 'band' && fullChat.band_id) {
            const { data: bm } = await supabase
              .from('band_members')
              .select('id')
              .eq('band_id', fullChat.band_id)
              .eq('user_id', user.id)
              .eq('is_active', true)
              .maybeSingle();

            if (!bm) {
              permitted = false;
              reason = t('You can only message in bands you are an active member of.');
            }
          } else if (fullChat.type === 'event' && fullChat.event_id) {
            let hasAccess = false;
            if (fullChat.band_id) {
              const { data: bm } = await supabase
                .from('band_members')
                .select('role')
                .eq('band_id', fullChat.band_id)
                .eq('user_id', user.id)
                .eq('is_active', true)
                .maybeSingle();
              if (bm?.role === 'admin') hasAccess = true;
            }
            if (!hasAccess) {
              const { data: em } = await supabase
                .from('event_members')
                .select('id, status')
                .eq('event_id', fullChat.event_id)
                .eq('user_id', user.id)
                .maybeSingle();
              if (em && em.status !== 'declined') hasAccess = true;
            }
            if (!hasAccess) {
              permitted = false;
              reason = t('You can only message in events you are participating in.');
            }
          }

          setCanText(permitted);
          setRestrictionReason(reason);
        }
      }
    })();
    
    const unsubscribe = subscribeToChat(chat.id, (message) => {
      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev.filter(m => !m.id.startsWith('temp-')), message];
      });
      markChatNotificationsAsRead(chat.id);
      markChatAsRead(chat.id);
    });

    const unsubscribeReceipts = subscribeToReceipts((changedChatId) => {
      if (changedChatId === chat.id) loadParticipants();
    });

    const pollInterval = setInterval(async () => {
      const { data } = await getMessages(chat.id, { limit: CHAT_PAGE_SIZE });
      if (data) setMessages(prev => mergeLatestPage(prev, data));
      loadParticipants();
    }, 3000);

    return () => {
      unsubscribe();
      unsubscribeReceipts();
      clearInterval(pollInterval);
      setActiveChat(null);
    };
  }, [chat.id, user?.id]);

  // Scroll to the bottom only when a message arrives at the bottom and the reader
  // is already there (or sent it), never because the poll refreshed the list.
  useEffect(() => {
    const last = messages[messages.length - 1];
    const lastId = last?.id ?? null;
    if (lastId === lastIdRef.current) return;
    const firstLoad = lastIdRef.current === null;
    lastIdRef.current = lastId;
    if (!last) return;
    const mine = last.sender_id === user?.id || last.id.startsWith('temp-');
    if (firstLoad || mine || nearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: firstLoad ? 'auto' : 'smooth' });
    }
  }, [messages, user?.id]);

  // Older messages go above: keep the ones on screen where they were.
  useLayoutEffect(() => {
    const anchor = prependAnchorRef.current;
    const el = scrollRef.current;
    if (!anchor || !el) return;
    prependAnchorRef.current = null;
    el.scrollTop = anchor.top + (el.scrollHeight - anchor.height);
  }, [messages]);

  const loadMessages = async () => {
    setLoading(true);
    const { data } = await getMessages(chat.id, { limit: CHAT_PAGE_SIZE });
    if (data) setMessages(data);
    setHasOlder((data?.length ?? 0) >= CHAT_PAGE_SIZE);
    setLoading(false);
  };

  const loadOlder = async () => {
    const oldest = messages.find(m => !m.id.startsWith('temp-'));
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    const { data } = await getMessages(chat.id, { limit: CHAT_PAGE_SIZE, before: oldest.created_at });
    setLoadingOlder(false);
    if (!data) return;
    setHasOlder(data.length >= CHAT_PAGE_SIZE);
    const el = scrollRef.current;
    if (el) prependAnchorRef.current = { height: el.scrollHeight, top: el.scrollTop };
    setMessages(prev => prependOlder(prev, data));
  };

  const handleSend = async () => {
    if (!canText) return;
    if (!newMessage.trim() || sending) return;
    if (!chat.id || chat.id === 'undefined' || chat.id === 'null') return;
    
    setSending(true);
    const messageText = newMessage.trim();
    const replyToMessage = replyingTo;
    setNewMessage('');
    setReplyingTo(null);
    
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      chat_id: chat.id,
      sender_id: user?.id || '',
      content: messageText,
      message_type: 'text',
      edited: false,
      deleted: false,
      created_at: new Date().toISOString(),
      reply_to_id: replyToMessage?.id,
      reply_to: replyToMessage || undefined,
      sender: { id: user?.id || '', full_name: t('You') }
    };
    setMessages(prev => [...prev, optimisticMessage]);
    
    const { data, error } = await sendMessage(chat.id, messageText, 'text', replyToMessage?.id);
    
    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
      setNewMessage(messageText);
      setReplyingTo(replyToMessage);
    } else if (data) {
      setMessages(prev => prev.map(m => m.id === optimisticMessage.id ? data : m));
    }
    
    setSending(false);
    inputRef.current?.focus();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString(intlLocale('en-US'), { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return t('Today');
    if (date.toDateString() === yesterday.toDateString()) return t('Yesterday');
    return date.toLocaleDateString(intlLocale('en-US'), { month: 'short', day: 'numeric' });
  };

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';
    msgs.forEach(msg => {
      const msgDate = new Date(msg.created_at).toDateString();
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msg.created_at, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });
    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);
  const chatTypeLabel = chatType === 'direct' ? t('DM') : chatType === 'band' ? t('BAND') : t('EVENT');
  // Group chats: "N members · N online". Online comes from realtime presence and is
  // only shown once presence has synced (our own id is tracked) and participants are loaded.
  const memberCount = chatParticipants.length > 0 ? chatParticipants.length + 1 : chat.members;
  const onlineCount =
    user?.id && onlineUserIds.has(user.id) && chatParticipants.length > 0
      ? 1 + chatParticipants.filter(p => onlineUserIds.has(p.id)).length
      : null;
  // Read the others' status live from presence. chat.isOnline is the list's
  // snapshot from when the chat was opened and never updates.
  const presenceReady = !!user?.id && onlineUserIds.has(user.id);
  const isOtherOnline =
    presenceReady && chatParticipants.length > 0
      ? chatParticipants.some(p => onlineUserIds.has(p.id))
      : !!chat.isOnline;
  const eventKind = eventKindOf({ eventType: chat.eventType });
  const EventIcon = EVENT_ICON[eventKind];
  const displayTitle = toTitleCase(chatName || (chat.name && chat.name !== 'New Chat' ? chat.name : '') || (chatType === 'direct' ? t('Member') : chatType === 'band' ? t('Band Chat') : t('Event Chat')));

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
      className="bw-pane-detail bw-chat-detail fixed inset-0 z-[80] bg-background text-foreground flex flex-col"
      data-keep-keyboard=""
    >
      {/* Header and messages; in Laptop pose they fill the Display (index.css). */}
      <div className="bw-chat-top flex-1 min-h-0 flex flex-col">
      {/* ── Header ── */}
      <div
        className="relative flex items-center gap-3 px-4 pb-3 bg-background shrink-0 bw-status-clear"
        style={{ paddingTop: 'calc(var(--safe-top) + 8px)' }}
      >
        <NavBackButton pane onClick={onClose} />

        <div className="flex-1 flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            {chatType === 'event' ? (
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `var(--accent-${eventKind})`, color: `var(--accent-${eventKind}-fg)` }}
              >
                <EventIcon className="w-5 h-5" />
              </div>
            ) : (
              <div className={cn(
                "w-11 h-11 rounded-full flex items-center justify-center overflow-hidden",
                chatType === 'band'
                  ? "bg-surface-inverse text-surface-inverse-foreground"
                  : "bg-white text-black border-[1.5px] border-border"
              )}>
                {chatAvatarUrl ? (
                  <img
                    src={chatAvatarUrl}
                    alt={chatName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <span className="bw-h3">
                    {chatInitials || (chat.initials && chat.initials !== 'NC' ? chat.initials : chatType === 'band' ? 'B' : 'U')}
                  </span>
                )}
              </div>
            )}
            {isOtherOnline && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success ring-2 ring-background" />
            )}
          </div>

          <div className="flex-1 min-w-0 flex flex-col">
            <h3 className="bw-h3 text-foreground truncate">
              {displayTitle}
            </h3>
            <p className="bw-body-sm text-muted-foreground truncate flex items-center gap-1.5">
              <span className="sr-only">{chatTypeLabel} · </span>
              {chatType === 'direct' ? (
                isOtherOnline ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-success inline-block shrink-0" />
                    {t('Online')}
                  </>
                ) : (
                  t('Offline')
                )
              ) : memberCount ? (
                `${memberCount === 1 ? t('{count} member', { count: memberCount }) : t('{count} members', { count: memberCount })}${onlineCount !== null ? ` · ${t('{count} online', { count: onlineCount })}` : ''}`
              ) : chatType === 'band' ? (
                t('Band chat')
              ) : (
                t('Event chat')
              )}
              {chat.bandLabel && <span className="truncate">· {chat.bandLabel}</span>}
            </p>
          </div>
        </div>

        <HeaderAction pane label={t('Delete chat')} variant="ghost" icon={<Trash2 />} onClick={() => setShowDeleteConfirm(true)} />
      </div>

      <DeleteChatSheet
        open={showDeleteConfirm}
        chatName={chatType === 'direct' ? displayTitle : undefined}
        deleting={deleting}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteChat}
      />

      {/* ── Messages ── (swipe down to hide the keyboard) */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 pt-2 pb-4 bg-background"
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
        onTouchStart={(e) => {
          swipeStartY.current = e.touches[0]?.clientY ?? null;
        }}
        onTouchMove={(e) => {
          const y0 = swipeStartY.current;
          const y = e.touches[0]?.clientY;
          if (y0 != null && y != null && y - y0 > 36) {
            swipeStartY.current = null;
            hideChatKeyboard();
          }
        }}
        onTouchEnd={() => {
          swipeStartY.current = null;
        }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            {chatType === 'event' ? (
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `var(--accent-${eventKind})`, color: `var(--accent-${eventKind}-fg)` }}
              >
                <EventIcon className="w-7 h-7" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full border-[1.5px] border-foreground flex items-center justify-center text-foreground">
                {chatType === 'band' ? (
                  <Users className="w-7 h-7" />
                ) : (
                  <ArrowUpRight className="w-7 h-7" />
                )}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <h4 className="bw-h3 text-foreground">{t('No messages yet')}</h4>
              <p className="bw-label-sm text-muted-foreground">
                {t('Start the conversation')}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {hasOlder && (
              <div className="flex justify-center">
                <PillButton
                  variant="outline"
                  size="sm"
                  fullWidth={false}
                  loading={loadingOlder}
                  onClick={loadOlder}
                >
                  {t('Load earlier messages')}
                </PillButton>
              </div>
            )}
            {messageGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="flex flex-col gap-3">
                {/* Date separator */}
                <div className="flex items-center justify-center">
                  <Tag variant="subtle">{formatDate(group.date)}</Tag>
                </div>

                {group.messages.map((message) => {
                  const isMe = message.sender_id === user?.id;
                  const replyTo = message.reply_to;

                  const replyButton = (
                    <button
                      type="button"
                      onClick={() => handleReply(message)}
                      aria-label={t('Reply to message')}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 w-8 h-8 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground flex items-center justify-center transition-opacity active:scale-90 self-center shrink-0 cursor-pointer"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>
                  );
                  
                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15 }}
                      className={cn("flex group gap-1.5", isMe ? "justify-end" : "justify-start")}
                    >
                      {/* Reply button for sent messages */}
                      {isMe && replyButton}

                      <div className={cn(
                        "flex flex-col gap-1 min-w-0 max-w-[78%]",
                        isMe ? "items-end" : "items-start"
                      )}>
                        {!isMe && (chatType === 'band' || chatType === 'event') && (
                          <p className="bw-label-xs text-muted-foreground">
                            {personName(message.sender, t('Member'))}
                            {bandAdminIds.has(message.sender_id) ? ' · ' + t('Admin') : ''}
                          </p>
                        )}

                        <div className={cn(
                          "flex flex-col gap-2 px-4 py-3 rounded-[20px] max-w-full",
                          isMe
                            ? "bg-accent text-accent-foreground"
                            : "bg-card text-card-foreground"
                        )}>
                          {replyTo && message.reply_to_id && replyTo.content && (
                            <div className="flex flex-col gap-1 px-3 py-2 rounded-[20px] bg-black text-white min-w-0">
                              <p className="bw-label-xs text-accent truncate">
                                {personName(replyTo.sender, t('Unknown'))}
                              </p>
                              <p className="bw-body-sm text-white line-clamp-1">
                                {replyTo.content}
                              </p>
                            </div>
                          )}

                          <p className="bw-body-md break-words">
                            {renderMessageContent(message.content, isMe)}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 text-muted-foreground">
                          <span className="bw-label-xs">{formatTime(message.created_at)}</span>
                          {isMe && <ReceiptTicks status={statusFor(message)} className="w-3.5 h-3.5" />}
                        </div>
                      </div>

                      {/* Reply button for received messages */}
                      {!isMe && replyButton}
                    </motion.div>
                  );
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      </div>

      {/* Laptop pose: the fold stays empty; the composer opens the Deck. */}
      <div className="bw-chat-fold hidden" aria-hidden="true" />

      {/* ── Composer ── */}
      <div
        className="bg-background flex-shrink-0"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 12px)' }}
      >
        {!canText ? (
          <div className="px-4 pt-3 flex items-center justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-card text-muted-foreground">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span className="bw-label-xs">{restrictionReason || t('Messaging is restricted')}</span>
            </div>
          </div>
        ) : (
          <>
            {/* Reply preview */}
            <AnimatePresence>
              {replyingTo && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-card px-4 py-3 flex items-center gap-3">
                    <span className="w-[3px] h-7 rounded-full bg-accent shrink-0" aria-hidden="true" />
                    <div className="flex-1 min-w-0 flex flex-col">
                      <span className="bw-label-sm text-foreground truncate">
                        {t('Replying to {name}', { name: personName(replyingTo.sender, t('Message')) })}
                      </span>
                      <p className="bw-body-sm text-muted-foreground line-clamp-1">{replyingTo.content}</p>
                    </div>
                    <IconButton label={t('Cancel reply')} variant="ghost" size="sm" icon={<X />} onClick={() => setReplyingTo(null)} className="-mr-2 text-muted-foreground" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Touches here keep the keyboard up (see AuthenticatedApp's
                touchstart handler): sending a message doesn't close it. */}
            <div className="px-4 pt-3 flex items-center gap-3" data-keep-keyboard="">
              <div className="flex-1 relative min-w-0">
                <AnimatePresence>
                  {showMentionSuggestions && filteredParticipants.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="absolute bottom-full left-0 right-0 mb-2 bg-card rounded-[16px] border border-border max-h-40 overflow-y-auto z-10 py-1"
                    >
                      {filteredParticipants.map((participant) => (
                        <button
                          type="button"
                          key={participant.id}
                          onClick={() => insertMention(participant)}
                          className="w-full px-4 py-2 text-left hover:bg-foreground/[0.06] flex items-center gap-3 transition-colors cursor-pointer"
                        >
                          <div className="w-7 h-7 rounded-full bg-white text-black border-[1.5px] border-border flex items-center justify-center bw-label-xs shrink-0">
                            {participant.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="bw-label-sm text-foreground truncate">{participant.name}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setShowMentionSuggestions(false);
                    else if (e.key === 'Enter' && !showMentionSuggestions) handleSend();
                    else if (e.key === 'Enter' && showMentionSuggestions && filteredParticipants.length > 0) {
                      e.preventDefault();
                      insertMention(filteredParticipants[0]);
                    }
                  }}
                  placeholder={replyingTo ? t('Write a reply…') : t('Write a message…')}
                  aria-label={t('Message')}
                  className="w-full h-12 px-4 rounded-full bg-field text-foreground bw-body-md placeholder:text-muted-foreground/60 border border-border focus:border-2 focus:border-foreground focus:outline-none transition-colors"
                />
              </div>
              
              <IconButton
                label={t('Send message')}
                variant="filled"
                onClick={handleSend}
                // A tap used to blur the input first: the keyboard closed, the
                // composer moved down and the click missed, so it took two taps.
                // Keep the focus on the input and send on the touch itself.
                onPointerDown={(e) => e.preventDefault()}
                onMouseDown={(e) => e.preventDefault()}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  const touch = e.changedTouches[0];
                  const r = e.currentTarget.getBoundingClientRect();
                  if (touch && touch.clientX >= r.left && touch.clientX <= r.right && touch.clientY >= r.top && touch.clientY <= r.bottom) {
                    void handleSend();
                  }
                }}
                disabled={!newMessage.trim() || sending}
                icon={sending ? <Loader2 className="animate-spin" /> : <Send />}
              />
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default ChatDetailModal;
