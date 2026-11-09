import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Plus,
  BarChart3,
  Send,
  Edit3,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Loader2
} from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { ExpandedCardWrapper } from './ExpandedCardWrapper';
import { 
  Quote as MockQuote, 
  QuoteStatus,
  getStatusColor, 
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
  appQuoteToDbRecord,
  appMusiciansToDb,
  dbQuoteToAppQuote,
  isUuid,
} from '@/lib/services/quotes';
import { useBand } from '@/lib/BandContext';

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
}

export const QuotesExpanded: React.FC<QuotesExpandedProps> = ({
  bandId,
  onClose,
  realQuotes,
  quoteStats,
  loading,
  onShowToast,
  onQuotesChanged,
}) => {
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
  const handleCreateQuote = async (quoteData: Partial<Quote>) => {
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
        if (quoteData.status === 'SENT') setSharingQuote(saved);
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
      if (!quoteData.status || quoteData.status === 'SENT') {
        setSharingQuote(saved);
      }
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
      case 'DRAFT': return <Edit3 className="w-3 h-3" />;
      case 'SENT': return <Send className="w-3 h-3" />;
      case 'ACCEPTED': return <CheckCircle className="w-3 h-3" />;
      case 'DECLINED': return <XCircle className="w-3 h-3" />;
      case 'EXPIRED': return <Clock className="w-3 h-3" />;
      default: return <FileText className="w-3 h-3" />;
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

  return (
    <ExpandedCardWrapper
      backgroundColor="var(--secondary)"
      onClose={onClose}
      origin={{ top: '40%', left: '3%', right: '58%', bottom: '42%' }}
    >
      {/* Header */}
      <motion.div 
        className="sticky top-0 z-50 p-6 flex items-center justify-between bg-[var(--secondary)]/95 backdrop-blur-md" 
        initial={{ opacity: 0, y: -20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.15, duration: 0.3 }}
      >
        <div className="flex items-center gap-4">
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }} 
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-foreground hover:bg-white/20 transition-colors backdrop-blur-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-black tracking-tight text-foreground">Quotes</h2>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="w-10 h-10 rounded-full bg-[var(--surface-inverse)] flex items-center justify-center text-white shadow-lg hover:scale-105 transition-transform"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>
      </motion.div>
      
      <div 
        className="px-3 pb-32" 
        onClick={() => setActiveChartId(null)}
      >
        {/* Pipeline Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }} 
          transition={{ delay: 0.3 }} 
          className="mb-8 p-6 bg-[var(--surface-inverse)] rounded-[2.5rem] relative overflow-hidden shadow-2xl" 
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[var(--secondary)] text-[10px] font-bold uppercase tracking-widest block mb-1">Pipeline Potential</span>
                <h3 className="text-4xl font-black text-[var(--bg)] tracking-tighter">€{(pipelineTotal / 1000).toFixed(1)}k</h3>
              </div>
              <div className="bg-[var(--surface-inverse)] p-2 rounded-full">
                <BarChart3 className="w-5 h-5 text-accent-quote" />
              </div>
            </div>
            
            {/* Pipeline Chart */}
            <div className="h-28 flex items-end justify-between gap-1.5 px-1 pb-2 relative">
              {activeQuotes.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-center">
                  <BarChart3 className="w-8 h-8 text-stone-600 mb-2" />
                  <p className="text-stone-500 text-xs">No pipeline data</p>
                </div>
              ) : activeQuotes.slice(0, 7).map((quote, i) => { 
                const heightPct = Math.min(100, Math.max(20, (quote.total / 12000) * 100)); 
                const probability = getProbabilityFromStatus(quote.status);
                let barColor = "bg-[var(--surface-inverse)]"; 
                if (probability > 40) barColor = "bg-[var(--secondary)]"; 
                if (probability > 70) barColor = "bg-accent-quote"; 
                const isActive = activeChartId === quote.id; 
                
                return (
                  <motion.div 
                    key={quote.id} 
                    onClick={() => setActiveChartId(isActive ? null : quote.id)} 
                    initial={{ height: "0%" }} 
                    animate={{ height: `${heightPct}%` }} 
                    transition={{ delay: 0.2 + (i * 0.03), type: "tween", duration: 0.3, ease: "easeOut" }} 
                    className={cn("flex-1 rounded-t-lg relative group min-w-[12px] cursor-pointer", barColor)}
                  >
                    {probability > 70 && (
                      <motion.div 
                        animate={{ opacity: [0.5, 1, 0.5] }} 
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} 
                        className="absolute inset-0 bg-white/20 rounded-t-lg" 
                      />
                    )}
                    <div className={cn(
                      "absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-black text-[9px] font-bold px-1.5 py-0.5 rounded transition-opacity whitespace-nowrap pointer-events-none z-20", 
                      isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}>
                      €{(quote.total / 1000).toFixed(1)}k
                    </div>
                  </motion.div>
                ); 
              })}
            </div>
            
            <div className="flex items-center justify-between text-[10px] font-bold text-[var(--muted-fg)] border-t border-white/10 pt-3">
              <span>Total Deals: {activeQuotes.length}</span>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-accent-quote" />
                <span className="text-accent-quote">Accepted</span>
              </div>
            </div>
          </div>
        </motion.div>
        
        {/* Quote List */}
        <div className="space-y-3">
          <h4 className="text-sm font-black text-foreground uppercase tracking-wider ml-2 opacity-60 mb-2">All Quotes</h4>
          {quotes.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: 0.4 }} 
              className="bg-white/30 p-8 rounded-[2rem] flex flex-col items-center justify-center text-center"
            >
              <FileText className="w-12 h-12 text-foreground/40 mb-3" />
              <p className="text-foreground font-bold mb-1">No quotes yet</p>
              <p className="text-foreground/60 text-sm">Create your first quote to get started</p>
            </motion.div>
          ) : quotes.map((quote, i) => (
            <motion.div 
              key={quote.id} 
              onClick={() => setSelectedQuote(quote)}
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              transition={{ delay: 0.4 + (i * 0.05) }} 
              className={cn(
                "p-5 rounded-[2rem] shadow-sm relative overflow-hidden group transition-all cursor-pointer",
                quote.status === 'ACCEPTED' ? "bg-accent-quote" : "bg-background"
              )}
            >
              <div className="flex justify-between items-start mb-1 relative z-10">
                <div>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest block mb-0.5", 
                    quote.status === 'ACCEPTED' ? "text-foreground/60" : "text-[var(--secondary)]"
                  )}>
                    {quote.clientName}
                  </span>
                  <h4 className="text-lg font-black text-foreground leading-tight">{quote.eventTitle}</h4>
                </div>
                <div className={cn(
                  "px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wide flex items-center gap-1",
                  getStatusColor(quote.status)
                )}>
                  {getStatusIcon(quote.status)}
                  {getStatusLabel(quote.status)}
                </div>
              </div>
              
              <div className="flex items-end justify-between mt-4 relative z-10">
                <div className="flex flex-col gap-1 w-1/2">
                  <div className="flex justify-between text-[10px] font-bold uppercase text-foreground/50">
                    <span>{(quote.customItems?.length || 0)} items</span>
                    <span>{new Date(quote.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <span className="text-2xl font-black text-foreground">€{quote.total.toLocaleString()}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Inline feedback (used when no app-level toast is provided) */}
      <AnimatePresence>
        {inlineMessage && (
          <motion.div
            role={inlineMessage.type === 'error' ? 'alert' : 'status'}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={() => setInlineMessage(null)}
            className={cn(
              'fixed left-4 right-4 top-[max(env(safe-area-inset-top,0px),16px)] z-[300] mx-auto max-w-md rounded-2xl px-4 py-3 text-sm font-bold shadow-xl cursor-pointer',
              inlineMessage.type === 'error'
                ? 'bg-[var(--destructive)] text-white'
                : 'bg-[var(--surface-inverse)] text-white'
            )}
          >
            {inlineMessage.text}
          </motion.div>
        )}
      </AnimatePresence>

      {isSaving && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom,0px)+24px)] z-[300] flex items-center gap-2 rounded-full bg-[var(--surface-inverse)] px-4 py-2 text-xs font-bold text-white shadow-xl"
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
          />
        )}
      </AnimatePresence>
    </ExpandedCardWrapper>
  );
};
