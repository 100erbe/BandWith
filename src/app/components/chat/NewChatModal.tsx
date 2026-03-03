import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Search,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { DotRadio } from '@/app/components/ui/DotRadio';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { createChat } from '@/lib/services/chats';
import { getBandMembersForChat, getBands } from '@/lib/services/bands';
import { getEvents } from '@/lib/services/events';
import { useBand } from '@/lib/BandContext';
import type { BandWithMembers } from '@/lib/services/bands';
import type { Event } from '@/lib/services/events';

interface NewChatModalProps {
  onClose: () => void;
  onChatCreated: (chatId: string) => void;
}

interface MemberWithBand {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role?: string;
  instrument?: string;
  bandId: string;
  bandName: string;
}

interface EventWithBand extends Event {
  bandName?: string;
}

type ChatTypeOption = 'direct' | 'band' | 'event';

export const NewChatModal: React.FC<NewChatModalProps> = ({ onClose, onChatCreated }) => {
  const { selectedBand, bands: contextBands } = useBand();
  const [chatType, setChatType] = useState<ChatTypeOption>('direct');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [allMembers, setAllMembers] = useState<MemberWithBand[]>([]);
  const [allBands, setAllBands] = useState<BandWithMembers[]>([]);
  const [allEvents, setAllEvents] = useState<EventWithBand[]>([]);

  const [selectedMember, setSelectedMember] = useState<MemberWithBand | null>(null);
  const [selectedBandChat, setSelectedBandChat] = useState<BandWithMembers | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventWithBand | null>(null);

  useEffect(() => {
    const loadAllData = async () => {
      setIsLoading(true);
      
      try {
        const { data: bandsData, error: bandsError } = await getBands();
        
        if (bandsData) {
          setAllBands(bandsData);
          
          const membersPromises = bandsData.map(async (band) => {
            const { data: members } = await getBandMembersForChat(band.id);
            return (members || []).map(m => ({
              ...m,
              bandId: band.id,
              bandName: band.name
            }));
          });
          
          const allMembersArrays = await Promise.all(membersPromises);
          setAllMembers(allMembersArrays.flat());
          
          const eventsPromises = bandsData.map(async (band) => {
            const { data: events } = await getEvents(band.id);
            return (events || []).map(e => ({
              ...e,
              bandName: band.name
            }));
          });
          
          const allEventsArrays = await Promise.all(eventsPromises);
          setAllEvents(allEventsArrays.flat());
        }
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load data');
      }
      
      setIsLoading(false);
    };
    
    loadAllData();
  }, []);

  const filteredMembers = useMemo(() => {
    if (!searchQuery) return allMembers;
    const q = searchQuery.toLowerCase();
    return allMembers.filter(m => 
      m.full_name?.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.bandName.toLowerCase().includes(q)
    );
  }, [allMembers, searchQuery]);

  const filteredBands = useMemo(() => {
    if (!searchQuery) return allBands;
    const q = searchQuery.toLowerCase();
    return allBands.filter(b => b.name.toLowerCase().includes(q));
  }, [allBands, searchQuery]);

  const filteredEvents = useMemo(() => {
    if (!searchQuery) return allEvents;
    const q = searchQuery.toLowerCase();
    return allEvents.filter(e => 
      e.title.toLowerCase().includes(q) ||
      e.bandName?.toLowerCase().includes(q)
    );
  }, [allEvents, searchQuery]);

  const getInitials = (name?: string, fallback?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    }
    return fallback?.slice(0, 2).toUpperCase() || '??';
  };

  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT', { 
      day: 'numeric', 
      month: 'short',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  const handleSelect = (type: ChatTypeOption, item: any) => {
    if (type === 'direct') {
      setSelectedMember(item);
      setSelectedBandChat(null);
      setSelectedEvent(null);
    } else if (type === 'band') {
      setSelectedBandChat(item);
      setSelectedMember(null);
      setSelectedEvent(null);
    } else {
      setSelectedEvent(item);
      setSelectedMember(null);
      setSelectedBandChat(null);
    }
  };

  const handleCreateChat = async () => {
    setCreating(true);
    setError(null);

    try {
      if (chatType === 'direct' && selectedMember) {
        const { data, error: createError } = await createChat({
          type: 'direct',
          band_id: selectedMember.bandId,
          participant_ids: [selectedMember.id],
        });
        if (createError) throw createError;
        if (data) onChatCreated(data.id);
        
      } else if (chatType === 'band' && selectedBandChat) {
        const memberIds = selectedBandChat.members?.map(m => m.user_id) || [];
        const { data, error: createError } = await createChat({
          type: 'band',
          name: selectedBandChat.name,
          band_id: selectedBandChat.id,
          participant_ids: memberIds,
        });
        if (createError) throw createError;
        if (data) onChatCreated(data.id);
        
      } else if (chatType === 'event' && selectedEvent) {
        const { data, error: createError } = await createChat({
          type: 'event',
          name: selectedEvent.title,
          band_id: selectedEvent.band_id,
          event_id: selectedEvent.id,
          participant_ids: [],
        });
        if (createError) throw createError;
        if (data) onChatCreated(data.id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create chat');
    }

    setCreating(false);
  };

  const canCreate = 
    (chatType === 'direct' && selectedMember) ||
    (chatType === 'band' && selectedBandChat) ||
    (chatType === 'event' && selectedEvent);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-[10px]"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'tween', duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        className="fixed bottom-0 left-0 right-0 z-[91] bg-black rounded-t-[26px] px-4 pt-4 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] flex flex-col"
        style={{ 
          maxHeight: '85vh',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Pill handle */}
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 rounded-full bg-white/30" />
        </div>

        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <p className="text-xs font-bold text-white/50 uppercase tracking-wider">
            NEW CONVERSATION
          </p>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-white active:scale-90 transition-transform"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex gap-[12px] mb-6">
          {[
            { type: 'direct' as const, label: 'DIRECT' },
            { type: 'band' as const, label: 'BAND' },
            { type: 'event' as const, label: 'EVENT' },
          ].map(({ type, label }) => (
            <button
              key={type}
              onClick={() => {
                setChatType(type);
                setSelectedMember(null);
                setSelectedBandChat(null);
                setSelectedEvent(null);
                setSearchQuery('');
              }}
              className={cn(
                "px-[10px] py-[6px] rounded-[6px] text-[12px] font-bold uppercase transition-all",
                chatType === type
                  ? "bg-[#D5FB46] text-black"
                  : "bg-white/10 text-white/40"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="bg-white/10 rounded-[10px] flex items-center px-[12px] gap-[8px] mb-6">
          <Search className="w-[16px] h-[16px] text-white/30 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              chatType === 'direct' ? 'SEARCH MEMBERS...' :
              chatType === 'band' ? 'SEARCH BANDS...' :
              'SEARCH EVENTS...'
            }
            className="w-full h-[40px] bg-transparent text-[12px] font-bold text-white placeholder:text-white/30 uppercase focus:outline-none"
          />
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4"
            >
              <div className="p-3 bg-red-500/20 border-l-2 border-red-500 text-red-300 text-sm">
                {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto min-h-0 pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
            </div>
          ) : (
            <>
              {/* DIRECT TAB */}
              {chatType === 'direct' && (
                <div className="flex flex-col gap-6">
                  {allBands.map(band => {
                    const bandMembers = filteredMembers.filter(m => m.bandId === band.id);
                    if (bandMembers.length === 0) return null;
                    
                    return (
                      <div key={band.id}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-[10px] font-bold tracking-[0.15em] text-[#D5FB46] uppercase">
                            {band.name}
                          </span>
                        </div>
                        
                        <div className="flex flex-col gap-1">
                          {bandMembers.map(member => {
                            const isSelected = selectedMember?.id === member.id && selectedMember?.bandId === member.bandId;
                            return (
                              <motion.button
                                key={`${member.id}-${member.bandId}`}
                                onClick={() => handleSelect('direct', member)}
                                whileTap={{ scale: 0.98 }}
                                className={cn(
                                  "w-full p-3 rounded-[10px] flex items-center gap-3 transition-all",
                                  isSelected ? "bg-white/10" : "hover:bg-white/5"
                                )}
                              >
                                <div className={cn(
                                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold",
                                  isSelected 
                                    ? "bg-[#D5FB46] text-black" 
                                    : "bg-white/10 text-white/60"
                                )}>
                                  {getInitials(member.full_name, member.email)}
                                </div>
                                <div className="flex-1 text-left">
                                  <p className={cn(
                                    "font-bold text-sm uppercase",
                                    isSelected ? "text-white" : "text-white/50"
                                  )}>
                                    {member.full_name || member.email}
                                  </p>
                                  <p className={cn(
                                    "text-xs uppercase",
                                    isSelected ? "text-white/60" : "text-white/30"
                                  )}>
                                    {member.instrument || member.role || 'Member'}
                                  </p>
                                </div>
                                <DotRadio
                                  selected={isSelected}
                                  activeColor="#D5FB46"
                                  inactiveColor="rgba(255,255,255,0.20)"
                                />
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  
                  {filteredMembers.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-white/40 text-[12px] font-bold uppercase">NO MEMBERS FOUND</p>
                    </div>
                  )}
                </div>
              )}

              {/* BAND TAB */}
              {chatType === 'band' && (
                <div className="flex flex-col gap-2">
                  {filteredBands.map(band => {
                    const isSelected = selectedBandChat?.id === band.id;
                    const memberCount = band.members?.length || 0;
                    
                    return (
                      <motion.button
                        key={band.id}
                        onClick={() => handleSelect('band', band)}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          "w-full p-4 rounded-[10px] flex items-center gap-4 transition-all",
                          isSelected ? "bg-white/10" : "bg-white/5 hover:bg-white/[0.07]"
                        )}
                      >
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm",
                          isSelected 
                            ? "bg-[#D5FB46] text-black"
                            : "bg-white/10 text-white/60"
                        )}>
                          {getInitials(band.name)}
                        </div>
                        <div className="flex-1 text-left">
                          <p className={cn(
                            "font-bold uppercase",
                            isSelected ? "text-white" : "text-white/50"
                          )}>
                            {band.name}
                          </p>
                          <p className={cn(
                            "text-xs uppercase",
                            isSelected ? "text-white/60" : "text-white/30"
                          )}>
                            {memberCount} {memberCount === 1 ? 'MEMBER' : 'MEMBERS'}
                          </p>
                        </div>
                        <DotRadio
                          selected={isSelected}
                          activeColor="#D5FB46"
                          inactiveColor="rgba(255,255,255,0.20)"
                        />
                      </motion.button>
                    );
                  })}

                  {filteredBands.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-white/40 text-[12px] font-bold uppercase">NO BANDS FOUND</p>
                    </div>
                  )}
                </div>
              )}

              {/* EVENT TAB */}
              {chatType === 'event' && (
                <div className="flex flex-col gap-2">
                  {filteredEvents.map(event => {
                    const isSelected = selectedEvent?.id === event.id;
                    
                    return (
                      <motion.button
                        key={event.id}
                        onClick={() => handleSelect('event', event)}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          "w-full p-4 rounded-[10px] flex items-center gap-4 transition-all text-left",
                          isSelected ? "bg-white/10" : "bg-white/5 hover:bg-white/[0.07]"
                        )}
                      >
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex flex-col items-center justify-center",
                          isSelected 
                            ? "bg-[#D5FB46]" 
                            : "bg-white/10"
                        )}>
                          <span className={cn(
                            "text-[10px] font-bold uppercase",
                            isSelected ? "text-black" : "text-white/50"
                          )}>
                            {event.event_type === 'rehearsal' ? 'REH' : 'GIG'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "font-bold truncate uppercase",
                            isSelected ? "text-white" : "text-white/50"
                          )}>
                            {event.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={cn(
                              "text-xs uppercase",
                              isSelected ? "text-white/60" : "text-white/30"
                            )}>
                              {formatEventDate(event.event_date)}
                            </span>
                            <span className="text-xs text-white/20">•</span>
                            <span className="text-xs font-bold text-[#D5FB46] uppercase">
                              {event.bandName}
                            </span>
                          </div>
                        </div>
                        <DotRadio
                          selected={isSelected}
                          activeColor="#D5FB46"
                          inactiveColor="rgba(255,255,255,0.20)"
                        />
                      </motion.button>
                    );
                  })}

                  {filteredEvents.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-white/40 text-[12px] font-bold uppercase">NO EVENTS FOUND</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-4 border-t border-white/10">
          <button
            onClick={handleCreateChat}
            disabled={!canCreate || creating}
            className={cn(
              "w-full h-14 rounded-md font-bold text-[12px] uppercase flex items-center justify-center gap-3 transition-all",
              canCreate
                ? "bg-[#D5FB46] text-black active:scale-[0.98]"
                : "bg-white/5 text-white/30 cursor-not-allowed"
            )}
          >
            {creating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>
                  {chatType === 'direct' && selectedMember 
                    ? `Message ${selectedMember.full_name?.split(' ')[0] || 'User'}`
                    : chatType === 'band' && selectedBandChat
                    ? `Open ${selectedBandChat.name} Chat`
                    : chatType === 'event' && selectedEvent
                    ? `Open ${selectedEvent.title} Chat`
                    : 'Select to continue'
                  }
                </span>
                {canCreate && <ArrowRight className="w-4 h-4" />}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </>
  );
};

export default NewChatModal;
