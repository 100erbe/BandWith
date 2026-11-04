import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  Send, 
  Trash2,
  Users,
  Calendar,
  Loader2,
  Check,
  CheckCheck,
  Clock,
  Paperclip,
  X,
  Reply,
  ArrowUpRight,
  Lock,
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { supabase } from '@/lib/supabase';
import { getMessages, sendMessage, markChatAsRead, subscribeToChat, getChatParticipants, deleteChat, getChat } from '@/lib/services/chats';
import type { Message } from '@/lib/services/chats';
import { toTitleCase } from '@/app/data/chats';
import { markChatNotificationsAsRead } from '@/lib/services/notifications';
import { setActiveChat } from '@/lib/services/activeChatTracker';
import { useAuth } from '@/lib/AuthContext';

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
  };
  onClose: () => void;
}

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
                isMe ? "underline decoration-primary-foreground/60 font-semibold" : "text-primary"
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [otherParticipantsLastRead, setOtherParticipantsLastRead] = useState<Date | null>(null);
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
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

  const isMessageRead = (messageCreatedAt: string): boolean => {
    if (!otherParticipantsLastRead) return false;
    return new Date(messageCreatedAt) <= otherParticipantsLastRead;
  };

  const loadParticipants = async () => {
    const { data: participants } = await getChatParticipants(chat.id);
    if (participants && user) {
      const otherParticipants = participants.filter(p => p.user_id !== user.id);
      setChatParticipants(
        otherParticipants.map(p => ({
          id: p.user_id,
          name: (p.profile as any)?.full_name || `User ${p.user_id.slice(0, 6)}`
        }))
      );
      
      if (chat.type === 'direct' && otherParticipants.length > 0) {
        const otherProfile = (otherParticipants[0] as any)?.profile;
        const otherName = otherProfile?.full_name;
        if (otherName) {
          setChatName(otherName);
          const initials = otherName.split(' ').filter(Boolean).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
          if (initials) setChatInitials(initials);
        }
        if (otherProfile?.avatar_url) {
          setChatAvatarUrl(otherProfile.avatar_url);
        }
      }
      
      if (otherParticipants.length > 0) {
        const lastReadDates = otherParticipants
          .map(p => p.last_read_at ? new Date(p.last_read_at) : null)
          .filter((d): d is Date => d !== null);
        if (lastReadDates.length > 0) {
          setOtherParticipantsLastRead(new Date(Math.min(...lastReadDates.map(d => d.getTime()))));
        }
      }
    }
  };

  useEffect(() => {
    setActiveChat(chat.id);
    loadMessages();
    loadParticipants();
    markChatAsRead(chat.id);
    markChatNotificationsAsRead(chat.id);

    // Fetch full chat record to ensure real title and avatar
    (async () => {
      const { data: fullChat } = await getChat(chat.id);
      if (fullChat) {
        if (fullChat.type === 'direct') {
          const other = fullChat.participants.find(p => p.user_id !== user?.id);
          const name = other?.profile?.full_name;
          if (name) {
            setChatName(name);
            const initials = name.split(' ').filter(Boolean).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
            if (initials) setChatInitials(initials);
          }
          if (other?.profile?.avatar_url) {
            setChatAvatarUrl(other.profile.avatar_url);
          }
        } else if (fullChat.type === 'band' || fullChat.type === 'event') {
          if (fullChat.name && fullChat.name !== 'New Chat') {
            setChatName(fullChat.name);
            const initials = fullChat.name.split(' ').filter(Boolean).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
            if (initials) setChatInitials(initials);
          }
          if ((fullChat as any).logo_url || (fullChat as any).avatar_url) {
            setChatAvatarUrl((fullChat as any).logo_url || (fullChat as any).avatar_url);
          }
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
                reason = 'Direct messaging is only available with band admins.';
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
              reason = 'You can only message in bands you are an active member of.';
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
              reason = 'You can only message in events you are participating in.';
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

    const pollInterval = setInterval(async () => {
      const { data } = await getMessages(chat.id, { limit: 50 });
      if (data) {
        setMessages(prev => {
          const optimistic = prev.filter(m => m.id.startsWith('temp-'));
          const newMessages = data.filter(d => !optimistic.some(o => o.content === d.content));
          return [...newMessages, ...optimistic];
        });
      }
      loadParticipants();
    }, 3000);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
      setActiveChat(null);
    };
  }, [chat.id, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    setLoading(true);
    const { data } = await getMessages(chat.id, { limit: 50 });
    if (data) setMessages(data);
    setLoading(false);
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
      sender: { id: user?.id || '', full_name: 'You' }
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
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
  const chatTypeLabel = chat.type === 'direct' ? 'DM' : chat.type === 'band' ? 'BAND' : 'EVENT';

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
      className="fixed inset-0 z-[80] bg-background text-foreground flex flex-col"
    >
      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-card/90 backdrop-blur-md border-b border-border"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      >
        <button
          onClick={onClose}
          aria-label="Back"
          className="w-10 h-10 rounded-full border border-foreground/15 bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center text-foreground active:scale-90 transition-all shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden",
              chat.type === 'band' ? "bg-accent-rehearsal/15 border border-accent-rehearsal/30 text-accent-rehearsal" :
              chat.type === 'event' ? "bg-accent-gig/15 border border-accent-gig/30 text-accent-gig" :
              "bg-primary/10 border border-primary/20 text-primary"
            )}>
              {chatAvatarUrl && (chat.type === 'direct' || chat.type === 'band') ? (
                <img
                  src={chatAvatarUrl}
                  alt={chatName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : chat.type === 'direct' ? (
                <span>{chatInitials || (chat.initials && chat.initials !== 'NC' ? chat.initials : 'U')}</span>
              ) : chat.type === 'band' ? (
                <Users className="w-5 h-5" />
              ) : (
                <Calendar className="w-5 h-5" />
              )}
            </div>
            {chat.isOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm sm:text-base text-foreground truncate leading-tight">
              {toTitleCase(chatName || (chat.name && chat.name !== 'New Chat' ? chat.name : '') || (chat.type === 'direct' ? 'Direct Chat' : chat.type === 'band' ? 'Band Chat' : 'Event Chat'))}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  chat.type === 'event'
                    ? "text-accent-gig"
                    : chat.type === 'band'
                    ? "text-accent-rehearsal"
                    : "text-primary"
                )}
              >
                {chatTypeLabel}
              </span>
              {chat.type === 'direct' && (
                <>
                  <span className="text-foreground/20 text-[8px]">•</span>
                  {chat.isOnline ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-500 uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      Online
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-foreground/45 uppercase">
                      Offline
                    </span>
                  )}
                </>
              )}
              {(chat.type === 'band' || chat.type === 'event') && chat.members && (
                <>
                  <span className="text-foreground/20 text-[8px]">•</span>
                  <span className="text-[10px] font-bold text-foreground/50 uppercase">
                    {chat.members} {chat.members === 1 ? 'member' : 'members'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowDeleteConfirm(true)}
          aria-label="Delete chat"
          className="w-10 h-10 rounded-full border border-foreground/15 bg-foreground/5 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 flex items-center justify-center text-foreground/50 active:scale-90 transition-all shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Delete confirmation overlay */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 top-0 z-10 bg-card/95 backdrop-blur-md border-b border-destructive/20 flex items-center justify-between px-4 py-3"
            style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
          >
            <div className="flex-1 min-w-0 mr-3">
              <p className="text-xs font-bold text-foreground uppercase">Delete this chat?</p>
              <p className="text-[11px] text-foreground/50 mt-0.5">All messages will be permanently removed</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="h-9 px-4 rounded-full border border-foreground/15 text-xs font-bold text-foreground/70 uppercase hover:bg-foreground/5 active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteChat}
                disabled={deleting}
                className="h-9 px-4 rounded-full bg-destructive text-destructive-foreground text-xs font-bold uppercase flex items-center gap-1.5 active:scale-95 transition-all shadow-xs"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-background">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-foreground/30" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-foreground/5 border border-foreground/10 flex items-center justify-center text-foreground/30">
              {chat.type === 'band' ? (
                <Users className="w-7 h-7" />
              ) : (
                <ArrowUpRight className="w-7 h-7" />
              )}
            </div>
            <div>
              <h4 className="font-bold text-sm text-foreground uppercase mb-1">No messages yet</h4>
              <p className="text-xs font-medium text-foreground/50 uppercase">
                Start the conversation
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messageGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="flex flex-col gap-2">
                {/* Date separator */}
                <div className="flex items-center justify-center py-2">
                  <span className="px-3 py-1 rounded-full bg-card border border-foreground/10 text-[10px] font-bold text-foreground/60 uppercase tracking-wider shadow-2xs">
                    {formatDate(group.date)}
                  </span>
                </div>

                {group.messages.map((message) => {
                  const isMe = message.sender_id === user?.id;
                  const replyTo = message.reply_to;
                  
                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15 }}
                      className={cn("flex group items-end gap-1.5", isMe ? "justify-end" : "justify-start")}
                    >
                      {/* Reply button for sent messages */}
                      {isMe && (
                        <button
                          onClick={() => handleReply(message)}
                          aria-label="Reply to message"
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 w-8 h-8 rounded-full bg-card border border-foreground/10 text-foreground/50 hover:text-foreground hover:bg-foreground/5 flex items-center justify-center transition-all active:scale-90 self-center shadow-xs"
                        >
                          <Reply className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <div className={cn(
                        "max-w-[80%] px-4 py-2.5 shadow-xs transition-all",
                        isMe
                          ? "bg-primary text-primary-foreground rounded-2xl rounded-br-xs"
                          : "bg-card text-card-foreground border border-foreground/10 rounded-2xl rounded-bl-xs"
                      )}>
                        {replyTo && message.reply_to_id && replyTo.content && (
                          <div className={cn(
                            "mb-2 px-3 py-1.5 rounded-lg border-l-2",
                            isMe
                              ? "bg-black/15 border-primary-foreground/70 text-primary-foreground"
                              : "bg-foreground/5 border-primary text-foreground"
                          )}>
                            <p className={cn(
                              "text-[10px] font-bold uppercase mb-0.5",
                              isMe ? "text-primary-foreground/90" : "text-primary"
                            )}>
                              {replyTo.sender?.full_name || 'Unknown'}
                            </p>
                            <p className={cn(
                              "text-xs line-clamp-1",
                              isMe ? "text-primary-foreground/75" : "text-foreground/60"
                            )}>
                              {replyTo.content}
                            </p>
                          </div>
                        )}

                        {!isMe && (chat.type === 'band' || chat.type === 'event') && (
                          <p className="text-[11px] font-bold text-primary uppercase mb-1 tracking-wide">
                            {message.sender?.full_name || 'Member'}
                          </p>
                        )}

                        <p className={cn(
                          "text-sm font-normal leading-relaxed break-words",
                          isMe ? "text-primary-foreground" : "text-card-foreground"
                        )}>
                          {renderMessageContent(message.content, isMe)}
                        </p>

                        <div className={cn(
                          "flex items-center justify-end gap-1 mt-1",
                          isMe ? "text-primary-foreground/70" : "text-foreground/45"
                        )}>
                          <span className="text-[10px] font-medium">{formatTime(message.created_at)}</span>
                          {isMe && (
                            message.id.startsWith('temp-') ? (
                              <Clock className="w-3 h-3 opacity-60" />
                            ) : isMessageRead(message.created_at) ? (
                              <CheckCheck className="w-3.5 h-3.5 text-sky-400" />
                            ) : (
                              <Check className="w-3.5 h-3.5 opacity-60" />
                            )
                          )}
                        </div>
                      </div>

                      {/* Reply button for received messages */}
                      {!isMe && (
                        <button
                          onClick={() => handleReply(message)}
                          aria-label="Reply to message"
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 w-8 h-8 rounded-full bg-card border border-foreground/10 text-foreground/50 hover:text-foreground hover:bg-foreground/5 flex items-center justify-center transition-all active:scale-90 self-center shadow-xs"
                        >
                          <Reply className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Input ── */}
      <div
        className="bg-card/95 backdrop-blur-md border-t border-border flex-shrink-0"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}
      >
        {!canText ? (
          <div className="px-4 py-3.5 flex items-center justify-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-foreground/5 border border-foreground/10 text-xs font-semibold text-foreground/60 uppercase tracking-wide">
              <Lock className="w-3.5 h-3.5 text-foreground/50 shrink-0" />
              <span>{restrictionReason || 'Messaging is restricted'}</span>
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
                  <div className="px-4 pt-3 flex items-start gap-2">
                    <div className="flex-1 bg-foreground/5 rounded-xl p-3 border-l-2 border-primary">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-bold text-primary uppercase">
                          Replying to {replyingTo.sender?.full_name || 'Message'}
                        </span>
                        <button
                          onClick={() => setReplyingTo(null)}
                          className="p-1 hover:bg-foreground/10 rounded-full text-foreground/50 hover:text-foreground transition-colors"
                          aria-label="Cancel reply"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-foreground/70 line-clamp-1">{replyingTo.content}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            <div className="px-4 py-3 flex items-center gap-2">
              <div className="flex-1 relative">
                <AnimatePresence>
                  {showMentionSuggestions && filteredParticipants.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="absolute bottom-full left-0 right-0 mb-2 bg-card rounded-xl border border-border shadow-xl max-h-40 overflow-y-auto z-10 divide-y divide-border"
                    >
                      {filteredParticipants.map((participant) => (
                        <button
                          key={participant.id}
                          onClick={() => insertMention(participant)}
                          className="w-full px-4 py-2.5 text-left hover:bg-foreground/5 flex items-center gap-3 transition-colors first:rounded-t-xl last:rounded-b-xl"
                        >
                          <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                            {participant.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-bold text-foreground text-xs uppercase truncate">{participant.name}</span>
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
                  placeholder={replyingTo ? "Write a reply..." : "Write a message..."}
                  className="w-full h-11 px-4 rounded-full bg-foreground/5 text-foreground text-sm font-medium placeholder:text-foreground/35 border border-foreground/10 focus:border-primary/50 focus:bg-background focus:outline-none transition-all"
                />
              </div>
              
              <button
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
                aria-label="Send message"
                className={cn(
                  "w-11 h-11 rounded-full flex items-center justify-center transition-all shrink-0 active:scale-90",
                  newMessage.trim()
                    ? "bg-primary text-primary-foreground shadow-xs hover:opacity-95"
                    : "bg-foreground/5 text-foreground/30 cursor-not-allowed"
                )}
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default ChatDetailModal;
