import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Send, 
  MoreVertical,
  Phone,
  Video,
  User,
  Users,
  Calendar,
  Music2,
  Loader2,
  Check,
  CheckCheck,
  Image as ImageIcon,
  Paperclip,
  X,
  Reply
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { getMessages, sendMessage, markChatAsRead, subscribeToChat, getChatParticipants } from '@/lib/services/chats';
import type { Message, ChatWithDetails } from '@/lib/services/chats';
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

// Helper to render message content with highlighted mentions
const renderMessageContent = (content: string, isMe: boolean) => {
  // Match @username patterns
  const mentionRegex = /@(\w+(?:\s+\w+)?)/g;
  const parts = content.split(mentionRegex);
  
  if (parts.length === 1) {
    return <span>{content}</span>;
  }
  
  return (
    <>
      {parts.map((part, index) => {
        // Every odd index is a captured group (the username)
        if (index % 2 === 1) {
          return (
            <span 
              key={index} 
              className={cn(
                "font-bold",
                isMe ? "text-[#D4FB46]" : "text-blue-600"
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
  const [showMenu, setShowMenu] = useState(false);
  const [otherParticipantsLastRead, setOtherParticipantsLastRead] = useState<Date | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [chatParticipants, setChatParticipants] = useState<Array<{id: string; name: string}>>([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Filter participants based on mention query
  const filteredParticipants = chatParticipants.filter(p => 
    p.name.toLowerCase().includes(mentionQuery.toLowerCase()) &&
    p.id !== user?.id // Don't suggest self
  );
  
  // Handle input change for mention detection
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setNewMessage(value);
    
    // Find if we're typing a mention
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Check if there's no space after @ (still typing the mention)
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
  
  // Insert mention into input
  const insertMention = (participant: {id: string; name: string}) => {
    const beforeMention = newMessage.substring(0, mentionStartIndex);
    const afterMention = newMessage.substring(mentionStartIndex + mentionQuery.length + 1);
    const newText = `${beforeMention}@${participant.name} ${afterMention}`;
    setNewMessage(newText);
    setShowMentionSuggestions(false);
    setMentionQuery('');
    inputRef.current?.focus();
  };
  
  // Handle reply to a message
  const handleReply = (message: Message) => {
    setReplyingTo(message);
    inputRef.current?.focus();
  };
  
  // Cancel reply
  const cancelReply = () => {
    setReplyingTo(null);
  };
  
  // Function to check if a message has been read by the other participant(s)
  const isMessageRead = (messageCreatedAt: string): boolean => {
    if (!otherParticipantsLastRead) return false;
    return new Date(messageCreatedAt) <= otherParticipantsLastRead;
  };

  // Load participants to track read status and for mentions
  const loadParticipants = async () => {
    const { data: participants } = await getChatParticipants(chat.id);
    if (participants && user) {
      // Save participants for mentions (excluding self)
      const mentionableUsers = participants
        .filter(p => p.user_id !== user.id)
        .map(p => ({
          id: p.user_id,
          name: (p.profile as any)?.full_name || `User ${p.user_id.slice(0, 6)}`
        }));
      setChatParticipants(mentionableUsers);
      
      // Get the latest last_read_at from other participants
      const otherParticipants = participants.filter(p => p.user_id !== user.id);
      if (otherParticipants.length > 0) {
        // For direct chats, use the single other participant's last_read_at
        // For group chats, use the earliest (least recent) to show "all have read"
        const lastReadDates = otherParticipants
          .map(p => p.last_read_at ? new Date(p.last_read_at) : null)
          .filter((d): d is Date => d !== null);

        if (lastReadDates.length > 0) {
          // Use the minimum date (earliest read) for groups, or single date for direct
          const minLastRead = new Date(Math.min(...lastReadDates.map(d => d.getTime())));
          setOtherParticipantsLastRead(minLastRead);
        }
      }
    }
  };

  useEffect(() => {
    // Mark this chat as active (prevents notifications while viewing)
    setActiveChat(chat.id);
    
    loadMessages();
    loadParticipants();
    markChatAsRead(chat.id);
    
    // Also mark any in-app notifications for this chat as read
    markChatNotificationsAsRead(chat.id);
    
    // Subscribe to new messages via realtime
    const unsubscribe = subscribeToChat(chat.id, (message) => {
      console.log('[ChatDetail] Realtime message received:', message.id);
      setMessages(prev => {
        // Check if this message already exists (avoid duplicates from optimistic updates)
        const exists = prev.some(m => m.id === message.id);
        if (exists) return prev;
        
        // Remove any optimistic messages with temp IDs and add the real one
        const filtered = prev.filter(m => !m.id.startsWith('temp-'));
        return [...filtered, message];
      });
      
      // Mark any new notifications for this chat as read (since user is viewing live)
      markChatNotificationsAsRead(chat.id);
    });

    // Polling fallback - reload messages and participants every 3 seconds
    const pollInterval = setInterval(async () => {
      const { data } = await getMessages(chat.id, { limit: 50 });
      if (data) {
        setMessages(prev => {
          // Merge new messages, keeping optimistic ones
          const optimistic = prev.filter(m => m.id.startsWith('temp-'));
          const newMessages = data.filter(d => !optimistic.some(o => o.content === d.content));
          return [...newMessages, ...optimistic];
        });
      }
      // Also refresh participants to update read status
      loadParticipants();
    }, 3000);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
      // Clear active chat when closing
      setActiveChat(null);
    };
  }, [chat.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    setLoading(true);
    console.log('[ChatDetail] Loading messages for chat:', chat.id);
    const { data, error } = await getMessages(chat.id, { limit: 50 });
    console.log('[ChatDetail] Messages loaded:', data?.length, 'Error:', error);
    if (data) {
      setMessages(data);
    }
    setLoading(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    
    // Validate chat ID
    if (!chat.id || chat.id === 'undefined' || chat.id === 'null') {
      console.error('Invalid chat ID:', chat.id);
      alert('Cannot send message: Invalid chat');
      return;
    }
    
    setSending(true);
    const messageText = newMessage.trim();
    const replyToMessage = replyingTo;
    setNewMessage('');
    setReplyingTo(null); // Clear reply state
    
    // Optimistically add message
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
      sender: {
        id: user?.id || '',
        full_name: 'You',
      }
    };
    setMessages(prev => [...prev, optimisticMessage]);
    
    // Pass replyToId to sendMessage
    const { data, error } = await sendMessage(
      chat.id, 
      messageText, 
      'text', 
      replyToMessage?.id
    );
    
    if (error) {
      console.error('Error sending message:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
      setNewMessage(messageText); // Restore message
      setReplyingTo(replyToMessage); // Restore reply
      alert('Failed to send message. Please try again.');
    } else if (data) {
      // Replace optimistic message with real one
      setMessages(prev => prev.map(m => 
        m.id === optimisticMessage.id ? data : m
      ));
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

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
      className="fixed inset-0 z-[80] bg-[#E6E5E1] flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Header */}
      <div className="bg-white p-4 flex items-center gap-4 border-b border-black/5">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-black" />
        </button>

        <div className="flex-1 flex items-center gap-3">
          <div className="relative">
            {chat.type === 'direct' && (
              <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center text-[#D5FB46] font-bold text-sm">
                {chat.initials}
              </div>
            )}
            {chat.type === 'band' && (
              <div className="w-12 h-12 rounded-xl bg-[#D5FB46] flex items-center justify-center text-black font-black text-sm">
                {chat.initials}
              </div>
            )}
            {chat.type === 'event' && (
              <div className="w-12 h-12 rounded-xl bg-[#0147FF] flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[16px] text-black truncate uppercase">{chat.name}</h3>
            <span className="text-[10px] font-bold text-black/40 uppercase tracking-wide">
              {chat.type === 'direct' ? 'DIRECT MESSAGE' : 
               chat.type === 'band' ? `${chat.members || 0} MEMBERS` : 
               'EVENT CHAT'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {chat.type === 'direct' && (
            <>
              <button className="w-10 h-10 rounded-full hover:bg-black/5 flex items-center justify-center transition-colors">
                <Phone className="w-5 h-5 text-black/40" />
              </button>
              <button className="w-10 h-10 rounded-full hover:bg-black/5 flex items-center justify-center transition-colors">
                <Video className="w-5 h-5 text-black/40" />
              </button>
            </>
          )}
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="w-10 h-10 rounded-full hover:bg-black/5 flex items-center justify-center transition-colors relative"
          >
            <MoreVertical className="w-5 h-5 text-black/40" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-black/20" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-full bg-black/5 flex items-center justify-center mb-4">
              {chat.type === 'direct' ? <User className="w-8 h-8 text-black/20" /> :
               chat.type === 'band' ? <Music2 className="w-8 h-8 text-black/20" /> :
               <Calendar className="w-8 h-8 text-black/20" />}
            </div>
            <h4 className="font-bold text-[16px] text-black uppercase mb-1">NO MESSAGES YET</h4>
            <p className="text-[12px] font-medium text-black/40 uppercase max-w-[200px]">
              START THE CONVERSATION
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {messageGroups.map((group, groupIndex) => (
              <div key={groupIndex}>
                {/* Date Separator */}
                <div className="flex items-center justify-center mb-4">
                  <span className="px-3 py-1 bg-black/10 rounded-full text-[10px] font-bold text-black/40 uppercase">
                    {formatDate(group.date)}
                  </span>
                </div>

                {/* Messages */}
                <div className="space-y-2">
                  {group.messages.map((message) => {
                    const isMe = message.sender_id === user?.id;
                    const replyTo = message.reply_to;
                    
                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "flex group",
                          isMe ? "justify-end" : "justify-start"
                        )}
                      >
                        {!isMe && (
                          <button
                            onClick={() => handleReply(message)}
                            className="opacity-0 group-hover:opacity-100 mr-2 self-center p-1.5 rounded-full hover:bg-black/10 transition-all"
                          >
                            <Reply className="w-4 h-4 text-black/30" />
                          </button>
                        )}
                        
                        <div className={cn(
                          "max-w-[75%] rounded-2xl px-4 py-3",
                          isMe 
                            ? "bg-[#1A1A1A] text-white rounded-br-md" 
                            : "bg-white text-[#1A1A1A] rounded-bl-md shadow-sm"
                        )}>
                          {/* Quoted message */}
                          {replyTo && (
                            <div className={cn(
                              "mb-2 p-2 rounded-lg border-l-2",
                              isMe 
                                ? "bg-white/10 border-[#D5FB46]" 
                                : "bg-black/5 border-black"
                            )}>
                              <p className={cn(
                                "text-[10px] font-bold mb-0.5",
                                isMe ? "text-[#D5FB46]" : "text-black"
                              )}>
                                {replyTo.sender?.full_name || 'Messaggio'}
                              </p>
                              <p className={cn(
                                "text-xs line-clamp-2",
                                isMe ? "text-white/70" : "text-black/50"
                              )}>
                                {replyTo.content}
                              </p>
                            </div>
                          )}
                          
                          {/* Sender name ONLY for group chats (band/event), never for direct 1:1 */}
                          {!isMe && (chat.type === 'band' || chat.type === 'event') && (
                            <div className="flex items-center gap-2 mb-1.5">
                              <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center text-[#D5FB46] text-[8px] font-bold">
                                {(message.sender?.full_name || 'U').charAt(0).toUpperCase()}
                              </div>
                              <span className="text-xs font-bold text-black uppercase">
                                {message.sender?.full_name || 'Member'}
                              </span>
                            </div>
                          )}
                          
                          <p className="text-sm leading-relaxed">{renderMessageContent(message.content, isMe)}</p>
                          
                          <div className={cn(
                            "flex items-center justify-end gap-1 mt-1",
                            isMe ? "text-white/50" : "text-black/30"
                          )}>
                            <span className="text-[10px]">{formatTime(message.created_at)}</span>
                            {isMe && (
                              <>
                                {message.id.startsWith('temp-') ? (
                                  // Sending - show single check faded
                                  <Check className="w-3 h-3 opacity-50" />
                                ) : isMessageRead(message.created_at) ? (
                                  // Read - show double check blue
                                  <CheckCheck className="w-3 h-3 text-blue-400" />
                                ) : (
                                  // Sent but not read - show double check white/gray
                                  <CheckCheck className="w-3 h-3" />
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        
                        {isMe && (
                          <button
                            onClick={() => handleReply(message)}
                            className="opacity-0 group-hover:opacity-100 ml-2 self-center p-1.5 rounded-full hover:bg-black/10 transition-all"
                          >
                            <Reply className="w-4 h-4 text-black/30" />
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div 
        className="bg-white border-t border-black/5 flex-shrink-0"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
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
              <div className="px-4 pt-3 flex items-start gap-3">
                <div className="flex-1 bg-black/5 rounded-lg p-3 border-l-2 border-black">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-black uppercase">
                      Replying to {replyingTo.sender?.full_name || 'message'}
                    </span>
                    <button
                      onClick={cancelReply}
                      className="p-1 hover:bg-black/10 rounded-full transition-colors"
                    >
                      <X className="w-3.5 h-3.5 text-black/40" />
                    </button>
                  </div>
                  <p className="text-xs text-black/50 line-clamp-2">{replyingTo.content}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="p-4 flex items-center gap-3">
          <button className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10 transition-colors">
            <Paperclip className="w-5 h-5 text-black/40" />
          </button>
          
          <div className="flex-1 relative">
            <AnimatePresence>
              {showMentionSuggestions && filteredParticipants.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-[10px] shadow-lg border border-black/5 max-h-40 overflow-y-auto z-10"
                >
                  {filteredParticipants.map((participant) => (
                    <button
                      key={participant.id}
                      onClick={() => insertMention(participant)}
                      className="w-full px-4 py-3 text-left hover:bg-black/[0.03] flex items-center gap-3 transition-colors first:rounded-t-[10px] last:rounded-b-[10px]"
                    >
                      <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-[#D5FB46] text-xs font-bold">
                        {participant.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-bold text-black text-[12px] uppercase">{participant.name}</span>
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
                if (e.key === 'Escape') {
                  setShowMentionSuggestions(false);
                } else if (e.key === 'Enter' && !showMentionSuggestions) {
                  handleSend();
                } else if (e.key === 'Enter' && showMentionSuggestions && filteredParticipants.length > 0) {
                  e.preventDefault();
                  insertMention(filteredParticipants[0]);
                }
              }}
              placeholder={replyingTo ? "Reply..." : "Type @ to mention someone..."}
              className="w-full h-12 px-4 rounded-full bg-black/[0.06] text-black font-medium placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-[#D5FB46]"
            />
          </div>
          
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center transition-all",
              newMessage.trim() 
                ? "bg-black text-[#D5FB46] hover:scale-105" 
                : "bg-black/5 text-black/30"
            )}
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ChatDetailModal;
