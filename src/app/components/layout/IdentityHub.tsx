import React, { useState, useRef, useEffect } from 'react';
import { readLocalPref, loadNotificationPrefs, saveNotificationPrefs } from '@/lib/services/notificationPrefs';
import { exportMyData } from '@/lib/services/dataExport';
import { cn } from '@/app/components/ui/utils';
import { motion, AnimatePresence } from 'motion/react';
import { HEADER_SPRING } from '@/styles/motion';
import {
  X,
  Plus,
  ArrowUpRight,
  LogOut,
  Music,
  Box,
  FileSignature,
  CheckSquare,
  CurrencyIcon,
  Users,
  Mail,
  ChevronRight,
  Download,
  IconSettings,
  Check,
  Edit3,
  Upload,
  Trash2,
} from '@/app/components/icons';
import { DotText, Toggle } from '@/app/components/bw';
import { HeaderAction, IconButton, Tag, ListRow } from '@/app/components/bw/Screen';
import { useRailCover, useRailOwnsChrome } from '@/lib/railActions';
import { PillButton, PillField } from '@/app/components/bw/Form';
import { VenueAutocomplete } from '@/app/components/ui/VenueAutocomplete';
import { Band } from '@/app/data/bands';
import { NotificationItem } from '@/app/data/notifications';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useBand } from '@/lib/BandContext';
import { updateBand } from '@/lib/services/bands';
import { uploadBandBrandingAsset, getBandPricing, saveBandPricing } from '@/lib/services/pricing';
import { personName, personInitials, hasRealName } from '@/lib/personName';
import { useT } from '@/lib/i18n';
import { assetStatusParts, EMPTY_ASSET_STATUS, type AssetId, type AssetStatusCounts, type StatusPart } from '@/lib/assetStatus';

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
  entityCounts?: { templates: number; documents: number; inventory: number; repertoire: number; status?: AssetStatusCounts };
  onEntityDetailClick?: (label: string) => void;
  onEditProfile?: () => void;
  onEditBand?: () => void;
  onAddEntity?: () => void;
  onOpenPricing?: () => void;
  onOpenBandSettings?: () => void;
  onOpenSettings?: (section?: string) => void;
  onBandUpdated?: () => void;
  /** Bands that have this account as a deputy (086): shows "Deputy gigs". */
  deputyBandCount?: number;
  onOpenDeputyGigs?: () => void;
}

/* Figma "Who you are": cards sit on bg/card in light and bg/sheet in dark. */
const HUB_CARD = 'bg-card text-card-foreground dark:bg-sheet dark:text-sheet-foreground';

