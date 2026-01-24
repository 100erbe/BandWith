import React, { useState } from 'react';
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
  FileText
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { ExpandedCardWrapper } from './ExpandedCardWrapper';
import { 
  Quote, 
  QuoteStatus,
  QUOTES_DATA, 
  getStatusColor, 
  getStatusLabel,
  duplicateQuote,
  createQuote
} from '@/app/data/quotes';
import { QuoteCreationWizard } from '@/app/components/quotes/QuoteCreationWizard';
import { QuoteDetailModal } from '@/app/components/quotes/QuoteDetailModal';

interface QuotesExpandedProps {
  bandId: number;
  onClose: () => void;
}

export const QuotesExpanded: React.FC<QuotesExpandedProps> = ({
  onClose
}) => {
  // Quote data state
  const [quotes, setQuotes] = useState<Quote[]>(QUOTES_DATA);
  
  // Modal states
  const [isCreating, setIsCreating] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  
  // Chart interaction
  const [activeChartId, setActiveChartId] = useState<string | null>(null);

  // Computed values
  const pipelineTotal = quotes
    .filter(q => q.status !== 'DECLINED' && q.status !== 'EXPIRED')
    .reduce((acc, q) => acc + q.total, 0);

  const activeQuotes = quotes.filter(q => q.status !== 'DECLINED' && q.status !== 'EXPIRED');

  // Handlers
  const handleCreateQuote = (quoteData: Partial<Quote>) => {
    const newQuote = createQuote(
      'band-1',
      quoteData.eventId || `event-${Date.now()}`,
      quoteData.lineItems?.map(li => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
      })) || [],
      {
        discount: quoteData.discount,
        tax: quoteData.tax,
        notes: quoteData.notes,
        validUntil: quoteData.validUntil,
        eventTitle: quoteData.eventTitle,
        clientName: quoteData.clientName,
      }
    );

    // If status is SENT, update it
    if (quoteData.status === 'SENT') {
      newQuote.status = 'SENT';
    }

    setQuotes(prev => [newQuote, ...prev]);
    setIsCreating(false);
  };

  const handleSendQuote = (quote: Quote) => {
    setQuotes(prev => prev.map(q => 
      q.id === quote.id 
        ? { ...q, status: 'SENT' as QuoteStatus, updatedAt: new Date().toISOString() }
        : q
    ));
    setSelectedQuote(null);
  };

  const handleDuplicateQuote = (quote: Quote) => {
    const duplicated = duplicateQuote(quote);
    setQuotes(prev => [duplicated, ...prev]);
    setSelectedQuote(null);
  };

  const handleDeleteQuote = (quote: Quote) => {
    setQuotes(prev => prev.filter(q => q.id !== quote.id));
    setSelectedQuote(null);
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
      backgroundColor="#998878"
      onClose={onClose}
      origin={{ top: '40%', left: '3%', right: '58%', bottom: '42%' }}
    >
      {/* Header */}
      <motion.div 
        className="sticky top-0 z-50 p-6 flex items-center justify-between bg-[#998878]/95 backdrop-blur-md" 
        initial={{ opacity: 0, y: -20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.15, duration: 0.3 }}
      >
        <div className="flex items-center gap-4">
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }} 
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-[#1A1A1A] hover:bg-white/20 transition-colors backdrop-blur-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-black tracking-tight text-[#1A1A1A]">Quotes</h2>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="w-10 h-10 rounded-full bg-[#1A1A1A] flex items-center justify-center text-white shadow-lg hover:scale-105 transition-transform"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>
      </motion.div>
      
      <div 
        className="px-3 pb-32 max-w-md mx-auto w-full" 
        onClick={() => setActiveChartId(null)}
      >
        {/* Pipeline Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }} 
          transition={{ delay: 0.3 }} 
          className="mb-8 p-6 bg-[#1A1A1A] rounded-[2.5rem] relative overflow-hidden shadow-2xl" 
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[#998878] text-[10px] font-bold uppercase tracking-widest block mb-1">Pipeline Potential</span>
                <h3 className="text-4xl font-black text-[#E6E5E1] tracking-tighter">€{(pipelineTotal / 1000).toFixed(1)}k</h3>
              </div>
              <div className="bg-[#333336] p-2 rounded-full">
                <BarChart3 className="w-5 h-5 text-[#D4FB46]" />
              </div>
            </div>
            
            {/* Pipeline Chart */}
            <div className="h-28 flex items-end justify-between gap-1.5 px-1 pb-2 relative">
              {activeQuotes.slice(0, 7).map((quote, i) => { 
                const heightPct = Math.min(100, Math.max(20, (quote.total / 12000) * 100)); 
                const probability = getProbabilityFromStatus(quote.status);
                let barColor = "bg-[#333336]"; 
                if (probability > 40) barColor = "bg-[#998878]"; 
                if (probability > 70) barColor = "bg-[#D4FB46]"; 
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
            
            <div className="flex items-center justify-between text-[10px] font-bold text-[#555555] border-t border-white/10 pt-3">
              <span>Total Deals: {activeQuotes.length}</span>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#D4FB46]" />
                <span className="text-[#D4FB46]">Accepted</span>
              </div>
            </div>
          </div>
        </motion.div>
        
        {/* Quote List */}
        <div className="space-y-3">
          <h4 className="text-sm font-black text-[#1A1A1A] uppercase tracking-wider ml-2 opacity-60 mb-2">All Quotes</h4>
          {quotes.map((quote, i) => (
            <motion.div 
              key={quote.id} 
              onClick={() => setSelectedQuote(quote)}
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              transition={{ delay: 0.4 + (i * 0.05) }} 
              className={cn(
                "p-5 rounded-[2rem] shadow-sm relative overflow-hidden group transition-all cursor-pointer",
                quote.status === 'ACCEPTED' ? "bg-[#D4FB46]" : "bg-[#E6E5E1]"
              )}
            >
              <div className="flex justify-between items-start mb-1 relative z-10">
                <div>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest block mb-0.5", 
                    quote.status === 'ACCEPTED' ? "text-black/60" : "text-[#998878]"
                  )}>
                    {quote.clientName}
                  </span>
                  <h4 className="text-lg font-black text-[#1A1A1A] leading-tight">{quote.eventTitle}</h4>
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
                  <div className="flex justify-between text-[10px] font-bold uppercase text-[#1A1A1A]/50">
                    <span>{(quote.customItems?.length || 0)} items</span>
                    <span>{new Date(quote.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <span className="text-2xl font-black text-[#1A1A1A]">€{quote.total.toLocaleString()}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Quote Creation Wizard */}
      <AnimatePresence>
        {isCreating && (
          <QuoteCreationWizard
            onClose={() => {
              setIsCreating(false);
              setEditingQuote(null);
            }}
            onCreate={handleCreateQuote}
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
    </ExpandedCardWrapper>
  );
};
