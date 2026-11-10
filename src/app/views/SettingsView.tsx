import React, { useState } from 'react';
import { Toggle, IconButton, NavBackButton, Tag, PillButton, Selector } from '@/app/components/bw';
import { motion, AnimatePresence } from 'motion/react';
import { BrandLogo } from '@/app/components/ui/BrandLogo';
import {
  Bell,
  Mail,
  Play,
  ArrowLeft,
  ArrowUpRight,
  Eye,
  Lock,
  Sun,
  Star,
  MessageSquare,
  Globe,
  Trash2,
  AlertCircle,
  ChevronRight,
} from '@/app/components/icons';
import { deleteMyAccount } from '@/lib/services/account';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { cn } from '@/app/components/ui/utils';

type SettingsSection = 'notifications' | 'appearance' | 'privacy' | 'help' | 'about' | 'language';

interface SettingsViewProps {
  onClose: () => void;
  initialSection?: string;
  isAdmin?: boolean;
}

/* ── Local building blocks (Figma: Card / Icon tile) ── */

const IconTile: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <span
    aria-hidden
    className={cn(
      'size-10 rounded-full bg-foreground/[0.08] flex items-center justify-center text-foreground shrink-0 [&>svg]:size-[18px]',
      className
    )}
  >
    {children}
  </span>
);

const RowText: React.FC<{ title: React.ReactNode; hint?: React.ReactNode; titleClassName?: string }> = ({
  title,
  hint,
  titleClassName,
}) => (
  <span className="flex flex-col gap-1 min-w-0 flex-1">
    <span className={cn('bw-label-md text-foreground', titleClassName)}>{title}</span>
    {hint && <span className="bw-body-sm text-muted-foreground">{hint}</span>}
  </span>
);

const CARD = 'bg-card text-card-foreground rounded-[24px]';
const ROW = 'p-4 flex items-center gap-3 w-full text-left';
const PRESSABLE =
  'transition-colors hover:bg-foreground/[0.03] active:bg-foreground/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';

