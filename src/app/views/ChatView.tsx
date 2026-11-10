import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, animate, useMotionValue, useTransform } from 'motion/react';
import { 
  Search, 
  User, 
  Music,
  Music2, 
  Mic,
  FileText,
  Calendar as CalendarIcon,
  MessageSquare,
  X,
  Loader2,
  Trash2,
} from '@/app/components/icons';
import { DeleteChatSheet } from '@/app/components/chat/DeleteChatSheet';
import { haptic } from '@/lib/haptics';
import { ReceiptTicks } from '@/app/components/chat/ReceiptTicks';
import { cn } from '@/app/components/ui/utils';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { eventKindOf, type EventKind } from '@/app/components/bw';
import { ChatItem, ChatFilterType, toTitleCase } from '@/app/data/chats';
import { searchChatsAndMessages, SearchResult } from '@/lib/services/chats';
import { useRailSearch } from '@/lib/railActions';

interface ChatViewProps {
  chatFilter: ChatFilterType;
  setChatFilter: (filter: ChatFilterType) => void;
  chatSearch: string;
  setChatSearch: (search: string) => void;
  filteredChats: ChatItem[];
  unreadCounts?: { all: number; direct: number; band: number; event: number };
  onChatClick?: (chat: ChatItem) => void;
  onStartChat?: () => void;
  /** Swipe left → Delete. Removes the chat from my list only. */
  onDeleteChat?: (chat: ChatItem) => Promise<void> | void;
}

const ACTION_W = 80;
const ACTION_GAP = 16;
/** How far the row slides: the action plus clear space before date/ticks. */
const REVEAL = ACTION_W + ACTION_GAP;

/** iOS-style row: swipe left to reveal Delete, tap elsewhere to close. */
const SwipeRow: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  label: string;
  children: React.ReactNode;
}> = ({ open, onOpenChange, onDelete, label, children }) => {
  const x = useMotionValue(0);
  // Hidden at rest so no red edge peeks out next to the row.
  const actionOpacity = useTransform(x, [-REVEAL, -6, 0], [1, 1, 0]);
  const dragged = useRef(false);

  useEffect(() => {
    const controls = animate(x, open ? -REVEAL : 0, { type: 'spring', stiffness: 520, damping: 42 });
    return () => controls.stop();
  }, [open, x]);

  return (
    <div className="relative overflow-hidden">
      <motion.button
        type="button"
        onClick={onDelete}
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        aria-label={`Delete chat with ${label}`}
        className="absolute top-2 bottom-2 right-0 flex flex-col items-center justify-center gap-1 rounded-[20px] bg-destructive-solid text-white bw-label-xs active:scale-95 transition-transform"
        style={{ width: ACTION_W, opacity: actionOpacity }}
      >
        <Trash2 className="w-5 h-5" aria-hidden />
        Delete
      </motion.button>
      <motion.div
        drag="x"
        dragDirectionLock
        dragMomentum={false}
        dragConstraints={{ left: -REVEAL, right: 0 }}
        dragElastic={{ left: 0.12, right: 0 }}
        style={{ x, touchAction: 'pan-y' }}
        onDragStart={() => { dragged.current = true; }}
        onDragEnd={(_, info) => {
          const next = open
            ? !(info.offset.x > REVEAL / 3 || info.velocity.x > 400)
            : info.offset.x < -REVEAL / 2 || info.velocity.x < -400;
          animate(x, next ? -REVEAL : 0, { type: 'spring', stiffness: 520, damping: 42 });
          if (next && !open) haptic.tap();
          onOpenChange(next);
          setTimeout(() => { dragged.current = false; }, 0);
        }}
        onClickCapture={(e) => {
          // A swipe is not a tap; a tap on an open row just closes it.
          if (dragged.current || open) {
            e.stopPropagation();
            e.preventDefault();
            if (!dragged.current) onOpenChange(false);
          }
        }}
        className="relative bg-background"
      >
        {children}
      </motion.div>
    </div>
  );
};

const FILTERS = [
  { key: 'all' as const, label: 'ALL' },
  { key: 'direct' as const, label: 'DIRECT' },
  { key: 'band' as const, label: 'BANDS' },
  { key: 'event' as const, label: 'EVENTS' },
];

/** Icon shown on an event chat tile, per event kind (Figma: music / mic / file). */
const EVENT_ICON: Record<EventKind, React.ComponentType<{ className?: string }>> = {
  gig: Music,
  rehearsal: Mic,
  quote: FileText,
  personal: User,
  past: CalendarIcon,
};

/**
 * Leading avatar for a chat row: event chats get a round tile in the event
 * colour, band chats a dark initials disc, direct chats a white initials disc
 * with an online dot.
 */
