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
} from '@/lib/services/quotes';
import { useBand } from '@/lib/BandContext';
import { getActiveSymbol as sym, useCurrency } from '@/lib/currency';

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
}) => {
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
    const t = setTimeout(() => setInlineMessage(null), inlineMessage.type === 'error' ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [inlineMessage]);

  const notify = useCallback(
    (text: string, type: 'success' | 'error' | 'info' = 'info') => {
      if (onShowToast) onShowToast(text, type);
      else setInlineMessage({ text, type });
    },
    [onShowToast]
  );

  const errorText = (err: unknown, fallback: string) =>
    `${fallback}: ${(err as any)?.message || 'Unknown error'}`;
  
  // Modal states
  const [isCreating, setIsCreating] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [sharingQuote, setSharingQuote] = useState<Partial<Quote> | null>(null);
  
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
      notify('No band selected — cannot save the quote', 'error');
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
          notify(errorText(error, 'Failed to update quote'), 'error');
          return; // keep the wizard open so nothing is lost
        }

        const saved = { ...quoteData, ...dbQuoteToAppQuote(data), musicians: quoteData.musicians || existing.musicians } as MockQuote;
        setQuotes(prev => prev.map(q => (q.id === existing.id ? saved : q)));
        setIsCreating(false);
        setEditingQuote(null);
        notify('Quote updated', 'success');
        onQuotesChanged?.();
        if (opts?.share) setSharingQuote(saved);
        return;
      }

      // ── Create: the DB assigns the quote number; share/PDF only after the insert returns ──
      const { data, error } = await createQuoteDB(record, appMusiciansToDb(quoteData.musicians));
      if (error || !data) {
        notify(errorText(error, 'Failed to create quote'), 'error');
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
      notify(`Quote ${saved.quoteNumber} saved`, 'success');
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
      notify(errorText(error, 'Failed to mark quote as sent'), 'error');
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
      notify(errorText(error, 'Could not update the quote'), 'error');
      return;
    }
    setQuotes(prev => prev.map(q => (q.id === quote.id ? { ...q, ...dbQuoteToAppQuote(data), musicians: q.musicians } : q)));
    notify(outcome === 'ACCEPTED' ? 'Quote accepted. The gig is confirmed.' : 'Quote marked as declined', 'success');
    onQuotesChanged?.();
  };

  const handleDuplicateQuote = async (quote: Quote) => {
    setSelectedQuote(null);
    const { data, error } = await duplicateQuoteDB(quote.id);
    if (error || !data) {
      notify(errorText(error, 'Failed to duplicate quote'), 'error');
      return;
    }
    setQuotes(prev => [dbQuoteToAppQuote(data), ...prev]);
    notify(`Quote duplicated as ${data.quote_number}`, 'success');
    onQuotesChanged?.();
  };

  const handleDeleteQuote = async (quote: Quote) => {
    const label = quote.quoteNumber || quote.eventTitle || quote.clientName || 'this quote';
    if (typeof window !== 'undefined' && !window.confirm(`Delete ${label}? This cannot be undone.`)) {
      return;
    }

    const previous = quotes;
    setQuotes(prev => prev.filter(q => q.id !== quote.id));
    setSelectedQuote(null);

    const { error } = await deleteQuoteDB(quote.id);
    if (error) {
      setQuotes(previous);
      notify(errorText(error, 'Failed to delete quote'), 'error');
      return;
    }
    notify('Quote deleted', 'success');
    onQuotesChanged?.();
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
      case 'SENT': return <Send />;
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
        title="Quotes"
        onBack={onClose}
        meta={<span className="bw-label-sm text-muted-foreground">{quotes.length}</span>}
        actions={<IconButton label="New quote" variant="filled" icon={<Plus />} onClick={() => setIsCreating(true)} />}
      />

      <div
        className="flex-1 flex flex-col gap-8 px-4 pt-2 max-w-[700px] w-full mx-auto bg-background text-foreground"
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
            <span className="bw-label-sm">Pipeline potential</span>
            <DotText text={`${sym()}${(pipelineTotal / 1000).toFixed(1)}k`} size={32} label={`Pipeline ${sym()}${pipelineTotal.toLocaleString()}`} />
          </div>

          {/* One dot column per active quote: height = value, colour = likelihood */}
          {chartQuotes.length === 0 ? (
            <p className="bw-body-sm text-sheet-foreground/70 py-6 text-center">No pipeline data</p>
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
                    aria-label={`${quote.eventTitle || quote.clientName}: ${sym()}${quote.total.toLocaleString()}`}
                    className="relative flex flex-col gap-1 items-center cursor-pointer group"
                  >
                    <span
                      className={
                        'absolute -top-6 left-1/2 -translate-x-1/2 h-5 px-1.5 rounded-full bg-surface-inverse text-surface-inverse-foreground bw-label-xs inline-flex items-center whitespace-nowrap pointer-events-none transition-opacity ' +
                        (isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')
                      }
                    >
                      {sym()}{(quote.total / 1000).toFixed(1)}k
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
              {activeQuotes.length} {activeQuotes.length === 1 ? 'deal' : 'deals'}
            </span>
            <span className="flex items-center gap-1.5 bw-label-sm">
              <span className="w-2 h-2 rounded-full bg-accent" aria-hidden="true" />
              Accepted
            </span>
          </div>
        </motion.section>

        {/* Quote list */}
        <section className="flex flex-col gap-4">
          <h2 className="bw-label-md text-foreground">All quotes</h2>
          {quotes.length === 0 ? (
            <Card className="items-center text-center py-8 gap-1">
              <h3 className="bw-h3">No quotes yet</h3>
              <p className="bw-body-sm text-muted-foreground">Create your first quote to get started.</p>
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
                  'w-full rounded-[24px] p-4 flex flex-col gap-3 text-left active:scale-[0.99] transition-transform ' +
                  (accepted ? 'bg-accent-quote text-accent-quote-foreground' : 'bg-card text-card-foreground')
                }
              >
                <span className="flex items-start gap-3">
                  <span className="flex-1 min-w-0 flex flex-col gap-1">
                    {quote.clientName && (
                      <span className={'bw-label-sm truncate ' + (accepted ? 'opacity-70' : 'text-muted-foreground')}>{quote.clientName}</span>
                    )}
                    <span className="bw-h3 [overflow-wrap:anywhere]">{quote.eventTitle || 'Untitled quote'}</span>
                  </span>
                  <Tag variant={statusTag(quote.status)} icon={getStatusIcon(quote.status)}>
                    {getStatusLabel(quote.status)}
                  </Tag>
                </span>
                <span className="flex items-end justify-between gap-3">
                  <span className={'bw-label-xs ' + (accepted ? 'opacity-70' : 'text-muted-foreground')}>
                    {[items > 0 ? `${items} ${items === 1 ? 'item' : 'items'}` : null, created && !isNaN(created.getTime()) ? created.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span className="bw-num whitespace-nowrap">{sym()}{quote.total.toLocaleString()}</span>
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
              Saving quote…
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
