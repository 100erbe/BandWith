import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  User, 
  Music2, 
  Calendar as CalendarIcon,
  CheckCheck,
  Check,
  Plus,
  MessageSquare,
  X,
  Loader2,
  ArrowUpRight
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
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
      <div className="flex flex-col gap-[40px] -mt-[20px]">
        {filteredChats.length > 0 ? (
          filteredChats.map((chat, i) => (
            <motion.div 
              key={chat.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => onChatClick?.(chat)}
              className="flex flex-col gap-[16px] cursor-pointer"
            >
              {/* Top row: Info + Arrow */}
              <div className="flex gap-[20px] items-start">
                {/* Left: Avatar + Name + Message */}
                <div className="flex-1 flex flex-col gap-[4px] min-w-0">
                  {/* Type Tag */}
                  <div className="flex gap-[4px] items-center">
                    <div className={cn(
                      "rounded-[6px] px-[10px] py-[4px]",
                      chat.type === 'direct' ? "bg-black text-white" :
                      chat.type === 'band' ? "bg-[#D5FB46] text-black" :
                      "bg-[#0147FF] text-white"
                    )}>
                      <span className="text-[12px] font-bold uppercase">
                        {chat.type === 'direct' ? 'DM' : chat.type === 'band' ? 'BAND' : 'EVENT'}
                      </span>
                    </div>
                    {chat.unread > 0 && (
                      <div className="bg-[#D5FB46] rounded-[6px] px-[10px] py-[4px]">
                        <span className="text-[12px] font-bold text-black">
                          {chat.unread} NEW
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <h3 className="text-[32px] font-bold text-black uppercase leading-none truncate">
                    {chat.name}
                  </h3>

                  {/* Last Message */}
                  <div className="flex flex-col gap-[2px]">
                    <p className={cn(
                      "text-[12px] font-medium uppercase truncate",
                      chat.unread > 0 ? "text-black" : "text-black/50"
                    )}>
                      {chat.lastMessage || 'No messages yet'}
                    </p>
                    {chat.subtitle && (
                      <span className="text-[12px] font-medium text-black/30 uppercase">
                        {chat.subtitle}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Arrow + Time */}
                <div className="flex flex-col items-end justify-between self-stretch shrink-0">
                  <div className={cn(
                    "rounded-full p-[5.7px]",
                    chat.type === 'band' ? "bg-[#D5FB46]" : "bg-black"
                  )}>
                    <ArrowUpRight className={cn(
                      "w-[28px] h-[28px]",
                      chat.type === 'band' ? "text-black" : "text-[#D5FB46]"
                    )} />
                  </div>
                  <div className="bg-black/10 rounded-[10px] px-[10px] py-[10px]">
                    <span className="text-[12px] font-bold text-black uppercase whitespace-nowrap">
                      {chat.time || 'NOW'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom: Stats */}
              <div className="flex gap-[20px] items-end">
                {/* Members dot grid */}
                <div className="w-[169px] flex flex-col gap-[10px] shrink-0">
                  <div
                    className="grid w-full gap-[4px]"
                    style={{
                      gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
                      gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
                      height: 32,
                    }}
                  >
                    {Array.from({ length: 12 }).map((_, idx) => {
                      const memberCount = chat.members || (chat.type === 'direct' ? 2 : 1);
                      const color = chat.type === 'band' ? '#D5FB46' :
                                    chat.type === 'event' ? '#0147FF' : '#000000';
                      return (
                        <div
                          key={idx}
                          className="rounded-[10px]"
                          style={{ backgroundColor: idx < memberCount ? color : 'rgba(0,0,0,0.1)' }}
                        />
                      );
                    })}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[12px] font-bold text-black uppercase">
                      {chat.type === 'direct' ? 'STATUS' : 'MEMBERS'}
                    </span>
                    <span className="text-[42px] font-bold text-black leading-none">
                      {chat.type === 'direct' ? (
                        chat.status === 'read' ? (
                          <span className="flex items-center"><CheckCheck className="w-[32px] h-[32px]" /></span>
                        ) : (
                          <span className="flex items-center"><Check className="w-[32px] h-[32px]" /></span>
                        )
                      ) : (
                        chat.members || 1
                      )}
                    </span>
                  </div>
                </div>

                {/* Activity */}
                <div className="flex-1 flex flex-col gap-[10px]">
                  <div
                    className="grid w-full gap-[4px]"
                    style={{
                      gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
                      gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
                      height: 32,
                    }}
                  >
                    {Array.from({ length: 12 }).map((_, idx) => {
                      const filled = chat.unread > 0 ? Math.min(12, chat.unread + 6) : 4;
                      const color = chat.type === 'band' ? '#D5FB46' :
                                    chat.type === 'event' ? '#0147FF' : '#000000';
                      return (
                        <div
                          key={idx}
                          className="rounded-[10px]"
                          style={{ backgroundColor: idx < filled ? color : 'rgba(0,0,0,0.1)' }}
                        />
                      );
                    })}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[12px] font-bold text-black uppercase">
                      UNREAD
                    </span>
                    <span className="text-[42px] font-bold text-black leading-none">
                      {chat.unread || 0}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-[20px]"
          >
            {/* Empty State - Swiss Brutalist */}
            <div className="bg-black rounded-[20px] p-[30px] flex flex-col gap-[20px]">
              <div className="flex flex-col gap-[4px]">
                <span className="text-[12px] font-bold text-white/40 uppercase">
                  {chatFilter === 'direct' ? 'DIRECT MESSAGES' : chatFilter === 'band' ? 'BAND CHATS' : 'EVENT CHATS'}
                </span>
                <h3 className="text-[32px] font-bold text-white uppercase leading-none">
                  NO CHATS
                </h3>
              </div>
              <p className="text-[14px] font-medium text-white/50 uppercase">
                {chatFilter === 'direct' && 'START A PRIVATE CONVERSATION WITH A BAND MEMBER'}
                {chatFilter === 'band' && 'CREATE A GROUP CHAT TO COORDINATE WITH YOUR BAND'}
                {chatFilter === 'event' && 'CHAT CHANNELS FOR EVENTS WILL APPEAR HERE'}
              </p>
              <button
                onClick={() => onStartChat?.()}
                className="bg-[#D5FB46] text-black rounded-full px-[20px] py-[12px] font-bold text-[14px] uppercase flex items-center gap-[8px] self-start"
              >
                <Plus className="w-[16px] h-[16px]" />
                NEW CHAT
              </button>
            </div>

            {/* Tip Cards */}
            <div className="grid grid-cols-2 gap-[10px]">
              <div className="bg-black/[0.06] rounded-[10px] p-[16px] flex flex-col gap-[8px]">
                <div className="w-[32px] h-[32px] bg-black rounded-[6px] flex items-center justify-center">
                  <User className="w-[16px] h-[16px] text-[#D5FB46]" />
                </div>
                <span className="text-[12px] font-bold text-black uppercase">DIRECT</span>
                <span className="text-[11px] font-medium text-black/40 uppercase">CHAT PRIVATELY WITH MEMBERS</span>
              </div>
              <div className="bg-black/[0.06] rounded-[10px] p-[16px] flex flex-col gap-[8px]">
                <div className="w-[32px] h-[32px] bg-[#D5FB46] rounded-[6px] flex items-center justify-center">
                  <Music2 className="w-[16px] h-[16px] text-black" />
                </div>
                <span className="text-[12px] font-bold text-black uppercase">BANDS</span>
                <span className="text-[11px] font-medium text-black/40 uppercase">COORDINATE WITH YOUR BAND</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};
