import React, { useState, useEffect } from 'react';
import { readLocalPref, loadNotificationPrefs, saveNotificationPref } from '@/lib/services/notificationPrefs';
import { loadPrivacyPrefs, savePrivacyPref } from '@/lib/services/privacyPrefs';
import { exportMyData } from '@/lib/services/dataExport';
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
  Download,
  Smartphone,
  FileText,
} from '@/app/components/icons';
import { LegalSheet, type LegalDoc } from '@/app/components/legal/LegalSheet';
import { deleteMyAccount } from '@/lib/services/account';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { cn } from '@/app/components/ui/utils';
import { useRailLayout } from '@/lib/deviceRegions';
import { usePosture, useLaptopPoseEnabled, setLaptopPoseEnabled } from '@/lib/posture';

type SettingsSection = 'notifications' | 'appearance' | 'privacy' | 'duo' | 'help' | 'about' | 'language';

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

  // iPhone Duo: only where the device reports posture (fold / hinge / Duo
  // status column); ordinary phones never see it.
  const { detected: postureDetected } = usePosture();
  const laptopPoseEnabled = useLaptopPoseEnabled();

  const SECTIONS: {
    id: SettingsSection;
    label: string;
    hint?: string;
    value?: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'notifications', label: 'Notifications', hint: 'Push and email', icon: Bell },
    { id: 'appearance', label: 'Appearance', hint: 'Light, dark or system', value: themeLabel, icon: Sun },
    { id: 'privacy', label: 'Privacy & account', hint: 'Gig privacy, export, delete account', icon: Lock },
    ...(postureDetected
      ? [{ id: 'duo' as const, label: 'iPhone Duo', hint: 'Laptop pose', value: laptopPoseEnabled ? 'On' : 'Off', icon: Smartphone }]
      : []),
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

  // iPhone Duo, open (Figma "Duo · 09"): the list stays on the leading page
  // and the section you are changing is on the trailing page, so one is
  // always selected (Notifications first).
  const { twoPane } = useRailLayout();
  const selectedSection: SettingsSection | null = twoPane ? activeSection ?? 'notifications' : activeSection;

  const handleBack = () => {
    if (twoPane) {
      onClose();
      return;
    }
    if (activeSection && openedFromMenu) {
      setActiveSection(null);
      return;
    }
    onClose();
  };

  const [pushEnabled, setPushEnabled] = useState(() => readLocalPref('push'));
  const [emailEnabled, setEmailEnabled] = useState(() => readLocalPref('email'));
  useEffect(() => {
    let cancelled = false;
    loadNotificationPrefs().then((prefs) => {
      if (cancelled || !prefs) return;
      if (prefs.push !== undefined) setPushEnabled(prefs.push);
      if (prefs.email !== undefined) setEmailEnabled(prefs.email);
    });
    return () => { cancelled = true; };
  }, []);

  const [notifError, setNotifError] = useState<string | null>(null);

  const handleTogglePush = (val: boolean) => {
    setPushEnabled(val);
    setNotifError(null);
    saveNotificationPref('push', val).then(({ error }) => {
      if (error) {
        setPushEnabled(!val);
        setNotifError(`Couldn’t save push setting: ${error.message}`);
      }
    });
  };

  const handleToggleEmail = (val: boolean) => {
    setEmailEnabled(val);
    setNotifError(null);
    saveNotificationPref('email', val).then(({ error }) => {
      if (error) {
        setEmailEnabled(!val);
        setNotifError(`Couldn’t save email setting: ${error.message}`);
      }
    });
  };

  /* Privacy: profiles.privacy.hidePersonalGigDetails (see privacyPrefs.ts) */
  const [hideGigDetails, setHideGigDetails] = useState(false);
  const [privacyState, setPrivacyState] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading');
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [privacySaving, setPrivacySaving] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadPrivacyPrefs().then((res) => {
      if (cancelled) return;
      if (res.status === 'ready') {
        setHideGigDetails(res.prefs.hidePersonalGigDetails);
        setPrivacyState('ready');
      } else if (res.status === 'unavailable') {
        setPrivacyState('unavailable');
      } else {
        setPrivacyState('error');
        setPrivacyError(`Couldn’t load privacy settings: ${res.error.message}`);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const handleToggleHideGigDetails = (val: boolean) => {
    if (privacySaving) return;
    setHideGigDetails(val);
    setPrivacyError(null);
    setPrivacySaving(true);
    savePrivacyPref('hidePersonalGigDetails', val).then(({ error, unavailable }) => {
      setPrivacySaving(false);
      if (error) {
        setHideGigDetails(!val);
        if (unavailable) setPrivacyState('unavailable');
        setPrivacyError(unavailable ? error.message : `Couldn’t save: ${error.message}`);
      }
    });
  };

  /* Export my data (dataExport.ts) */
  const [exporting, setExporting] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      await exportMyData();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Couldn’t export your data.');
    } finally {
      setExporting(false);
    }
  };


  const notificationStatus = (() => {
    const on = [
      pushEnabled && 'push',
      emailEnabled && 'email',
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
      const names = result.bands.filter(Boolean);
      const list =
        names.length <= 1
          ? names[0] || 'your band'
          : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
      setDeleteError(`Add another admin to ${list} first.`);
    } else {
      setDeleteError(result.message);
    }
  };

  const getSectionTitle = (section: SettingsSection | null = activeSection): string => {
    switch (section) {
      case 'notifications': return 'Notifications';
      case 'appearance': return 'Appearance';
      case 'privacy': return 'Privacy & account';
      case 'duo': return 'iPhone Duo';
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
        const selected = twoPane && selectedSection === sec.id;
        return (
          <button
            key={sec.id}
            type="button"
            onClick={() => setActiveSection(sec.id)}
            aria-current={selected ? 'page' : undefined}
            className={cn(CARD, ROW, PRESSABLE, 'min-h-[72px]', selected && 'ring-[1.5px] ring-inset ring-foreground')}
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
        <RowText title="Email notifications" hint="Band invites by email" />
        <Toggle
          checked={emailEnabled}
          onCheckedChange={handleToggleEmail}
          aria-label="Email notifications"
        />
      </div>

      {notifError && (
        <p role="alert" className="bw-body-sm text-destructive">
          {notifError}
        </p>
      )}

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
      <div className={cn(CARD, 'p-4 flex flex-col gap-2')}>
        <div className="flex items-center gap-3">
          <IconTile>
            <Eye />
          </IconTile>
          <RowText
            title="Hide my personal gigs' details from bands"
            hint={
              privacyState === 'unavailable'
                ? 'Not available yet'
                : 'Bands see you as busy, without title or venue'
            }
          />
          <Toggle
            checked={hideGigDetails}
            onCheckedChange={handleToggleHideGigDetails}
            disabled={privacyState !== 'ready' || privacySaving}
            aria-label="Hide my personal gigs' details from bands"
          />
        </div>
        {privacyError && (
          <p role="alert" className="bw-body-sm text-destructive">
            {privacyError}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={handleExport}
        disabled={exporting}
        aria-busy={exporting}
        className={cn(CARD, ROW, PRESSABLE, 'disabled:opacity-60')}
      >
        <IconTile>
          <Download />
        </IconTile>
        <RowText title="Export my data" hint={exporting ? 'Preparing your file…' : 'Download a JSON copy'} />
        <ChevronRight aria-hidden className="w-[18px] h-[18px] text-foreground shrink-0" />
      </button>
      {exportError && (
        <p role="alert" className="bw-body-sm text-destructive">
          {exportError}
        </p>
      )}

      <div className={cn(CARD, 'flex flex-col')}>
        {(['terms', 'privacy'] as const).map((doc, i) => (
          <button
            key={doc}
            type="button"
            onClick={() => setLegalDoc(doc)}
            className={cn(ROW, PRESSABLE, i > 0 && 'border-t border-border')}
          >
            <IconTile>
              <FileText />
            </IconTile>
            <RowText title={doc === 'terms' ? 'Terms of Service' : 'Privacy Policy'} hint={doc === 'terms' ? 'The rules for using BandWith' : 'How your data is used and protected'} />
            <ChevronRight aria-hidden className="w-[18px] h-[18px] text-foreground shrink-0" />
          </button>
        ))}
      </div>
      <LegalSheet doc={legalDoc} onClose={() => setLegalDoc(null)} />

      <div className={cn(CARD, 'p-4 flex flex-col gap-3 border-[1.5px] border-destructive')}>
        <div className="flex items-center gap-3">
          <Trash2 aria-hidden className="w-5 h-5 text-destructive shrink-0" />
          <span className="bw-h2 text-destructive">Delete account</span>
        </div>
        <p className="bw-body-md text-foreground">
          Permanently removes your profile, personal gigs and messages. Bands you admin must have
          another admin first.
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

  const renderDuoSection = () => (
    <div className={cn(CARD, ROW)}>
      <IconTile>
        <Smartphone />
      </IconTile>
      <RowText title="Laptop pose" hint="Switch layouts when the phone is half open on a table" />
      <Toggle
        checked={laptopPoseEnabled}
        onCheckedChange={(on: boolean) => setLaptopPoseEnabled(on)}
        aria-label="Laptop pose"
      />
    </div>
  );

  const renderSection = (section: SettingsSection | null) => (
    <>
      {section === null && renderMenu()}
      {section === 'notifications' && renderNotificationsSection()}
      {section === 'appearance' && renderAppearanceSection()}
      {section === 'privacy' && renderPrivacySection()}
      {section === 'duo' && renderDuoSection()}
      {section === 'help' && renderHelpSection()}
      {section === 'about' && renderAboutSection()}
      {section === 'language' && renderLanguageSection()}
    </>
  );

  /* Figma: Top Bar — back circle + H2 title. On the Duo, Back is in the rail. */
  const renderTopBar = (title: string, withBack: boolean) => (
    <div
      className="px-4 shrink-0 bg-[var(--bg)] sticky top-0 z-30 bw-status-clear"
      style={{
        paddingTop: 'calc(var(--safe-top) + 8px)',
      }}
    >
      <div className="max-w-xl mx-auto w-full h-14 flex items-center gap-3">
        {withBack && <NavBackButton size="sm" onClick={handleBack} />}
        <h1 className="bw-h2 text-foreground truncate min-w-0 flex-1">{title}</h1>
      </div>
    </div>
  );

  /* Bottom spacer: the nav bar is hidden here, so only the home indicator needs clearing */
  const bottomSpacer = (
    <div
      className="shrink-0 pointer-events-none"
      style={{ height: 'calc(var(--safe-bottom) + 40px)' }}
      aria-hidden="true"
    />
  );

  const slideUp = {
    initial: { y: '100%' },
    animate: { y: 0 },
    exit: { y: '100%' },
    transition: { type: 'tween' as const, duration: 0.3, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] },
  };
  const layerClass = 'fixed inset-0 z-[70] bg-[var(--bg)] text-foreground overflow-y-auto overflow-x-hidden flex flex-col min-h-screen';
  const layerStyle: React.CSSProperties = { overscrollBehaviorX: 'none', touchAction: 'pan-y' };

  // Figma "Open · Settings / Privacy & account | Account / Delete – confirm":
  // while you confirm, what will be deleted stays readable on the left.
  const leadingSection: SettingsSection | null = twoPane && showDeleteConfirm ? 'privacy' : null;

  return (
    <>
    <motion.div
      {...slideUp}
      className={cn(layerClass, twoPane && 'bw-pane-hub')}
      style={layerStyle}
    >
      {renderTopBar(twoPane ? getSectionTitle(leadingSection) : getSectionTitle(), true)}

      {/* Content */}
      <div className="px-4 pt-3 pb-2 max-w-xl mx-auto w-full flex flex-col gap-3">
        {renderSection(twoPane ? leadingSection : activeSection)}

        {/* Footer */}
        <p className="bw-label-sm text-muted-foreground pt-1">v1.0.0 · All data encrypted</p>

        {bottomSpacer}
      </div>
    </motion.div>

    {twoPane && selectedSection && (
      <motion.div
        key="settings-detail"
        {...slideUp}
        className={cn(layerClass, 'bw-pane-detail')}
        style={layerStyle}
      >
        {renderTopBar(getSectionTitle(selectedSection), false)}
        <div className="px-4 pt-3 pb-2 max-w-xl mx-auto w-full flex flex-col gap-3">
          {renderSection(selectedSection)}
          {bottomSpacer}
        </div>
      </motion.div>
    )}

      {/* Delete Confirm Modal (Figma: Account / Delete – confirm) */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bw-pane-dialog fixed inset-0 z-[80] bg-black/65 flex items-center justify-center p-6"
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
                This can't be undone. Your profile, personal gigs and messages will be deleted.
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
    </>
  );
};
