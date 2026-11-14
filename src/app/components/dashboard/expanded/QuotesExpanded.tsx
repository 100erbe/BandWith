import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Send,
  Edit3,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Loader2
} from '@/app/components/icons';
import { Card, IconButton, Tag, type TagStyle } from '@/app/components/bw/Screen';
import { DotText } from '@/app/components/bw';
import { ExpandedCardWrapper, ExpandedTopBar } from './ExpandedCardWrapper';
import { 
  Quote as MockQuote, 
  QuoteStatus,
  getStatusLabel,
} from '@/app/data/quotes';
import type { Quote } from '@/app/data/quotes';
import { QuoteCreationWizard } from '@/app/components/quotes/QuoteCreationWizard';
import { QuoteDetailModal } from '@/app/components/quotes/QuoteDetailModal';
import { QuoteShareModal } from '@/app/components/quotes/QuoteShareModal';
import type { Quote as RealQuote } from '@/lib/services/quotes';
import {
  createQuote as createQuoteDB,
  updateQuote as updateQuoteDB,
  deleteQuote as deleteQuoteDB,
  duplicateQuote as duplicateQuoteDB,
  sendQuote as sendQuoteDB,
  acceptQuote as acceptQuoteDB,
  declineQuote as declineQuoteDB,
  appQuoteToDbRecord,
  appMusiciansToDb,
  dbQuoteToAppQuote,
  isUuid,
  gigFromAcceptedQuote,
} from '@/lib/services/quotes';
import { republishClientQuote } from '@/lib/services/quoteLinks';
import type { ContractPrefill } from '@/app/views/ContractsView';
import { useBand } from '@/lib/BandContext';
import { getActiveSymbol as sym, useCurrency, currencySymbol } from '@/lib/currency';
import { formatQuoteMoney } from '@/lib/services/quoteMath';
import { useT, intlLocale, localDecimal } from '@/lib/i18n';

interface QuotesExpandedProps {
  bandId: string;
  onClose: () => void;
  realQuotes?: RealQuote[];
  quoteStats?: {
    totalQuotes: number;
    pendingQuotes: number;
    acceptedQuotes: number;
    totalPipeline: number;
    acceptedRevenue: number;
  } | null;
  loading?: boolean;
  /** Optional app-level toast; when absent an inline banner is shown. */
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  /** Optional: called after a successful create/update/delete so the parent can refetch. */
  onQuotesChanged?: () => void;
  /** Opens Band settings (Pricing modal, "Branding & payment" tab) from the share sheet. */
  onOpenBandSettings?: () => void;
  /** Opens a gig (after "Create gig from quote"). */
  onOpenEvent?: (eventId: string) => void;
  /** Opens Contracts with a new contract filled from the quote. */
  onPrepareContract?: (prefill: ContractPrefill) => void;
  /** A quote to open right away (from a notification), then cleared. */
  focusQuoteId?: string | null;
  onFocusConsumed?: () => void;
}

