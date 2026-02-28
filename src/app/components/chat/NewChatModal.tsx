import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Search,
  User,
  Users,
  Calendar,
  Music2,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { DotRadio } from '@/app/components/ui/DotRadio';
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

  // Data for each tab
  const [allMembers, setAllMembers] = useState<MemberWithBand[]>([]);
  const [allBands, setAllBands] = useState<BandWithMembers[]>([]);
  const [allEvents, setAllEvents] = useState<EventWithBand[]>([]);

  // Selection states
  const [selectedMember, setSelectedMember] = useState<MemberWithBand | null>(null);
  const [selectedBandChat, setSelectedBandChat] = useState<BandWithMembers | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventWithBand | null>(null);

  // Load all data on mount
  useEffect(() => {
    const loadAllData = async () => {
      setIsLoading(true);
      
      try {
        // Get all bands
        const { data: bandsData, error: bandsError } = await getBands();
        console.log('[NewChatModal] Bands loaded:', bandsData?.length, 'error:', bandsError);
        
        if (bandsData) {
          setAllBands(bandsData);
          
          // Get members from all bands
          const membersPromises = bandsData.map(async (band) => {
            console.log('[NewChatModal] Loading members for band:', band.id, band.name);
            const { data: members, error: membersError } = await getBandMembersForChat(band.id);
            console.log('[NewChatModal] Members for', band.name, ':', members?.length, 'error:', membersError);
            return (members || []).map(m => ({
              ...m,
              bandId: band.id,
              bandName: band.name
            }));
          });
          
          const allMembersArrays = await Promise.all(membersPromises);
          const flatMembers = allMembersArrays.flat();
          
          // Remove duplicates (same user in multiple bands) - keep both entries but with band info
          setAllMembers(flatMembers);
          
          // Get events from all bands
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

  // Filter based on search
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

  // Get initials
  const getInitials = (name?: string, fallback?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    }
    return fallback?.slice(0, 2).toUpperCase() || '??';
  };

  // Format event date
  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT', { 
      day: 'numeric', 
      month: 'short',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  // Handle selection
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

  // Create chat
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
        // Get all member IDs for this band
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
          participant_ids: [], // Will be populated by backend based on event members
        });
        if (createError) throw createError;
        if (data) onChatCreated(data.id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create chat');
    }

    setCreating(false);
  };

  // Check if can create
  const canCreate = 
    (chatType === 'direct' && selectedMember) ||
    (chatType === 'band' && selectedBandChat) ||
    (chatType === 'event' && selectedEvent);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
        className="w-full max-w-md bg-[#E6E5E1] rounded-t-[2rem] max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-black/10 rounded-full" />
        </div>

        {/* Header - Swiss Editorial Style */}
        <div className="px-6 pb-6">
          <div className="flex items-start justify-between mb-8">
            <div>
              <p className="text-[12px] font-bold text-black/40 uppercase mb-1">
                NEW CONVERSATION
              </p>
              <h2 className="text-[32px] font-bold text-black uppercase leading-none">
                {chatType === 'direct' ? 'MESSAGE' : chatType === 'band' ? 'BAND CHAT' : 'EVENT CHAT'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10 transition-colors mt-1"
            >
              <X className="w-4 h-4 text-black" />
            </button>
          </div>

          {/* Tab Selector - Minimal Swiss Style */}
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
                  "px-[8px] py-[6px] rounded-[6px] text-[12px] transition-all",
                  chatType === type
                    ? "bg-white text-black font-bold"
                    : "bg-black/20 text-black/40 font-medium"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Search Field - Swiss Minimal */}
          <div className="bg-black/[0.06] rounded-[10px] flex items-center px-[12px] gap-[8px]">
            <Search className="w-[16px] h-[16px] text-black/30 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                chatType === 'direct' ? 'SEARCH MEMBERS...' :
                chatType === 'band' ? 'SEARCH BANDS...' :
                'SEARCH EVENTS...'
              }
              className="w-full h-[40px] bg-transparent text-[12px] font-bold text-black placeholder:text-black/30 uppercase focus:outline-none"
            />
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mx-6 mb-4"
            >
              <div className="p-3 bg-red-50 border-l-2 border-red-500 text-red-700 text-sm">
                {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-black/20 animate-spin" />
            </div>
          ) : (
            <>
              {/* DIRECT TAB - Show Members grouped by Band */}
              {chatType === 'direct' && (
                <div className="space-y-6">
                  {/* Group members by band */}
                  {allBands.map(band => {
                    const bandMembers = filteredMembers.filter(m => m.bandId === band.id);
                    if (bandMembers.length === 0) return null;
                    
                    return (
                      <div key={band.id}>
                        {/* Band Header */}
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-5 h-5 rounded bg-[#D4FB46] flex items-center justify-center">
                            <Music2 className="w-3 h-3 text-[#1A1A1A]" />
                          </div>
                          <span className="text-[10px] font-bold tracking-[0.15em] text-black/40 uppercase">
                            {band.name}
                          </span>
                        </div>
                        
                        {/* Members */}
                        <div className="space-y-1">
                          {bandMembers.map(member => {
                            const isSelected = selectedMember?.id === member.id && selectedMember?.bandId === member.bandId;
                            return (
                              <motion.button
                                key={`${member.id}-${member.bandId}`}
                                onClick={() => handleSelect('direct', member)}
                                className="w-full p-3 rounded-lg flex items-center gap-3 transition-all hover:bg-black/5"
                              >
                                <div className={cn(
                                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold",
                                  isSelected 
                                    ? "bg-[#D5FB46] text-black" 
                                    : "bg-black/10 text-black/60"
                                )}>
                                  {getInitials(member.full_name, member.email)}
                                </div>
                                <div className="flex-1 text-left">
                                  <p className={cn(
                                    "font-semibold text-sm",
                                    isSelected ? "text-black" : "text-black/50"
                                  )}>
                                    {member.full_name || member.email}
                                  </p>
                                  <p className={cn(
                                    "text-xs",
                                    isSelected ? "text-black/60" : "text-black/30"
                                  )}>
                                    {member.instrument || member.role || 'Member'}
                                  </p>
                                </div>
                                <DotRadio
                                  selected={isSelected}
                                  activeColor="#000000"
                                  inactiveColor="rgba(0,0,0,0.20)"
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
                      <User className="w-10 h-10 text-black/20 mx-auto mb-3" />
                      <p className="text-black/40 text-[12px] font-bold uppercase">NO MEMBERS FOUND</p>
                    </div>
                  )}
                </div>
              )}

              {/* BAND TAB - Show Bands */}
              {chatType === 'band' && (
                <div className="space-y-2">
                  {filteredBands.map(band => {
                    const isSelected = selectedBandChat?.id === band.id;
                    const memberCount = band.members?.length || 0;
                    
                    return (
                      <motion.button
                        key={band.id}
                        onClick={() => handleSelect('band', band)}
                        className="w-full p-4 rounded-[10px] flex items-center gap-4 transition-all bg-white hover:bg-black/[0.03] border border-black/5"
                      >
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm bg-[#D5FB46] text-black">
                          {getInitials(band.name)}
                        </div>
                        <div className="flex-1 text-left">
                          <p className={cn(
                            "font-bold",
                            isSelected ? "text-black" : "text-black/50"
                          )}>
                            {band.name}
                          </p>
                          <p className={cn(
                            "text-xs",
                            isSelected ? "text-black/60" : "text-black/30"
                          )}>
                            {memberCount} {memberCount === 1 ? 'member' : 'members'}
                          </p>
                        </div>
                        <DotRadio
                          selected={isSelected}
                          activeColor="#000000"
                          inactiveColor="rgba(0,0,0,0.20)"
                        />
                      </motion.button>
                    );
                  })}

                  {filteredBands.length === 0 && (
                    <div className="text-center py-12">
                      <Music2 className="w-10 h-10 text-black/20 mx-auto mb-3" />
                      <p className="text-black/40 text-[12px] font-bold uppercase">NO BANDS FOUND</p>
                    </div>
                  )}
                </div>
              )}

              {/* EVENT TAB - Show Events with Band info */}
              {chatType === 'event' && (
                <div className="space-y-2">
                  {filteredEvents.map(event => {
                    const isSelected = selectedEvent?.id === event.id;
                    
                    return (
                      <motion.button
                        key={event.id}
                        onClick={() => handleSelect('event', event)}
                        className={cn(
                          "w-full p-4 rounded-[10px] flex items-center gap-4 transition-all text-left",
                          "bg-white hover:bg-black/[0.03] border border-black/5"
                        )}
                      >
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex flex-col items-center justify-center",
                          isSelected 
                            ? "bg-[#D5FB46]" 
                            : "bg-black/5"
                        )}>
                          <Calendar className={cn(
                            "w-5 h-5",
                            isSelected ? "text-black" : "text-black/50"
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "font-bold truncate",
                            isSelected ? "text-black" : "text-black/50"
                          )}>
                            {event.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={cn(
                              "text-xs",
                              isSelected ? "text-black/60" : "text-black/30"
                            )}>
                              {formatEventDate(event.event_date)}
                            </span>
                            <span className="text-xs text-black/20">•</span>
                            <span className={cn(
                              "text-xs font-medium",
                              isSelected ? "text-[#D5FB46]" : "text-[#D5FB46]/80"
                            )}>
                              {event.bandName}
                            </span>
                          </div>
                        </div>
                        <DotRadio
                          selected={isSelected}
                          activeColor="#000000"
                          inactiveColor="rgba(0,0,0,0.20)"
                        />
                      </motion.button>
                    );
                  })}

                  {filteredEvents.length === 0 && (
                    <div className="text-center py-12">
                      <Calendar className="w-10 h-10 text-black/20 mx-auto mb-3" />
                      <p className="text-black/40 text-[12px] font-bold uppercase">NO EVENTS FOUND</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Action Button - Swiss Minimal */}
        <div 
          className="p-6 bg-white border-t border-black/5"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
        >
          <button
            onClick={handleCreateChat}
            disabled={!canCreate || creating}
            className={cn(
              "w-full h-14 rounded-full font-bold text-[12px] uppercase flex items-center justify-center gap-3 transition-all",
              canCreate
                ? "bg-black text-[#D5FB46] hover:bg-black/90 active:scale-[0.98]"
                : "bg-black/5 text-black/30 cursor-not-allowed"
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
    </motion.div>
  );
};

export default NewChatModal;