const initialsOf = (name: string, fallback = 'BW') =>
  name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || fallback;

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
  onOpenSettings,
  deputyBandCount = 0,
  onOpenDeputyGigs,
  onBandUpdated,
}) => {
  const { signOut, user, profile } = useAuth();
  const t = useT();
  const { mode, setMode, resolvedTheme } = useTheme();
  const {
    isAdmin: isBandAdmin,
    selectedBand: activeBandDetails,
    bands: realBandsList,
    refreshBands,
  } = useBand();

  // --bw-head-top: Laptop pose on iPhone Duo starts top bars beside the clock
  // block instead of below it (index.css); elsewhere it is unset.
  const topInset = 'max(var(--bw-head-top, var(--safe-top)), 12px)';

  // iPhone Duo: the profile covers the screen beneath, so its Back/Search
  // leave the rail; the hub keeps its own close (Figma "Identity / Who you are").
  useRailCover(isOpen, false, false);
  const railChrome = useRailOwnsChrome();

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
    if (!isScrolledRef.current && top > 20) {
      isScrolledRef.current = true;
      setIsScrolled(true);
    } else if (isScrolledRef.current && top < 8) {
      isScrolledRef.current = false;
      setIsScrolled(false);
    }
  };

  const [isEditingBandDetails, setIsEditingBandDetails] = useState(false);
  const [editBandName, setEditBandName] = useState('');
  const [editBandDescription, setEditBandDescription] = useState('');
  const [editBandCity, setEditBandCity] = useState('');
  // Coordinates of the picked suggestion (travel fees use them); null when typed by hand.
  const [editBandCoords, setEditBandCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [editBandLogoUrl, setEditBandLogoUrl] = useState('');
  const [uploadingBandLogo, setUploadingBandLogo] = useState(false);
  const [savingBandDetails, setSavingBandDetails] = useState(false);
  const bandLogoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setEditBandName(activeBandDetails?.name || selectedBand.name || '');
    setEditBandDescription(activeBandDetails?.description || '');
    setEditBandCity(activeBandDetails?.home_base_address || '');
    setEditBandLogoUrl(activeBandDetails?.logo_url || '');
    setIsEditingBandDetails(false);
  }, [
    activeBandDetails?.id,
    activeBandDetails?.name,
    activeBandDetails?.description,
    activeBandDetails?.home_base_address,
    activeBandDetails?.logo_url,
    selectedBand.name,
  ]);

  const handleBandLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBandLogo(true);
    try {
      const bandIdStr = activeBandDetails?.id || String(selectedBand.id || 'default');
      const url = await uploadBandBrandingAsset(bandIdStr, file, 'logo');
      setEditBandLogoUrl(url);
    } catch (err) {
      console.error('Band logo upload failed:', err);
    } finally {
      setUploadingBandLogo(false);
      e.target.value = '';
    }
  };

  const handleSaveBandIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = editBandName.trim();
    if (!trimmedName) return;
    setSavingBandDetails(true);
    try {
      if (activeBandDetails?.id) {
        await updateBand(activeBandDetails.id, {
          name: trimmedName,
          description: editBandDescription.trim() || undefined,
          home_base_address: editBandCity.trim() || undefined,
          logo_url: editBandLogoUrl || undefined,
        });
        // Also keep quote PDF branding logo & origin synced
        const currentPricing = await getBandPricing(activeBandDetails.id);
        await saveBandPricing({
          ...currentPricing,
          band_id: activeBandDetails.id,
          band_logo_url: editBandLogoUrl || currentPricing.band_logo_url || '',
          band_origin_address: editBandCity.trim() || currentPricing.band_origin_address || '',
          ...(editBandCoords
            ? { band_origin_lat: editBandCoords.lat, band_origin_lng: editBandCoords.lng }
            : {}),
        });
        await refreshBands();
        onBandUpdated?.();
      }
      setIsEditingBandDetails(false);
    } catch (err) {
      console.error('Failed to update band details:', err);
    } finally {
      setSavingBandDetails(false);
    }
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

  // Figma "Who you are": one master toggle that switches push and email together.
  const alertsOn = pushEnabled || emailEnabled;
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const handleToggleAlerts = (val: boolean) => {
    if (savingAlerts) return;
    const prev = { push: pushEnabled, email: emailEnabled };
    setPushEnabled(val);
    setEmailEnabled(val);
    setAlertsError(null);
    setSavingAlerts(true);
    saveNotificationPrefs({ push: val, email: val }).then(({ error }) => {
      setSavingAlerts(false);
      if (error) {
        setPushEnabled(prev.push);
        setEmailEnabled(prev.email);
        setAlertsError(t('Couldn’t save notifications: {error}', { error: error.message }));
      }
    });
  };

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      await exportMyData();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : t('Couldn’t export your data.'));
    } finally {
      setExporting(false);
    }
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

  const notificationStatus =
    pushEnabled && emailEnabled
      ? t('Push & email alerts enabled')
      : pushEnabled
        ? t('Push alerts enabled')
        : emailEnabled
          ? t('Email alerts enabled')
          : t('Alerts off');

  const displayName = personName({ full_name: profile?.full_name, email: user?.email }, t('User'));
  const displayEmail = user?.email || t('No email attached');
  // No name yet: the address stands in for it, and the card asks for a name.
  const missingName = !hasRealName({ full_name: profile?.full_name, email: user?.email });
  const displayInitials = personInitials({ full_name: profile?.full_name, email: user?.email }, 'BW');

  const roleLabel = selectedBand.role || (profile?.role ? profile.role.toUpperCase() : 'MEMBER');
  const isAdmin = isBandAdmin || roleLabel === 'ADMIN';

  const rosterMembers = activeBandDetails?.members || [];
  const lineupCount =
    selectedBand.members || activeBandDetails?.member_count || rosterMembers.length || 1;
  const myBandMember = rosterMembers.find((m) => m.user_id === user?.id);
  // Role tag under the name: profile instrument first, then this band's lineup entry.
  // Onboarding stores lowercase ids ("guitar, keys"), so title-case each part.
  const formatInstrument = (raw?: string | null) => {
    const parts = (raw || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => (p.length <= 2 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1)));
    return parts.length ? parts.join(', ') : null;
  };
  const myInstrument = formatInstrument(profile?.instrument) || formatInstrument(myBandMember?.instrument);
  const bandInitials =
    selectedBand.initials ||
    selectedBand.name
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ||
    'BW';

  // Contracts hold the client and the gig price: admins only (migration 075).
  const allAssetShortcuts = [
    {
      id: 'REPERTOIRE',
      label: t('Repertoire'),
      count: entityCounts?.repertoire ?? 0,
      unit: t('songs'),
      icon: Music,
    },
    {
      id: 'INVENTORY',
      label: t('Gear & inventory'),
      count: entityCounts?.inventory ?? 0,
      unit: t('items'),
      icon: Box,
    },
    {
      id: 'DOCUMENTS',
      label: t('Contracts & docs'),
      count: entityCounts?.documents ?? 0,
      unit: t('files'),
      icon: FileSignature,
    },
    {
      id: 'TEMPLATES',
      label: t('To-do lists'),
      count: entityCounts?.templates ?? 0,
      unit: t('lists'),
      icon: CheckSquare,
    },
  ];
  const statusParts = assetStatusParts(entityCounts?.status ?? EMPTY_ASSET_STATUS, {
    repertoire: entityCounts?.repertoire ?? 0,
    inventory: entityCounts?.inventory ?? 0,
    documents: entityCounts?.documents ?? 0,
    templates: entityCounts?.templates ?? 0,
  });
  const partText = (p: StatusPart): string => {
    const n = p.count ?? 0;
    switch (p.key) {
      case 'ready': return t('{count} ready', { count: n });
      case 'allReady': return t('All ready');
      case 'learning': return t('{count} learning', { count: n });
      case 'repair': return t('{count} in repair', { count: n });
      case 'missing': return t('{count} missing', { count: n });
      case 'toSign': return t('{count} to sign', { count: n });
      case 'drafts': return n === 1 ? t('1 draft') : t('{count} drafts', { count: n });
      case 'overdue': return t('{count} overdue', { count: n });
      case 'due': return t('{count} due this week', { count: n });
      case 'allGood': return t('All in order');
      case 'nothingToSign': return t('Nothing to sign');
      case 'nothingDue': return t('Nothing due this week');
    }
  };
  const assetShortcuts = isAdmin
    ? allAssetShortcuts
    : allAssetShortcuts.filter((item) => item.id !== 'DOCUMENTS');

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'tween', duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          onScroll={handleContainerScroll}
          className="bw-pane-hub fixed inset-0 z-[60] bg-background text-foreground overflow-y-auto overflow-x-hidden flex flex-col min-h-screen"
          style={{
            overscrollBehaviorX: 'none',
            touchAction: 'pan-y',
          }}
        >
          {/* ═══ STICKY HEADER (Expanded -> Compact Morph, Zero Layout Shift) ═══ */}
          <div
            className="sticky top-0 z-30 shrink-0 pointer-events-none select-none"
            style={{
              height: `calc(${topInset} + 72px)`,
              overflowAnchor: 'none',
            }}
          >
            <div
              className={cn(
                'absolute top-0 left-0 right-0 px-4 pointer-events-auto bg-background'
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
                transition={HEADER_SPRING}
                style={{ willChange: 'height' }}
                className="max-w-[34rem] mx-auto w-full relative overflow-hidden"
              >
                <div className="flex flex-col pr-14 pt-2">
                  <motion.span
                    initial={false}
                    animate={{
                      y: isScrolled ? 2 : 0,
                      scale: isScrolled ? 0.9 : 1,
                    }}
                    transition={HEADER_SPRING}
                    style={{ willChange: 'transform' }}
                    className="bw-label-sm text-muted-foreground h-[14px] flex items-center origin-top-left"
                  >
                    {t('Identity & account')}
                  </motion.span>
                  <motion.h1
                    initial={false}
                    animate={{
                      scale: isScrolled ? 0.55 : 1,
                      y: isScrolled ? 2 : 4,
                    }}
                    transition={HEADER_SPRING}
                    style={{ willChange: 'transform' }}
                    className="bw-display-lg text-foreground origin-top-left whitespace-nowrap"
                  >
                    {t('Who you are')}
                  </motion.h1>
                </div>
                {(showCloseButton || railChrome) && (
                  <HeaderAction
                    label={t('Close Account Hub')}
                    variant="filled"
                    railProminent={false}
                    icon={<X />}
                    onClick={onClose}
                    className="absolute top-2 right-0 bw-status-clear-shift"
                  />
                )}
              </motion.div>
            </div>
          </div>

          {/* ═══ SCROLLABLE CONTENT ═══ */}
          <div className="px-4 pt-5 pb-2 max-w-xl mx-auto w-full flex flex-col gap-4">
            {/* ═══ 1. PROFILE CARD ═══ */}
            <section aria-label={t('Your profile')} className={cn('p-5 rounded-[24px]', HUB_CARD)}>
              <div className="flex items-center gap-4">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={displayName}
                    className="w-16 h-16 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-accent text-accent-foreground bw-h2 flex items-center justify-center shrink-0">
                    {displayInitials}
                  </div>
                )}
                <div className="flex flex-col min-w-0 flex-1 gap-1">
                  <h2
                    className={cn(
                      'text-foreground line-clamp-2',
                      // An address in big uppercase type breaks mid-word: show it as text.
                      missingName ? 'bw-body-lg font-semibold [overflow-wrap:anywhere]' : 'bw-h2 break-words'
                    )}
                  >
                    {missingName && displayName.includes('@') ? (
                      <>
                        {displayName.slice(0, displayName.indexOf('@'))}
                        <wbr />
                        {displayName.slice(displayName.indexOf('@'))}
                      </>
                    ) : (
                      displayName
                    )}
                  </h2>
                  <span className="bw-body-sm text-muted-foreground truncate">{missingName ? t('No name yet') : displayEmail}</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag variant={isAdmin ? 'accent' : 'subtle'}>{myInstrument || (roleLabel === 'ADMIN' ? t('Admin') : roleLabel === 'MEMBER' ? t('Member') : roleLabel)}</Tag>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onEditProfile?.();
                  }}
                  className="h-9 px-2 -mr-2 rounded-full flex items-center gap-2 text-accent-ink bw-button-sm shrink-0 self-start mt-1 active:scale-95 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Edit3 aria-hidden className="w-3.5 h-3.5" />
                  <span>{t('Edit')}</span>
                </button>
              </div>
              {missingName && (
                <button
                  type="button"
                  onClick={() => onEditProfile?.()}
                  className="mt-4 w-full rounded-[16px] bg-accent text-accent-foreground px-4 py-3 flex items-center justify-between gap-3 text-left active:scale-[0.99] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex flex-col gap-0.5 min-w-0">
                    <span className="bw-label-md">{t('Add your name')}</span>
                    <span className="bw-body-sm opacity-80">{t('Your band sees your email until you do.')}</span>
                  </span>
                  <ArrowUpRight aria-hidden className="w-4 h-4 shrink-0" />
                </button>
              )}
            </section>

            {/* Deputy for other bands (086): their requests, answered in the app */}
            {deputyBandCount > 0 && onOpenDeputyGigs && (
              <ListRow
                className={cn('rounded-[24px] px-5', HUB_CARD)}
                icon={<Users aria-hidden className="w-5 h-5" />}
                title={t('Deputy gigs')}
                subtitle={deputyBandCount === 1 ? t('Requests from 1 band') : t('Requests from {count} bands', { count: deputyBandCount })}
                onClick={onOpenDeputyGigs}
              />
            )}

            {/* ═══ 2. CURRENT BAND & LINEUP ═══ */}
            <section
              aria-label={t('Current band')}
              className={cn('p-5 rounded-[24px] flex flex-col gap-4', HUB_CARD)}
            >
              {/* Band identity row */}
              <div className="flex items-center gap-4">
                {activeBandDetails?.logo_url ? (
                  <img
                    src={activeBandDetails.logo_url}
                    alt={selectedBand.name}
                    className="w-16 h-16 rounded-full object-cover border-[1.5px] border-border shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-white text-black border-[1.5px] border-border bw-h2 flex items-center justify-center shrink-0">
                    {bandInitials}
                  </div>
                )}

                <div className="flex flex-col min-w-0 flex-1 gap-2">
                  <h3 className="bw-h2 text-foreground line-clamp-2 break-words">
                    {activeBandDetails?.name || selectedBand.name}
                  </h3>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Tag>
                      {lineupCount === 1 ? t('{count} musician', { count: lineupCount }) : t('{count} musicians', { count: lineupCount })}
                    </Tag>
                    <Tag>{isAdmin ? t('Band admin') : t('Band member')}</Tag>
                  </div>
                  {(activeBandDetails?.home_base_address || activeBandDetails?.description) && (
                    <span className="bw-body-sm text-muted-foreground truncate">
                      {[activeBandDetails?.home_base_address, activeBandDetails?.description]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    aria-expanded={isEditingBandDetails}
                    onClick={() => setIsEditingBandDetails((prev) => !prev)}
                    className={cn(
                      'h-9 rounded-full flex items-center gap-2 bw-button-sm shrink-0 self-start mt-1 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isEditingBandDetails
                        ? 'px-3 bg-surface-inverse text-surface-inverse-foreground'
                        : 'px-2 -mr-2 text-accent-ink'
                    )}
                  >
                    {isEditingBandDetails ? (
                      <X aria-hidden className="w-3.5 h-3.5" />
                    ) : (
                      <Edit3 aria-hidden className="w-3.5 h-3.5" />
                    )}
                    <span>{isEditingBandDetails ? t('Close') : t('Edit')}</span>
                  </button>
                )}
              </div>

              {/* Inline Edit Band Name & Details Drawer */}
              <AnimatePresence initial={false}>
                {isEditingBandDetails && isAdmin && (
                  <motion.form
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    onSubmit={handleSaveBandIdentity}
                    className="overflow-hidden"
                  >
                    <div className="p-4 rounded-[16px] bg-foreground/[0.08] flex flex-col gap-4">
                      {/* Logo row */}
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-white text-black border-[1.5px] border-border flex items-center justify-center overflow-hidden shrink-0">
                          {editBandLogoUrl ? (
                            <img
                              src={editBandLogoUrl}
                              alt={t('Band logo')}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="bw-label-md">{bandInitials}</span>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                          <span className="bw-label-md text-foreground">{t('Band logo')}</span>
                          <span className="bw-body-sm text-muted-foreground truncate">
                            {t('Band card, switcher & quote PDFs')}
                          </span>
                        </div>

                        <input
                          ref={bandLogoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleBandLogoFileChange}
                          className="hidden"
                        />
                        <div className="flex items-center gap-1.5 shrink-0">
                          <PillButton
                            size="sm"
                            variant="outline"
                            fullWidth={false}
                            onClick={() => bandLogoInputRef.current?.click()}
                            loading={uploadingBandLogo}
                            icon={<Upload aria-hidden className="w-3.5 h-3.5" />}
                          >
                            {editBandLogoUrl ? t('Change') : t('Upload')}
                          </PillButton>
                          {editBandLogoUrl && (
                            <IconButton
                              label={t('Remove logo')}
                              variant="ghost"
                              size="sm"
                              icon={<Trash2 aria-hidden />}
                              onClick={() => setEditBandLogoUrl('')}
                              className="text-destructive"
                            />
                          )}
                        </div>
                      </div>

                      <PillField
                        id="hub-band-name"
                        label={t('Band name')}
                        type="text"
                        required
                        value={editBandName}
                        onChange={(e) => setEditBandName(e.target.value)}
                        placeholder={t('e.g. Bandazz')}
                      />

                      {/* Home base city with place suggestions (same search as venues). */}
                      <div className="flex flex-col gap-2 w-full">
                        <label htmlFor="hub-band-city" className="bw-label-sm text-muted-foreground">
                          {t('Home base city')}
                        </label>
                        <div className="flex items-center gap-3 h-[52px] px-4 rounded-full border bg-field border-border text-foreground focus-within:border-2 focus-within:border-foreground">
                          <VenueAutocomplete
                            inputId="hub-band-city"
                            value={editBandCity}
                            onChange={(val) => {
                              setEditBandCity(val);
                              setEditBandCoords(null);
                            }}
                            onSelect={(place) => {
                              setEditBandCity(
                                [place.city || place.name, place.country].filter(Boolean).join(', ') || place.name,
                              );
                              setEditBandCoords(
                                typeof place.latitude === 'number' && typeof place.longitude === 'number'
                                  ? { lat: place.latitude, lng: place.longitude }
                                  : null,
                              );
                            }}
                            heading={t('Suggested places')}
                            placeholder={t('Start typing a city')}
                            className="text-[18px] font-medium normal-case"
                          />
                        </div>
                      </div>

                      <PillField
                        id="hub-band-bio"
                        label={t('Band bio / tagline (optional)')}
                        type="text"
                        value={editBandDescription}
                        onChange={(e) => setEditBandDescription(e.target.value)}
                        placeholder={t('e.g. Live Funk, Soul & Disco Collective')}
                      />

                      <div className="flex items-center gap-3">
                        <PillButton
                          size="md"
                          variant="outline"
                          className="flex-1 min-w-0"
                          onClick={() => setIsEditingBandDetails(false)}
                        >
                          {t('Cancel')}
                        </PillButton>
                        <PillButton
                          type="submit"
                          size="md"
                          className="flex-1 min-w-0"
                          loading={savingBandDetails}
                          disabled={!editBandName.trim()}
                          icon={<Check aria-hidden className="w-4 h-4" />}
                        >
                          {t('Save details')}
                        </PillButton>
                      </div>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Members pill (opens lineup) */}
              <button
                type="button"
                onClick={() => {
                  onEditBand?.();
                }}
                aria-label={t('Members ({count})', { count: lineupCount })}
                className="w-full px-4 py-3 rounded-full bg-foreground/[0.08] flex items-center gap-3 text-left transition-colors hover:bg-foreground/[0.12] active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="bw-label-md text-foreground flex-1 min-w-0 truncate">{t('Members')}</span>
                {rosterMembers.length > 0 ? (
                  <span className="flex items-center shrink-0" aria-hidden>
                    {rosterMembers.slice(0, 4).map((m) => {
                      const mName =
                        m.stage_name || personName(m.profile, 'M');
                      const mInitials = initialsOf(mName, 'M');
                      return m.profile?.avatar_url ? (
                        <img
                          key={m.id}
                          src={m.profile.avatar_url}
                          alt={mName}
                          className="w-7 h-7 rounded-full object-cover -mr-1.5 last:mr-0 ring-2 ring-card shrink-0"
                        />
                      ) : (
                        <span
                          key={m.id}
                          className="w-7 h-7 rounded-full bg-card text-muted-foreground bw-label-sm flex items-center justify-center -mr-1.5 last:mr-0 ring-2 ring-card shrink-0"
                        >
                          {mInitials}
                        </span>
                      );
                    })}
                    {lineupCount > 4 && (
                      <span className="w-7 h-7 rounded-full bg-card text-muted-foreground bw-label-xs flex items-center justify-center ring-2 ring-card shrink-0">
                        +{lineupCount - 4}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-muted-foreground shrink-0">
                    <Users aria-hidden className="w-4 h-4" />
                    <span className="bw-label-sm">{lineupCount}</span>
                  </span>
                )}
                <ChevronRight aria-hidden className="w-[18px] h-[18px] text-foreground shrink-0" />
              </button>

              {isAdmin && (
                <PillButton
                  size="md"
                  variant="outline"
                  icon={<IconSettings aria-hidden className="w-[18px] h-[18px]" />}
                  onClick={() => {
                    if (onOpenBandSettings) {
                      onOpenBandSettings();
                    } else {
                      onOpenPricing?.();
                    }
                  }}
                >
                  {t('Band settings')}
                </PillButton>
              )}

              {/* Band Switcher / Multi-Band Section */}
              {bands.length > 1 ? (
                <div className="flex flex-col gap-3 pt-1">
                  <span className="bw-label-sm text-muted-foreground">{t('Your bands ({count})', { count: bands.length })}</span>

                  <div className="flex flex-col gap-2">
                    {bands.map((b) => {
                      const isActive = b.id === selectedBand.id || b.name === selectedBand.name;
                      const matchedRealBand = realBandsList?.find((rb) => rb.name === b.name);
                      const itemInitials = b.initials || initialsOf(b.name);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedBand(b)}
                          aria-current={isActive ? 'true' : undefined}
                          className={cn(
                            'w-full px-4 py-3 rounded-[16px] text-left flex items-center gap-3 transition-colors active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            isActive
                              ? 'bg-accent text-accent-foreground'
                              : 'bg-foreground/[0.08] text-foreground'
                          )}
                        >
                          {matchedRealBand?.logo_url ? (
                            <img
                              src={matchedRealBand.logo_url}
                              alt={b.name}
                              className="w-10 h-10 rounded-full object-cover border-[1.5px] border-black/15 shrink-0"
                            />
                          ) : (
                            <span className="w-10 h-10 rounded-full bg-white text-black border-[1.5px] border-black/15 bw-label-md flex items-center justify-center shrink-0">
                              {itemInitials}
                            </span>
                          )}
                          <span className="flex flex-col min-w-0 flex-1 gap-0.5">
                            <span className="flex items-center gap-1.5 bw-label-xs">
                              {!isActive && (
                                <span aria-hidden className="w-2 h-2 rounded-full bg-accent shrink-0" />
                              )}
                              {b.role === 'ADMIN' ? t('Admin') : t('Member')}
                            </span>
                            <span className="bw-h3 truncate">{b.name}</span>
                            <span
                              className={cn(
                                'bw-body-sm truncate',
                                isActive ? 'text-accent-foreground/70' : 'text-muted-foreground'
                              )}
                            >
                              {b.members === 1 ? t('{count} member', { count: b.members }) : t('{count} members', { count: b.members })}
                            </span>
                          </span>
                          {isActive ? (
                            <Tag variant="solid">{t('Active')}</Tag>
                          ) : (
                            <span className="bw-label-xs text-muted-foreground shrink-0">{t('Switch')}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <PillButton size="md" variant="outline" icon={<Plus aria-hidden className="w-4 h-4" />} onClick={() => onAddEntity?.()}>
                    {t('New band')}
                  </PillButton>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <span className="bw-body-sm text-muted-foreground">{t('Playing in another act?')}</span>
                  <button
                    type="button"
                    onClick={() => {
                      onAddEntity?.();
                    }}
                    className="h-9 px-2 -mr-2 rounded-full text-accent-ink bw-button-sm flex items-center gap-1 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Plus aria-hidden className="w-3 h-3" /> {t('New band')}
                  </button>
                </div>
              )}
            </section>

            {/* ═══ 3. BAND ASSETS & WORKFLOWS ═══ */}
            <h2 className="bw-label-md text-foreground">{t('Band assets & workflows')}</h2>

            <div className="grid grid-cols-2 gap-3">
              {assetShortcuts.map((item, index) => {
                const Icon = item.icon;
                // Odd count (members see three): the last card fills the row.
                const spansRow = assetShortcuts.length % 2 === 1 && index === assetShortcuts.length - 1;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onEntityDetailClick?.(item.id);
                    }}
                    aria-label={[`${item.label}: ${item.count} ${item.unit}`, ...(statusParts[item.id as AssetId] ?? []).map(partText)].join(', ')}
                    className={cn(
                      'p-4 rounded-[24px] flex flex-col gap-3 text-left min-w-0 active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      HUB_CARD,
                      spansRow && 'col-span-2',
                    )}
                  >
                    <span className="flex items-center justify-between w-full">
                      <Icon aria-hidden className="w-[22px] h-[22px] text-accent-ink" />
                      <ArrowUpRight aria-hidden className="w-4 h-4 text-foreground" />
                    </span>
                    <span className="bw-label-md text-foreground truncate w-full">{item.label}</span>
                    <span className="flex items-end gap-1.5 min-w-0">
                      <DotText text={item.count} size={24} />
                      <span className="bw-body-lg leading-none truncate">{item.unit}</span>
                    </span>
                    {(statusParts[item.id as AssetId] ?? []).length > 0 && (
                      <span aria-hidden className="flex items-center gap-1.5 min-w-0 w-full bw-body-sm text-muted-foreground">
                        {statusParts[item.id as AssetId].some((p) => p.attention) && (
                          <span className="w-2 h-2 rounded-full bg-destructive shrink-0" />
                        )}
                        <span className="truncate">{statusParts[item.id as AssetId].map(partText).join(' · ')}</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* PRICING, FEES & SERVICES (Admin Only) */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => onOpenPricing?.()}
                className="w-full p-4 rounded-[24px] bg-accent text-accent-foreground flex items-center gap-4 text-left transition-transform active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <CurrencyIcon aria-hidden className="w-6 h-6 shrink-0" />
                <span className="flex flex-col gap-1 min-w-0 flex-1">
                  <span className="bw-label-md">{t('Pricing, fees & services')}</span>
                  <span className="bw-body-sm">{t('Logo, bank account, musician fees & quote services')}</span>
                </span>
                <ArrowUpRight aria-hidden className="w-5 h-5 shrink-0" />
              </button>
            )}

            {/* ═══ 4. APP SETTINGS ═══ */}
            <h2 className="bw-label-md text-foreground">{t('App settings')}</h2>

            <div className={cn('p-4 rounded-[24px] flex flex-col gap-3', HUB_CARD)}>
              {/* Appearance / Theme */}
              <span className="bw-label-sm text-muted-foreground">{t('Appearance')}</span>
              <div role="group" aria-label={t('Theme')} className="flex items-center gap-2">
                {[
                  { id: 'light' as const, label: t('Light') },
                  { id: 'dark' as const, label: t('Dark') },
                  { id: 'system' as const, label: t('System') },
                ].map((opt) => {
                  const isSelected = mode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={isSelected}
                      title={opt.id === 'system' ? t('System ({theme})', { theme: resolvedTheme === 'dark' ? t('dark') : t('light') }) : undefined}
                      onClick={() => setMode(opt.id)}
                      className={cn(
                        'flex-1 min-w-0 h-9 px-4 rounded-full bw-label-md flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isSelected
                          ? 'bg-surface-inverse text-surface-inverse-foreground'
                          : 'border border-border text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Notifications (Figma: one row, one master toggle) */}
              <div className="p-4 rounded-[16px] flex items-center gap-3">
                <span className="flex flex-col gap-1 min-w-0 flex-1">
                  <span className="bw-body-lg">{t('Notifications')}</span>
                  <span className="bw-body-sm text-muted-foreground">{notificationStatus}</span>
                </span>
                <Toggle
                  checked={alertsOn}
                  onCheckedChange={handleToggleAlerts}
                  disabled={savingAlerts}
                  aria-label={t('Notifications')}
                />
              </div>
              {alertsError && (
                <p role="alert" className="bw-body-sm text-destructive">
                  {alertsError}
                </p>
              )}
            </div>

            {/* Settings & account (notifications, theme, language, delete account) */}
            {onOpenSettings && (
              <ListRow
                className="dark:bg-sheet"
                icon={<IconSettings />}
                title={t('Settings & account')}
                subtitle={t('Privacy, language, delete account')}
                onClick={() => onOpenSettings('main')}
              />
            )}

            {/* Help & Support */}
            <ListRow
              className="dark:bg-sheet"
              icon={<Mail />}
              title={t('Help & support')}
              subtitle="support@bandwith.app"
              onClick={() =>
                window.open('mailto:support@bandwith.app?subject=BandWith%20Help%20Request', '_blank')
              }
            />

            {/* Export My Data */}
            <ListRow
              className="dark:bg-sheet"
              icon={<Download />}
              title={t('Export my data')}
              subtitle={exporting ? t('Preparing your file…') : t('Download a JSON copy')}
              onClick={handleExport}
            />
            {exportError && (
              <p role="alert" className="bw-body-sm text-destructive">
                {exportError}
              </p>
            )}

            {/* Sign Out */}
            <PillButton
              variant="outline"
              onClick={handleLogout}
              title={t('Sign out ({email})', { email: displayEmail })}
              icon={<LogOut aria-hidden className="w-5 h-5" />}
              className="border-destructive text-destructive"
            >
              {t('Sign out')}
            </PillButton>

            {/* Footer */}
            <p className="bw-label-sm text-muted-foreground">{t('v{version} · All data encrypted', { version: '1.0.0' })}</p>

            {/* Bottom clearance spacer ensuring the footer cleanly clears the floating navbar */}
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
