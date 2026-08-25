
import React, { useMemo } from 'react';
import { cn } from '@/app/components/ui/utils';
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
import { useAuth } from '@/lib/AuthContext';

interface IdentityHubProps {
  isOpen: boolean;
  onClose: () => void;
  bands: Band[];
  selectedBand: Band;
  setSelectedBand: (band: Band) => void;
  entityCounts?: { templates: number; documents: number; inventory: number; repertoire: number };
  onEntityDetailClick?: (label: string) => void;
  onEditProfile?: () => void;
  onEditBand?: () => void;
  onAddEntity?: () => void;
}

export const IdentityHub: React.FC<IdentityHubProps> = ({
  isOpen,
  onClose,
  bands,
  selectedBand,
  entityCounts,
  onEntityDetailClick,
  onEditProfile,
  onEditBand,
  onAddEntity,
}) => {
  const { signOut, user, profile } = useAuth();
  
  const handleLogout = async () => {
    try {
      await signOut();
      onClose();
      // Force a reload to ensure all states are wiped clean
      window.location.href = '/';
    } catch (e) {
      console.error("Logout failed:", e);
      // Fallback: clear local storage manually if API fails
      localStorage.clear();
      window.location.href = '/';
    }
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const displayInitials = profile?.full_name 
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.substring(0, 2).toUpperCase() || '??');
    
  const displayRole = profile?.role || 'Member';

  const entityDetails = [
    { label: 'TEMPLATES', count: entityCounts?.templates ?? 0, cols: 6, rows: 4, height: 72 },
    { label: 'DOCUMENTS', count: entityCounts?.documents ?? 0, cols: 6, rows: 4, height: 72 },
    { label: 'INVENTORY', count: entityCounts?.inventory ?? 0, cols: 6, rows: 4, height: 72 },
    { label: 'REPERTOIRE', count: entityCounts?.repertoire ?? 0, cols: 12, rows: 8, height: 148 },
  ];

  const bandTags = bands.map(b => b.name);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '-100%' }}
          animate={{ y: 0 }}
          exit={{ y: '-100%' }}
          transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
          className="fixed inset-0 z-[60] bg-muted-foreground overflow-y-auto overflow-x-hidden"
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
                <span className="text-xs font-bold text-accent uppercase">
                  IDENTITY HUB
                </span>
                <h2 className="text-3xl font-bold text-accent-foreground leading-tight uppercase">
                  WHO YOU ARE
                </h2>
              </div>
              <button
                onClick={onClose}
                className="w-12 h-12 rounded-full bg-muted border-2 border-border flex items-center justify-center shrink-0"
              >
                <X className="w-6 h-6 text-accent-foreground" />
              </button>
            </div>

            {/* ═══ PROFILE SECTION ═══ */}
            <div className="flex flex-col gap-10">
              {/* Avatar + Name */}
              <div className="flex items-start gap-5">
                <div className="w-18 h-18 rounded-full bg-accent border-2 border-border flex items-center justify-center text-accent-foreground font-bold text-xl shrink-0 overflow-hidden">
                  {displayInitials}
                </div>
                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-xl font-bold text-foreground uppercase leading-tight">
                      {displayName}
                    </p>
                    <div className="flex items-center gap-1 bg-surface-inverse/20 rounded-full px-1.5 py-0.5 w-fit">
                      <Fingerprint className="w-4 h-4 text-accent" />
                      <span className="text-xs font-bold text-accent uppercase">
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
                    <span className="text-xs font-medium text-foreground uppercase">
                      EDIT PROFILE
                    </span>
                    <ArrowUpRight className="w-3 h-3 text-foreground" />
                  </button>
                </div>
              </div>

              {/* ═══ BAND SECTION ═══ */}
              <div className="flex flex-col gap-7.5">
                <div className="flex flex-col gap-7.5">
                  {/* Band Header */}
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-accent uppercase">
                          YOUR BAND
                        </span>
                        <h3 className="text-3xl font-bold text-accent-foreground leading-tight uppercase">
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
                        className="bg-accent rounded-full px-2.5 py-1 shrink-0"
                      >
                        <span className="text-xs font-bold text-accent-foreground uppercase">EDIT</span>
                      </button>
                    </div>
                    {/* Band Tags */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {bandTags.map((tag, i) => (
                        <div
                          key={i}
                          className={`rounded-full px-1.5 py-1 ${
                            i === 0
                              ? 'bg-surface-inverse'
                              : 'bg-muted/20'
                          }`}
                        >
                          <span
                            className={`text-xs font-medium uppercase ${
                              i === 0 ? 'text-accent' : 'text-foreground'
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
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-accent uppercase">
                          MEMBERS
                        </span>
                        <span className="text-3xl font-bold text-foreground leading-tight">
                          {selectedBand.members}
                        </span>
                      </div>
                    </div>
                    {/* Genre */}
                    <div className="flex-1 flex flex-col gap-2.5">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-accent uppercase">
                          GENRE
                        </span>
                        <span className="text-3xl font-bold text-foreground leading-tight uppercase">
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
                  className="w-full border-2 border-dashed border-border rounded-xl py-3.5 flex items-center justify-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5 text-foreground" />
                  <span className="text-xs font-medium text-foreground text-center uppercase">
                    ADD NEW
                  </span>
                </button>
              </div>
            </div>

            {/* ═══ ENTITY DETAILS ═══ */}
            <div className="flex flex-col gap-10">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-accent uppercase">
                  SUPPORT TEXT
                </span>
                <h3 className="text-3xl font-bold text-accent-foreground leading-tight uppercase">
                  ENTITY DETAILS
                </h3>
              </div>

              <div className="flex flex-col gap-10">
                {entityDetails.map((item) => (
                  <div key={item.label} className="flex flex-col gap-2">
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-accent uppercase">
                          {item.label}
                        </span>
                        <button
                          onClick={() => {
                            onEntityDetailClick?.(item.label);
                            onClose();
                          }}
                          className="bg-accent rounded-full px-2.5 py-1"
                        >
                          <span className="text-xs font-bold text-accent-foreground uppercase">EDIT</span>
                        </button>
                      </div>
                      <span className="text-3xl font-bold text-foreground leading-tight">
                        {item.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ═══ SIGN OUT ═══ */}
            <div className="flex flex-col gap-4">
              <button
                onClick={handleLogout}
                className="w-full border border-destructive bg-destructive/20 rounded-xl py-3.5 flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4 text-accent-foreground" />
                <span className="text-xs font-medium text-accent-foreground text-center uppercase">
                  SIGN OUT
                </span>
              </button>
              {user?.email && (
                <p className="text-xs font-normal text-foreground/50 text-center uppercase w-full">
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
