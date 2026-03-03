import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  Receipt,
  Plus,
  Check,
  Calendar,
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

const FinanceDotGrid: React.FC<{ filled: number; color: string }> = ({ filled, color }) => {
  const total = 24;
  const count = Math.min(filled, total);
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    setVisible(0);
    if (count === 0) return;
    let c = 0;
    const iv = setInterval(() => {
      c++;
      setVisible(c);
      if (c >= count) clearInterval(iv);
    }, 40);
    return () => clearInterval(iv);
  }, [count]);

  return (
    <div className="grid grid-cols-6 grid-rows-4 gap-1 w-full h-[72px]">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-[10px]"
          style={{
            backgroundColor: i < count && i < visible ? color : '#CDCACA',
            transition: 'background-color 0.15s',
          }}
        />
      ))}
    </div>
  );
};

export const FinanceExpanded: React.FC<FinanceExpandedProps> = ({
  bandId,
  onClose,
  financialStats,
  transactions: realTransactions,
  loading,
  onTransactionAdded,
}) => {
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [txType, setTxType] = useState<'income' | 'expense'>('income');
  const [txTitle, setTxTitle] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState('GIG');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const categories = {
    income: ['GIG', 'REHEARSAL', 'MERCHANDISE', 'ROYALTIES', 'OTHER'],
    expense: ['EQUIPMENT', 'TRAVEL', 'STUDIO', 'MARKETING', 'FEES', 'OTHER'],
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
      status: 'completed',
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

  const stats = financialStats || { totalIncome: 0, totalExpenses: 0, netProfit: 0 };

  const displayTransactions =
    realTransactions && realTransactions.length > 0
      ? realTransactions.map((t) => ({
          id:
            parseInt(t.id.replace(/-/g, '').slice(0, 8), 16) || Date.now(),
          title: t.title,
          date: new Date(t.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          amount:
            t.type === 'income'
              ? `+€${Number(t.amount).toFixed(2)}`
              : `-€${Math.abs(Number(t.amount)).toFixed(2)}`,
          type: t.type as 'income' | 'expense',
          tag: t.category || 'OTHER',
        }))
      : [];

  const fmt = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0));

  return (
    <ExpandedCardWrapper
      backgroundColor="#E6E5E1"
      onClose={onClose}
      origin={{ top: '12%', left: '3%', right: '42%', bottom: '62%' }}
    >
      {/* Header */}
      <motion.div
        className="sticky top-0 z-50 px-4 py-4 flex items-center gap-4 bg-[#E6E5E1]/95 backdrop-blur-md"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="w-[50px] h-[50px] rounded-full flex items-center justify-center border-2 border-black shrink-0 active:scale-90 transition-transform"
          style={{ backgroundColor: 'rgba(216,216,216,0.2)' }}
        >
          <ArrowLeft className="w-[24px] h-[24px] text-black" />
        </button>
        <div className="flex flex-col leading-none flex-1">
          <span className="text-[32px] font-bold text-black leading-none">MONEY</span>
          <span className="text-[32px] font-bold text-black leading-none">FLOW</span>
        </div>
        <button
          onClick={() => setShowAddTransaction(true)}
          className="w-[50px] h-[50px] rounded-full flex items-center justify-center bg-[#D5FB46] shrink-0 active:scale-90 transition-transform"
        >
          <Plus className="w-[20px] h-[20px] text-black" />
        </button>
      </motion.div>

      {/* Content */}
      <div className="px-4 pb-32">
        <div className="flex flex-col gap-10">
          {/* Stats Grid */}
          <div className="flex flex-col gap-10">
            <div className="flex gap-5">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex-1 flex flex-col gap-2 items-start text-left"
              >
                <span className="text-xs font-bold text-black tracking-wide">NET PROFIT</span>
                <div className="h-[62px] overflow-hidden">
                  {loading ? (
                    <Loader2 className="w-8 h-8 animate-spin text-black/30 mt-4" />
                  ) : (
                    <span className="text-[52px] font-bold leading-none text-black block">
                      €{fmt(stats.netProfit)}
                    </span>
                  )}
                </div>
                <FinanceDotGrid
                  filled={Math.min(Math.ceil(stats.netProfit / 500), 24)}
                  color="#D5FB46"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="flex-1 flex flex-col gap-2 items-start text-left"
              >
                <span className="text-xs font-bold text-black tracking-wide">REVENUE</span>
                <div className="h-[62px] overflow-hidden">
                  {loading ? (
                    <Loader2 className="w-8 h-8 animate-spin text-black/30 mt-4" />
                  ) : (
                    <span className="text-[52px] font-bold leading-none text-black block">
                      €{fmt(stats.totalIncome)}
                    </span>
                  )}
                </div>
                <FinanceDotGrid
                  filled={Math.min(Math.ceil(stats.totalIncome / 500), 24)}
                  color="#0147FF"
                />
              </motion.div>
            </div>

            <div className="flex gap-5">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex-1 flex flex-col gap-2 items-start text-left"
              >
                <span className="text-xs font-bold text-black tracking-wide">EXPENSES</span>
                <div className="h-[62px] overflow-hidden">
                  {loading ? (
                    <Loader2 className="w-8 h-8 animate-spin text-black/30 mt-4" />
                  ) : (
                    <span className="text-[52px] font-bold leading-none text-black block">
                      -€{fmt(stats.totalExpenses)}
                    </span>
                  )}
                </div>
                <FinanceDotGrid
                  filled={Math.min(Math.ceil(stats.totalExpenses / 500), 24)}
                  color="#9A8878"
                />
              </motion.div>
              <div className="flex-1" />
            </div>
          </div>

          {/* Recent Activity */}
          <div className="flex flex-col gap-5">
            <div className="flex flex-col">
              <span className="text-[32px] font-bold leading-none text-black">RECENT</span>
              <span className="text-[32px] font-bold leading-none text-black">ACTIVITY</span>
            </div>

            {displayTransactions.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex flex-col items-center py-10"
              >
                <Receipt className="w-12 h-12 text-black/15 mb-3" />
                <span className="text-xs font-bold text-black/40 uppercase tracking-wide mb-1">
                  No transactions yet
                </span>
                <span className="text-[10px] font-medium text-black/30 uppercase">
                  Your income and expenses will appear here
                </span>
              </motion.div>
            ) : (
              <div className="flex flex-col gap-0">
                {displayTransactions.map((tx, i) => (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.03 }}
                    className="flex items-center justify-between py-4 border-b border-black/10 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0',
                          tx.type === 'income' ? 'bg-[#D5FB46]' : 'bg-[#CDCACA]',
                        )}
                      >
                        {tx.type === 'income' ? (
                          <ArrowDownLeft className="w-5 h-5 text-black" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5 text-black" />
                        )}
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="text-xs font-bold text-black uppercase tracking-wide">
                          {tx.title}
                        </span>
                        <span className="text-[10px] font-medium text-black/40 uppercase">
                          {tx.tag} · {tx.date}
                        </span>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'text-xs font-bold',
                        tx.type === 'income' ? 'text-black' : 'text-black/50',
                      )}
                    >
                      {tx.amount}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {showAddTransaction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowAddTransaction(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="w-full max-w-md bg-[#E6E5E1] rounded-t-[20px] p-6"
              onClick={(e) => e.stopPropagation()}
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
            >
              <div className="w-12 h-1 bg-black/20 rounded-full mx-auto mb-6" />

              <span className="text-[32px] font-bold text-black leading-none block mb-6">
                ADD TRANSACTION
              </span>

              {/* Type Toggle */}
              <div className="flex gap-0 mb-6 border-b border-black/10">
                <button
                  onClick={() => {
                    setTxType('income');
                    setTxCategory('GIG');
                  }}
                  className={cn(
                    'flex-1 py-3 flex items-center justify-center gap-2 transition-all border-b-2',
                    txType === 'income'
                      ? 'border-black'
                      : 'border-transparent text-black/40',
                  )}
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wide">Income</span>
                </button>
                <button
                  onClick={() => {
                    setTxType('expense');
                    setTxCategory('EQUIPMENT');
                  }}
                  className={cn(
                    'flex-1 py-3 flex items-center justify-center gap-2 transition-all border-b-2',
                    txType === 'expense'
                      ? 'border-black'
                      : 'border-transparent text-black/40',
                  )}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wide">Expense</span>
                </button>
              </div>

              <div className="flex flex-col gap-5">
                {/* Title */}
                <div>
                  <label className="text-[10px] font-bold text-black/40 uppercase block mb-2 tracking-wide">
                    Description
                  </label>
                  <input
                    type="text"
                    value={txTitle}
                    onChange={(e) => setTxTitle(e.target.value)}
                    placeholder="e.g., Jazz Night @ Blue Note"
                    className="w-full bg-transparent border-b-2 border-black/10 py-3 text-sm font-bold text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-colors"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="text-[10px] font-bold text-black/40 uppercase block mb-2 tracking-wide">
                    Amount (€)
                  </label>
                  <input
                    type="number"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-transparent border-b-2 border-black/10 py-3 text-xl font-bold text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-colors"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="text-[10px] font-bold text-black/40 uppercase block mb-2 tracking-wide">
                    Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      className="w-full bg-transparent border-b-2 border-black/10 py-3 text-sm font-bold text-black focus:outline-none focus:border-black transition-colors"
                    />
                    <Calendar className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40 pointer-events-none" />
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="text-[10px] font-bold text-black/40 uppercase block mb-2 tracking-wide">
                    Category
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {categories[txType].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setTxCategory(cat)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all',
                          txCategory === cat
                            ? 'bg-black text-white'
                            : 'bg-black/5 text-black/40 active:bg-black/10',
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
                    'w-full h-14 rounded-[10px] font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-2 transition-all mt-2',
                    txTitle.trim() && txAmount
                      ? 'bg-black text-white active:scale-[0.98]'
                      : 'bg-black/10 text-black/30 cursor-not-allowed',
                  )}
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      ADD {txType === 'income' ? 'INCOME' : 'EXPENSE'}
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
