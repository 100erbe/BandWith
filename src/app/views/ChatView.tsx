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
      type: result.chat_type || 'direct',
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
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col gap-[40px] relative z-10 pb-32 min-h-[50vh]"
    >
      {/* ═══ HEADER ═══ */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-[4px]">
          <span className="text-[12px] font-bold text-black uppercase leading-none">
            MESSAGES
          </span>
          <h1 className="text-[32px] font-bold text-black uppercase leading-none">
            INBOX
          </h1>
        </div>
        <button
          onClick={() => onStartChat?.()}
          className="bg-black rounded-full p-[5.7px]"
        >
          <Plus className="w-[28px] h-[28px] text-[#D5FB46]" />
        </button>
      </div>

      {/* ═══ FILTER PILLS ═══ */}
      <div className="flex gap-[12px] items-center -mt-[20px]">
        {FILTERS.map(({ key, label }) => {
          const count = unreadCounts[key];
          return (
            <button
              key={key}
              onClick={() => setChatFilter(key)}
              className={cn(
                "px-[8px] py-[6px] rounded-[6px] text-[12px] whitespace-nowrap transition-all shrink-0 flex items-center gap-[6px]",
                chatFilter === key
                  ? "bg-white text-black font-bold"
                  : "bg-black/20 text-black/40 font-medium"
              )}
            >
              {label}
              {count > 0 && (
                <span className="bg-[#D5FB46] text-black text-[10px] font-bold px-[5px] py-[1px] rounded-full min-w-[16px] text-center">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═══ SEARCH ═══ */}
      <div className="relative -mt-[20px]">
        <div className="bg-black/[0.06] rounded-[10px] flex items-center px-[12px] gap-[8px]">
          {isSearching ? (
            <Loader2 className="w-[16px] h-[16px] text-black/30 animate-spin shrink-0" />
          ) : (
            <Search className="w-[16px] h-[16px] text-black/30 shrink-0" />
          )}
          <input 
            type="text" 
            placeholder="SEARCH CHATS..."
            value={chatSearch}
            onChange={(e) => setChatSearch(e.target.value)}
            onFocus={() => chatSearch.length >= 2 && setShowSearchResults(true)}
            className="w-full h-[40px] bg-transparent text-[12px] font-bold text-black placeholder:text-black/30 uppercase focus:outline-none" 
          />
          {chatSearch && (
            <button
              onClick={() => {
                setChatSearch('');
                setShowSearchResults(false);
              }}
              className="p-[4px] hover:bg-black/5 rounded-full shrink-0"
            >
              <X className="w-[14px] h-[14px] text-black/30" />
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
                    <div className="px-[12px] py-[8px] bg-black/[0.03] text-[10px] font-bold uppercase tracking-widest text-black/30 sticky top-0">
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
                          result.type === 'message' ? "bg-[#0147FF]/10" :
                          result.chat_type === 'band' ? "bg-[#D5FB46]" :
                          result.chat_type === 'event' ? "bg-black/10" :
                          "bg-black"
                        )}>
                          {result.type === 'message' ? (
                            <MessageSquare className="w-[14px] h-[14px] text-[#0147FF]" />
                          ) : result.chat_type === 'band' ? (
                            <Music2 className="w-[14px] h-[14px] text-black" />
                          ) : result.chat_type === 'event' ? (
                            <CalendarIcon className="w-[14px] h-[14px] text-black/60" />
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
                              <span className="text-[10px] text-black/30 font-bold shrink-0 ml-[8px] uppercase">
                                {formatResultDate(result.message_date)}
                              </span>
                            )}
                          </div>
                          {result.type === 'message' && result.message_content && (
                            <p className="text-[11px] text-black/50 truncate mt-[2px] font-medium">
                              <span className="font-bold">{result.message_sender}:</span> {result.message_content}
                            </p>
                          )}
                          {result.type === 'participant' && (
                            <p className="text-[11px] text-black/50 truncate mt-[2px] font-medium">
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
        <span className="text-[12px] font-bold text-black uppercase leading-none">
          {chatFilter === 'direct' ? 'DIRECT' : chatFilter === 'band' ? 'BANDS' : 'EVENTS'}
        </span>
        <h2 className="text-[32px] font-bold text-black uppercase leading-none">
          {filteredChats.length > 0 ? 'RECENT' : 'EMPTY'}
        </h2>
      </div>

      {/* ═══ CHAT LIST ═══ */}
      <div className="flex flex-col gap-[16px] -mt-[20px]">
        {filteredChats.length > 0 ? (
          filteredChats.map((chat, i) => (
            <motion.div 
              key={chat.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => onChatClick?.(chat)}
              className="bg-card rounded-[10px] p-[20px] cursor-pointer flex flex-col gap-[16px] overflow-hidden active:scale-[0.98] transition-transform"
            >
              {/* ── Top: Info + Icons ── */}
              <div className="flex gap-[30px] items-start">
                {/* Left: Pills + Name + Preview */}
                <div className="flex-1 flex flex-col gap-[8px] min-w-0">
                  <div className="flex flex-col gap-[4px]">
                    {/* Pills row */}
                    <div className="flex flex-wrap gap-[4px]">
                      {chat.type === 'direct' && (
                        <>
                          <div className="bg-black rounded-[6px] px-[10px] py-[4px]">
                            <span className="text-[12px] font-bold text-white uppercase">DM</span>
                          </div>
                          {chat.bandName && (
                            <div className="bg-black rounded-[6px] px-[10px] py-[4px]">
                              <span className="text-[12px] font-bold text-white uppercase">{chat.bandName}</span>
                            </div>
                          )}
                        </>
                      )}
                      {chat.type === 'band' && (
                        <>
                          <div className="bg-black rounded-[6px] px-[10px] py-[4px]">
                            <span className="text-[12px] font-bold text-white uppercase">BM</span>
                          </div>
                          {chat.senderName && (
                            <div className="bg-black rounded-[6px] px-[10px] py-[4px]">
                              <span className="text-[12px] font-bold text-white uppercase">{chat.senderName}</span>
                            </div>
                          )}
                        </>
                      )}
                      {chat.type === 'event' && (
                        <>
                          <div className="bg-black rounded-[6px] px-[10px] py-[4px]">
                            <span className="text-[12px] font-bold text-white uppercase">EM</span>
                          </div>
                          <div className="bg-black rounded-[6px] px-[10px] py-[4px]">
                            <span className="text-[12px] font-bold text-white uppercase">
                              {chat.eventType === 'rehearsal' ? 'REHEARSAL' : 'GIG'}
                            </span>
                          </div>
                          {chat.senderName && (
                            <div className="bg-black rounded-[6px] px-[10px] py-[4px]">
                              <span className="text-[12px] font-bold text-white uppercase">{chat.senderName}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    {/* Name */}
                    <h3 className="text-[22px] font-bold text-black uppercase leading-none truncate">
                      {chat.name}
                    </h3>
                  </div>
                  {/* Message preview */}
                  <p className="text-[12px] font-medium text-black/50 uppercase leading-snug line-clamp-2">
                    {chat.lastMessage || 'No messages yet'}
                  </p>
                </div>

                {/* Right: Icons + Timestamp */}
                <div className="flex flex-col items-end justify-between self-stretch shrink-0">
                  <div className="flex gap-[6px]">
                    {chat.isOnline ? (
                      <div className="bg-[#17c764] rounded-full p-[6px]">
                        <PlugsConnectedIcon className="w-[28px] h-[28px] text-black" />
                      </div>
                    ) : (
                      <div className="bg-[rgba(0,0,0,0.3)] rounded-full p-[6px]">
                        <PlugsDisconnectedIcon className="w-[28px] h-[28px] text-black" />
                      </div>
                    )}
                    {/* Open chat arrow */}
                    <div className="bg-black rounded-full p-[6px]">
                      <ArrowUpRight className="w-[28px] h-[28px] text-[#D5FB46]" />
                    </div>
                  </div>
                  {/* Timestamp */}
                  <div className="bg-black/20 rounded-[6px] px-[10px] py-[4px]">
                    <span className="text-[12px] font-bold text-black whitespace-nowrap">
                      {chat.time || 'NOW'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Bottom: Dots grid + Unread ── */}
              <div className="flex items-end justify-between">
                {/* Dot grid — 16 cols × 3 rows */}
                <div className="flex-1 max-w-[220px]">
                  <div
                    className="grid w-full gap-[4px]"
                    style={{
                      gridTemplateColumns: 'repeat(16, minmax(0, 1fr))',
                      gridTemplateRows: 'repeat(3, minmax(0, 1fr))',
                      height: 62,
                    }}
                  >
                    {Array.from({ length: 48 }).map((_, idx) => {
                      const unreadDots = chat.unread || 0;
                      const limeStart = 48 - unreadDots;
                      return (
                        <div
                          key={idx}
                          className="rounded-[10px]"
                          style={{
                            backgroundColor: idx >= limeStart ? '#D5FB46' : 'rgba(0,0,0,0.1)',
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
                {chat.unread > 0 ? (
                  <div className="flex flex-col items-end w-[50px] shrink-0">
                    <span className="text-[12px] font-bold text-black uppercase">UNREAD</span>
                    <span className="text-[42px] font-bold text-black leading-none">{chat.unread}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-end w-[48px] shrink-0">
                    <span className="text-[12px] font-bold text-black uppercase">READ</span>
                    <ChecksIcon className="w-[48px] h-[48px]" />
                  </div>
                )}
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
