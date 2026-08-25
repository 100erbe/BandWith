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
  Paperclip,
  X,
  Reply,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { getMessages, sendMessage, markChatAsRead, subscribeToChat, getChatParticipants, deleteChat } from '@/lib/services/chats';
import type { Message } from '@/lib/services/chats';
import { markChatNotificationsAsRead } from '@/lib/services/notifications';
import { setActiveChat } from '@/lib/services/activeChatTracker';
import { useAuth } from '@/lib/AuthContext';

interface ChatDetailModalProps {
  chat: {
    id: string;
    type: 'direct' | 'band' | 'event';
    name: string;
    initials: string;
    unread: number;
    members?: number;
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
            <span key={index} className={cn("font-bold", isMe ? "text-accent-foreground" : "text-accent")}>
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
      setChatParticipants(
        participants
          .filter(p => p.user_id !== user.id)
          .map(p => ({
            id: p.user_id,
            name: (p.profile as any)?.full_name || `User ${p.user_id.slice(0, 6)}`
          }))
      );
      
      const otherParticipants = participants.filter(p => p.user_id !== user.id);
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
    
    const unsubscribe = subscribeToChat(chat.id, (message) => {
      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev.filter(m => !m.id.startsWith('temp-')), message];
      });
      markChatNotificationsAsRead(chat.id);
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
  }, [chat.id]);

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
  const accentColor = chat.type === 'event' ? 'var(--accent-rehearsal)' : 'var(--accent)';

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
      className="fixed inset-0 z-[80] bg-background flex flex-col"
    >
      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-background border-b border-border"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      >
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full border border-border flex items-center justify-center active:scale-90 transition-transform"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>

        <div className="flex-1 flex items-center gap-3 min-w-0">
          {chat.type === 'direct' ? (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-accent font-black text-sm shrink-0">
              {chat.initials}
            </div>
          ) : chat.type === 'band' ? (
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-accent-foreground font-black text-sm shrink-0">
              {chat.initials}
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-accent-rehearsal flex items-center justify-center shrink-0">
              <Calendar className="w-4.5 h-4.5 text-accent-foreground" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h3 className="font-black text-sm text-foreground truncate uppercase leading-tight">
              {chat.name}
            </h3>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: accentColor }}>
                {chatTypeLabel}
              </span>
              {(chat.type === 'band' || chat.type === 'event') && chat.members && (
                <>
                  <span className="text-muted-foreground text-xs">•</span>
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    {chat.members} members
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-10 h-10 rounded-full border border-border flex items-center justify-center active:scale-90 transition-transform"
        >
          <Trash2 className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Delete confirmation overlay */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 top-0 z-10 bg-background/95 backdrop-blur-sm flex items-center justify-between px-4 py-3"
            style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
          >
            <div className="flex-1 min-w-0 mr-3">
              <p className="text-xs font-bold text-foreground uppercase">Delete this chat?</p>
              <p className="text-xs text-muted-foreground mt-0.5">All messages will be permanently removed</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="h-9 px-4 rounded-full border border-border text-xs font-bold text-foreground/70 uppercase active:scale-95 transition-transform"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteChat}
                disabled={deleting}
                className="h-9 px-4 rounded-full bg-destructive/90 text-xs font-bold text-destructive-foreground uppercase flex items-center gap-1.5 active:scale-95 transition-transform"
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
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              {chat.type === 'band' ? (
                <Users className="w-7 h-7 text-muted-foreground" />
              ) : (
                <ArrowUpRight className="w-7 h-7 text-muted-foreground" />
              )}
            </div>
            <div>
              <h4 className="font-black text-sm text-foreground/60 uppercase mb-1">No messages yet</h4>
              <p className="text-xs font-medium text-muted-foreground uppercase">
                Start the conversation
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {messageGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="flex flex-col gap-1.5">
                {/* Date separator */}
                <div className="flex items-center justify-center py-2">
                  <span className="px-3 py-1 rounded-full bg-muted text-xs font-bold text-muted-foreground uppercase tracking-wider">
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
                      {/* Reply button — opposite side of bubble (WhatsApp style) */}
                      {isMe && (
                        <button
                          onClick={() => handleReply(message)}
                          className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-full bg-muted flex items-center justify-center transition-all active:scale-90 self-center"
                        >
                          <Reply className="w-4 h-4 text-muted-foreground" />
                        </button>
                      )}

                      <div className={cn(
                        "max-w-[78%] px-4 py-2.5",
                        isMe
                          ? "bg-accent text-accent-foreground rounded-2xl rounded-br"
                          : "bg-card text-foreground border border-border/40 rounded-2xl rounded-bl"
                      )}>
                        {replyTo && message.reply_to_id && replyTo.content && (
                          <div className={cn(
                            "mb-2 px-3 py-2 rounded-xl border-l-2 border-accent",
                            isMe ? "bg-accent-foreground/10" : "bg-muted"
                          )}>
                            <p className="text-xs font-bold text-accent uppercase mb-0.5">
                              {replyTo.sender?.full_name || 'Unknown'}
                            </p>
                            <p className="text-xs line-clamp-1 opacity-60">
                              {replyTo.content}
                            </p>
                          </div>
                        )}

                        {!isMe && (chat.type === 'band' || chat.type === 'event') && (
                          <p className="text-xs font-bold text-muted-foreground uppercase mb-1 tracking-wide">
                            {message.sender?.full_name || 'Member'}
                          </p>
                        )}

                        <p className="text-sm leading-[1.45]">
                          {renderMessageContent(message.content, isMe)}
                        </p>

                        <div className={cn(
                          "flex items-center justify-end gap-1 mt-1",
                          isMe ? "text-accent-foreground/60" : "text-muted-foreground"
                        )}>
                          <span className="text-xs font-medium">{formatTime(message.created_at)}</span>
                          {isMe && (
                            message.id.startsWith('temp-') ? (
                              <Check className="w-3 h-3 opacity-40" />
                            ) : isMessageRead(message.created_at) ? (
                              <CheckCheck className="w-3 h-3" />
                            ) : (
                              <CheckCheck className="w-3 h-3" />
                            )
                          )}
                        </div>
                      </div>

                      {!isMe && (
                        <button
                          onClick={() => handleReply(message)}
                          className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-full bg-muted flex items-center justify-center transition-all active:scale-90 self-center"
                        >
                          <Reply className="w-4 h-4 text-muted-foreground" />
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
        className="bg-background border-t border-border flex-shrink-0"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}
      >
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
                <div className="flex-1 bg-muted rounded-xl p-3 border-l-2 border-accent">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-bold text-accent uppercase">
                      {replyingTo.sender?.full_name || 'Message'}
                    </span>
                    <button onClick={() => setReplyingTo(null)} className="p-0.5">
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{replyingTo.content}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="px-4 py-3 flex items-center gap-2.5">
          <button className="w-10 h-10 rounded-full border border-border flex items-center justify-center active:scale-90 transition-transform shrink-0">
            <Paperclip className="w-4 h-4 text-muted-foreground" />
          </button>
          
          <div className="flex-1 relative">
            <AnimatePresence>
              {showMentionSuggestions && filteredParticipants.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="absolute bottom-full left-0 right-0 mb-2 bg-card rounded-xl border border-border max-h-40 overflow-y-auto z-10"
                >
                  {filteredParticipants.map((participant) => (
                    <button
                      key={participant.id}
                      onClick={() => insertMention(participant)}
                      className="w-full px-4 py-3 text-left hover:bg-muted flex items-center gap-3 transition-colors first:rounded-t-xl last:rounded-b-xl"
                    >
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-accent text-xs font-bold">
                        {participant.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-bold text-foreground/80 text-xs uppercase">{participant.name}</span>
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
              placeholder={replyingTo ? "Reply..." : "Message..."}
              className="w-full h-11 px-4 rounded-full bg-muted text-foreground/90 text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:bg-muted transition-colors"
            />
          </div>
          
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 active:scale-90",
              newMessage.trim()
                ? "bg-accent text-accent-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ChatDetailModal;
