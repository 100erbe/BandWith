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
}

const FILTERS = [
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
  unreadCounts = { direct: 0, band: 0, event: 0 },
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
      className="flex flex-col gap-[40px] relative z-10 pb-44 min-h-[50vh]"
    >
      {/* ═══ HEADER ═══ */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-[4px]">
          <span className="text-[12px] font-bold text-foreground/60 uppercase leading-none">
            MESSAGES
          </span>
          <h1 className="text-[32px] font-bold text-foreground uppercase leading-none">
            INBOX
          </h1>
        </div>
        <button
          onClick={() => onStartChat?.()}
          className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs hover:opacity-95 active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5 text-primary-foreground" />
        </button>
      </div>

      {/* ═══ FILTER PILLS ═══ */}
      <div className="flex gap-[10px] items-center -mt-[20px]">
        {FILTERS.map(({ key, label }) => {
          const count = unreadCounts[key];
          const isActive = chatFilter === key;
          return (
            <button
              key={key}
              onClick={() => setChatFilter(key)}
              className={cn(
                "px-[12px] py-[6px] rounded-[8px] text-[12px] whitespace-nowrap transition-all shrink-0 flex items-center gap-[6px]",
                isActive
                  ? "bg-card text-foreground font-bold shadow-xs border border-foreground/15"
                  : "bg-foreground/5 text-foreground/50 hover:text-foreground font-medium border border-transparent"
              )}
            >
              {label}
              {count > 0 && (
                <span className="bg-primary text-primary-foreground text-[10px] font-bold px-[5px] py-[1px] rounded-full min-w-[16px] text-center">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═══ SEARCH ═══ */}
      <div className="relative -mt-[20px]">
        <div className="bg-foreground/5 border border-foreground/10 rounded-[12px] flex items-center px-[12px] gap-[8px]">
          {isSearching ? (
            <Loader2 className="w-[16px] h-[16px] text-foreground/30 animate-spin shrink-0" />
          ) : (
            <Search className="w-[16px] h-[16px] text-foreground/30 shrink-0" />
          )}
          <input 
            type="text" 
            placeholder="SEARCH CHATS..."
            value={chatSearch}
            onChange={(e) => setChatSearch(e.target.value)}
            onFocus={() => chatSearch.length >= 2 && setShowSearchResults(true)}
            className="w-full h-[40px] bg-transparent text-[12px] font-bold text-foreground placeholder:text-foreground/30 uppercase focus:outline-none" 
          />
          {chatSearch && (
            <button
              onClick={() => {
                setChatSearch('');
                setShowSearchResults(false);
              }}
              className="p-[4px] hover:bg-foreground/10 rounded-full shrink-0"
            >
              <X className="w-[14px] h-[14px] text-foreground/30" />
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
              className="absolute top-full left-0 right-0 mt-[8px] bg-white rounded-[10px] shadow-xl border border-black/5 max-h-80 overflow-y-auto z-50"
            >
              {['chat', 'participant', 'message'].map(type => {
                const typeResults = searchResults.filter(r => r.type === type);
                if (typeResults.length === 0) return null;
                
                return (
                  <div key={type}>
                    <div className="px-[12px] py-[8px] bg-black/[0.03] text-[10px] font-bold uppercase tracking-widest text-foreground/30 sticky top-0">
                      {type === 'chat' ? 'CHATS' : type === 'participant' ? 'PEOPLE' : 'MESSAGES'}
                    </div>
                    {typeResults.map((result, i) => (
                      <button
                        key={`${result.chat_id}-${result.message_id || i}`}
                        onClick={() => handleSearchResultClick(result)}
                        className="w-full px-[12px] py-[10px] text-left hover:bg-black/[0.03] flex items-center gap-[10px] transition-colors"
                      >
                        <div className={cn(
                          "w-[36px] h-[36px] rounded-full flex items-center justify-center shrink-0",
                          result.type === 'message' ? "bg-accent-rehearsal/10" :
                          result.chat_type === 'band' ? "bg-accent" :
                          result.chat_type === 'event' ? "bg-black/10" :
                          "bg-black"
                        )}>
                          {result.type === 'message' ? (
                            <MessageSquare className="w-[14px] h-[14px] text-accent-rehearsal" />
                          ) : result.chat_type === 'band' ? (
                            <Music2 className="w-[14px] h-[14px] text-black" />
                          ) : result.chat_type === 'event' ? (
                            <CalendarIcon className="w-[14px] h-[14px] text-foreground/60" />
                          ) : (
                            <User className="w-[14px] h-[14px] text-white" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[12px] text-black truncate uppercase">
                              {result.type === 'participant' ? result.participant_name : result.chat_name}
                            </span>
                            {result.message_date && (
                              <span className="text-[10px] text-foreground/30 font-bold shrink-0 ml-[8px] uppercase">
                                {formatResultDate(result.message_date)}
                              </span>
                            )}
                          </div>
                          {result.type === 'message' && result.message_content && (
                            <p className="text-[11px] text-foreground/50 truncate mt-[2px] font-medium">
                              <span className="font-bold">{result.message_sender}:</span> {result.message_content}
                            </p>
                          )}
                          {result.type === 'participant' && (
                            <p className="text-[11px] text-foreground/50 truncate mt-[2px] font-medium">
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

      {/* ═══ LIST HEADER ═══ */}
      <div className="flex flex-col gap-[4px] -mt-[20px]">
        <span className="text-[12px] font-bold text-foreground/60 uppercase leading-none">
          {chatFilter === 'direct' ? 'DIRECT' : chatFilter === 'band' ? 'BANDS' : 'EVENTS'}
        </span>
        <h2 className="text-[32px] font-bold text-foreground uppercase leading-none">
          {filteredChats.length > 0 ? 'RECENT' : 'EMPTY'}
        </h2>
      </div>

      {/* ═══ CHAT LIST ═══ */}
      <div className="flex flex-col gap-[14px] -mt-[20px]">
        {filteredChats.length > 0 ? (
          filteredChats.map((chat, i) => (
            <motion.div 
              key={chat.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => onChatClick?.(chat)}
              className="bg-card rounded-[16px] border border-foreground/10 p-[18px] cursor-pointer flex flex-col gap-[14px] overflow-hidden active:scale-[0.99] hover:border-foreground/20 hover:shadow-xs transition-all"
            >
              {/* ── Top: Info + Icons ── */}
              <div className="flex gap-[20px] items-start">
                {/* Left: Pills + Name + Preview */}
                <div className="flex-1 flex flex-col gap-[8px] min-w-0">
                  <div className="flex flex-col gap-[4px]">
                    {/* Pills row */}
                    <div className="flex flex-wrap gap-[6px]">
                      {chat.type === 'direct' && (
                        <>
                          <div className="inline-flex items-center justify-center rounded-[8px] px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 text-[11px] font-bold uppercase tracking-wider">
                            <span>DM</span>
                          </div>
                          {chat.bandName && (
                            <div className="inline-flex items-center justify-center rounded-[8px] px-2.5 py-0.5 bg-foreground/8 text-foreground/80 border border-foreground/10 text-[11px] font-bold uppercase tracking-wider">
                              <span>{chat.bandName}</span>
                            </div>
                          )}
                        </>
                      )}
                      {chat.type === 'band' && (
                        <>
                          <div className="inline-flex items-center justify-center rounded-[8px] px-2.5 py-0.5 bg-accent-rehearsal/10 text-accent-rehearsal border border-accent-rehearsal/20 text-[11px] font-bold uppercase tracking-wider">
                            <span>BM</span>
                          </div>
                          {chat.senderName && (
                            <div className="inline-flex items-center justify-center rounded-[8px] px-2.5 py-0.5 bg-foreground/8 text-foreground/80 border border-foreground/10 text-[11px] font-bold uppercase tracking-wider">
                              <span>{chat.senderName}</span>
                            </div>
                          )}
                        </>
                      )}
                      {chat.type === 'event' && (
                        <>
                          <div className="inline-flex items-center justify-center rounded-[8px] px-2.5 py-0.5 bg-accent-gig/10 text-accent-gig border border-accent-gig/20 text-[11px] font-bold uppercase tracking-wider">
                            <span>EM</span>
                          </div>
                          <div className="inline-flex items-center justify-center rounded-[8px] px-2.5 py-0.5 bg-foreground/8 text-foreground/80 border border-foreground/10 text-[11px] font-bold uppercase tracking-wider">
                            <span>
                              {chat.eventType === 'rehearsal' ? 'REHEARSAL' : 'GIG'}
                            </span>
                          </div>
                          {chat.senderName && (
                            <div className="inline-flex items-center justify-center rounded-[8px] px-2.5 py-0.5 bg-foreground/8 text-foreground/80 border border-foreground/10 text-[11px] font-bold uppercase tracking-wider">
                              <span>{chat.senderName}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    {/* Name */}
                    <h3 className="text-[20px] font-bold text-foreground uppercase leading-tight truncate">
                      {chat.name}
                    </h3>
                  </div>
                  {/* Message preview */}
                  <p className="text-[12px] font-medium text-foreground/60 leading-snug line-clamp-2">
                    {chat.lastMessage || 'No messages yet'}
                  </p>
                </div>

                {/* Right: Icons + Timestamp */}
                <div className="flex flex-col items-end justify-between self-stretch shrink-0">
                  <div className="flex gap-[6px]">
                    {chat.isOnline ? (
                      <div className="w-9 h-9 rounded-full bg-[var(--success)]/15 border border-[var(--success)]/30 flex items-center justify-center text-[var(--success)]">
                        <PlugsConnectedIcon className="w-[18px] h-[18px]" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-foreground/8 border border-foreground/10 flex items-center justify-center text-foreground/40">
                        <PlugsDisconnectedIcon className="w-[18px] h-[18px]" />
                      </div>
                    )}
                    {/* Open chat arrow */}
                    <div className="w-9 h-9 rounded-full bg-foreground/8 hover:bg-foreground/12 flex items-center justify-center text-foreground transition-colors">
                      <ArrowUpRight className="w-5 h-5 text-foreground" />
                    </div>
                  </div>
                  {/* Timestamp */}
                  <div className="rounded-[8px] bg-foreground/6 border border-foreground/10 px-2.5 py-0.5">
                    <span className="text-[11px] font-bold text-foreground/60 whitespace-nowrap">
                      {chat.time || 'NOW'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Bottom: Unread / Read status ── */}
              <div className="flex items-center justify-between pt-2.5 border-t border-foreground/10">
                <span className="text-[11px] font-bold tracking-wider text-foreground/40 uppercase">
                  {chat.type === 'direct' ? 'Direct Message' : chat.type === 'band' ? 'Band Channel' : 'Event Channel'}
                </span>
                {chat.unread > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-foreground/70 uppercase">UNREAD</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[12px] font-black leading-tight shadow-xs">
                      {chat.unread}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-foreground/50">
                    <span className="text-[11px] font-bold uppercase">READ</span>
                    <ChecksIcon className="w-4 h-4 text-primary" />
                  </div>
                )}
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
