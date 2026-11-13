import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  FileText,
  Send,
  MoreHorizontal,
  Eye,
  Download,
  Trash2,
  Loader2,
  ScrollText,
  FileSignature,
  RefreshCw,
  Pencil,
  Sparkles,
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { todayLocal } from '@/lib/dates';
import { shareFile, openExternal, saveFile } from '@/lib/nativeFiles';
import { DeleteChatSheet } from '@/app/components/chat/DeleteChatSheet';
import {
  STATUS_LABEL,
  buildContractPdf,
  buildSendMessage,
  contractFileName,
  createContract,
  deleteContract,
  effectiveStatus,
  errorMessage,
  fetchBandName,
  formatContractDate,
  isRider,
  isValidEmail,
  listContracts,
  listLinkableEvents,
  saveContractEdits,
  STANDARD_TERMS,
  type LinkableEvent,
  mailtoUrl,
  markContractSent,
  markContractSigned,
  type Contract,
  type ContractStatus,
} from '@/lib/services/contracts';
import { DotText } from '@/app/components/bw';
import { ScreenHeader, IconButton, SearchField, Card, BwSheet } from '@/app/components/bw/Screen';
import { PillButton, PillField, Selector, FormError } from '@/app/components/bw/Form';
import { useT, intlLocale } from '@/lib/i18n';

interface ContractsViewProps {
  onBack: () => void;
  bandId: string;
}

/** Figma "Status": dot colour + Label/XS. */
const STATUS_DOT: Record<ContractStatus, string> = {
  draft: 'bg-accent-past',
  sent: 'bg-info',
  viewed: 'bg-warning',
  signed: 'bg-success',
  expired: 'bg-destructive',
};

/** Status label for display (the status itself stays the stored value). */
const useStatusLabel = () => {
  const t = useT();
  return useCallback(
    (status: ContractStatus): string => {
      const labels: Record<ContractStatus, string> = {
        draft: t('Draft'),
        sent: t('Sent'),
        viewed: t('Viewed'),
        signed: t('Signed'),
        expired: t('Expired'),
      };
      return labels[status] ?? STATUS_LABEL[status] ?? status;
    },
    [t],
  );
};

const StatusDot: React.FC<{ status: ContractStatus }> = ({ status }) => {
  const statusLabel = useStatusLabel();
  return (
    <span className="flex items-center gap-1.5 shrink-0">
      <span className={cn('w-2 h-2 rounded-full', STATUS_DOT[status] ?? 'bg-muted-foreground')} aria-hidden />
      <span className="bw-label-xs">{statusLabel(status)}</span>
    </span>
  );
};

/** Small stat card (Figma: label + 24pt dot value). */
const StatCard: React.FC<{ label: string; value: number; inverse?: boolean }> = ({ label, value, inverse }) => (
  <div
    className={cn(
      'flex-1 min-w-0 flex flex-col gap-1 px-4 py-3 rounded-[24px]',
      inverse ? 'bg-surface-inverse text-surface-inverse-foreground' : 'bg-card text-card-foreground',
    )}
  >
    <span className="bw-label-sm truncate">{label}</span>
    <DotText text={value} size={24} label={`${label}: ${value}`} />
  </div>
);

/** Info row on the dark sheet. */
const SheetInfo: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
  <div className={cn('flex flex-col gap-1 p-4 rounded-[16px] bg-sheet-foreground/[0.08] min-w-0', className)}>
    <p className="bw-label-sm text-sheet-foreground/70">{label}</p>
    <div className="bw-body-lg [overflow-wrap:anywhere]">{children}</div>
  </div>
);

/** Outline button readable on the dark sheet. */
const SHEET_OUTLINE = 'border-sheet-foreground text-sheet-foreground';

const TABS = ['All', 'Contracts', 'Riders'] as const;

const sameText = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

type BusyKind = 'download' | 'sign' | 'delete';