export const QuotesExpanded: React.FC<QuotesExpandedProps> = ({
  bandId,
  onClose,
  realQuotes,
  quoteStats,
  loading,
  onShowToast,
  onQuotesChanged,
  onOpenBandSettings,
  onOpenEvent,
  onPrepareContract,
  focusQuoteId,
  onFocusConsumed,
}) => {
  const t = useT();
  useCurrency(); // re-render money labels when the band currency changes
  const { selectedBand } = useBand();
  // Real band id: BandContext first, then the prop (only if it is a real UUID, never a mock id)
  const currentBandId: string | null =
    (selectedBand?.id && isUuid(selectedBand.id) ? selectedBand.id : null) ||
    (isUuid(bandId) ? bandId : null);

  // Convert real quotes to display format (real quote number, VAT, discount etc. from the DB)
  const convertRealQuotes = (rq: RealQuote[]): MockQuote[] => rq.map(dbQuoteToAppQuote);

  // Quote data state - use real quotes only
  const [quotes, setQuotes] = useState<MockQuote[]>(
    realQuotes && realQuotes.length > 0 ? convertRealQuotes(realQuotes) : []
  );

  // Update quotes when realQuotes changes (including when it becomes empty)
  useEffect(() => {
    if (realQuotes) {
      setQuotes(convertRealQuotes(realQuotes));
    }
  }, [realQuotes]);

  // Feedback: app toast if provided, otherwise an inline banner
  const [inlineMessage, setInlineMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!inlineMessage) return;
    const timer = setTimeout(() => setInlineMessage(null), inlineMessage.type === 'error' ? 6000 : 3500);
    return () => clearTimeout(timer);
  }, [inlineMessage]);

  const notify = useCallback(
    (text: string, type: 'success' | 'error' | 'info' = 'info') => {
      if (onShowToast) onShowToast(text, type);
      else setInlineMessage({ text, type });
    },
    [onShowToast]
  );

  // Translated text only: the server's own message goes to the console.
  const errorText = (err: unknown, fallback: string) => {
    console.warn(`[quotes] ${fallback}:`, err);
    return `${fallback}. ${t('Check your connection and try again.')}`;
  };
  // A quote's own currency, cents only when it has them.
  const quoteMoney = (q: Pick<Quote, 'total' | 'currency'>) =>
    formatQuoteMoney(q.total || 0, q.currency ? currencySymbol(q.currency) : sym(), intlLocale('en-US'));
  
  // Modal states
  const [isCreating, setIsCreating] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [sharingQuote, setSharingQuote] = useState<Partial<Quote> | null>(null);
  
  const [creatingGig, setCreatingGig] = useState(false);

  // A notification about a quote opens it (once the list has it).
  useEffect(() => {
    if (!focusQuoteId) return;
    const q = quotes.find((x) => x.id === focusQuoteId);
    if (!q) return;
    setSelectedQuote(q);
    onFocusConsumed?.();
  }, [focusQuoteId, quotes, onFocusConsumed]);

  // Chart interaction
  const [activeChartId, setActiveChartId] = useState<string | null>(null);

  // Computed values - use stats if available, otherwise calculate
  const pipelineTotal = quoteStats?.totalPipeline || quotes
    .filter(q => q.status !== 'DECLINED' && q.status !== 'EXPIRED')
    .reduce((acc, q) => acc + q.total, 0);

  const activeQuotes = quotes.filter(q => q.status !== 'DECLINED' && q.status !== 'EXPIRED');

  // Handlers (all persist through src/lib/services/quotes.ts; optimistic changes are reverted on failure)
  const handleCreateQuote = async (quoteData: Partial<Quote>, opts?: { share?: boolean }) => {
    if (isSaving) return;
    if (!currentBandId) {
      notify(t('No band selected — cannot save the quote'), 'error');
      return;
    }

    const existing = quoteData.id ? quotes.find(q => q.id === quoteData.id) : undefined;
    const record = appQuoteToDbRecord(quoteData, currentBandId);
    setIsSaving(true);

    try {
      if (existing && isUuid(existing.id)) {
        // ── Edit an existing quote (optimistic, reverted on failure) ──
        const previous = quotes;
        const optimistic = { ...existing, ...quoteData, quoteNumber: existing.quoteNumber } as MockQuote;
        setQuotes(prev => prev.map(q => (q.id === existing.id ? optimistic : q)));

        const { band_id: _bandId, ...updates } = record;
        const { data, error } = await updateQuoteDB(existing.id, updates);
        if (error || !data) {
          setQuotes(previous);
          notify(errorText(error, t('Failed to update quote')), 'error');
          return; // keep the wizard open so nothing is lost
        }

        const saved = { ...quoteData, ...dbQuoteToAppQuote(data), musicians: quoteData.musicians || existing.musicians } as MockQuote;
        setQuotes(prev => prev.map(q => (q.id === existing.id ? saved : q)));
        setIsCreating(false);
        setEditingQuote(null);
        notify(t('Quote updated'), 'success');
        onQuotesChanged?.();
        if (opts?.share) setSharingQuote(saved);
        // Already sent with the client link: the page shows the new version.
        republishClientQuote(saved, currentBandId, selectedBand?.name || 'Band').then(({ data: version, error: pubError }) => {
          if (pubError) notify(t('The client page could not be updated. Try again.'), 'error');
          else if (version && version > 1) notify(t('The client’s page now shows version {n}.', { n: version }), 'success');
        });
        return;
      }

      // ── Create: the DB assigns the quote number; share/PDF only after the insert returns ──
      const { data, error } = await createQuoteDB(record, appMusiciansToDb(quoteData.musicians));
      if (error || !data) {
        notify(errorText(error, t('Failed to create quote')), 'error');
        return; // keep the wizard open so nothing is lost
      }

      const { id: _localId, ...rest } = quoteData;
      const saved = {
        ...rest,
        ...dbQuoteToAppQuote(data),
        // keep wizard-only presentation fields (moments, options, musicians) for the share/PDF step
        musicians: quoteData.musicians || [],
        selectedMoments: quoteData.selectedMoments,
        quoteOptions: quoteData.quoteOptions,
        includeProposalSummary: quoteData.includeProposalSummary,
      } as MockQuote;

      setQuotes(prev => [saved, ...prev]);
      setIsCreating(false);
      setEditingQuote(null);
      notify(t('Quote {number} saved', { number: String(saved.quoteNumber) }), 'success');
      onQuotesChanged?.();
      if (opts?.share) setSharingQuote(saved);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendQuote = async (quote: Quote) => {
    const previous = quotes;
    setQuotes(prev => prev.map(q => 
      q.id === quote.id 
        ? { ...q, status: 'SENT' as QuoteStatus, updatedAt: new Date().toISOString() }
        : q
    ));
    setSelectedQuote(null);

    const { data, error } = await sendQuoteDB(quote.id);
    if (error || !data) {
      setQuotes(previous);
      notify(errorText(error, t('Failed to mark quote as sent')), 'error');
      return;
    }
    setQuotes(prev => prev.map(q => (q.id === quote.id ? { ...q, ...dbQuoteToAppQuote(data), musicians: q.musicians } : q)));
    onQuotesChanged?.();
  };

  const handleSetOutcome = async (quote: Quote, outcome: 'ACCEPTED' | 'DECLINED') => {
    const previous = quotes;
    setQuotes(prev => prev.map(q => (q.id === quote.id ? { ...q, status: outcome as QuoteStatus } : q)));
    setSelectedQuote(null);
    const { data, error } = outcome === 'ACCEPTED' ? await acceptQuoteDB(quote.id) : await declineQuoteDB(quote.id);
    if (error || !data) {
      setQuotes(previous);
      notify(errorText(error, t('Could not update the quote')), 'error');
      return;
    }
    setQuotes(prev => prev.map(q => (q.id === quote.id ? { ...q, ...dbQuoteToAppQuote(data), musicians: q.musicians } : q)));
    notify(
      outcome === 'DECLINED'
        ? t('Quote marked as declined')
        : data.converted_to_event_id
          ? t('Quote accepted. The gig is confirmed.')
          : t('Quote accepted. Open it to create the gig.'),
      'success',
    );
    onQuotesChanged?.();
  };

  const handleDuplicateQuote = async (quote: Quote) => {
    setSelectedQuote(null);
    const { data, error } = await duplicateQuoteDB(quote.id);
    if (error || !data) {
      notify(errorText(error, t('Failed to duplicate quote')), 'error');
      return;
    }
    setQuotes(prev => [dbQuoteToAppQuote(data), ...prev]);
    notify(t('Quote duplicated as {number}', { number: String(data.quote_number) }), 'success');
    onQuotesChanged?.();
  };

  const handleDeleteQuote = async (quote: Quote) => {
    const label = quote.quoteNumber || quote.eventTitle || quote.clientName || t('this quote');
    if (typeof window !== 'undefined' && !window.confirm(t('Delete {label}? This cannot be undone.', { label }))) {
      return;
    }

    const previous = quotes;
    setQuotes(prev => prev.filter(q => q.id !== quote.id));
    setSelectedQuote(null);

    const { error } = await deleteQuoteDB(quote.id);
    if (error) {
      setQuotes(previous);
      notify(errorText(error, t('Failed to delete quote')), 'error');
      return;
    }
    notify(t('Quote deleted'), 'success');
    onQuotesChanged?.();
  };

  const handleCreateGig = async (quote: Quote) => {
    if (creatingGig) return;
    setCreatingGig(true);
    const { data, error } = await gigFromAcceptedQuote(quote.id);
    setCreatingGig(false);
    if (error || !data) {
      notify(errorText(error, t('Could not create the gig')), 'error');
      return;
    }
    setQuotes(prev => prev.map(q => (q.id === quote.id ? { ...q, convertedToEventId: data.eventId, eventId: data.eventId } : q)));
    notify(
      data.lineupError
        ? t('Gig created, but its lineup was not added. Add the musicians in the gig.')
        : data.created
          ? t('Gig created from the quote')
          : t('Gig confirmed'),
      data.lineupError ? 'error' : 'success',
    );
    onQuotesChanged?.();
    setSelectedQuote(null);
    onOpenEvent?.(data.eventId);
  };

  const handlePrepareContract = (quote: Quote) => {
    setSelectedQuote(null);
    onPrepareContract?.({
      eventId: quote.convertedToEventId || null,
      eventName: quote.eventName || quote.eventTitle || '',
      clientName: quote.clientCompany || quote.clientName || '',
      clientEmail: quote.clientEmail || '',
      eventDate: quote.eventDate || '',
    });
  };

  const handleEditQuote = (quote: Quote) => {
    setSelectedQuote(null);
    setEditingQuote(quote);
    // For now, just open creation wizard - in full implementation would pre-populate
    setIsCreating(true);
  };

  const getStatusIcon = (status: QuoteStatus) => {
    switch (status) {
      case 'DRAFT': return <Edit3 />;
      case 'SENT':
      case 'VIEWED':
      case 'NEGOTIATING': return <Send />;
      case 'ACCEPTED': return <CheckCircle />;
      case 'DECLINED': return <XCircle />;
      case 'EXPIRED': return <Clock />;
      default: return <FileText />;
    }
  };

  const getProbabilityFromStatus = (status: QuoteStatus): number => {
    switch (status) {
      case 'DRAFT': return 20;
      case 'SENT': return 50;
      case 'VIEWED': return 55;
      case 'NEGOTIATING': return 60;
      case 'ACCEPTED': return 100;
      case 'DECLINED': return 0;
      case 'EXPIRED': return 0;
      default: return 30;
    }
  };

  const statusTag = (status: QuoteStatus): TagStyle => {
    switch (status) {
      case 'ACCEPTED': return 'solid';
      case 'SENT':
      case 'VIEWED':
      case 'NEGOTIATING': return 'quote';
      case 'DECLINED':
      case 'EXPIRED': return 'outline';
      default: return 'subtle';
    }
  };

  const chartQuotes = activeQuotes.slice(0, 7);
  const chartMax = Math.max(12000, ...chartQuotes.map(q => q.total));
  const CHART_ROWS = 8;

  return (
    <ExpandedCardWrapper
      backgroundColor="var(--bg)"
      onClose={onClose}
      origin={{ top: '40%', left: '3%', right: '58%', bottom: '42%' }}
    >
      <ExpandedTopBar
        title={t('Quotes')}
        onBack={onClose}
        meta={<span className="bw-label-sm text-muted-foreground">{quotes.length}</span>}
        actions={<IconButton label={t('New quote')} variant="filled" icon={<Plus />} onClick={() => setIsCreating(true)} />}
      />

      <div
        className="@container flex-1 flex flex-col gap-8 px-4 pt-2 max-w-[1100px] w-full mx-auto bg-background text-foreground"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 40px)' }}
        onClick={() => setActiveChartId(null)}
      >
        {/* Pipeline (Figma Fee card, dark) */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="dark bg-sheet text-sheet-foreground rounded-[24px] p-5 flex flex-col gap-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-1">
            <span className="bw-label-sm">{t('Pipeline potential')}</span>
            <DotText text={`${sym()}${localDecimal((pipelineTotal / 1000).toFixed(1))}k`} size={32} label={t('Pipeline {amount}', { amount: formatQuoteMoney(pipelineTotal, sym(), intlLocale('en-US')) })} />
          </div>

          {/* One dot column per active quote: height = value, colour = likelihood */}
          {chartQuotes.length === 0 ? (
            <p className="bw-body-sm text-sheet-foreground/70 py-6 text-center">{t('No pipeline data')}</p>
          ) : (
            <div className="flex justify-between gap-2 pt-6">
              {chartQuotes.map((quote, qi) => {
                const probability = getProbabilityFromStatus(quote.status);
                const lit = Math.max(2, Math.round(Math.min(1, quote.total / chartMax) * CHART_ROWS));
                const onColor = probability > 70 ? 'var(--accent)' : probability > 40 ? 'var(--sheet-fg)' : 'color-mix(in srgb, var(--sheet-fg) 45%, transparent)';
                const isActive = activeChartId === quote.id;
                return (
                  <button
                    type="button"
                    key={quote.id}
                    onClick={() => setActiveChartId(isActive ? null : quote.id)}
                    aria-label={`${quote.eventTitle || quote.clientName}: ${quoteMoney(quote)}`}
                    className="relative flex flex-col gap-1 items-center cursor-pointer group"
                  >
                    <span
                      className={
                        'absolute -top-6 left-1/2 -translate-x-1/2 h-5 px-1.5 rounded-full bg-surface-inverse text-surface-inverse-foreground bw-label-xs inline-flex items-center whitespace-nowrap pointer-events-none transition-opacity ' +
                        (isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')
                      }
                    >
                      {sym()}{localDecimal((quote.total / 1000).toFixed(1))}k
                    </span>
                    {Array.from({ length: CHART_ROWS }).map((_, r) => {
                      const fromBottom = CHART_ROWS - 1 - r;
                      const on = fromBottom < lit;
                      return (
                        <span
                          key={`${r}-${on ? 'on' : 'off'}`}
                          className={'w-2.5 h-2.5 rounded-full block' + (on ? ' bw-dot-rise' : '')}
                          style={{
                            backgroundColor: on ? onColor : 'color-mix(in srgb, var(--sheet-fg) 12%, transparent)',
                            ['--d' as string]: `${250 + qi * 60 + fromBottom * 35}ms`,
                          }}
                        />
                      );
                    })}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-sheet-foreground/15">
            <span className="bw-label-sm text-sheet-foreground/70">
              {activeQuotes.length === 1
                ? t('{count} deal', { count: activeQuotes.length })
                : t('{count} deals', { count: activeQuotes.length })}
            </span>
            <span className="flex items-center gap-1.5 bw-label-sm">
              <span className="w-2 h-2 rounded-full bg-accent" aria-hidden="true" />
              {t('Accepted')}
            </span>
          </div>
        </motion.section>

        {/* Quote list */}
        <section className="grid grid-cols-1 @min-[640px]:grid-cols-2 @min-[960px]:grid-cols-3 gap-4 items-stretch">
          <h2 className="bw-label-md text-foreground col-span-full">{t('All quotes')}</h2>
          {quotes.length === 0 ? (
            <Card className="col-span-full items-center text-center py-8 gap-1">
              <h3 className="bw-h3">{t('No quotes yet')}</h3>
              <p className="bw-body-sm text-muted-foreground">{t('Create your first quote to get started.')}</p>
            </Card>
          ) : quotes.map((quote, i) => {
            const accepted = quote.status === 'ACCEPTED';
            const items = quote.customItems?.length || 0;
            const created = quote.createdAt ? new Date(quote.createdAt) : null;
            return (
              <motion.button
                type="button"
                key={quote.id}
                onClick={() => setSelectedQuote(quote)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.04 }}
                className={
                  'w-full h-full rounded-[24px] p-4 flex flex-col justify-between gap-3 text-left active:scale-[0.99] transition-transform ' +
                  (accepted ? 'bg-accent-quote text-accent-quote-foreground' : 'bg-card text-card-foreground')
                }
              >
                <span className="flex items-start gap-3">
                  <span className="flex-1 min-w-0 flex flex-col gap-1">
                    {quote.clientName && (
                      <span className={'bw-label-sm truncate ' + (accepted ? 'opacity-70' : 'text-muted-foreground')}>{quote.clientName}</span>
                    )}
                    <span className="bw-h3 [overflow-wrap:anywhere]">{quote.eventTitle || t('Untitled quote')}</span>
                  </span>
                  <Tag variant={statusTag(quote.status)} icon={getStatusIcon(quote.status)}>
                    {t(getStatusLabel(quote.status))}
                  </Tag>
                </span>
                <span className="flex items-end justify-between gap-3">
                  <span className={'bw-label-xs ' + (accepted ? 'opacity-70' : 'text-muted-foreground')}>
                    {[items > 0 ? (items === 1 ? t('{count} item', { count: items }) : t('{count} items', { count: items })) : null, created && !isNaN(created.getTime()) ? created.toLocaleDateString(intlLocale('en-US'), { month: 'short', day: 'numeric' }) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span className="bw-num whitespace-nowrap">{quoteMoney(quote)}</span>
                </span>
              </motion.button>
            );
          })}
        </section>
      </div>

      {/* Toasts and the screens a quote opens render at the top of the
          document: this card lives inside the home scroller, which keeps fixed
          layers on the leading page in iOS WebKit, and on the iPhone Duo they
          open on the trailing page (Figma "Duo · 06 Quotes"). */}
      {createPortal(
        <>
          {/* Inline feedback (used when no app-level toast is provided) */}
          <AnimatePresence>
            {inlineMessage && (
              <motion.div
                role={inlineMessage.type === 'error' ? 'alert' : 'status'}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onClick={() => setInlineMessage(null)}
                className={
                  'bw-pane-leading-float fixed left-4 right-4 bw-status-clear-inset top-[max(var(--safe-top),16px)] z-[300] mx-auto max-w-md rounded-[16px] px-4 py-3 bw-body-sm font-medium cursor-pointer ' +
                  (inlineMessage.type === 'error'
                    ? 'bg-destructive-solid text-destructive-foreground'
                    : 'bg-surface-inverse text-surface-inverse-foreground')
                }
              >
                {inlineMessage.text}
              </motion.div>
            )}
          </AnimatePresence>

          {isSaving && (
            <div
              role="status"
              className="bw-pane-leading-center fixed left-1/2 -translate-x-1/2 bottom-[calc(var(--safe-bottom)+24px)] z-[300] flex items-center gap-2 h-9 rounded-full bg-surface-inverse text-surface-inverse-foreground px-4 bw-label-sm"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('Saving quote…')}
            </div>
          )}

          {/* Quote Creation Wizard */}
          <AnimatePresence>
            {isCreating && (
              <QuoteCreationWizard
                onClose={() => {
                  setIsCreating(false);
                  setEditingQuote(null);
                }}
                onCreate={handleCreateQuote}
                initialData={editingQuote || undefined}
                initialClientName={editingQuote?.clientName}
              />
            )}
          </AnimatePresence>

          {/* Quote Detail Modal */}
          <AnimatePresence>
            {selectedQuote && (
              <QuoteDetailModal
                quote={selectedQuote}
                onClose={() => setSelectedQuote(null)}
                onEdit={handleEditQuote}
                onSend={handleSendQuote}
                onDuplicate={handleDuplicateQuote}
                onDelete={handleDeleteQuote}
                onSetOutcome={handleSetOutcome}
                onOpenBandSettings={onOpenBandSettings}
                onClientStatus={(q, status) => {
                  // The client opened, answered or wrote: the list follows.
                  const next = (status === 'discussing' ? 'NEGOTIATING' : status.toUpperCase()) as QuoteStatus;
                  if (!['SENT', 'VIEWED', 'NEGOTIATING', 'ACCEPTED', 'DECLINED'].includes(next)) return;
                  if (next === q.status) return;
                  setQuotes(prev => prev.map(x => (x.id === q.id ? { ...x, status: next } : x)));
                  setSelectedQuote(prev => (prev && prev.id === q.id ? { ...prev, status: next } : prev));
                  onQuotesChanged?.();
                }}
                onCreateGig={handleCreateGig}
                creatingGig={creatingGig}
                onPrepareContract={onPrepareContract ? handlePrepareContract : undefined}
                notify={(text, tone) => notify(text, tone === 'error' ? 'error' : 'success')}
                onSent={(q) => {
                  setQuotes(prev => prev.map(x => (x.id === q.id ? { ...x, status: 'SENT' as QuoteStatus, sentAt: new Date().toISOString() } : x)));
                  setSelectedQuote(prev => (prev && prev.id === q.id ? { ...prev, status: 'SENT' as QuoteStatus } : prev));
                  onQuotesChanged?.();
                }}
              />
            )}
          </AnimatePresence>

          {/* Quote Share Modal */}
          <AnimatePresence>
            {sharingQuote && (
              <QuoteShareModal
                isOpen={!!sharingQuote}
                onClose={() => setSharingQuote(null)}
                quote={sharingQuote}
                bandId={currentBandId || bandId || 'default'}
                bandName={selectedBand?.name || 'Band'}
                onOpenBandSettings={onOpenBandSettings}
                onSent={(id) => {
                  const sentAt = new Date().toISOString();
                  setQuotes(prev => prev.map(q => (q.id === id ? { ...q, status: 'SENT' as QuoteStatus, sentAt } : q)));
                  setSharingQuote(prev => (prev && prev.id === id ? { ...prev, status: 'SENT' as QuoteStatus, sentAt } : prev));
                  onQuotesChanged?.();
                }}
              />
            )}
          </AnimatePresence>
        </>,
        document.body,
      )}
    </ExpandedCardWrapper>
  );
};
