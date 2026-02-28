import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Plus, 
  ArrowUpRight,
  LogOut,
  Fingerprint,
} from 'lucide-react';
import { USER } from '@/app/data/user';
import { Band } from '@/app/data/bands';
import { NotificationItem } from '@/app/data/notifications';
import { useAuth } from '@/lib/AuthContext';

interface NotificationGroup {
  type: string;
  items: NotificationItem[];
}

interface IdentityHubProps {
  isOpen: boolean;
  onClose: () => void;
  bands: Band[];
  selectedBand: Band;
  setSelectedBand: (band: Band) => void;
  notificationGroups: NotificationGroup[];
  unreadCount: number;
  onNotificationClick: (ids: number[], actionType: string) => void;
  onMarkAsRead?: (id: number) => void;
  onMarkGroupAsRead?: (ids: number[]) => void;
  entityCounts?: { templates: number; documents: number; inventory: number; repertoire: number };
  onEntityDetailClick?: (label: string) => void;
  onEditProfile?: () => void;
  onEditBand?: () => void;
  onAddEntity?: () => void;
}

const DotGrid: React.FC<{
  filled: number;
  cols: number;
  rows: number;
  height: number;
  activeColor?: string;
  inactiveColor?: string;
}> = ({ filled, cols, rows, height, activeColor = '#D5FB46', inactiveColor = 'rgba(0,0,0,0.2)' }) => {
  const total = cols * rows;
  const capped = Math.min(filled, total);
  return (
    <div
      className="grid w-full shrink-0"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        gap: 4,
        height,
      }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-[10px]"
          style={{ backgroundColor: i < capped ? activeColor : inactiveColor }}
        />
      ))}
    </div>
  );
};

