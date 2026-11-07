import React, { useState, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { cn } from '@/app/components/ui/utils';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Plus,
  ArrowUpRight,
  LogOut,
  Shield,
  ListMusic,
  Package,
  FileSignature,
  LayoutTemplate,
  Sun,
  Moon,
  Monitor,
  Users,
  Bell,
  DollarSign,
  Smartphone,
  Volume2,
  VolumeX,
  ChevronDown,
  HelpCircle,
  Download,
  Settings,
} from '@/app/components/icons';
import { Band } from '@/app/data/bands';
import { NotificationItem } from '@/app/data/notifications';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useBand } from '@/lib/BandContext';
import { BrandLogo } from '@/app/components/ui/BrandLogo';
import { Switch } from '@/app/components/ui/switch';

interface NotificationGroup {
  type: string;
  items: NotificationItem[];
}

export interface IdentityHubProps {
  isOpen: boolean;
  onClose: () => void;
  showCloseButton?: boolean;
  bands: Band[];
  selectedBand: Band;
  setSelectedBand: (band: Band) => void;
  notificationGroups?: NotificationGroup[];
  unreadCount?: number;
  onNotificationClick?: (ids: number[], actionType: string) => void;
  onMarkAsRead?: (id: number) => void;
  onMarkGroupAsRead?: (ids: number[]) => void;
  entityCounts?: { templates: number; documents: number; inventory: number; repertoire: number };
  onEntityDetailClick?: (label: string) => void;
  onEditProfile?: () => void;
  onEditBand?: () => void;
  onAddEntity?: () => void;
  onOpenPricing?: () => void;
  onOpenBandSettings?: () => void;
  onOpenSettings?: (section?: string) => void;
}

