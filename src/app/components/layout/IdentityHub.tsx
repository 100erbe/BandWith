import React from 'react';
import { cn } from '@/app/components/ui/utils';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Plus,
  ArrowUpRight,
  LogOut,
  Shield,
  Music2,
  Package,
  FileText,
  CheckSquare,
  Sun,
  Moon,
  Monitor,
  Users,
  Bell,
  Sparkles,
} from 'lucide-react';
import { Band } from '@/app/data/bands';
import { NotificationItem } from '@/app/data/notifications';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';

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

export const IdentityHub: React.FC<IdentityHubProps> = ({
  isOpen,
  onClose,
  bands,
  selectedBand,
  setSelectedBand,
  notificationGroups,
  unreadCount,
  onNotificationClick,
  entityCounts,
  onEntityDetailClick,
  onEditProfile,
  onEditBand,
  onAddEntity,
}) => {
  const { signOut, user, profile } = useAuth();
  const { mode, setMode, resolvedTheme } = useTheme();

  const handleLogout = async () => {
    try {
      await signOut();
      onClose();
      window.location.href = '/';
    } catch (e) {
      console.error('Logout failed:', e);
      localStorage.clear();
      window.location.href = '/';
    }
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const displayEmail = user?.email || 'No email attached';
  const displayInitials = profile?.full_name
    ? profile.full_name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.substring(0, 2).toUpperCase() || 'BW';

  const roleLabel = selectedBand.role || (profile?.role ? profile.role.toUpperCase() : 'MEMBER');
  const isAdmin = roleLabel === 'ADMIN';

  const assetShortcuts = [
    {
      id: 'REPERTOIRE',
      label: 'Setlist & Repertoire',
      count: entityCounts?.repertoire ?? 0,
      unit: 'songs',
      icon: Music2,
    },
    {
      id: 'INVENTORY',
      label: 'Gear & Inventory',
      count: entityCounts?.inventory ?? 0,
      unit: 'items',
      icon: Package,
    },
    {
      id: 'DOCUMENTS',
      label: 'Contracts & Docs',
      count: entityCounts?.documents ?? 0,
      unit: 'files',
      icon: FileText,
    },
    {
      id: 'TEMPLATES',
      label: 'Task Templates',
      count: entityCounts?.templates ?? 0,
      unit: 'workflows',
      icon: CheckSquare,
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '-100%' }}
          animate={{ y: 0 }}
          exit={{ y: '-100%' }}
          transition={{ type: 'tween', duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
          className="fixed inset-0 z-[60] bg-background text-foreground overflow-y-auto overflow-x-hidden flex flex-col"
          style={{
            overscrollBehaviorX: 'none',
            touchAction: 'pan-y',
          }}
        >
          {/* ═══ STICKY HEADER ═══ */}
          <div
            className="px-4 shrink-0 border-b border-foreground/10 bg-background/95 backdrop-blur-md sticky top-0 z-30"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
              paddingBottom: '14px',
            }}
          >
            <div className="max-w-xl mx-auto w-full flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                  IDENTITY & ACCOUNT
                </span>
                <h1 className="text-[22px] sm:text-[24px] font-black text-foreground uppercase tracking-tight leading-none">
                  WHO YOU ARE
                </h1>
              </div>
              <button
                onClick={onClose}
                aria-label="Close Identity Hub"
                className="w-10 h-10 rounded-full border border-foreground/20 bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center text-foreground active:scale-90 transition-all shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ═══ SCROLLABLE CONTENT ═══ */}
          <div className="px-4 py-6 max-w-xl mx-auto w-full flex flex-col gap-6 pb-36">
            {/* Unread Alerts Banner (if any) */}
            {unreadCount > 0 && (
              <div
                onClick={() => {
                  if (notificationGroups.length > 0) {
                    const first = notificationGroups[0];
                    onNotificationClick(
                      first.items.map((i) => i.id),
                      first.items[0]?.actionType || 'navigate'
                    );
                  }
                  onClose();
                }}
                className="p-3.5 rounded-[14px] bg-primary/10 border border-primary/25 flex items-center justify-between gap-3 cursor-pointer hover:bg-primary/15 transition-colors shadow-2xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                    <Bell className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold uppercase tracking-wide text-foreground">
                      {unreadCount} UNREAD {unreadCount === 1 ? 'NOTIFICATION' : 'NOTIFICATIONS'}
                    </span>
                    <span className="text-[11px] text-foreground/60">
                      Tap to review activity & gig alerts
                    </span>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-primary shrink-0" />
              </div>
            )}

            {/* ═══ 1. PROFILE CARD ═══ */}
            <div className="p-5 rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-4 shadow-2xs">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[14px] bg-primary text-primary-foreground font-black text-xl sm:text-2xl flex items-center justify-center shrink-0 shadow-xs">
                    {displayInitials}
                  </div>
                  <div className="flex flex-col min-w-0 gap-1">
                    <h2 className="text-lg sm:text-xl font-bold uppercase text-foreground leading-tight truncate">
                      {displayName}
                    </h2>
                    <span className="text-xs text-foreground/50 truncate font-medium">
                      {displayEmail}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10px] font-bold uppercase tracking-wider',
                          isAdmin
                            ? 'bg-primary/15 text-primary border border-primary/25'
                            : 'bg-foreground/10 text-foreground/70 border border-foreground/15'
                        )}
                      >
                        <Shield className="w-3 h-3" />
                        {roleLabel}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onEditProfile?.();
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-[10px] bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1 active:scale-95 transition-all shrink-0"
                >
                  <span>Edit</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* ═══ 2. ACTIVE PROJECT & BAND ROSTER ═══ */}
            <div className="p-5 rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-4 shadow-2xs">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                    ACTIVE PROJECT
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black uppercase text-foreground leading-none mt-1">
                    {selectedBand.name}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onEditBand?.();
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-[10px] bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1 active:scale-95 transition-all shrink-0"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Members</span>
                </button>
              </div>

              {/* Band Metadata Pills */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-[8px] bg-foreground/5 border border-foreground/10 text-foreground/80">
                  {selectedBand.members} {selectedBand.members === 1 ? 'Member' : 'Members'}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-[8px] bg-foreground/5 border border-foreground/10 text-foreground/80">
                  Genre: {selectedBand.genre || 'Live Music'}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-[8px] bg-foreground/5 border border-foreground/10 text-foreground/80">
                  Plan: {selectedBand.plan || 'Standard'}
                </span>
              </div>

              {/* Band Switcher Quick Row (Interactive) */}
              {bands.length > 0 && (
                <div className="flex flex-col gap-2 pt-2 border-t border-foreground/10">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                      SWITCH BAND
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onAddEntity?.();
                        onClose();
                      }}
                      className="text-[11px] font-bold uppercase tracking-wider text-primary hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> New Band
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {bands.map((b) => {
                      const isActive = b.id === selectedBand.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedBand(b)}
                          className={cn(
                            'px-3 py-1.5 rounded-[10px] text-xs font-bold uppercase tracking-wider transition-all border',
                            isActive
                              ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                              : 'bg-foreground/5 hover:bg-foreground/10 text-foreground/70 border-foreground/10'
                          )}
                        >
                          {b.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ═══ 3. BAND ASSETS & WORKFLOWS ═══ */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                  BAND ASSETS & WORKFLOWS
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {assetShortcuts.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onEntityDetailClick?.(item.id);
                        onClose();
                      }}
                      className="p-4 rounded-[16px] bg-card border border-foreground/10 hover:border-foreground/25 flex flex-col justify-between gap-3 text-left transition-all active:scale-[0.98] shadow-2xs group"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="w-8 h-8 rounded-[10px] bg-foreground/5 group-hover:bg-primary/10 group-hover:text-primary flex items-center justify-center text-foreground transition-colors">
                          <Icon className="w-4 h-4" />
                        </div>
                        <ArrowUpRight className="w-3.5 h-3.5 text-foreground/40 group-hover:text-primary transition-colors" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xl font-black text-foreground tabular-nums leading-none">
                          {item.count}
                        </span>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/60 mt-1 truncate">
                          {item.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ═══ 4. THEME & APPEARANCE ═══ */}
            <div className="p-4 rounded-[16px] bg-card border border-foreground/10 flex flex-col gap-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                  APP THEME
                </span>
                <span className="text-[10px] font-medium text-foreground/40 uppercase">
                  ACTIVE: {resolvedTheme}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'light' as const, label: 'Light', icon: Sun },
                  { id: 'dark' as const, label: 'Dark', icon: Moon },
                  { id: 'system' as const, label: 'System', icon: Monitor },
                ].map((t) => {
                  const Icon = t.icon;
                  const isSelected = mode === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setMode(t.id)}
                      className={cn(
                        'py-2 px-3 rounded-[10px] flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-all border',
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                          : 'bg-foreground/5 hover:bg-foreground/10 text-foreground/70 border-foreground/10'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ═══ 5. ACCOUNT ACTIONS & SIGN OUT ═══ */}
            <div className="flex flex-col gap-3 pt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full border border-[var(--destructive)]/30 hover:border-[var(--destructive)] bg-[var(--destructive)]/5 hover:bg-[var(--destructive)]/10 text-[var(--destructive)] rounded-[12px] py-3.5 flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider active:scale-95 transition-all shadow-2xs"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>

              <div className="flex flex-col items-center justify-center gap-1 pt-1 text-center">
                <span className="text-[11px] font-bold text-foreground/40 uppercase tracking-wider">
                  SIGNED IN AS {displayEmail}
                </span>
                <span className="text-[10px] text-foreground/30 uppercase tracking-wider">
                  BANDWITH V1.0.0 · ALL DATA ENCRYPTED
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
