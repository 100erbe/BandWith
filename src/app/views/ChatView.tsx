import React from 'react';
import { motion } from 'motion/react';
import { 
  Search, 
  User, 
  Music2, 
  Calendar as CalendarIcon,
  CheckCheck,
  Check
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { ChatItem, ChatType } from '@/app/data/chats';

interface ChatViewProps {
  chatFilter: ChatType;
  setChatFilter: (filter: ChatType) => void;
  chatSearch: string;
  setChatSearch: (search: string) => void;
  filteredChats: ChatItem[];
}

export const ChatView: React.FC<ChatViewProps> = ({
  chatFilter,
  setChatFilter,
  chatSearch,
  setChatSearch,
  filteredChats
}) => {
  return (
    <motion.div 
      key="chat"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col gap-6 relative z-10 pb-32"
    >
      {/* TABS */}
      <div className="flex gap-2">
        {(['direct', 'band', 'event'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setChatFilter(t)}
            className={cn(
              "flex-1 py-3 rounded-full text-xs font-bold uppercase tracking-wide transition-all shadow-sm border",
              chatFilter === t 
                ? "bg-black text-[#D4FB46] border-black" 
                : "bg-white text-stone-500 border-white hover:bg-stone-50"
            )}
          >
            {t === 'band' ? 'Bands' : t + 's'}
          </button>
        ))}
      </div>

      {/* SEARCH */}
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">
          <Search className="w-5 h-5" />
        </div>
        <input 
          type="text" 
          placeholder={`Search ${chatFilter} messages...`}
          value={chatSearch}
          onChange={(e) => setChatSearch(e.target.value)}
          className="w-full bg-white h-14 pl-12 pr-4 rounded-[1.5rem] text-sm font-bold text-[#1A1A1A] placeholder:text-stone-300 border-none shadow-sm focus:outline-none focus:ring-2 focus:ring-[#D4FB46]" 
        />
      </div>

      {/* CHAT LIST */}
      <div className="space-y-2">
        {filteredChats.length > 0 ? (
          filteredChats.map((chat, i) => (
            <motion.div 
              key={chat.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-4 bg-white rounded-[2rem] shadow-sm flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-transform border border-transparent hover:border-black/5"
            >
              {/* Avatar Logic */}
              <div className="relative shrink-0">
                {chat.type === 'direct' && (
                  <div className="w-14 h-14 rounded-full bg-[#1A1A1A] flex items-center justify-center text-white font-bold text-sm tracking-widest border-2 border-white shadow-md">
                    {chat.initials}
                  </div>
                )}
                {chat.type === 'band' && (
                  <div className="w-14 h-14 rounded-[1rem] bg-[#D4FB46] flex items-center justify-center text-black font-black text-sm tracking-tighter border-2 border-white shadow-md">
                    {chat.initials}
                  </div>
                )}
                {chat.type === 'event' && (
                  <div className="w-14 h-14 rounded-[1rem] bg-stone-100 flex flex-col items-center justify-center border-2 border-white shadow-md text-[#1A1A1A]">
                    <span className="text-[9px] font-black uppercase text-stone-400">{chat.month}</span>
                    <span className="text-lg font-black leading-none">{chat.date}</span>
                  </div>
                )}
                
                {/* Status Dot */}
                {chat.unread > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#D4FB46] rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-black shadow-sm">
                    {chat.unread}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <h4 className="font-black text-lg text-[#1A1A1A] truncate">{chat.name}</h4>
                  <span className={cn(
                    "text-[10px] font-bold uppercase", 
                    chat.unread > 0 ? "text-[#D4FB46] bg-black px-1.5 py-0.5 rounded-full" : "text-stone-400"
                  )}>
                    {chat.time}
                  </span>
                </div>
                <p className={cn(
                  "text-xs font-medium truncate", 
                  chat.unread > 0 ? "text-[#1A1A1A]" : "text-stone-500"
                )}>
                  {chat.lastMessage}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  {chat.role && (
                    <span className="text-[9px] font-bold uppercase text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
                      {chat.role}
                    </span>
                  )}
                  {chat.status === 'read' && (
                    <div className="flex items-center gap-1 text-[9px] font-bold uppercase text-stone-300">
                      <CheckCheck className="w-3 h-3" /> Read
                    </div>
                  )}
                  {chat.status === 'sent' && (
                    <div className="flex items-center gap-1 text-[9px] font-bold uppercase text-stone-300">
                      <Check className="w-3 h-3" /> Sent
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-12 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-stone-100 flex items-center justify-center mb-4">
              {chatFilter === 'direct' && <User className="w-8 h-8 text-stone-300" />}
              {chatFilter === 'band' && <Music2 className="w-8 h-8 text-stone-300" />}
              {chatFilter === 'event' && <CalendarIcon className="w-8 h-8 text-stone-300" />}
            </div>
            <h3 className="text-xl font-black text-[#1A1A1A] mb-1">No chats yet</h3>
            <p className="text-sm text-stone-500 max-w-[200px] mb-6">Start a conversation to coordinate your next gig.</p>
            <button className="bg-black text-[#D4FB46] px-6 py-3 rounded-full font-bold text-xs uppercase tracking-wide hover:scale-105 transition-transform shadow-lg">
              Start Chat
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};