const MemberBars: React.FC<{
  count: number;
  total?: number;
}> = ({ count, total = 6 }) => {
  const capped = Math.min(count, total);
  return (
    <div
      className="grid w-full shrink-0"
      style={{
        gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))`,
        gridTemplateRows: 'repeat(3, minmax(0, 1fr))',
        gap: 4,
        height: 53,
      }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-[10px] row-span-3"
          style={{ backgroundColor: i < capped ? '#D5FB46' : 'rgba(0,0,0,0.2)' }}
        />
      ))}
    </div>
  );
};

export const IdentityHub: React.FC<IdentityHubProps> = ({
  isOpen,
  onClose,
  bands,
  selectedBand,
  notificationGroups,
  unreadCount,
  onNotificationClick,
  onMarkGroupAsRead,
  entityCounts,
  onEntityDetailClick,
  onEditProfile,
  onEditBand,
  onAddEntity
}) => {
  const { signOut, user, profile } = useAuth();
  
  const handleLogout = async () => {
    await signOut();
    onClose();
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || USER.name;
  const displayInitials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || USER.initials;
  const displayRole = profile?.role || USER.role;

  const entityDetails = [
    { label: 'TEMPLATES', count: entityCounts?.templates ?? 0, cols: 6, rows: 4, height: 72 },
    { label: 'DOCUMENTS', count: entityCounts?.documents ?? 0, cols: 6, rows: 4, height: 72 },
    { label: 'INVENTORY', count: entityCounts?.inventory ?? 0, cols: 6, rows: 4, height: 72 },
    { label: 'REPERTOIRE', count: entityCounts?.repertoire ?? 0, cols: 12, rows: 8, height: 148 },
  ];

  const bandTags = bands.map(b => b.name);

  const handleClearAll = () => {
    notificationGroups.forEach(g => {
      onMarkGroupAsRead?.(g.items.map(i => i.id));
    });
  };

  const getNotifLabel = (type: string) => {
    if (type.includes('quote')) return 'QUOTE';
    if (type.includes('chat') || type === 'chat') return 'CHAT';
    if (type.includes('event') || type === 'event') return 'EVENT';
    if (type.includes('rehearsal')) return 'REHARSAL';
    if (type.includes('invite')) return 'INVITE';
    if (type.includes('payment') || type === 'finance') return 'PAYMENT';
    return type.toUpperCase();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '-100%' }}
          animate={{ y: 0 }}
          exit={{ y: '-100%' }}
          transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
          className="fixed inset-0 z-[60] bg-[#737373] overflow-y-auto overflow-x-hidden"
          style={{
            overscrollBehaviorX: 'none',
            touchAction: 'pan-y',
          }}
        >
          <div
            className="flex flex-col gap-10 px-4 min-h-full"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 62px)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 62px)',
            }}
          >
            {/* ═══ HEADER ═══ */}
            <div className="flex items-start justify-between w-full">
              <div className="flex flex-col gap-1">
                <span className="text-[12px] font-bold text-[#D5FB46] uppercase">
                  IDENTITY HUB
                </span>
                <h2 className="text-[32px] font-bold text-white leading-none uppercase">
                  WHO YOU ARE
                </h2>
              </div>
              <button
                onClick={onClose}
                className="w-[50px] h-[50px] rounded-full bg-[rgba(216,216,216,0.2)] border-2 border-white flex items-center justify-center shrink-0"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* ═══ NOTIFICATIONS (if any) ═══ */}
            {unreadCount > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between mb-1">
                  <div />
                  <button
                    onClick={handleClearAll}
                    className="text-[12px] font-bold text-[#D5FB46] uppercase"
                  >
                    CLEAR ALL
                  </button>
                </div>
                {notificationGroups.map((group) => {
                  const label = getNotifLabel(group.type);
                  return (
                    <button
                      key={group.type}
                      onClick={() => {
                        const item = group.items[0];
                        onNotificationClick(group.items.map(i => i.id), item.actionType);
                      }}
                      className="flex items-center justify-between w-full bg-white rounded-[10px] px-3 py-2.5 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold text-black uppercase">
                          {label}
                        </span>
                        <span className="bg-[#D5FB46] text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                          {group.items.length}
                        </span>
                        {group.items[0] && (
                          <span className="text-[10px] text-black/50 font-medium truncate max-w-[140px]">
                            {group.items[0].message}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onMarkGroupAsRead?.(group.items.map(i => i.id));
                          }}
                          className="w-6 h-6 rounded-full border border-black/20 flex items-center justify-center"
                        >
                          <X className="w-3 h-3 text-black/60" />
                        </button>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ═══ PROFILE SECTION ═══ */}
            <div className="flex flex-col gap-10">
              {/* Avatar + Name */}
              <div className="flex items-start gap-5">
                <div className="w-[74px] h-[74px] rounded-full bg-[#D5FB46] border-2 border-white flex items-center justify-center text-black font-bold text-xl shrink-0 overflow-hidden">
                  {displayInitials}
                </div>
                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-[22px] font-bold text-black uppercase leading-tight">
                      {displayName}
                    </p>
                    <div className="flex items-center gap-1 bg-black/20 rounded-[6px] px-1.5 py-0.5 w-fit">
                      <Fingerprint className="w-4 h-4 text-[#D5FB46]" />
                      <span className="text-[12px] font-bold text-[#D5FB46] uppercase">
                        {displayRole}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (onEditProfile) {
                        onEditProfile();
                        onClose();
                      }
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <span className="text-[10px] font-medium text-black uppercase">
                      EDIT PROFILE
                    </span>
                    <ArrowUpRight className="w-3 h-3 text-black" />
                  </button>
                </div>
              </div>

              {/* ═══ BAND SECTION ═══ */}
              <div className="flex flex-col gap-[30px]">
                <div className="flex flex-col gap-[30px]">
                  {/* Band Header */}
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col gap-1">
                        <span className="text-[12px] font-bold text-[#D5FB46] uppercase">
                          YOUR BAND
                        </span>
                        <h3 className="text-[32px] font-bold text-white leading-none uppercase">
                          {selectedBand.name}
                        </h3>
                      </div>
                      <button
                        onClick={() => {
                          if (onEditBand) {
                            onEditBand();
                            onClose();
                          }
                        }}
                        className="bg-[#D5FB46] rounded-[6px] px-2.5 py-1 shrink-0"
                      >
                        <span className="text-[12px] font-bold text-black uppercase">EDIT</span>
                      </button>
                    </div>
                    {/* Band Tags */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {bandTags.map((tag, i) => (
                        <div
                          key={i}
                          className={`rounded-[6px] px-1.5 py-1 ${
                            i === 0
                              ? 'bg-black'
                              : 'bg-white/20'
                          }`}
                        >
                          <span
                            className={`text-[12px] font-medium uppercase ${
                              i === 0 ? 'text-[#D5FB46]' : 'text-black'
                            }`}
                          >
                            {tag}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Members + Genre Row */}
                  <div className="flex gap-5 w-full">
                    {/* Members */}
                    <div className="flex-1 flex flex-col gap-2.5">
                      <MemberBars count={selectedBand.members} />
                      <div className="flex flex-col gap-1">
                        <span className="text-[12px] font-bold text-[#D5FB46] uppercase">
                          MEMBERS
                        </span>
                        <span className="text-[32px] font-bold text-black leading-none">
                          {selectedBand.members}
                        </span>
                      </div>
                    </div>
                    {/* Genre */}
                    <div className="flex-1 flex flex-col gap-2.5">
                      <DotGrid filled={10} cols={6} rows={3} height={53} />
                      <div className="flex flex-col gap-1">
                        <span className="text-[12px] font-bold text-[#D5FB46] uppercase">
                          GENRE
                        </span>
                        <span className="text-[32px] font-bold text-black leading-none uppercase">
                          {selectedBand.genre}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* + ADD NEW */}
                <button
                  onClick={() => {
                    if (onAddEntity) {
                      onAddEntity();
                      onClose();
                    }
                  }}
                  className="w-full border-2 border-dashed border-black/20 rounded-[10px] py-3.5 flex items-center justify-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5 text-black" />
                  <span className="text-[12px] font-medium text-black text-center uppercase">
                    ADD NEW
                  </span>
                </button>
              </div>
            </div>

            {/* ═══ ENTITY DETAILS ═══ */}
            <div className="flex flex-col gap-10">
              <div className="flex flex-col gap-1">
                <span className="text-[12px] font-bold text-[#D5FB46] uppercase">
                  SUPPORT TEXT
                </span>
                <h3 className="text-[32px] font-bold text-white leading-none uppercase">
                  ENTITY DETAILS
                </h3>
              </div>

              <div className="flex flex-col gap-10">
                {entityDetails.map((item) => (
                  <div key={item.label} className="flex flex-col gap-2">
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-bold text-[#D5FB46] uppercase">
                          {item.label}
                        </span>
                        <button
                          onClick={() => {
                            onEntityDetailClick?.(item.label);
                            onClose();
                          }}
                          className="bg-[#D5FB46] rounded-[6px] px-2.5 py-1"
                        >
                          <span className="text-[12px] font-bold text-black uppercase">EDIT</span>
                        </button>
                      </div>
                      <span className="text-[32px] font-bold text-black leading-none">
                        {item.count}
                      </span>
                    </div>
                    <DotGrid
                      filled={item.count}
                      cols={item.cols}
                      rows={item.rows}
                      height={item.height}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* ═══ SIGN OUT ═══ */}
            <div className="flex flex-col gap-4">
              <button
                onClick={handleLogout}
                className="w-full border border-[#A73131] bg-[rgba(167,49,49,0.2)] rounded-[10px] py-3.5 flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4 text-white" />
                <span className="text-[12px] font-medium text-white text-center uppercase">
                  SIGN OUT
                </span>
              </button>
              {user?.email && (
                <p className="text-[10px] font-normal text-black/50 text-center uppercase w-full">
                  SIGNED IN AS {user.email}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