export const SettingsView: React.FC<SettingsViewProps> = ({
  onClose,
  initialSection = 'notifications',
}) => {
  const { signOut } = useAuth();
  const { mode, setMode, resolvedTheme } = useTheme();

  const themeLabel = mode === 'system' ? 'System' : mode === 'dark' ? 'Dark' : 'Light';

  const SECTIONS: {
    id: SettingsSection;
    label: string;
    hint?: string;
    value?: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'notifications', label: 'Notifications', hint: 'Push, email and sounds', icon: Bell },
    { id: 'appearance', label: 'Appearance', hint: 'Light, dark or system', value: themeLabel, icon: Sun },
    { id: 'privacy', label: 'Privacy & account', hint: 'Workspace privacy, delete account', icon: Lock },
    { id: 'language', label: 'Language', value: 'English (US)', icon: MessageSquare },
    { id: 'help', label: 'Help & support', hint: 'support@bandwith.app', icon: Mail },
    { id: 'about', label: 'About', hint: 'Version 1.0.0', icon: Star },
  ];
  const isKnownSection = (v?: string): v is SettingsSection =>
    !!v && SECTIONS.some((sec) => sec.id === v);

  // 'main' (or nothing) opens the section list; a known id opens that section.
  const openedFromMenu = !isKnownSection(initialSection);
  const [activeSection, setActiveSection] = useState<SettingsSection | null>(
    isKnownSection(initialSection) ? initialSection : null
  );

  const handleBack = () => {
    if (activeSection && openedFromMenu) {
      setActiveSection(null);
      return;
    }
    onClose();
  };

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

  const notificationStatus = (() => {
    const on = [
      pushEnabled && 'push',
      emailEnabled && 'email',
      soundEnabled && 'sound',
    ].filter(Boolean) as string[];
    if (on.length === 0) return 'All alerts paused';
    const list =
      on.length === 1 ? on[0] : `${on.slice(0, -1).join(', ')} & ${on[on.length - 1]}`;
    return `${list} alerts enabled`;
  })();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const closeDeleteConfirm = () => {
    if (deleting) return;
    setShowDeleteConfirm(false);
    setDeleteText('');
    setDeleteError(null);
  };

  const handleDeleteAccount = async () => {
    if (deleteText.trim().toUpperCase() !== 'DELETE' || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteMyAccount();
    if (result.ok) {
      // The account no longer exists: clear the local session.
      await signOut().catch(() => {});
      onClose();
      return;
    }
    setDeleting(false);
    if (result.reason === 'admin_of_bands') {
      const names = result.bands.join(', ');
      setDeleteError(
        `You're the only admin of ${names || 'a band'} with other members. Make someone else admin (Band members → role) or remove the members, then try again.`
      );
    } else {
      setDeleteError(result.message);
    }
  };

  const getSectionTitle = (): string => {
    switch (activeSection) {
      case 'notifications': return 'Notifications';
      case 'appearance': return 'Appearance';
      case 'privacy': return 'Privacy & account';
      case 'help': return 'Help & support';
      case 'about': return 'About';
      case 'language': return 'Language';
      default: return 'App settings';
    }
  };

  const renderMenu = () => (
    <nav aria-label="Settings sections" className="flex flex-col gap-3">
      {SECTIONS.map((sec) => {
        const Icon = sec.icon;
        return (
          <button
            key={sec.id}
            type="button"
            onClick={() => setActiveSection(sec.id)}
            className={cn(CARD, ROW, PRESSABLE, 'min-h-[72px]')}
          >
            <IconTile>
              <Icon />
            </IconTile>
            <RowText title={sec.label} hint={sec.hint} />
            {sec.value && (
              <span className="bw-label-sm text-muted-foreground shrink-0">{sec.value}</span>
            )}
            <ChevronRight aria-hidden className="w-[18px] h-[18px] text-foreground shrink-0" />
          </button>
        );
      })}
    </nav>
  );

  const renderNotificationsSection = () => (
    <div className="flex flex-col gap-3">
      <div
        role="status"
        className="dark bg-sheet text-sheet-foreground rounded-full px-5 py-4 flex items-center gap-3"
      >
        <Bell aria-hidden className="w-[22px] h-[22px] text-accent shrink-0" />
        <span className="bw-label-md">{notificationStatus}</span>
      </div>

      <div className={cn(CARD, ROW)}>
        <IconTile>
          <Bell />
        </IconTile>
        <RowText title="Push notifications" hint="Gig invites, polls, chat messages" />
        <Toggle
          checked={pushEnabled}
          onCheckedChange={handleTogglePush}
          aria-label="Push notifications"
        />
      </div>

      <div className={cn(CARD, ROW)}>
        <IconTile>
          <Mail />
        </IconTile>
        <RowText title="Email notifications" hint="Invites and schedule updates" />
        <Toggle
          checked={emailEnabled}
          onCheckedChange={handleToggleEmail}
          aria-label="Email notifications"
        />
      </div>

      <div className={cn(CARD, ROW)}>
        <IconTile>
          <Play />
        </IconTile>
        <RowText title="Sound effects" hint="In-app sounds" />
        <Toggle
          checked={soundEnabled}
          onCheckedChange={handleToggleSound}
          aria-label="Sound effects"
        />
      </div>

      <p className="bw-body-sm text-muted-foreground">
        Urgent invites and polls always show a pop-up, even when push is off.
      </p>
    </div>
  );

  const renderAppearanceSection = () => (
    <div className={cn(CARD, 'p-4 flex flex-col gap-3')}>
      <div className="flex items-center justify-between gap-3">
        <span className="bw-label-sm text-muted-foreground">Theme</span>
        <span className="bw-label-sm text-muted-foreground">Current: {resolvedTheme} mode</span>
      </div>
      <div role="group" aria-label="Theme" className="flex items-center gap-2">
        {[
          { id: 'light' as const, label: 'Light' },
          { id: 'dark' as const, label: 'Dark' },
          { id: 'system' as const, label: 'System' },
        ].map((t) => (
          <Selector
            key={t.id}
            size="md"
            selected={mode === t.id}
            onClick={() => setMode(t.id)}
            className="flex-1 min-w-0 justify-center"
          >
            {t.label}
          </Selector>
        ))}
      </div>
    </div>
  );

  const renderPrivacySection = () => (
    <div className="flex flex-col gap-3">
      <div className={cn(CARD, ROW)}>
        <IconTile>
          <Eye />
        </IconTile>
        <RowText title="Workspace privacy" hint="Member-only visibility within active band" />
        <Toggle checked={true} disabled aria-label="Workspace privacy" />
      </div>

      <div className={cn(CARD, 'p-4 flex flex-col gap-3 border-[1.5px] border-destructive')}>
        <div className="flex items-center gap-3">
          <Trash2 aria-hidden className="w-5 h-5 text-destructive shrink-0" />
          <span className="bw-h2 text-destructive">Delete account</span>
        </div>
        <p className="bw-body-md text-foreground">
          Permanently removes your account and user profile. If you're the only admin of a band
          with other members, make someone else admin first.
        </p>
        <PillButton
          variant="danger"
          size="md"
          fullWidth={false}
          onClick={() => setShowDeleteConfirm(true)}
          icon={<Trash2 aria-hidden className="w-[18px] h-[18px]" />}
          className="self-start"
        >
          Delete account
        </PillButton>
      </div>
    </div>
  );

  const renderHelpSection = () => (
    <button
      type="button"
      onClick={() => window.open('mailto:support@bandwith.app?subject=Help%20Request', '_blank')}
      className={cn(CARD, ROW, PRESSABLE)}
    >
      <IconTile>
        <Mail />
      </IconTile>
      <RowText title="Contact support" hint="support@bandwith.app" />
      <ArrowUpRight aria-hidden className="w-[18px] h-[18px] text-foreground shrink-0" />
    </button>
  );

  const renderAboutSection = () => (
    <div className={cn(CARD, 'p-5 flex flex-col gap-4')}>
      <BrandLogo variant="waveform" lockup="horizontal" className="h-8" textClassName="text-2xl" />
      <span className="bw-label-sm text-muted-foreground">Version 1.0.0</span>
      <p className="bw-body-sm text-muted-foreground">
        All workspace data encrypted end-to-end. Built for musicians, managers, and touring crews.
      </p>
    </div>
  );

  const renderLanguageSection = () => (
    <div className={cn(CARD, ROW)}>
      <IconTile>
        <Globe />
      </IconTile>
      <RowText title="Language" hint="English (US)" />
      <Tag variant="accent">Active</Tag>
    </div>
  );

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'tween', duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      className="fixed inset-0 z-[70] bg-[var(--bg)] text-foreground overflow-y-auto overflow-x-hidden flex flex-col min-h-screen"
      style={{
        overscrollBehaviorX: 'none',
        touchAction: 'pan-y',
      }}
    >
      {/* Sticky Top Bar (Figma: Top Bar — back circle + H2 title) */}
      <div
        className="px-4 shrink-0 bg-[var(--bg)] sticky top-0 z-30 bw-status-clear"
        style={{
          paddingTop: 'calc(var(--safe-top) + 8px)',
        }}
      >
        <div className="max-w-xl mx-auto w-full h-14 flex items-center gap-3">
          <NavBackButton size="sm" onClick={handleBack} />
          <h1 className="bw-h2 text-foreground truncate min-w-0 flex-1">{getSectionTitle()}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-3 pb-2 max-w-xl mx-auto w-full flex flex-col gap-3">
        {activeSection === null && renderMenu()}
        {activeSection === 'notifications' && renderNotificationsSection()}
        {activeSection === 'appearance' && renderAppearanceSection()}
        {activeSection === 'privacy' && renderPrivacySection()}
        {activeSection === 'help' && renderHelpSection()}
        {activeSection === 'about' && renderAboutSection()}
        {activeSection === 'language' && renderLanguageSection()}

        {/* Footer */}
        <p className="bw-label-sm text-muted-foreground pt-1">v1.0.0 · All data encrypted</p>

        {/* Bottom clearance spacer ensuring the footer cleanly clears the floating navbar */}
        <div
          className="shrink-0 pointer-events-none"
          style={{ height: 'var(--content-bottom-clearance, 136px)' }}
          aria-hidden="true"
        />
      </div>

      {/* Delete Confirm Modal (Figma: Account / Delete – confirm) */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/65 flex items-center justify-center p-6"
            onClick={closeDeleteConfirm}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-account-title"
              aria-describedby="delete-account-desc"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => { if (e.key === 'Escape') closeDeleteConfirm(); }}
              className="w-full max-w-[342px] rounded-[24px] bg-[var(--bg)] text-foreground p-6 flex flex-col gap-4"
            >
              <div className="w-14 h-14 rounded-full bg-destructive-solid text-white flex items-center justify-center shrink-0">
                <AlertCircle aria-hidden className="w-6 h-6" />
              </div>
              <h2 id="delete-account-title" className="bw-h1 text-foreground">
                Delete account?
              </h2>
              <p id="delete-account-desc" className="bw-body-md text-muted-foreground">
                This can't be undone. Your profile, your personal gigs and any band where you're the
                only member are deleted for good. Bands you share with others stay, without you.
              </p>
              <div className="flex flex-col gap-2">
                <label htmlFor="delete-account-confirm" className="bw-label-sm text-muted-foreground">
                  Type DELETE to confirm
                </label>
                <div
                  className={cn(
                    'h-[52px] rounded-full bg-field px-4 flex items-center gap-3 transition-colors',
                    deleteError ? 'border-2 border-destructive' : 'border border-border focus-within:border-2 focus-within:border-foreground'
                  )}
                >
                  <input
                    id="delete-account-confirm"
                    type="text"
                    autoComplete="off"
                    autoCapitalize="characters"
                    autoFocus
                    value={deleteText}
                    onChange={(e) => setDeleteText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleDeleteAccount(); }}
                    disabled={deleting}
                    aria-invalid={!!deleteError}
                    className="flex-1 min-w-0 bg-transparent bw-body-lg text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                  />
                  {deleteError && (
                    <AlertCircle aria-hidden className="w-5 h-5 text-destructive shrink-0" />
                  )}
                </div>
                {deleteError && (
                  <p role="alert" className="bw-body-sm text-destructive">
                    {deleteError}
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <PillButton variant="outline" className="flex-1" onClick={closeDeleteConfirm} disabled={deleting}>
                  Cancel
                </PillButton>
                <PillButton
                  variant="dark"
                  className="flex-1 bg-destructive-solid text-white"
                  onClick={handleDeleteAccount}
                  disabled={deleting || deleteText.trim().toUpperCase() !== 'DELETE'}
                  aria-busy={deleting}
                  loading={deleting}
                  icon={<Trash2 aria-hidden className="w-5 h-5" />}
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </PillButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
