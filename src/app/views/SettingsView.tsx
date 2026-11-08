import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BrandLogo } from '@/app/components/ui/BrandLogo';
import { 
  Bell,
  Smartphone,
  Volume2,
  VolumeX,
  ArrowLeft,
  ArrowUpRight,
  Shield,
  HelpCircle,
  Sun,
  Moon,
  Monitor,
  Globe,
  Trash2,
  AlertTriangle,
} from '@/app/components/icons';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { Switch } from '@/app/components/ui/switch';
import { cn } from '@/app/components/ui/utils';

type SettingsSection = 'notifications' | 'appearance' | 'privacy' | 'help' | 'about' | 'language';

interface SettingsViewProps {
  onClose: () => void;
  initialSection?: string;
  isAdmin?: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onClose,
  initialSection = 'notifications',
}) => {
  const { signOut, user } = useAuth();
  const { mode, setMode, resolvedTheme } = useTheme();

  const safeInitialSection: SettingsSection = 
    initialSection === 'main' || !initialSection
      ? 'notifications'
      : (initialSection as SettingsSection);

  const [activeSection] = useState<SettingsSection>(safeInitialSection);

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

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const getSectionTitle = (): string => {
    switch (activeSection) {
      case 'notifications': return 'NOTIFICATIONS';
      case 'appearance': return 'APPEARANCE';
      case 'privacy': return 'PRIVACY & SECURITY';
      case 'help': return 'HELP & SUPPORT';
      case 'about': return 'ABOUT';
      case 'language': return 'LANGUAGE';
      default: return 'SETTINGS';
    }
  };

  const renderNotificationsSection = () => (
    <div className="bg-card rounded-2xl border border-border/40 divide-y divide-border/30 overflow-hidden shadow-sm">
      <div className="p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center text-foreground shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold uppercase tracking-wide text-foreground">
              Push Notifications
            </span>
            <span className="text-xs text-muted-foreground font-normal">
              Receive alerts on this device
            </span>
          </div>
        </div>
        <Switch checked={pushEnabled} onCheckedChange={handleTogglePush} />
      </div>

      <div className="p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center text-foreground shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold uppercase tracking-wide text-foreground">
              Email Notifications
            </span>
            <span className="text-xs text-muted-foreground font-normal">
              Get schedule updates in your inbox
            </span>
          </div>
        </div>
        <Switch checked={emailEnabled} onCheckedChange={handleToggleEmail} />
      </div>

      <div className="p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center text-foreground shrink-0">
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold uppercase tracking-wide text-foreground">
              Sound Effects
            </span>
            <span className="text-xs text-muted-foreground font-normal">
              Play sounds for alerts and notifications
            </span>
          </div>
        </div>
        <Switch checked={soundEnabled} onCheckedChange={handleToggleSound} />
      </div>
    </div>
  );

  const renderAppearanceSection = () => (
    <div className="bg-card rounded-2xl border border-border/40 divide-y divide-border/30 overflow-hidden shadow-sm">
      <div className="p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-foreground/5 flex items-center justify-center text-foreground shrink-0">
            {resolvedTheme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold uppercase tracking-wide text-foreground">Theme</span>
            <span className="text-xs text-muted-foreground">Current: {resolvedTheme} mode</span>
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
    </div>
  );

  const renderPrivacySection = () => (
    <div className="bg-card rounded-2xl border border-border/40 divide-y divide-border/30 overflow-hidden shadow-sm">
      <div className="p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center text-foreground shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold uppercase tracking-wide text-foreground">
              Workspace Privacy
            </span>
            <span className="text-xs text-muted-foreground font-normal">
              Member-only visibility within active band
            </span>
          </div>
        </div>
        <Switch checked={true} disabled />
      </div>

      <div className="p-4 flex items-center justify-between gap-3">
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--destructive)]">
            Delete Account
          </span>
          <span className="text-xs text-muted-foreground font-normal">
            Permanently remove your account and user profile
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="px-3 py-1.5 rounded-lg border border-[var(--destructive)]/30 text-[var(--destructive)] text-xs font-bold uppercase tracking-wider hover:bg-[var(--destructive)]/10 active:scale-95 transition-all"
        >
          Delete
        </button>
      </div>
    </div>
  );

  const renderHelpSection = () => (
    <div className="bg-card rounded-2xl border border-border/40 divide-y divide-border/30 overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => window.open('mailto:support@bandwith.app?subject=Help%20Request', '_blank')}
        className="p-4 flex items-center justify-between w-full hover:bg-foreground/[0.02] active:bg-foreground/[0.04] transition-colors text-left"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center text-foreground shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold uppercase tracking-wide text-foreground">Contact Support</span>
            <span className="text-xs text-muted-foreground font-normal">support@bandwith.app</span>
          </div>
        </div>
        <ArrowUpRight className="w-4 h-4 text-foreground/40" />
      </button>
    </div>
  );

  const renderAboutSection = () => (
    <div className="bg-card rounded-2xl border border-border/40 p-6 flex flex-col gap-4 shadow-sm text-center items-center">
      <BrandLogo variant="waveform" lockup="horizontal" className="h-8" textClassName="text-2xl" />
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Version 1.0.0</span>
      <p className="text-xs text-muted-foreground">
        All workspace data encrypted end-to-end. Built for musicians, managers, and touring crews.
      </p>
    </div>
  );

  const renderLanguageSection = () => (
    <div className="bg-card rounded-2xl border border-border/40 p-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center text-foreground shrink-0">
          <Globe className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-bold uppercase tracking-wide text-foreground">Language</span>
          <span className="text-xs text-muted-foreground font-normal">English (US)</span>
        </div>
      </div>
      <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Active</span>
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
      {/* Sticky Header */}
      <div
        className="px-4 shrink-0 border-b border-border/30 bg-background/95 backdrop-blur-md sticky top-0 z-30"
        style={{
          paddingTop: 'var(--wizard-header-pt, max(env(safe-area-inset-top, 0px), 56px))',
          paddingBottom: '14px',
        }}
      >
        <div className="max-w-xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              aria-label="Back"
              className="w-10 h-10 rounded-full border border-border/40 bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center text-foreground active:scale-90 transition-all shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                APP SETTINGS
              </span>
              <h1 className="text-[20px] sm:text-[22px] font-black text-foreground uppercase tracking-tight leading-none">
                {getSectionTitle()}
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        className="px-4 pt-6 pb-2 max-w-xl mx-auto w-full flex flex-col gap-6"
      >
        {activeSection === 'notifications' && renderNotificationsSection()}
        {activeSection === 'appearance' && renderAppearanceSection()}
        {activeSection === 'privacy' && renderPrivacySection()}
        {activeSection === 'help' && renderHelpSection()}
        {activeSection === 'about' && renderAboutSection()}
        {activeSection === 'language' && renderLanguageSection()}

        {/* Footer */}
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

      {/* Delete Confirm Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-card border border-border/40 p-6 flex flex-col gap-5 shadow-xl"
            >
              <div className="w-12 h-12 mx-auto bg-[var(--destructive)]/10 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-[var(--destructive)]" />
              </div>
              <div className="flex flex-col gap-1.5 text-center">
                <h2 className="text-lg font-bold text-foreground uppercase">Delete Account?</h2>
                <p className="text-xs text-muted-foreground">
                  This action cannot be undone. All your data will be permanently deleted.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 h-11 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-foreground font-bold text-xs uppercase active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                    onClose();
                  }}
                  className="flex-1 h-11 rounded-xl bg-[var(--destructive)] text-white font-bold text-xs uppercase active:scale-95 transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