export const ContractsView: React.FC<ContractsViewProps> = ({ onBack, bandId }) => {
  const t = useT();
  const statusLabel = useStatusLabel();
  const tabLabel = (tab: typeof TABS[number]) => (tab === 'All' ? t('All') : tab === 'Contracts' ? t('Contracts') : t('Riders'));
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ id: string; kind: BusyKind } | null>(null);
  const [bandName, setBandName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<typeof TABS[number]>('All');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);

  // Create form state
  const [formType, setFormType] = useState<'contract' | 'rider'>('contract');
  const [formTitle, setFormTitle] = useState('');
  const [formEventName, setFormEventName] = useState('');
  const [formClientName, setFormClientName] = useState('');
  const [formClientEmail, setFormClientEmail] = useState('');
  const [formEventDate, setFormEventDate] = useState('');
  const [formValidUntil, setFormValidUntil] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formEventId, setFormEventId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  /** Set when the form edits an existing document. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [linkableEvents, setLinkableEvents] = useState<LinkableEvent[]>([]);
  const [pendingDelete, setPendingDelete] = useState<Contract | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Send to client sheet
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendEmail, setSendEmail] = useState('');
  const [sendStep, setSendStep] = useState<'compose' | 'confirm'>('compose');
  /** How the PDF left the app (drives the confirm copy). */
  const [sendVia, setSendVia] = useState<'share' | 'mail'>('share');
  const [sendBusy, setSendBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const today = todayLocal();
  const viewingContract = contracts.find((c) => c.id === viewingId) ?? null;
  const sendingContract = contracts.find((c) => c.id === sendingId) ?? null;

  const resetForm = () => {
    setFormType('contract');
    setFormTitle('');
    setFormEventName('');
    setFormClientName('');
    setFormClientEmail('');
    setFormEventDate('');
    setFormValidUntil('');
    setFormNotes('');
    setFormEventId(null);
    setEditingId(null);
    setFormError(null);
  };

  const openCreate = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEdit = (contract: Contract) => {
    setMenuOpenId(null);
    setViewingId(null);
    resetForm();
    setEditingId(contract.id);
    setFormType(isRider(contract) ? 'rider' : 'contract');
    setFormTitle(contract.title);
    setFormEventName(contract.event_name ?? '');
    setFormClientName(contract.client_name ?? '');
    setFormClientEmail(contract.client_email ?? '');
    setFormEventDate(contract.event_date?.slice(0, 10) ?? '');
    setFormValidUntil(contract.expires_at?.slice(0, 10) ?? '');
    setFormNotes(contract.content ?? '');
    setFormEventId(contract.event_id ?? null);
    setShowCreateModal(true);
  };

  /** Picking a band event fills what the document needs from it. */
  const linkEvent = (ev: LinkableEvent | null) => {
    if (!ev) {
      setFormEventId(null);
      return;
    }
    setFormEventId(ev.id);
    setFormEventName(ev.title);
    if (ev.event_date) setFormEventDate(ev.event_date.slice(0, 10));
    const client = ev.client_name || ev.venue_name;
    if (client) setFormClientName(client);
    if (ev.client_email) setFormClientEmail(ev.client_email);
    if (!formTitle.trim()) setFormTitle(`${formType === 'rider' ? 'Technical rider' : 'Performance agreement'} · ${ev.title}`);
  };

  // Upcoming gigs to link, loaded when the form opens.
  useEffect(() => {
    if (!showCreateModal) return;
    let alive = true;
    listLinkableEvents(bandId).then((rows) => alive && setLinkableEvents(rows));
    return () => {
      alive = false;
    };
  }, [showCreateModal, bandId]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const replaceContract = (row: Contract) => setContracts((prev) => prev.map((c) => (c.id === row.id ? row : c)));

  const emailError = formClientEmail.trim() && !isValidEmail(formClientEmail) ? t('Enter a valid email address.') : null;

  const handleSaveContract = async () => {
    if (!formTitle.trim() || !formClientName.trim() || emailError || saving) return;
    setSaving(true);
    setFormError(null);
    const fields = {
      type: formType,
      title: formTitle,
      clientName: formClientName,
      clientEmail: formClientEmail,
      eventName: formEventName,
      eventDate: formEventDate,
      expiresOn: formValidUntil,
      content: formNotes,
      eventId: formEventId,
    };
    const { data, error } = editingId ? await saveContractEdits(editingId, fields) : await createContract({ bandId, ...fields });
    setSaving(false);
    if (error || !data) {
      setFormError(error?.message || (editingId ? t('Could not save the changes.') : t('Could not create the document.')));
      return;
    }
    if (editingId) {
      replaceContract(data);
      setNotice(t('Changes saved'));
    } else {
      setContracts((prev) => [data, ...prev]);
    }
    resetForm();
    setShowCreateModal(false);
  };

  const loadContracts = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await listContracts(bandId);
    if (error) setLoadError(error.message);
    else setContracts(data || []);
    setLoading(false);
  }, [bandId]);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  useEffect(() => {
    let alive = true;
    fetchBandName(bandId).then((name) => alive && setBandName(name));
    return () => {
      alive = false;
    };
  }, [bandId]);

  const q = searchQuery.toLowerCase();
  const filteredContracts = contracts.filter((contract) => {
    const matchesSearch =
      contract.title.toLowerCase().includes(q) ||
      (contract.event_name ?? '').toLowerCase().includes(q) ||
      (contract.client_name ?? '').toLowerCase().includes(q);
    const matchesTab =
      selectedTab === 'All' ||
      (selectedTab === 'Contracts' && !isRider(contract)) ||
      (selectedTab === 'Riders' && isRider(contract));
    return matchesSearch && matchesTab;
  });

  const stats = useMemo(() => {
    const statuses = contracts.map((c) => effectiveStatus(c, today));
    return {
      total: contracts.length,
      signed: statuses.filter((s) => s === 'signed').length,
      pending: statuses.filter((s) => s === 'draft' || s === 'sent' || s === 'viewed').length,
    };
  }, [contracts, today]);

  const getTabCount = (tab: typeof TABS[number]) => {
    if (tab === 'All') return contracts.length;
    return contracts.filter((c) => (tab === 'Riders' ? isRider(c) : !isRider(c))).length;
  };

  const handleDelete = async (contract: Contract) => {
    setMenuOpenId(null);
    if (busy) return;
    setBusy({ id: contract.id, kind: 'delete' });
    setActionError(null);
    const { error } = await deleteContract(contract.id);
    setBusy(null);
    setPendingDelete(null);
    if (error) {
      setActionError(t('Couldn\'t delete "{title}". {message}', { title: contract.title, message: error.message }));
      return;
    }
    setContracts((prev) => prev.filter((c) => c.id !== contract.id));
    if (viewingId === contract.id) setViewingId(null);
  };

  const handleView = (contract: Contract) => {
    setActionError(null);
    setViewingId(contract.id);
    setMenuOpenId(null);
  };

  const handleDownloadPdf = async (contract: Contract) => {
    setMenuOpenId(null);
    if (busy) return;
    setBusy({ id: contract.id, kind: 'download' });
    setActionError(null);
    try {
      const blob = buildContractPdf(contract, { bandName });
      const { result, location } = await saveFile(blob, contractFileName(contract));
      if (result === 'saved') setNotice(t('PDF saved to {location}', { location: String(location) }));
      else if (result === 'downloaded') setNotice(t('PDF downloaded'));
    } catch (err) {
      setActionError(t('Couldn\'t export "{title}". {message}', { title: contract.title, message: errorMessage(err) }));
    } finally {
      setBusy(null);
    }
  };

  const handleMarkSigned = async (contract: Contract) => {
    setMenuOpenId(null);
    if (busy) return;
    setBusy({ id: contract.id, kind: 'sign' });
    setActionError(null);
    const { data, error } = await markContractSigned(contract.id);
    setBusy(null);
    if (error || !data) {
      setActionError(t('Couldn\'t mark "{title}" as signed. {message}', { title: contract.title, message: error?.message ?? '' }).trim());
      return;
    }
    replaceContract(data);
  };

  const openSend = (contract: Contract) => {
    setMenuOpenId(null);
    setViewingId(null);
    setSendEmail(contract.client_email ?? '');
    setSendStep('compose');
    setSendError(null);
    setSendingId(contract.id);
  };

  const closeSend = () => {
    if (sendBusy) return;
    setSendingId(null);
  };

  const finishSend = async (contract: Contract, email: string) => {
    const { data, error } = await markContractSent(contract.id, email);
    if (error || !data) {
      setSendError(t('The document was shared, but its status couldn\'t be updated. {message}', { message: error?.message ?? '' }).trim());
      setSendStep('confirm');
      return;
    }
    replaceContract(data);
    setSendingId(null);
  };

  /** Share the PDF with a ready-to-send message; mark as sent only once it has gone out. */
  const handleShareToClient = async () => {
    if (!sendingContract || sendBusy) return;
    const email = sendEmail.trim();
    if (!isValidEmail(email)) {
      setSendError(t('Enter the client email address.'));
      return;
    }
    setSendBusy(true);
    setSendError(null);
    try {
      const contract = { ...sendingContract, client_email: email };
      const { subject, body } = buildSendMessage(contract, bandName);
      const blob = buildContractPdf(contract, { bandName });
      const result = await shareFile(blob, contractFileName(contract), { title: subject, text: body, dialogTitle: t('Send to client') });
      if (result === 'cancelled') return;
      if (result === 'shared') {
        setSendVia('share');
        await finishSend(sendingContract, email);
        return;
      }
      // No file sharing here (desktop web): the PDF was downloaded, open the
      // mail app pre-filled and let the user confirm once the email is sent.
      await openExternal(mailtoUrl(email, subject, `${body}\n\n(PDF attached: ${contractFileName(contract)})`));
      setSendVia('mail');
      setSendStep('confirm');
    } catch (err) {
      setSendError(t('Couldn\'t share the document. {message}', { message: errorMessage(err) }));
    } finally {
      setSendBusy(false);
    }
  };

  const handleConfirmSent = async () => {
    if (!sendingContract || sendBusy) return;
    setSendBusy(true);
    setSendError(null);
    await finishSend(sendingContract, sendEmail.trim());
    setSendBusy(false);
  };

  const isBusy = (id: string, kind?: BusyKind) => !!busy && busy.id === id && (!kind || busy.kind === kind);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
      className="bw-pane-hub fixed inset-0 z-[70] bg-background text-foreground flex flex-col overflow-y-auto"
      style={{
        overscrollBehaviorX: 'none',
        touchAction: 'pan-y',
      }}
    >
      <ScreenHeader
        sticky
        onBack={onBack}
        backLabel={t('Go back')}
        overline={t('Legal & riders')}
        title={t('Contracts & docs')}
        actions={
          <IconButton
            label={t('Create document')}
            variant="filled"
            icon={<Plus />}
            onClick={openCreate}
          />
        }
      />

      <div className="flex-1 flex flex-col gap-4 px-4 pt-4 max-w-2xl mx-auto w-full" style={{ paddingBottom: 'calc(var(--safe-bottom) + 40px)' }}>
        <SearchField value={searchQuery} onChange={setSearchQuery} label={t('Search documents')} placeholder={t('Search by title, client or event…')} />

        {/* Tabs (Figma Selector MD with counts) */}
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <Selector key={tab} size="md" selected={selectedTab === tab} onClick={() => setSelectedTab(tab)} count={getTabCount(tab)}>
              {tabLabel(tab)}
            </Selector>
          ))}
        </div>

        {/* Overview */}
        {contracts.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2" aria-label={t('{signed} of {total} signed', { signed: stats.signed, total: stats.total })}>
            <StatCard label={t('Total docs')} value={stats.total} inverse />
            <StatCard label={t('Signed')} value={stats.signed} />
            <StatCard label={t('Pending')} value={stats.pending} />
          </motion.div>
        )}

        {actionError && !viewingContract && <FormError>{actionError}</FormError>}
        {notice && !viewingContract && (
          <p role="status" className="bw-body-sm text-success">{notice}</p>
        )}

        {/* Documents */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : loadError ? (
          <Card className="items-center text-center py-10 gap-4" role="alert">
            <FileText className="w-10 h-10 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <h2 className="bw-h3">{t('Couldn\'t load documents')}</h2>
              <p className="bw-body-sm text-muted-foreground max-w-xs [overflow-wrap:anywhere]">{loadError}</p>
            </div>
            <PillButton size="md" fullWidth={false} icon={<RefreshCw className="w-4 h-4" />} onClick={loadContracts}>
              {t('Try again')}
            </PillButton>
          </Card>
        ) : contracts.length === 0 ? (
          <Card className="items-center text-center py-10 gap-4">
            <FileText className="w-10 h-10 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <h2 className="bw-h3">{t('No documents yet')}</h2>
              <p className="bw-body-sm text-muted-foreground max-w-xs">
                {t('Keep your band performance agreements and technical riders organised in one place.')}
              </p>
            </div>
            <PillButton
              size="md"
              fullWidth={false}
              icon={<Plus className="w-4 h-4" />}
              onClick={openCreate}
            >
              {t('Create first document')}
            </PillButton>
          </Card>
        ) : filteredContracts.length === 0 ? (
          <Card className="items-center text-center py-8">
            <h2 className="bw-h3">{t('No matches')}</h2>
            <p className="bw-body-sm text-muted-foreground">{t('No documents match your search or filter.')}</p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-4" aria-label={t('Documents ({count})', { count: filteredContracts.length })}>
            {filteredContracts.map((contract, index) => {
              const rider = isRider(contract);
              const TypeIcon = rider ? ScrollText : FileText;
              const status = effectiveStatus(contract, today);
              // Figma: "Client · Event date …" (event name only when it adds something).
              const showEventName =
                !!contract.event_name && !sameText(contract.event_name, contract.title) && !sameText(contract.event_name, contract.client_name);
              const meta = [
                contract.client_name,
                showEventName ? contract.event_name : null,
                contract.event_date ? t('Event date {date}', { date: formatContractDate(contract.event_date, intlLocale('en-GB')) }) : null,
              ]
                .filter(Boolean)
                .join(' · ');
              const rowBusy = isBusy(contract.id);
              return (
                <motion.li
                  key={contract.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.3) }}
                  className="relative"
                >
                  <Card className="relative gap-2">
                    <div className="flex items-center gap-3">
                      <TypeIcon className="w-[22px] h-[22px] shrink-0" aria-label={rider ? t('Rider') : t('Contract')} />
                      <div className="flex-1" />
                      <StatusDot status={status} />
                      <button
                        type="button"
                        onClick={() => setMenuOpenId(menuOpenId === contract.id ? null : contract.id)}
                        aria-label={t('Actions for {title}', { title: contract.title })}
                        aria-expanded={menuOpenId === contract.id}
                        disabled={rowBusy}
                        className="relative z-10 -m-3 p-3 text-foreground"
                      >
                        {rowBusy ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <MoreHorizontal className="w-[18px] h-[18px]" />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleView(contract)}
                      className="text-left flex flex-col gap-2 after:absolute after:inset-0 after:rounded-[24px] after:content-['']"
                    >
                      <h3 className="bw-h3 text-foreground [overflow-wrap:anywhere]">{contract.title}</h3>
                      {meta && <p className="bw-body-sm text-muted-foreground line-clamp-2">{meta}</p>}
                    </button>
                  </Card>

                  <AnimatePresence>
                    {menuOpenId === contract.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute right-3 top-11 z-20 min-w-[180px] p-1 rounded-[16px] bg-popover text-popover-foreground shadow-lg border border-border origin-top-right"
                        role="menu"
                      >
                        {[
                          { label: t('View'), icon: <Eye className="w-4 h-4" />, run: () => handleView(contract) },
                          { label: t('Download PDF'), icon: <Download className="w-4 h-4" />, run: () => handleDownloadPdf(contract) },
                          ...(contract.status !== 'signed'
                            ? [
                                { label: t('Edit'), icon: <Pencil className="w-4 h-4" />, run: () => openEdit(contract) },
                                {
                                  label: contract.sent_at ? t('Resend to client') : t('Send to client'),
                                  icon: <Send className="w-4 h-4" />,
                                  run: () => openSend(contract),
                                },
                                { label: t('Mark as signed'), icon: <FileSignature className="w-4 h-4" />, run: () => handleMarkSigned(contract) },
                              ]
                            : []),
                          {
                            label: t('Delete'),
                            icon: <Trash2 className="w-4 h-4" />,
                            run: () => {
                              setMenuOpenId(null);
                              setPendingDelete(contract);
                            },
                            danger: true,
                          },
                        ].map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            role="menuitem"
                            onClick={item.run}
                            className={cn(
                              'w-full h-11 px-3 flex items-center gap-3 rounded-[12px] bw-body-sm font-medium text-left hover:bg-foreground/[0.06]',
                              'danger' in item && item.danger ? 'text-destructive' : 'text-foreground',
                            )}
                          >
                            {item.icon}
                            {item.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Create document — full screen */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="bw-pane-detail fixed inset-0 z-[100] flex flex-col bg-background text-foreground"
          >
            <ScreenHeader
                pane
              onBack={() => !saving && setShowCreateModal(false)}
              overline={editingId ? t('Edit document') : t('New document')}
              title={editingId ? (formType === 'contract' ? t('Edit contract') : t('Edit rider')) : formType === 'contract' ? t('Create contract') : t('Create rider')}
              titleSize="h1"
            />

            <div className="flex-1 overflow-y-auto px-4 pt-6 pb-8 max-w-xl mx-auto w-full flex flex-col gap-6">
              {formError && <FormError>{formError}</FormError>}

              <fieldset className="flex flex-col gap-2">
                <legend className="bw-label-sm text-muted-foreground mb-2">{t('Document type')}</legend>
                <div className="flex flex-wrap gap-2">
                  <Selector size="md" selected={formType === 'contract'} onClick={() => setFormType('contract')}>
                    <FileText className="w-4 h-4" />
                    {t('Contract')}
                  </Selector>
                  <Selector size="md" selected={formType === 'rider'} onClick={() => setFormType('rider')}>
                    <ScrollText className="w-4 h-4" />
                    {t('Rider')}
                  </Selector>
                </div>
              </fieldset>

              {(linkableEvents.length > 0 || formEventId) && (
                <fieldset className="flex flex-col gap-2">
                  <legend className="bw-label-sm text-muted-foreground mb-2">{t('For a band event')}</legend>
                  <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 [scrollbar-width:none]">
                    <Selector size="md" selected={!formEventId} onClick={() => linkEvent(null)} className="shrink-0">
                      {t('None')}
                    </Selector>
                    {formEventId && !linkableEvents.some((e) => e.id === formEventId) && (
                      <Selector size="md" selected className="shrink-0">
                        {formEventName || t('Linked event')}
                      </Selector>
                    )}
                    {linkableEvents.map((ev) => (
                      <Selector key={ev.id} size="md" selected={formEventId === ev.id} onClick={() => linkEvent(ev)} className="shrink-0 max-w-[260px]">
                        <span className="truncate">{ev.title}</span>
                        {ev.event_date && <span className="opacity-60 shrink-0">{formatContractDate(ev.event_date, intlLocale('en-GB'))}</span>}
                      </Selector>
                    ))}
                  </div>
                  <p className="bw-body-sm text-muted-foreground">{t('Fills in the event, date and client from the gig.')}</p>
                </fieldset>
              )}

              <PillField
                label={t('Document title *')}
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder={t('Performance agreement 2026')}
              />
              <PillField
                label={t('Event name')}
                value={formEventName}
                onChange={(e) => setFormEventName(e.target.value)}
                placeholder={t('Annual gala night')}
              />
              <PillField
                label={t('Client / venue *')}
                value={formClientName}
                onChange={(e) => setFormClientName(e.target.value)}
                placeholder="Hotel Arts & Club"
              />
              <PillField
                label={t('Client email')}
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                value={formClientEmail}
                onChange={(e) => setFormClientEmail(e.target.value)}
                placeholder="events@venue.com"
                error={emailError}
              />
              <div className="grid grid-cols-2 gap-3">
                <PillField label={t('Event date')} type="date" value={formEventDate} onChange={(e) => setFormEventDate(e.target.value)} />
                <PillField label={t('Valid until')} type="date" value={formValidUntil} onChange={(e) => setFormValidUntil(e.target.value)} />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="contract-notes" className="bw-label-sm text-muted-foreground">
                    {formType === 'rider' ? t('Requirements & notes') : t('Notes & terms')}
                  </label>
                  {!formNotes.trim() && (
                    <button
                      type="button"
                      onClick={() => setFormNotes(STANDARD_TERMS[formType])}
                      className="inline-flex items-center gap-1.5 h-9 bw-button-sm text-foreground"
                    >
                      <Sparkles className="w-4 h-4" aria-hidden />
                      {formType === 'rider' ? t('Use standard rider') : t('Use standard terms')}
                    </button>
                  )}
                </div>
                <textarea
                  id="contract-notes"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder={t('Technical specifications, load-in requirements, hospitality…')}
                  rows={formNotes.length > 200 ? 12 : 5}
                  className="w-full px-4 py-3.5 rounded-[24px] bg-field border border-border bw-body-lg text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-2 focus:border-foreground resize-none"
                />
              </div>
            </div>

            <div className="shrink-0 px-4 pt-3 bg-background" style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
              <div className="max-w-xl mx-auto w-full">
                <PillButton
                  onClick={handleSaveContract}
                  loading={saving}
                  disabled={!formTitle.trim() || !formClientName.trim() || !!emailError}
                  icon={<FileText className="w-[18px] h-[18px]" />}
                >
                  {editingId ? t('Save changes') : formType === 'contract' ? t('Create contract') : t('Create rider')}
                </PillButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View document (Figma Sheet, Style=Dark) */}
      <BwSheet
        open={!!viewingContract}
        onClose={() => setViewingId(null)}
        overline={viewingContract ? statusLabel(effectiveStatus(viewingContract, today)) : undefined}
        title={viewingContract?.title ?? ''}
        zIndex={110}
        footer={
          viewingContract && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <PillButton
                  variant="white"
                  icon={<Download className="w-[18px] h-[18px]" />}
                  loading={isBusy(viewingContract.id, 'download')}
                  disabled={!!busy}
                  onClick={() => handleDownloadPdf(viewingContract)}
                >
                  PDF
                </PillButton>
                {viewingContract.status !== 'signed' && (
                  <PillButton icon={<Send className="w-[18px] h-[18px]" />} disabled={!!busy} onClick={() => openSend(viewingContract)}>
                    {viewingContract.sent_at ? t('Resend') : t('Send')}
                  </PillButton>
                )}
              </div>
              {viewingContract.status !== 'signed' && (
                <div className="flex gap-2">
                  <PillButton
                    variant="outline"
                    className={SHEET_OUTLINE}
                    icon={<Pencil className="w-[18px] h-[18px]" />}
                    disabled={!!busy}
                    onClick={() => openEdit(viewingContract)}
                  >
                    {t('Edit')}
                  </PillButton>
                  <PillButton
                    variant="outline"
                    className={SHEET_OUTLINE}
                    icon={<FileSignature className="w-[18px] h-[18px]" />}
                    loading={isBusy(viewingContract.id, 'sign')}
                    disabled={!!busy}
                    onClick={() => handleMarkSigned(viewingContract)}
                  >
                    {t('Mark as signed')}
                  </PillButton>
                </div>
              )}
            </div>
          )
        }
      >
        {viewingContract && (
          <div className="flex flex-col gap-2">
            {actionError && <FormError>{actionError}</FormError>}
            {notice && <p role="status" className="bw-body-sm text-success">{notice}</p>}
            {viewingContract.event_name && <SheetInfo label={t('Event')}>{viewingContract.event_name}</SheetInfo>}
            <div className="grid grid-cols-2 gap-2">
              <SheetInfo label={t('Client')} className="[&>div:last-child]:truncate">{viewingContract.client_name || '—'}</SheetInfo>
              <SheetInfo label={t('Event date')}>{formatContractDate(viewingContract.event_date, intlLocale('en-GB')) || '—'}</SheetInfo>
            </div>
            {viewingContract.client_email && <SheetInfo label={t('Client email')}>{viewingContract.client_email}</SheetInfo>}
            <SheetInfo label={t('Document type')}>{isRider(viewingContract) ? t('Rider') : t('Contract')}</SheetInfo>
            {viewingContract.expires_at && <SheetInfo label={t('Valid until')}>{formatContractDate(viewingContract.expires_at, intlLocale('en-GB'))}</SheetInfo>}
            {viewingContract.sent_at && <SheetInfo label={t('Sent')}>{formatContractDate(viewingContract.sent_at, intlLocale('en-GB'))}</SheetInfo>}
            {viewingContract.signed_at && <SheetInfo label={t('Signed')}>{formatContractDate(viewingContract.signed_at, intlLocale('en-GB'))}</SheetInfo>}
            {viewingContract.content && (
              <SheetInfo label={isRider(viewingContract) ? t('Requirements & notes') : t('Notes & terms')}>
                <p className="whitespace-pre-wrap bw-body-md">{viewingContract.content}</p>
              </SheetInfo>
            )}
          </div>
        )}
      </BwSheet>

      {/* Send to client (Figma Sheet, Style=Dark) */}
      <BwSheet
        open={!!sendingContract}
        onClose={closeSend}
        overline={sendingContract?.title}
        title={t('Send to client')}
        zIndex={120}
        footer={
          sendingContract &&
          (sendStep === 'compose' ? (
            <PillButton
              icon={<Send className="w-[18px] h-[18px]" />}
              loading={sendBusy}
              disabled={!sendEmail.trim()}
              onClick={handleShareToClient}
            >
              {t('Share PDF')}
            </PillButton>
          ) : (
            <div className="flex flex-col gap-2">
              <PillButton icon={<Send className="w-[18px] h-[18px]" />} loading={sendBusy} onClick={handleConfirmSent}>
                {t('Mark as sent')}
              </PillButton>
              <PillButton variant="outline" className={SHEET_OUTLINE} disabled={sendBusy} onClick={closeSend}>
                {t('Not sent yet')}
              </PillButton>
            </div>
          ))
        }
      >
        {sendingContract && (
          <div className="flex flex-col gap-4">
            {sendError && <FormError>{sendError}</FormError>}
            {sendStep === 'compose' ? (
              <>
                <PillField
                  tone="sheet"
                  label={t('Client email')}
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="events@venue.com"
                  value={sendEmail}
                  onChange={(e) => setSendEmail(e.target.value)}
                  error={sendEmail.trim() && !isValidEmail(sendEmail) ? t('Enter a valid email address.') : null}
                />
                <p className="bw-body-sm text-sheet-foreground/70">
                  {t('The PDF opens in the share sheet with a message ready to go. Pick Mail (or any app) and send it to the client. The document is marked as sent once you share it.')}
                </p>
                <SheetInfo label={t('Message')}>
                  <p className="whitespace-pre-wrap bw-body-md">
                    {buildSendMessage({ ...sendingContract, client_email: sendEmail }, bandName).body}
                  </p>
                </SheetInfo>
              </>
            ) : sendVia === 'mail' ? (
              <p className="bw-body-md text-sheet-foreground/85">
                {t('The PDF was saved and your email app opened with the message to {email}. Attach the PDF, send the email, then mark the document as sent.', { email: sendEmail.trim() })}
              </p>
            ) : (
              <p className="bw-body-md text-sheet-foreground/85">
                {t('The PDF was shared. Try marking the document as sent again.')}
              </p>
            )}
          </div>
        )}
      </BwSheet>

      <DeleteChatSheet
        open={!!pendingDelete}
        title={pendingDelete ? t('Delete "{title}"?', { title: pendingDelete.title }) : undefined}
        body={t('The document is removed for the whole band. Copies already sent to the client are not affected.')}
        deleting={!!pendingDelete && isBusy(pendingDelete.id, 'delete')}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && handleDelete(pendingDelete)}
      />
    </motion.div>
  );
};

export default ContractsView;