export const IdentityHub: React.FC<IdentityHubProps> = ({
  isOpen,
  onClose,
  showCloseButton = false,
  bands,
  selectedBand,
  setSelectedBand,
  entityCounts,
  onEntityDetailClick,
  onEditProfile,
  onEditBand,
  onAddEntity,
  onOpenPricing,
  onOpenBandSettings,
}) => {
  const { signOut, user, profile } = useAuth();
  const { mode, setMode, resolvedTheme } = useTheme();
  const { isAdmin: isBandAdmin } = useBand();

  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();
  const isAndroid = typeof window !== 'undefined' && (Capacitor.getPlatform() === 'android' || /Android/i.test(navigator.userAgent));
  const topInset = (isAndroid && isNative) ? '56px' : 'max(env(safe-area-inset-top, 0px), 12px)';

  const [isScrolled, setIsScrolled] = useState(false);
  const isScrolledRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      isScrolledRef.current = false;
      setIsScrolled(false);
    }
  }, [isOpen]);

  const handleContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    if (!isScrolledRef.current && top > 36) {
      isScrolledRef.current = true;
      setIsScrolled(true);
    } else if (isScrolledRef.current && top < 12) {
      isScrolledRef.current = false;
      setIsScrolled(false);
    }
  };

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(() => {
    try {
      return localStorage.getItem('bandwith_push_notifs') !== 'false';
    } catch {
      return true;
    }
  });
  const [emailEnabled, setEmailEnabled] = useState(() => {
    try {
      return localStorage.getItem('bandwith_email_notifs') !== 'false';
    } catch {
      return true;
    }
  });
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem('bandwith_sound_notifs') !== 'false';
    } catch {
      return true;
    }
  });

  const handleTogglePush = (val: boolean) => {
    setPushEnabled(val);
    try {
      localStorage.setItem('bandwith_push_notifs', String(val));
    } catch {}
  };

  const handleToggleEmail = (val: boolean) => {
    setEmailEnabled(val);
    try {
      localStorage.setItem('bandwith_email_notifs', String(val));
    } catch {}
  };

  const handleToggleSound = (val: boolean) => {
    setSoundEnabled(val);
    try {
      localStorage.setItem('bandwith_sound_notifs', String(val));
    } catch {}
  };

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
  const isAdmin = isBandAdmin || roleLabel === 'ADMIN';

  const assetShortcuts = [
    {
      id: 'REPERTOIRE',
      label: 'Setlist & Repertoire',
      count: entityCounts?.repertoire ?? 0,
      unit: 'songs',
      icon: ListMusic,
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
      icon: FileSignature,
    },
    {
      id: 'TEMPLATES',
      label: 'Task Templates',
      count: entityCounts?.templates ?? 0,
      unit: 'workflows',
      icon: LayoutTemplate,
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'tween', duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          onScroll={handleContainerScroll}
          className="fixed inset-0 z-[60] bg-[var(--bg)] text-foreground overflow-y-auto overflow-x-hidden flex flex-col min-h-screen"
          style={{
            overscrollBehaviorX: 'none',
            touchAction: 'pan-y',
          }}
        >
          {/* ═══ STICKY HEADER (Consistent Expanded -> Compact Morph, Zero Layout Shift) ═══ */}
          <div
            className="sticky top-0 z-30 shrink-0 pointer-events-none select-none"
            style={{
              height: `calc(${topInset} + 72px)`,
              overflowAnchor: 'none',
            }}
          >
            <div
              className={cn(
                'absolute top-0 left-0 right-0 px-4 pointer-events-auto transition-[background-color,border-color,box-shadow] duration-300',
                isScrolled
                  ? 'bg-background/95 backdrop-blur-xl border-b border-foreground/10 shadow-2xs'
                  : 'bg-background/80 backdrop-blur-md border-b border-transparent'
              )}
              style={{
                paddingTop: topInset,
              }}
            >
              <motion.div
                initial={false}
                animate={{
                  height: isScrolled ? 54 : 72,
                }}
                transition={{ type: 'spring', stiffness: 240, damping: 28, mass: 0.85 }}
                className="max-w-xl mx-auto w-full relative overflow-hidden"
              >
                <div className="flex flex-col pr-14">
                  <motion.span
                    initial={false}
                    animate={{
                      y: isScrolled ? 4 : 0,
                      scale: isScrolled ? 0.9 : 1,
                    }}
                    transition={{ type: 'spring', stiffness: 240, damping: 28, mass: 0.85 }}
                    className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest leading-none h-[14px] flex items-center origin-top-left"
                  >
                    IDENTITY & ACCOUNT
                  </motion.span>
                  <motion.h1
                    initial={false}
                    animate={{
                      scale: isScrolled ? 0.52 : 1,
                      y: isScrolled ? 6 : 5,
                    }}
                    transition={{ type: 'spring', stiffness: 240, damping: 28, mass: 0.85 }}
                    className="text-[40px] sm:text-[44px] font-black text-foreground uppercase tracking-tighter leading-[0.9] origin-top-left"
                  >
                    WHO YOU ARE
                  </motion.h1>
                </div>
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    aria-label="Close Account Hub"
                    className="absolute top-[5px] right-0 w-10 h-10 rounded-full border border-border/40 bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center text-foreground active:scale-90 transition-all shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </motion.div>
            </div>
          </div>

          {/* ═══ SCROLLABLE CONTENT ═══ */}
          <div
            className="px-4 pt-3 pb-2 max-w-xl mx-auto w-full flex flex-col gap-6"
          >
            {/* ═══ 1. PROFILE CARD ═══ */}
            <div className="p-5 rounded-2xl bg-card border border-border/40 flex flex-col gap-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={displayName}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border border-border/40 shrink-0 shadow-xs"
                    />
                  ) : (
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary text-primary-foreground font-black text-xl sm:text-2xl flex items-center justify-center shrink-0 shadow-xs">
                      {displayInitials}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0 gap-1">
                    <h2 className="text-lg sm:text-xl font-bold uppercase text-foreground leading-tight truncate">
                      {displayName}
                    </h2>
                    <span className="text-xs text-muted-foreground truncate font-medium">
                      {displayEmail}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider',
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
                  }}
                  className="px-3 py-1.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 border border-border/40 text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1 active:scale-95 transition-all shrink-0"
                >
                  <span>Edit</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* ═══ 2. ACTIVE PROJECT & BAND ROSTER ═══ */}
            <div className="p-5 rounded-2xl bg-card border border-border/40 flex flex-col gap-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    ACTIVE PROJECT
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black uppercase text-foreground leading-none mt-1">
                    {selectedBand.name}
                  </h3>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenBandSettings) {
                          onOpenBandSettings();
                        } else {
                          onOpenPricing?.();
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-primary/15 hover:bg-primary/25 border border-primary/30 text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5 active:scale-95 transition-all shrink-0"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Band Settings</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      onEditBand?.();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-foreground/5 hover:bg-foreground/10 border border-border/40 text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1 active:scale-95 transition-all shrink-0"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Members</span>
                  </button>
                </div>
              </div>

              {/* Band Metadata Pills */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-foreground/5 border border-border/40 text-foreground/80">
                  {selectedBand.members} {selectedBand.members === 1 ? 'Member' : 'Members'}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-foreground/5 border border-border/40 text-foreground/80">
                  Genre: {selectedBand.genre || 'Live Music'}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-foreground/5 border border-border/40 text-foreground/80">
                  Plan: {selectedBand.plan || 'Standard'}
                </span>
              </div>

              {/* Band Switcher Quick Row (Interactive) */}
              {bands.length > 0 && (
                <div className="flex flex-col gap-2 pt-2 border-t border-border/30">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      SWITCH BAND
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onAddEntity?.();
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
                            'px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border',
                            isActive
                              ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                              : 'bg-foreground/5 hover:bg-foreground/10 text-foreground/70 border-border/40'
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
            <div className="flex flex-col">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">
                BAND ASSETS & WORKFLOWS
              </div>

              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  {assetShortcuts.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onEntityDetailClick?.(item.id);
                        }}
                        className="p-4 rounded-2xl bg-card border border-border/40 hover:border-foreground/25 flex flex-col justify-between gap-3 text-left transition-all active:scale-[0.98] shadow-sm group"
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="w-8 h-8 rounded-xl bg-foreground/5 group-hover:bg-primary/10 group-hover:text-primary flex items-center justify-center text-foreground transition-colors">
                            <Icon className="w-4 h-4" />
                          </div>
                          <ArrowUpRight className="w-3.5 h-3.5 text-foreground/40 group-hover:text-primary transition-colors" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xl font-black text-foreground tabular-nums leading-none">
                            {item.count}
                          </span>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mt-1 truncate">
                            {item.label}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* PRICING, FEES & SERVICES (Admin Only) */}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => onOpenPricing?.()}
                    className="w-full p-4 rounded-2xl bg-card border border-border/40 hover:border-foreground/25 flex items-center justify-between gap-4 text-left transition-all active:scale-[0.98] shadow-sm group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-foreground/5 group-hover:bg-primary/10 group-hover:text-primary flex items-center justify-center text-foreground transition-colors shrink-0">
                        <DollarSign className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                            PRICING, FEES & SERVICES
                          </span>
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/25">
                            Admin
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground font-normal mt-0.5">
                          Band logo, payment & IBAN details, musician fees & quote services
                        </span>
                      </div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                  </button>
                )}
              </div>
            </div>

            {/* ═══ 4. APP SETTINGS ═══ */}
            <div className="flex flex-col">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">
                APP SETTINGS
              </div>

              <div className="bg-card rounded-2xl border border-border/40 divide-y divide-border/30 overflow-hidden shadow-sm">
                {/* 1. Appearance / Theme */}
                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-foreground/5 flex items-center justify-center text-foreground shrink-0">
                      {resolvedTheme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold uppercase tracking-wide text-foreground">
                        Appearance
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Theme & display ({resolvedTheme})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center p-1 bg-foreground/5 rounded-xl border border-border/40 shrink-0">
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
                            'px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all',
                            isSelected
                              ? 'bg-primary text-primary-foreground shadow-xs'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <Icon className="w-3 h-3" />
                          <span className="hidden sm:inline">{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Notifications (Interactive Accordion / Inline Controls) */}
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => setIsNotificationsOpen((prev) => !prev)}
                    className="p-4 flex items-center justify-between w-full hover:bg-foreground/[0.02] active:bg-foreground/[0.04] transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-foreground/5 group-hover:bg-primary/10 group-hover:text-primary flex items-center justify-center text-foreground transition-colors shrink-0">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold uppercase tracking-wide text-foreground">
                          Notifications
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {pushEnabled && emailEnabled
                            ? 'Push, email & sound alerts enabled'
                            : pushEnabled
                              ? 'Push alerts enabled'
                              : emailEnabled
                                ? 'Email alerts enabled'
                                : 'Alerts paused'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-foreground/5 text-muted-foreground">
                        {isNotificationsOpen ? 'Hide' : 'Configure'}
                      </span>
                      <ChevronDown
                        className={cn(
                          'w-4 h-4 text-muted-foreground transition-transform duration-200',
                          isNotificationsOpen && 'rotate-180 text-foreground'
                        )}
                      />
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isNotificationsOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden bg-foreground/[0.02] border-t border-border/30 divide-y divide-border/20 px-4"
                      >
                        {/* Push Notifications */}
                        <div className="py-3.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center text-muted-foreground shrink-0">
                              <Smartphone className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold text-foreground">
                                Push Notifications
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                Receive gig, rehearsal & poll alerts on this device
                              </span>
                            </div>
                          </div>
                          <Switch
                            checked={pushEnabled}
                            onCheckedChange={handleTogglePush}
                          />
                        </div>

                        {/* Email Notifications */}
                        <div className="py-3.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center text-muted-foreground shrink-0">
                              <Bell className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold text-foreground">
                                Email Notifications
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                Get schedule digests & event updates in your inbox
                              </span>
                            </div>
                          </div>
                          <Switch
                            checked={emailEnabled}
                            onCheckedChange={handleToggleEmail}
                          />
                        </div>

                        {/* Sound Effects */}
                        <div className="py-3.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center text-muted-foreground shrink-0">
                              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold text-foreground">
                                Sound Effects
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                Play audio cues for chat messages & notifications
                              </span>
                            </div>
                          </div>
                          <Switch
                            checked={soundEnabled}
                            onCheckedChange={handleToggleSound}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 3. Help & Support */}
                <button
                  type="button"
                  onClick={() => window.open('mailto:support@bandwith.app?subject=BandWith%20Help%20Request', '_blank')}
                  className="p-4 flex items-center justify-between w-full hover:bg-foreground/[0.02] active:bg-foreground/[0.04] transition-colors text-left group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-foreground/5 group-hover:bg-primary/10 group-hover:text-primary flex items-center justify-center text-foreground transition-colors shrink-0">
                      <HelpCircle className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold uppercase tracking-wide text-foreground">
                        Help & Support
                      </span>
                      <span className="text-xs text-muted-foreground">
                        FAQ & direct support (support@bandwith.app)
                      </span>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                </button>

                {/* 4. Export My Data */}
                <button
                  type="button"
                  onClick={() => {
                    const exportData = {
                      exportedAt: new Date().toISOString(),
                      user: user?.email,
                      band: selectedBand.name,
                      preferences: {
                        theme: mode,
                        pushNotifications: pushEnabled,
                        emailNotifications: emailEnabled,
                        soundEffects: soundEnabled,
                      },
                      message: 'BandWith user data export',
                    };
                    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `bandwith-export-${new Date().toISOString().split('T')[0]}.json`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  }}
                  className="p-4 flex items-center justify-between w-full hover:bg-foreground/[0.02] active:bg-foreground/[0.04] transition-colors text-left group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-foreground/5 group-hover:bg-primary/10 group-hover:text-primary flex items-center justify-center text-foreground transition-colors shrink-0">
                      <Download className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold uppercase tracking-wide text-foreground">
                        Export My Data
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Download a JSON copy of your workspace data
                      </span>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                </button>

                {/* 5. Sign Out */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-4 flex items-center justify-between w-full hover:bg-[var(--destructive)]/5 active:bg-[var(--destructive)]/10 transition-colors text-left group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[var(--destructive)]/10 text-[var(--destructive)] flex items-center justify-center shrink-0">
                      <LogOut className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold uppercase tracking-wide text-[var(--destructive)]">
                        Sign Out
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {displayEmail}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--destructive)]/70 group-hover:text-[var(--destructive)] transition-colors">
                    Leave
                  </span>
                </button>
              </div>
            </div>

            {/* Brand Footer */}
            <div className="flex flex-col items-center justify-center gap-1.5 pt-4 pb-4 text-center opacity-40">
              <BrandLogo variant="waveform" lockup="horizontal" className="h-3.5" textClassName="text-[11px] font-bold" />
              <span className="text-[10px] text-foreground/50 uppercase tracking-wider">
                v1.0.0 · All data encrypted
              </span>
            </div>

            {/* Bottom clearance spacer ensuring Brand Footer cleanly clears floating navbar */}
            <div
              className="shrink-0 pointer-events-none"
              style={{ height: 'var(--content-bottom-clearance, 136px)' }}
              aria-hidden="true"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
