import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Search,
  Loader2,
  MessageSquare,
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { EventMark, eventKindOf, IconButton, Tag, PillButton } from '@/app/components/bw';
import { RailSheet } from '@/lib/railActions';
import { createChat } from '@/lib/services/chats';
import { getBandMembersForChat, getBands } from '@/lib/services/bands';
import { getEvents } from '@/lib/services/events';
import { supabase } from '@/lib/supabase';
import type { BandWithMembers } from '@/lib/services/bands';
import type { Event } from '@/lib/services/events';
import { personName, personFirstName, personInitials } from '@/lib/personName';
import { useSheetDrag } from '@/app/components/bw/useSheetDrag';
import { useT, intlLocale } from '@/lib/i18n';

interface NewChatModalProps {
  onClose: () => void;
  onChatCreated: (chatId: string, details?: { type: 'direct' | 'band' | 'event'; name: string; initials: string; avatarUrl?: string }) => void;
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
  const t = useT();
  const drag = useSheetDrag(onClose);
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
        const { data: { user } } = await supabase.auth.getUser();
        const { data: bandsData } = await getBands();
        
        if (bandsData) {
          setAllBands(bandsData);

          // Fetch event memberships for the current user to restrict event chats
          let myEventIdSet = new Set<string>();
          if (user?.id) {
            const { data: myMemberships } = await supabase
              .from('event_members')
              .select('event_id, status')
              .eq('user_id', user.id);
            myEventIdSet = new Set(
              (myMemberships || [])
                .filter((m: any) => m.status !== 'declined')
                .map((m: any) => m.event_id)
            );
          }
          
          const membersPromises = bandsData.map(async (band) => {
            const { data: members } = await getBandMembersForChat(band.id);
            const isUserAdminInBand = band.user_role === 'admin';

            // Members can ONLY text band admins. Admins can text anyone in their band.
            const allowedMembers = (members || []).filter(m => {
              if (isUserAdminInBand) return true;
              return m.role === 'admin';
            });

            return allowedMembers.map(m => ({
              ...m,
              bandId: band.id,
              bandName: band.name
            }));
          });
          
          const allMembersArrays = await Promise.all(membersPromises);
          setAllMembers(allMembersArrays.flat());
          
          const eventsPromises = bandsData.map(async (band) => {
            const { data: events } = await getEvents(band.id);
            const isUserAdminInBand = band.user_role === 'admin';

            // Members can ONLY text in events they're participating in. Admins can access all band events.
            const allowedEvents = (events || []).filter(e => {
              if (isUserAdminInBand) return true;
              return myEventIdSet.has(e.id);
            });

            return allowedEvents.map(e => ({
              ...e,
              bandName: band.name
            }));
          });
          
          const allEventsArrays = await Promise.all(eventsPromises);
          setAllEvents(allEventsArrays.flat());
        }
      } catch (err) {
        console.error('Error loading data:', err);
        setError(t('Failed to load data'));
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
    return date.toLocaleDateString(intlLocale('en-US'), { 
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
        const memberName = personName(selectedMember, 'User');
        const memberInitials = personInitials(selectedMember, 'U');
        if (data) onChatCreated(data.id, {
          type: 'direct',
          name: memberName,
          initials: memberInitials,
          avatarUrl: selectedMember.avatar_url,
        });
        
      } else if (chatType === 'band' && selectedBandChat) {
        const memberIds = selectedBandChat.members?.map(m => m.user_id) || [];
        const { data, error: createError } = await createChat({
          type: 'band',
          name: selectedBandChat.name,
          band_id: selectedBandChat.id,
          participant_ids: memberIds,
        });
        if (createError) throw createError;
        const bandName = selectedBandChat.name || 'Band';
        const bandInitials = bandName.split(' ').filter(Boolean).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || 'B';
        if (data) onChatCreated(data.id, {
          type: 'band',
          name: bandName,
          initials: bandInitials,
        });
        
      } else if (chatType === 'event' && selectedEvent) {
        const { data, error: createError } = await createChat({
          type: 'event',
          name: selectedEvent.title,
          band_id: selectedEvent.band_id || undefined,
          event_id: selectedEvent.id,
          participant_ids: [],
        });
        if (createError) throw createError;
        const eventTitle = selectedEvent.title || 'Event';
        const eventInitials = eventTitle.split(' ').filter(Boolean).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || 'E';
        if (data) onChatCreated(data.id, {
          type: 'event',
          name: eventTitle,
          initials: eventInitials,
        });
      }
    } catch (err: any) {
      setError(err.message || t('Failed to create chat'));
    }

    setCreating(false);
  };

  const canCreate = 
    (chatType === 'direct' && selectedMember) ||
    (chatType === 'band' && selectedBandChat) ||
    (chatType === 'event' && selectedEvent);

  const canMessageAnyMember = allBands.some(b => b.user_role === 'admin');

  /** Shared row chrome: 16px-radius row, lime outline when selected. */
  const rowClass = (isSelected: boolean) => cn(
    "w-full p-3 rounded-[16px] border-[1.5px] flex items-center gap-3 text-left transition-colors cursor-pointer",
    isSelected ? "bg-foreground/[0.08] border-accent" : "border-transparent hover:bg-foreground/[0.05]"
  );

  const avatarClass = "w-11 h-11 rounded-full bg-white text-black border-[1.5px] border-border flex items-center justify-center shrink-0 overflow-hidden";
  const avatarInitialsClass = "bw-h3";

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="bw-rail-sheet fixed inset-0 z-[90] bg-black/50"
        onClick={onClose}
      />

      {/* Bottom Sheet (dark) */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'tween', duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-chat-title"
        className="bw-rail-sheet dark fixed bottom-0 left-0 right-0 z-[91] bg-sheet text-sheet-foreground rounded-t-[32px] flex flex-col"
        style={{ 
          maxHeight: '85vh',
          paddingBottom: 'calc(var(--safe-bottom) + 16px)',
        }}
        onClick={e => e.stopPropagation()}
        {...drag.sheet}
      >
        {/* Sheet header: grabber, overline, title, close */}
        <div className="flex flex-col items-center gap-3 px-5 pt-3 pb-2 shrink-0" {...drag.handle}>
          <div className="w-10 h-[5px] rounded-[3px] bg-foreground/85" aria-hidden="true" />
          <div className="flex items-center gap-3 w-full">
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <span className="bw-label-sm text-foreground/85">{t('Start chat')}</span>
              <h2 id="new-chat-title" className="bw-h1 text-foreground">{t('New chat')}</h2>
            </div>
            <RailSheet onClose={onClose} />
            <IconButton label={t('Close')} variant="sheet" size="sm" icon={<X />} onClick={onClose} />
          </div>
        </div>

        <div className="flex flex-col gap-3 px-5 pt-4 min-h-0 flex-1">
          {/* Type selector */}
          <div className="flex gap-2 shrink-0" role="tablist" aria-label={t('Chat type')}>
            {[
              { type: 'direct' as const, label: t('DIRECT') },
              { type: 'band' as const, label: t('BAND') },
              { type: 'event' as const, label: t('EVENT') },
            ].map(({ type, label }) => (
              <button
                key={type}
                type="button"
                role="tab"
                aria-selected={chatType === type}
                onClick={() => {
                  setChatType(type);
                  setSelectedMember(null);
                  setSelectedBandChat(null);
                  setSelectedEvent(null);
                  setSearchQuery('');
                }}
                className={cn(
                  "h-7 px-3 rounded-full bw-label-sm whitespace-nowrap transition-colors cursor-pointer",
                  chatType === type
                    ? "bg-accent text-accent-foreground"
                    : "border border-foreground/85 text-foreground hover:bg-foreground/[0.08]"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="bg-foreground/[0.08] rounded-full flex items-center px-4 gap-2 h-12 shrink-0">
            <Search className="w-[18px] h-[18px] text-foreground shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={t('Search')}
              placeholder={
                chatType === 'direct' 
                  ? (canMessageAnyMember ? t('Search members…') : t('Search admins…')) 
                  : chatType === 'band' ? t('Search bands…') :
                  t('Search events…')
              }
              className="w-full min-w-0 h-full bg-transparent bw-body-md text-foreground placeholder:text-foreground/70 focus:outline-none"
            />
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="shrink-0"
              >
                <div role="alert" className="px-4 py-3 rounded-[16px] bg-destructive-solid text-white bw-body-sm">
                  {error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto min-h-0 -mx-5 px-5">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-foreground/50 animate-spin" />
              </div>
            ) : (
              <>
                {/* DIRECT TAB */}
                {chatType === 'direct' && (
                  <div className="flex flex-col gap-4">
                    {allBands.map(band => {
                      const bandMembers = filteredMembers.filter(m => m.bandId === band.id);
                      if (bandMembers.length === 0) return null;
                      
                      return (
                        <div key={band.id} className="flex flex-col gap-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="bw-label-sm text-foreground/85 truncate">
                              {band.name}
                            </span>
                            {band.user_role !== 'admin' && (
                              <span className="bw-label-xs text-foreground/85 shrink-0">
                                {t('Admins')}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex flex-col gap-2">
                            {bandMembers.map(member => {
                              const isSelected = selectedMember?.id === member.id && selectedMember?.bandId === member.bandId;
                              return (
                                <motion.button
                                  key={`${member.id}-${member.bandId}`}
                                  type="button"
                                  aria-pressed={isSelected}
                                  onClick={() => handleSelect('direct', member)}
                                  whileTap={{ scale: 0.98 }}
                                  className={rowClass(isSelected)}
                                >
                                  <div className={avatarClass}>
                                    {member.avatar_url ? (
                                      <img
                                        src={member.avatar_url}
                                        alt={personName(member, '')}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                        }}
                                      />
                                    ) : (
                                      <span className={avatarInitialsClass}>{getInitials(member.full_name, member.email)}</span>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                                    <p className="bw-label-md text-foreground truncate">
                                      {personName(member, '')}
                                    </p>
                                    <p className="bw-body-sm text-foreground/85 truncate">
                                      {member.instrument || member.role || t('Member')}
                                    </p>
                                  </div>
                                  {member.role === 'admin' && (
                                    <Tag variant="accent">{t('Admin')}</Tag>
                                  )}
                                </motion.button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    
                    {filteredMembers.length === 0 ? (
                      <div className="text-center py-12 flex flex-col items-center gap-1.5">
                        <p className="bw-label-md text-foreground/85">{t('NO ADMINS AVAILABLE')}</p>
                        <p className="bw-body-sm text-foreground/60">{t('Direct messaging is restricted to band admins.')}</p>
                      </div>
                    ) : !canMessageAnyMember && (
                      <p className="bw-body-sm text-foreground/85">
                        {t('Direct messages are limited to band admins.')}
                      </p>
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
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => handleSelect('band', band)}
                          whileTap={{ scale: 0.98 }}
                          className={rowClass(isSelected)}
                        >
                          <div className={avatarClass}>
                            <span className={avatarInitialsClass}>{getInitials(band.name)}</span>
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col gap-1">
                            <p className="bw-label-md text-foreground truncate">
                              {band.name}
                            </p>
                            <p className="bw-body-sm text-foreground/85">
                              {memberCount === 1 ? t('{count} member', { count: memberCount }) : t('{count} members', { count: memberCount })}
                            </p>
                          </div>
                        </motion.button>
                      );
                    })}

                    {filteredBands.length === 0 && (
                      <div className="text-center py-12">
                        <p className="bw-label-md text-foreground/85">{t('NO BANDS FOUND')}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* EVENT TAB */}
                {chatType === 'event' && (
                  <div className="flex flex-col gap-2">
                    {filteredEvents.map(event => {
                      const isSelected = selectedEvent?.id === event.id;
                      const startOfToday = new Date();
                      startOfToday.setHours(0, 0, 0, 0);
                      const kind = eventKindOf(event, new Date(event.event_date) < startOfToday);
                      
                      return (
                        <motion.button
                          key={event.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => handleSelect('event', event)}
                          whileTap={{ scale: 0.98 }}
                          className={rowClass(isSelected)}
                        >
                          <span className="w-11 h-11 flex items-center justify-center shrink-0">
                            <EventMark kind={kind} size={32} />
                          </span>
                          <div className="flex-1 min-w-0 flex flex-col gap-1">
                            <p className="bw-label-md text-foreground truncate">
                              {event.title}
                            </p>
                            <p className="bw-body-sm text-foreground/85 truncate">
                              {formatEventDate(event.event_date)}
                              {event.bandName && <> · {event.bandName}</>}
                            </p>
                          </div>
                          <Tag variant="subtle" className="bg-foreground/[0.12]">
                            {event.event_type === 'rehearsal' ? t('Rehearsal') : t('Gig')}
                          </Tag>
                        </motion.button>
                      );
                    })}

                    {filteredEvents.length === 0 && (
                      <div className="text-center py-12 flex flex-col items-center gap-1.5">
                        <p className="bw-label-md text-foreground/85">{t('NO EVENTS FOUND')}</p>
                        <p className="bw-body-sm text-foreground/60">{t('You can only chat in events you are participating in.')}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Action Button */}
          <div className="pt-1 shrink-0">
            <PillButton
              onClick={handleCreateChat}
              disabled={!canCreate}
              loading={creating}
              icon={canCreate ? <MessageSquare className="w-5 h-5 shrink-0" /> : undefined}
              className="[&>span]:min-w-0 [&>span>span]:truncate"
            >
              <span>
                {chatType === 'direct' && selectedMember
                  ? t('Message {name}', { name: personFirstName(selectedMember, t('User')) })
                  : chatType === 'band' && selectedBandChat
                  ? t('Open {name} chat', { name: selectedBandChat.name })
                  : chatType === 'event' && selectedEvent
                  ? t('Open {name} chat', { name: selectedEvent.title })
                  : t('Select to continue')}
              </span>
            </PillButton>
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default NewChatModal;
