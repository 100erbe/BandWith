import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  User, 
  Music2, 
  Calendar as CalendarIcon,
  Plus,
  MessageSquare,
  X,
  Loader2,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { PlugsConnectedIcon, PlugsDisconnectedIcon, ChecksIcon } from '@/app/components/ui/ConnectionIcons';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { ChatItem, ChatType } from '@/app/data/chats';
import { searchChatsAndMessages, SearchResult } from '@/lib/services/chats';

interface ChatViewProps {
  chatFilter: ChatType;
  setChatFilter: (filter: ChatType) => void;
  chatSearch: string;
  setChatSearch: (search: string) => void;
  filteredChats: ChatItem[];
  unreadCounts?: { direct: number; band: number; event: number };
  onChatClick?: (chat: ChatItem) => void;
  onStartChat?: () => void;
  onStartDirectChat?: (member: { userId: string; bandId: string; name: string }) => void;
}

const FILTERS = [
  { key: 'direct' as const, label: 'DIRECT' },
  { key: 'band' as const, label: 'BANDS' },
  { key: 'event' as const, label: 'EVENTS' },
];

const getChatIdentifiers = (chat: ChatItem): string[] => {
  const ids: string[] = [];
  if (chat.type === 'direct') {
    ids.push('DM');
    if (chat.bandName) ids.push(chat.bandName);
  } else if (chat.type === 'band') {
    ids.push('BAND');
    if (chat.senderName) ids.push(chat.senderName);
  } else if (chat.type === 'event') {
    ids.push('EVENT');
    ids.push(chat.eventType === 'rehearsal' ? 'REHEARSAL' : 'GIG');
    if (chat.senderName) ids.push(chat.senderName);
  }
  return ids;
};

