import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Briefcase,
  Loader2,
  BarChart3,
  Receipt,
  Plus,
  X,
  Check,
  Calendar
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { ExpandedCardWrapper } from './ExpandedCardWrapper';
import { createTransaction } from '@/lib/services/transactions';
import type { Transaction } from '@/lib/services/transactions';

interface FinanceExpandedProps {
  bandId: string;
  onClose: () => void;
  financialStats?: {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
  } | null;
  transactions?: Transaction[];
  loading?: boolean;
  onTransactionAdded?: () => void;
}

export const FinanceExpanded: React.FC<FinanceExpandedProps> = ({
  bandId,
  onClose,
  financialStats,
  transactions: realTransactions,
  loading,
  onTransactionAdded
}) => {
  // Add transaction modal state
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [txType, setTxType] = useState<'income' | 'expense'>('income');
  const [txTitle, setTxTitle] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState('GIG');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const categories = {
    income: ['GIG', 'REHEARSAL', 'MERCHANDISE', 'ROYALTIES', 'OTHER'],
    expense: ['EQUIPMENT', 'TRAVEL', 'STUDIO', 'MARKETING', 'FEES', 'OTHER']
  };

  const handleAddTransaction = async () => {
    if (!txTitle.trim() || !txAmount) return;
    setSaving(true);
    
    const { error } = await createTransaction({
      band_id: bandId,
      title: txTitle.trim(),
      amount: parseFloat(txAmount),
      type: txType,
      category: txCategory,
      date: txDate,
      status: 'completed'
    });
    
    if (!error) {
      setShowAddTransaction(false);
      setTxTitle('');
      setTxAmount('');
      setTxCategory('GIG');
      onTransactionAdded?.();
    }
    setSaving(false);
  };

  // Use real data only - no mock fallback
  const stats = financialStats || { totalIncome: 0, totalExpenses: 0, netProfit: 0 };
  const hasData = stats.totalIncome > 0 || stats.totalExpenses > 0;
  
  // Only use real transactions, no mock
  const displayTransactions = realTransactions && realTransactions.length > 0 
    ? realTransactions.map(t => ({
        id: parseInt(t.id.replace(/-/g, '').slice(0, 8), 16) || Date.now(),
        title: t.title,
        date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        amount: t.type === 'income' ? `+€${Number(t.amount).toFixed(2)}` : `-€${Math.abs(Number(t.amount)).toFixed(2)}`,
        type: t.type as 'income' | 'expense',
        tag: t.category || 'OTHER'
      }))
    : [];

  const formatValue = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return value.toFixed(0);
  };
  return (
    <ExpandedCardWrapper
      backgroundColor="#050505"
      onClose={onClose}
      origin={{ top: '12%', left: '3%', right: '42%', bottom: '62%' }}
    >
      <motion.div 
        className="sticky top-0 z-50 p-6 flex items-center justify-between bg-[#050505]/95 backdrop-blur-md"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
      >
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }} 
          className="w-10 h-10 rounded-full bg-[#1C1C1E] flex items-center justify-center text-white border border-white/10 hover:bg-[#333336] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-bold tracking-[0.2em] text-stone-500 uppercase">Financial Overview</span>
        <button 
          onClick={() => setShowAddTransaction(true)}
          className="w-10 h-10 rounded-full bg-[#D4FB46] flex items-center justify-center text-black hover:scale-105 transition-transform"
        >
          <Plus className="w-5 h-5" />
        </button>
      </motion.div>
      
      <div className="px-3 pb-32">
        <div className="mb-6 relative pt-2 px-3">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.3 }} 
            className="w-full bg-[#1C1C1E] rounded-[2rem] p-6 relative overflow-hidden border border-white/5"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="flex flex-col">
                <span className="text-stone-500 text-[10px] font-bold uppercase tracking-widest mb-1">Net Profit</span>
                <div className="flex items-baseline gap-2">
                  {loading ? (
                    <Loader2 className="w-8 h-8 animate-spin text-[#D4FB46]" />
                  ) : (
                    <h2 className="text-4xl font-black text-[#D4FB46] tracking-tighter">€{formatValue(stats.netProfit)}</h2>
                  )}
                </div>
              </div>
              <div className="w-10 h-10 bg-[#D4FB46] rounded-full flex items-center justify-center text-black shadow-[0_0_15px_rgba(212,251,70,0.4)]">
                <Briefcase className="w-5 h-5 stroke-[2.5]" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
              <div>
                <span className="text-stone-500 text-[10px] font-bold uppercase block mb-0.5">Total Revenue</span>
                <span className="text-white text-lg font-bold">€{formatValue(stats.totalIncome)}</span>
              </div>
              <div className="border-l border-white/10 pl-4">
                <span className="text-stone-500 text-[10px] font-bold uppercase block mb-0.5">Expenses</span>
                <span className="text-white text-lg font-bold">-€{formatValue(stats.totalExpenses)}</span>
              </div>
            </div>
          </motion.div>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 40 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.25, type: "tween", duration: 0.3, ease: "easeOut" }} 
          className="w-full h-56 bg-[#101010] rounded-[2rem] border border-white/5 relative overflow-hidden mb-6 p-6 flex flex-col"
        >
          <div className="flex justify-between items-center mb-4 z-10">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-widest">Cash Flow</span>
            <div className="flex gap-2">
              <button className="w-6 h-6 rounded-full bg-[#1C1C1E] text-stone-500 flex items-center justify-center text-[10px] font-bold border border-white/5">M</button>
              <button className="w-6 h-6 rounded-full bg-[#D4FB46] text-black flex items-center justify-center text-[10px] font-bold">Y</button>
            </div>
          </div>
          {hasData ? (
            <div className="flex-1 flex items-end justify-between gap-2 relative z-10">
              {/* Show bars based on real data when available */}
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((_, i) => (
                <motion.div 
                  key={i} 
                  initial={{ height: "4px" }} 
                  animate={{ height: "4px" }} 
                  transition={{ delay: 0.3 + (i * 0.03), type: "tween", duration: 0.35, ease: "easeOut" }} 
                  className="w-full rounded-full relative group bg-[#1C1C1E]"
                />
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <BarChart3 className="w-10 h-10 text-stone-600 mb-3" />
              <p className="text-stone-500 text-sm font-medium">No data yet</p>
              <p className="text-stone-600 text-xs">Add transactions to see your cash flow</p>
            </div>
          )}
        </motion.div>
        
        <div className="flex flex-col gap-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ delay: 0.7 }} 
            className="flex items-center justify-between px-1"
          >
            <h3 className="text-xl font-black text-white tracking-tight">Recent Activity</h3>
            {displayTransactions.length > 0 && <Search className="w-5 h-5 text-stone-500" />}
          </motion.div>
          
          {displayTransactions.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: 0.4 }} 
              className="bg-[#101010] border border-white/5 p-8 rounded-[1.5rem] flex flex-col items-center justify-center text-center"
            >
              <Receipt className="w-12 h-12 text-stone-600 mb-3" />
              <p className="text-stone-400 font-medium mb-1">No transactions yet</p>
              <p className="text-stone-600 text-sm">Your income and expenses will appear here</p>
            </motion.div>
          ) : (
            displayTransactions.map((tx, i) => (
              <motion.div 
                key={tx.id} 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: 0.4 + (i * 0.03), type: "tween", duration: 0.25, ease: "easeOut" }} 
                className="bg-[#101010] border border-white/10 p-4 rounded-[1.5rem] relative group overflow-hidden hover:border-[#D4FB46]/50 transition-colors"
              >
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-transform group-hover:scale-110", 
                      tx.type === 'income' ? "bg-[#1C1C1E] text-[#D4FB46]" : "bg-[#1C1C1E] text-white"
                    )}>
                      {tx.type === 'income' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-bold bg-[#1C1C1E] px-1.5 py-0.5 rounded text-stone-400 border border-white/5">{tx.tag}</span>
                        <span className="text-[10px] font-bold text-stone-600 uppercase">{tx.date}</span>
                      </div>
                      <h4 className="font-bold text-white text-sm tracking-wide">{tx.title}</h4>
                    </div>
                  </div>
                  <span className={cn(
                    "text-lg font-black tracking-tight", 
                    tx.type === 'income' ? "text-[#D4FB46]" : "text-white"
                  )}>
                    {tx.amount}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {showAddTransaction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowAddTransaction(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="w-full max-w-md bg-[#1C1C1E] rounded-t-[2rem] p-6"
              onClick={e => e.stopPropagation()}
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
            >
              <div className="w-12 h-1 bg-stone-600 rounded-full mx-auto mb-6" />
              
              <h2 className="text-2xl font-black text-white mb-6">Add Transaction</h2>

              {/* Type Toggle */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => { setTxType('income'); setTxCategory('GIG'); }}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all",
                    txType === 'income'
                      ? "bg-[#D4FB46] text-black"
                      : "bg-white/5 text-stone-400 hover:bg-white/10"
                  )}
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  Income
                </button>
                <button
                  onClick={() => { setTxType('expense'); setTxCategory('EQUIPMENT'); }}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all",
                    txType === 'expense'
                      ? "bg-white text-black"
                      : "bg-white/5 text-stone-400 hover:bg-white/10"
                  )}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  Expense
                </button>
              </div>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="text-[10px] font-bold text-stone-500 uppercase block mb-2">Description</label>
                  <input
                    type="text"
                    value={txTitle}
                    onChange={(e) => setTxTitle(e.target.value)}
                    placeholder="e.g., Jazz Night @ Blue Note"
                    className="w-full h-12 px-4 rounded-xl bg-white/5 text-white font-medium placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-[#D4FB46]"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="text-[10px] font-bold text-stone-500 uppercase block mb-2">Amount (€)</label>
                  <input
                    type="number"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-12 px-4 rounded-xl bg-white/5 text-white font-bold text-xl placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-[#D4FB46]"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="text-[10px] font-bold text-stone-500 uppercase block mb-2">Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      className="w-full h-12 px-4 rounded-xl bg-white/5 text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#D4FB46]"
                    />
                    <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-500 pointer-events-none" />
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="text-[10px] font-bold text-stone-500 uppercase block mb-2">Category</label>
                  <div className="flex flex-wrap gap-2">
                    {categories[txType].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setTxCategory(cat)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-bold uppercase transition-all",
                          txCategory === cat
                            ? "bg-[#D4FB46] text-black"
                            : "bg-white/5 text-stone-400 hover:bg-white/10"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit */}
                <button
                  onClick={handleAddTransaction}
                  disabled={!txTitle.trim() || !txAmount || saving}
                  className={cn(
                    "w-full h-14 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all mt-4",
                    txTitle.trim() && txAmount
                      ? "bg-[#D4FB46] text-black hover:scale-[1.02] active:scale-[0.98]"
                      : "bg-white/10 text-stone-600 cursor-not-allowed"
                  )}
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Add {txType === 'income' ? 'Income' : 'Expense'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ExpandedCardWrapper>
  );
};
