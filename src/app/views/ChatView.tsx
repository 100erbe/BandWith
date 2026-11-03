import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  User, 
  Users,
  Calendar,
  Music2, 
  Calendar as CalendarIcon,
  Plus,
  MessageSquare,
  X,
  Loader2,
  Check,
  CheckCheck,
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { ChatItem, ChatFilterType, toTitleCase } from '@/app/data/chats';
import { searchChatsAndMessages, SearchResult } from '@/lib/services/chats';

interface ChatViewProps {
  chatFilter: ChatFilterType;
  setChatFilter: (filter: ChatFilterType) => void;
  chatSearch: string;
  setChatSearch: (search: string) => void;
  filteredChats: ChatItem[];
  unreadCounts?: { all: number; direct: number; band: number; event: number };
  onChatClick?: (chat: ChatItem) => void;
  onStartChat?: () => void;
}

const FILTERS = [
  { key: 'all' as const, label: 'ALL' },
  { key: 'direct' as const, label: 'DIRECT' },
  { key: 'band' as const, label: 'BANDS' },
  { key: 'event' as const, label: 'EVENTS' },
];

export const ChatView: React.FC<ChatViewProps> = ({
  chatFilter,
  setChatFilter,
  chatSearch,
  setChatSearch,
  filteredChats,
  unreadCounts = { all: 0, direct: 0, band: 0, event: 0 },
  onChatClick,
  onStartChat
}) => {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  useEffect(() => {
    if (chatSearch.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    
    const timer = setTimeout(async () => {
      setIsSearching(true);
      const { data } = await searchChatsAndMessages(chatSearch, 15);
      setSearchResults(data || []);
      setShowSearchResults(true);
      setIsSearching(false);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [chatSearch]);
  
  const handleSearchResultClick = (result: SearchResult) => {
    const chatItem: ChatItem = {
      id: Date.now(),
      uuid: result.chat_id,
      type: (result.chat_type === 'group' ? 'band' : result.chat_type) || 'direct' as any,
      name: result.chat_name || 'Chat',
      initials: (result.chat_name || 'C').substring(0, 2).toUpperCase(),
      lastMessage: result.message_content || '',
      time: '',
      unread: 0,
      status: 'read',
    };
    onChatClick?.(chatItem);
    setChatSearch('');
    setShowSearchResults(false);
  };
  
  const formatResultDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const totalUnread = unreadCounts.direct + unreadCounts.band + unreadCounts.event;

  return (
    <motion.div 
      key="chat"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="flex flex-col gap-8 relative z-10 pb-44 min-h-[50vh]"
    >
      {/* ═══ HEADER ═══ */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-foreground/60 uppercase leading-none">
            MESSAGES
          </span>
          <h1 className="text-3xl font-black text-foreground uppercase leading-none">
            INBOX
          </h1>
        </div>
        <button
          onClick={() => onStartChat?.()}
          aria-label="New chat"
          className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs hover:opacity-95 active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5 text-primary-foreground" />
        </button>
      </div>

      {/* ═══ FILTER PILLS ═══ */}
      <div className="flex gap-2.5 items-center">
        {FILTERS.map(({ key, label }) => {
          const count = unreadCounts[key];
          const isActive = chatFilter === key;
          return (
            <button
              key={key}
              onClick={() => setChatFilter(key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5",
                isActive
                  ? "bg-card text-foreground font-bold shadow-xs border border-foreground/15"
                  : "bg-foreground/5 text-foreground/60 hover:text-foreground font-medium border border-transparent"
              )}
            >
              {label}
              {count > 0 && (
                <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-4 text-center">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═══ SEARCH ═══ */}
      <div className="relative">
        <div className="bg-foreground/5 border border-foreground/10 rounded-xl flex items-center px-3 gap-2">
          {isSearching ? (
            <Loader2 className="w-4 h-4 text-foreground/40 animate-spin shrink-0" />
          ) : (
            <Search className="w-4 h-4 text-foreground/40 shrink-0" />
          )}
          <input 
            type="text" 
            placeholder="SEARCH CHATS..."
            value={chatSearch}
            onChange={(e) => setChatSearch(e.target.value)}
            onFocus={() => chatSearch.length >= 2 && setShowSearchResults(true)}
            className="w-full h-10 bg-transparent text-xs font-bold text-foreground placeholder:text-foreground/35 uppercase focus:outline-none" 
          />
          {chatSearch && (
            <button
              onClick={() => {
                setChatSearch('');
                setShowSearchResults(false);
              }}
              aria-label="Clear search"
              className="p-1 hover:bg-foreground/10 rounded-full shrink-0"
            >
              <X className="w-3.5 h-3.5 text-foreground/40" />
            </button>
          )}
        </div>
        
        {/* Search Results Dropdown */}
        <AnimatePresence>
          {showSearchResults && searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-2 bg-card text-card-foreground rounded-xl shadow-xl border border-border max-h-80 overflow-y-auto z-50 divide-y divide-border"
            >
              {['chat', 'participant', 'message'].map(type => {
                const typeResults = searchResults.filter(r => r.type === type);
                if (typeResults.length === 0) return null;
                
                return (
                  <div key={type}>
                    <div className="px-3 py-2 bg-muted/40 text-[10px] font-bold uppercase tracking-widest text-muted-foreground sticky top-0 backdrop-blur-xs">
                      {type === 'chat' ? 'CHATS' : type === 'participant' ? 'PEOPLE' : 'MESSAGES'}
                    </div>
                    {typeResults.map((result, i) => (
                      <button
                        key={`${result.chat_id}-${result.message_id || i}`}
                        onClick={() => handleSearchResultClick(result)}
                        className="w-full px-3 py-2.5 text-left hover:bg-foreground/5 flex items-center gap-2.5 transition-colors"
                      >
                        <div className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
                          result.type === 'message' ? "bg-accent-rehearsal/15 text-accent-rehearsal" :
                          result.chat_type === 'band' ? "bg-accent/15 text-accent" :
                          result.chat_type === 'event' ? "bg-accent-gig/15 text-accent-gig" :
                          "bg-primary/15 text-primary"
                        )}>
                          {result.type === 'message' ? (
                            <MessageSquare className="w-4 h-4 text-accent-rehearsal" />
                          ) : result.chat_type === 'band' ? (
                            <Music2 className="w-4 h-4 text-accent" />
                          ) : result.chat_type === 'event' ? (
                            <CalendarIcon className="w-4 h-4 text-accent-gig" />
                          ) : (
                            <User className="w-4 h-4 text-primary" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-foreground truncate uppercase">
                              {result.type === 'participant' ? result.participant_name : result.chat_name}
                            </span>
                            {result.message_date && (
                              <span className="text-[10px] text-foreground/40 font-bold shrink-0 ml-2 uppercase">
                                {formatResultDate(result.message_date)}
                              </span>
                            )}
                          </div>
                          {result.type === 'message' && result.message_content && (
                            <p className="text-xs text-foreground/60 truncate mt-0.5 font-medium">
                              <span className="font-bold text-foreground/80">{result.message_sender}:</span> {result.message_content}
                            </p>
                          )}
                          {result.type === 'participant' && (
                            <p className="text-xs text-foreground/50 truncate mt-0.5 font-medium">
                              in {result.chat_name}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ CHAT LIST (WhatsApp-style rows) ═══ */}
      <div className="flex flex-col -mt-4 divide-y divide-foreground/5">
        {filteredChats.length > 0 ? (
          filteredChats.map((chat, i) => (
            <motion.div 
              key={chat.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => onChatClick?.(chat)}
              className="hover:bg-foreground/5 active:bg-foreground/10 rounded-xl px-2 py-3 cursor-pointer transition-colors active:scale-[0.99] flex items-center gap-3.5"
            >
              {/* Far Left: Icon (User avatar, Band or Event) */}
              <div className="relative shrink-0">
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden",
                  chat.type === 'band' ? "bg-accent-rehearsal/15 text-accent-rehearsal" :
                  chat.type === 'event' ? "bg-accent-gig/15 text-accent-gig" :
                  "bg-primary/10 text-primary"
                )}>
                  {chat.avatarUrl && (chat.type === 'direct' || chat.type === 'band') ? (
                    <img
                      src={chat.avatarUrl}
                      alt={chat.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : chat.type === 'band' ? (
                    <Users className="w-5 h-5" />
                  ) : chat.type === 'event' ? (
                    <Calendar className="w-5 h-5" />
                  ) : (
                    <span>{chat.initials}</span>
                  )}
                </div>
                {chat.isOnline && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-background" />
                )}
              </div>

              {/* Rows */}
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                {/* Top Row: Left = bold title in title case, Right = timestamp */}
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-sm sm:text-base text-foreground truncate leading-snug">
                    {toTitleCase(chat.name)}
                  </h3>
                  <span className="text-xs font-medium text-foreground/45 whitespace-nowrap shrink-0">
                    {chat.time || 'now'}
                  </span>
                </div>

                {/* Bottom Row: Left = last message, Right = badge with unread number of messages if needed */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {chat.isLastMessageMine && (
                      chat.isLastMessageRead ? (
                        <CheckCheck className="w-3.5 h-3.5 text-sky-500 shrink-0 inline" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-foreground/40 shrink-0 inline" />
                      )
                    )}
                    <p className="text-xs text-foreground/60 truncate font-normal">
                      {chat.lastMessage || 'No messages yet'}
                    </p>
                  </div>

                  {chat.unread > 0 && (
                    <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-4 text-center leading-none shrink-0">
                      {chat.unread > 99 ? '99+' : chat.unread}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Bottom clearance spacer ensuring last chat clears floating navbar */}
      <div className="h-12 shrink-0 pointer-events-none" aria-hidden="true" />
    </motion.div>
  );
};