export const ChatView: React.FC<ChatViewProps> = ({
  chatFilter,
  setChatFilter,
  chatSearch,
  setChatSearch,
  filteredChats,
  unreadCounts = { direct: 0, band: 0, event: 0 },
  onChatClick,
  onStartChat,
  onStartDirectChat
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
    // Band member (people) without an existing chat → start a direct chat
    if (result.type === 'participant' && result.member_id && !result.chat_id) {
      onStartDirectChat?.({
        userId: result.member_id,
        bandId: result.band_id || '',
        name: result.participant_name || '',
      });
      setChatSearch('');
      setShowSearchResults(false);
      return;
    }

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
      className="flex flex-col gap-10 relative z-10 pb-32 min-h-[50vh]"
    >
      {/* ═══ HEADER ═══ */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-muted-foreground uppercase leading-tight">
            MESSAGES
          </span>
          <h1 className="text-3xl font-bold text-foreground uppercase leading-tight">
            INBOX
          </h1>
        </div>
        <button
          onClick={() => onStartChat?.()}
          className="bg-surface-inverse rounded-full p-[5.7px]"
        >
          <Plus className="w-7 h-7 text-accent" />
        </button>
      </div>

      {/* ═══ FILTER PILLS ═══ */}
      <div className="flex gap-3 items-center -mt-5">
        {FILTERS.map(({ key, label }) => {
          const count = unreadCounts[key];
          return (
            <button
              key={key}
              onClick={() => setChatFilter(key)}
              className={cn(
                "px-4 py-2 rounded-full text-xs whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5",
                chatFilter === key
                  ? "bg-foreground text-background font-bold"
                  : "bg-muted text-muted-foreground font-medium"
              )}
            >
              {label}
              {count > 0 && (
                <span className="bg-accent text-accent-foreground text-xs font-bold px-1.5 py-px rounded-full min-w-4 text-center">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═══ SEARCH ═══ */}
      <div className="relative -mt-5">
        <div className="bg-muted rounded-xl flex items-center px-3 gap-2">
          {isSearching ? (
            <Loader2 className="w-4 h-4 text-foreground/30 animate-spin shrink-0" />
          ) : (
            <Search className="w-4 h-4 text-foreground/30 shrink-0" />
          )}
          <input 
            type="text" 
            placeholder="SEARCH CHATS..."
            value={chatSearch}
            onChange={(e) => setChatSearch(e.target.value)}
            onFocus={() => chatSearch.length >= 2 && setShowSearchResults(true)}
            className="w-full h-10 bg-transparent text-xs font-bold text-foreground placeholder:text-foreground/30 uppercase focus:outline-none" 
          />
          {chatSearch && (
            <button
              onClick={() => {
                setChatSearch('');
                setShowSearchResults(false);
              }}
              className="p-1 hover:bg-muted rounded-full shrink-0"
            >
              <X className="w-3.5 h-3.5 text-foreground/30" />
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
              className="absolute top-full left-0 right-0 mt-2 bg-popover rounded-xl shadow-xl border border-border/40 max-h-80 overflow-y-auto z-50"
            >
              {['chat', 'participant', 'message'].map(type => {
                const typeResults = searchResults.filter(r => r.type === type);
                if (typeResults.length === 0) return null;
                
                return (
                  <div key={type}>
                    <div className="px-3 py-2 bg-muted/50 text-xs font-bold uppercase tracking-widest text-foreground/30 sticky top-0">
                      {type === 'chat' ? 'CHATS' : type === 'participant' ? 'PEOPLE' : 'MESSAGES'}
                    </div>
                    {typeResults.map((result, i) => (
                      <button
                        key={`${result.chat_id}-${result.message_id || i}`}
                        onClick={() => handleSearchResultClick(result)}
                        className="w-full px-3 py-2.5 text-left hover:bg-muted/50 flex items-center gap-2.5 transition-colors"
                      >
                        <div className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                          result.type === 'message' ? "bg-accent-rehearsal/10" :
                          result.chat_type === 'band' ? "bg-accent" :
                          result.chat_type === 'event' ? "bg-muted" :
                          "bg-surface-inverse"
                        )}>
                          {result.type === 'message' ? (
                            <MessageSquare className="w-3.5 h-3.5 text-accent-rehearsal" />
                          ) : result.chat_type === 'band' ? (
                            <Music2 className="w-3.5 h-3.5 text-accent-foreground" />
                          ) : result.chat_type === 'event' ? (
                            <CalendarIcon className="w-3.5 h-3.5 text-foreground/60" />
                          ) : (
                            <User className="w-3.5 h-3.5 text-surface-inverse-foreground" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-foreground truncate uppercase">
                              {result.type === 'participant' ? result.participant_name : result.chat_name}
                            </span>
                            {result.message_date && (
                              <span className="text-xs text-foreground/30 font-bold shrink-0 ml-2 uppercase">
                                {formatResultDate(result.message_date)}
                              </span>
                            )}
                          </div>
                          {result.type === 'message' && result.message_content && (
                            <p className="text-xs text-foreground/50 truncate mt-0.5 font-medium">
                              <span className="font-bold">{result.message_sender}:</span> {result.message_content}
                            </p>
                          )}
                          {result.type === 'participant' && (
                            <p className="text-xs text-foreground/50 truncate mt-0.5 font-medium">
                              {result.member_id ? 'BAND MEMBER' : `in ${result.chat_name}`}
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

      {/* ═══ LIST HEADER ═══ */}
      <div className="flex flex-col gap-1 -mt-5">
        <span className="text-xs font-bold text-muted-foreground uppercase leading-tight">
          {chatFilter === 'direct' ? 'DIRECT' : chatFilter === 'band' ? 'BANDS' : 'EVENTS'}
        </span>
        <h2 className="text-3xl font-bold text-foreground uppercase leading-tight">
          {filteredChats.length > 0 ? 'RECENT' : 'EMPTY'}
        </h2>
      </div>

      {/* ═══ CHAT LIST ═══ */}
      <div className="flex flex-col gap-4 -mt-5">
        {filteredChats.length > 0 ? (
          filteredChats.map((chat, i) => (
            <motion.div 
              key={chat.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => onChatClick?.(chat)}
              className="bg-card border border-border/40 rounded-2xl p-4 shadow-sm cursor-pointer flex flex-col gap-2.5 overflow-hidden active:scale-[0.98] transition-transform"
            >
              {/* Eyebrow identifiers */}
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {getChatIdentifiers(chat).join(' • ')}
              </span>

              {/* Name + right column */}
              <div className="flex items-start justify-between gap-6">
                {/* Left: name + preview */}
                <div className="flex-1 flex flex-col gap-2 min-w-0">
                  <h3 className="text-xl font-bold text-foreground uppercase leading-tight truncate">
                    {chat.senderName || chat.name}
                  </h3>
                  <p className="text-xs font-medium text-muted-foreground uppercase leading-snug line-clamp-2">
                    {chat.lastMessage || 'No messages yet'}
                  </p>
                </div>

                {/* Right: ghost icons + date + read receipt */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    {chat.isOnline ? (
                      <PlugsConnectedIcon className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                    ) : (
                      <PlugsDisconnectedIcon className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                    )}
                    <ArrowUpRight className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                      {chat.time || 'NOW'}
                    </span>
                    {chat.unread > 0 ? (
                      <span className="bg-accent text-accent-foreground text-xs font-bold px-1.5 py-px rounded-full min-w-4 text-center">
                        {chat.unread > 99 ? '99+' : chat.unread}
                      </span>
                    ) : (
                      <ChecksIcon className={cn("w-5 h-5", chat.status === 'read' ? "text-accent-gig" : "text-muted-foreground")} />
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <EmptyState />
        )}
      </div>
    </motion.div>
  );
};