const ChatAvatar: React.FC<{ chat: ChatItem }> = ({ chat }) => {
  if (chat.type === 'event') {
    const kind = eventKindOf({ eventType: chat.eventType });
    const Icon = EVENT_ICON[kind];
    return (
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: `var(--accent-${kind})`, color: `var(--accent-${kind}-fg)` }}
      >
        <Icon className="w-5 h-5" />
      </div>
    );
  }

  const isBand = chat.type === 'band';
  return (
    <div className="relative shrink-0">
      <div className={cn(
        "w-11 h-11 rounded-full flex items-center justify-center overflow-hidden shrink-0",
        isBand
          ? "bg-surface-inverse text-surface-inverse-foreground"
          : "bg-white text-black border-[1.5px] border-border"
      )}>
        {chat.avatarUrl ? (
          <img
            src={chat.avatarUrl}
            alt={chat.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <span className="bw-h3 tracking-[-0.01em]">{chat.initials}</span>
        )}
      </div>
      {chat.isOnline && (
        <span
          className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-success ring-2 ring-background"
          aria-label="Online"
        />
      )}
    </div>
  );
};

export const ChatView: React.FC<ChatViewProps> = ({
  chatFilter,
  setChatFilter,
  chatSearch,
  setChatSearch,
  filteredChats,
  unreadCounts = { all: 0, direct: 0, band: 0, event: 0 },
  onChatClick,
  onStartChat,
  onDeleteChat,
}) => {
  const [openRowId, setOpenRowId] = useState<ChatItem['id'] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ChatItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!pendingDelete || !onDeleteChat) return;
    setDeleting(true);
    try {
      await onDeleteChat(pendingDelete);
      haptic.tap();
    } finally {
      setDeleting(false);
      setPendingDelete(null);
      setOpenRowId(null);
    }
  };

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // iPhone Duo: the chat search lives in the side rail (Figma "Duo/Rail Search Field").
  const searchInRail = useRailSearch({
    label: 'Search chats',
    placeholder: 'Search chats…',
    base: true,
    value: chatSearch,
    busy: isSearching,
    onChange: setChatSearch,
  });

  // The "+" lives in the screen header (Figma "Chat / Inbox"); Header.tsx signals it.
  useEffect(() => {
    const open = () => onStartChat?.();
    window.addEventListener('bw:new-chat', open);
    return () => window.removeEventListener('bw:new-chat', open);
  }, [onStartChat]);
  
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


  return (
    <motion.div 
      key="chat"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="flex flex-col gap-3 relative z-10 min-h-[50vh]"
    >
      {/* ═══ FILTER SELECTORS ═══ */}
      <div className="flex gap-1.5 items-center shrink-0 overflow-x-auto scrollbar-hide -mx-4 px-4" role="tablist" aria-label="Chat filters">
        {FILTERS.map(({ key, label }) => {
          const count = unreadCounts[key];
          const isActive = chatFilter === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setChatFilter(key)}
              className={cn(
                "h-9 px-4 rounded-full bw-label-sm whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer active:scale-[var(--press-scale,0.97)]",
                isActive
                  ? "bg-surface-inverse text-surface-inverse-foreground"
                  : "border border-foreground/25 text-foreground"
              )}
            >
              <span>{label}</span>
              {count > 0 && (
                <span className="opacity-60">{count > 99 ? '99+' : count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═══ SEARCH + NEW CHAT ═══ (on iPhone Duo only the results remain: the field is in the rail) */}
      <div className={cn('relative', searchInRail && !(showSearchResults && searchResults.length > 0) && 'hidden')}>
        {!searchInRail && <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0 h-[52px] bg-field border border-border rounded-full flex items-center px-4 gap-3">
            {isSearching ? (
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin shrink-0" />
            ) : (
              <Search className="w-5 h-5 text-foreground shrink-0" />
            )}
            <input 
              type="text" 
              placeholder="Search chats…"
              aria-label="Search chats"
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              onFocus={() => chatSearch.length >= 2 && setShowSearchResults(true)}
              className="w-full min-w-0 h-full bg-transparent bw-body-lg text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            />
            {chatSearch && (
              <button
                type="button"
                onClick={() => {
                  setChatSearch('');
                  setShowSearchResults(false);
                }}
                aria-label="Clear search"
                className="w-7 h-7 -mr-1 rounded-full flex items-center justify-center hover:bg-foreground/10 shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>}
        
        {/* Search Results Dropdown */}
        <AnimatePresence>
          {showSearchResults && searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-2 bg-card text-card-foreground rounded-[24px] border border-border max-h-80 overflow-y-auto z-50 py-2"
            >
              {['chat', 'participant', 'message'].map(type => {
                const typeResults = searchResults.filter(r => r.type === type);
                if (typeResults.length === 0) return null;
                
                return (
                  <div key={type}>
                    <div className="px-4 pt-2 pb-1 bg-card bw-label-xs text-muted-foreground sticky top-0">
                      {type === 'chat' ? 'CHATS' : type === 'participant' ? 'PEOPLE' : 'MESSAGES'}
                    </div>
                    {typeResults.map((result, i) => (
                      <button
                        key={`${result.chat_id}-${result.message_id || i}`}
                        type="button"
                        onClick={() => handleSearchResultClick(result)}
                        className="w-full px-4 py-2.5 text-left hover:bg-foreground/[0.06] flex items-center gap-3 transition-colors cursor-pointer"
                      >
                        <div className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                          result.type === 'message' ? "bg-field border-[1.5px] border-border text-foreground" :
                          result.chat_type === 'band' ? "bg-surface-inverse text-surface-inverse-foreground" :
                          result.chat_type === 'event' ? "bg-accent-gig text-accent-gig-foreground" :
                          "bg-field border-[1.5px] border-border text-foreground"
                        )}>
                          {result.type === 'message' ? (
                            <MessageSquare className="w-4 h-4" />
                          ) : result.chat_type === 'band' ? (
                            <Music2 className="w-4 h-4" />
                          ) : result.chat_type === 'event' ? (
                            <CalendarIcon className="w-4 h-4" />
                          ) : (
                            <User className="w-4 h-4" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="bw-label-md text-foreground truncate">
                              {result.type === 'participant' ? result.participant_name : result.chat_name}
                            </span>
                            {result.message_date && (
                              <span className="bw-label-xs text-muted-foreground shrink-0">
                                {formatResultDate(result.message_date)}
                              </span>
                            )}
                          </div>
                          {result.type === 'message' && result.message_content && (
                            <p className="bw-body-sm text-muted-foreground truncate">
                              <span className="text-foreground">{result.message_sender}:</span> {result.message_content}
                            </p>
                          )}
                          {result.type === 'participant' && (
                            <p className="bw-body-sm text-muted-foreground truncate">
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

      {/* ═══ CHAT LIST ═══ */}
      <div className="flex flex-col">
        {filteredChats.length > 0 ? (
          filteredChats.map((chat, i) => {
            const hasUnread = chat.unread > 0;
            const displayName = toTitleCase(chat.name);
            const row = (
              <motion.div 
                key={chat.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                onClick={() => onChatClick?.(chat)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onChatClick?.(chat);
                  }
                }}
                aria-label={`${displayName}${hasUnread ? `, ${chat.unread} unread` : ''}`}
                className="py-3 cursor-pointer active:scale-[0.99] transition-transform flex items-center gap-3"
              >
                <ChatAvatar chat={chat} />

                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  {/* Top row: name + time */}
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="bw-label-md text-foreground truncate">
                      {displayName}
                      {chat.type === 'band' && <span> · Band</span>}
                    </h3>
                    <span className={cn(
                      "bw-label-sm whitespace-nowrap shrink-0",
                      hasUnread ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {chat.time || 'now'}
                    </span>
                  </div>

                  {/* Bottom row: last message + unread badge / read state */}
                  <div className="flex items-center gap-2">
                    <p className={cn(
                      "bw-body-sm flex-1 min-w-0",
                      hasUnread ? "text-foreground line-clamp-2" : "text-muted-foreground truncate"
                    )}>
                      {chat.lastMessage || 'No messages yet'}
                    </p>

                    {hasUnread ? (
                      <span className="bg-accent text-accent-foreground bw-label-xs h-5 min-w-5 px-1.5 rounded-full inline-flex items-center justify-center shrink-0">
                        {chat.unread > 99 ? '99+' : chat.unread}
                      </span>
                    ) : chat.isLastMessageMine ? (
                      <ReceiptTicks
                        status={chat.lastMessageStatus ?? (chat.isLastMessageRead ? 'read' : 'sent')}
                        className="w-3.5 h-3.5"
                      />
                    ) : null}
                  </div>
                </div>
              </motion.div>
            );
            if (!onDeleteChat) return row;
            return (
              <SwipeRow
                key={chat.id}
                label={displayName}
                open={openRowId === chat.id}
                onOpenChange={(o) => setOpenRowId(o ? chat.id : null)}
                onDelete={() => setPendingDelete(chat)}
              >
                {row}
              </SwipeRow>
            );
          })
        ) : (
          <EmptyState />
        )}
      </div>

      <DeleteChatSheet
        open={!!pendingDelete}
        chatName={pendingDelete?.type === 'direct' ? toTitleCase(pendingDelete.name) : undefined}
        deleting={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />

      {/* Bottom clearance spacer ensuring last chat cleanly clears floating navbar */}
      <div
        className="shrink-0 pointer-events-none"
        style={{ height: 'var(--content-bottom-clearance, 136px)' }}
        aria-hidden="true"
      />
    </motion.div>
  );
};
