import React, { useState } from 'react';
import { uuidToNumericId } from '@/lib/numericId';
import { motion } from 'motion/react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Check,
  Calendar,
} from '@/app/components/icons';
import { BwSheet, Card, IconButton, ListRow } from '@/app/components/bw/Screen';
import { PillButton, PillField, Selector, SectionHeader, Metric } from '@/app/components/bw';
import { ExpandedCardWrapper, ExpandedTopBar } from './ExpandedCardWrapper';
import { createTransaction } from '@/lib/services/transactions';
import type { Transaction } from '@/lib/services/transactions';
import { todayLocal } from '../../../../lib/dates';
import { parseLocalDate } from '@/lib/dates';
import { getActiveSymbol as sym, useCurrency } from '@/lib/currency';

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
  onTransactionAdded,
}) => {
  useCurrency(); // re-render money labels when the band currency changes
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [txType, setTxType] = useState<'income' | 'expense'>('income');
  const [txTitle, setTxTitle] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState<string>('GIG');
  const [txError, setTxError] = useState<string | null>(null);
  const [txDate, setTxDate] = useState(todayLocal());
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
      amount: parseFloat(String(txAmount).replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')),
      type: txType,
      category: txCategory as any,
      date: txDate,

    });

    if (error) {
      setTxError(error.message || 'Could not save the transaction');
    } else {
      setTxError(null);
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
            uuidToNumericId(t.id),
          title: t.title,
          date: parseLocalDate(t.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          amount:
            t.type === 'income'
              ? `+${sym()}${Number(t.amount).toFixed(2)}`
              : `-${sym()}${Math.abs(Number(t.amount)).toFixed(2)}`,
          type: t.type as 'income' | 'expense',
          tag: t.category || 'OTHER',
        }))
      : [];

  const fmt = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0));

  const income = Math.max(0, stats.totalIncome);
  const expenses = Math.abs(stats.totalExpenses);

  return (
    <ExpandedCardWrapper
      backgroundColor="var(--bg)"
      onClose={onClose}
      origin={{ top: '12%', left: '3%', right: '42%', bottom: '62%' }}
    >
      <ExpandedTopBar
        title="Money flow"
        onBack={onClose}
        actions={
          <IconButton label="Add transaction" variant="filled" icon={<Plus />} onClick={() => setShowAddTransaction(true)} />
        }
      />

      <div
        className="flex-1 flex flex-col gap-8 px-4 pt-2 max-w-[700px] w-full mx-auto bg-background text-foreground"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 40px)' }}
      >
        {/* Metrics (Figma Metric: label, dot value, 4×12 meter) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-8 gap-y-8"
        >
          <Metric
            label="Net profit"
            value={loading ? '-' : `${sym()}${fmt(stats.netProfit)}`}
            fill={income > 0 ? Math.max(0, stats.netProfit) / income : 0}
          />
          <Metric
            label="Revenue"
            value={loading ? '-' : `${sym()}${fmt(stats.totalIncome)}`}
            fill={income + expenses > 0 ? income / (income + expenses) : 0}
          />
          <Metric
            label="Expenses"
            value={loading ? '-' : `-${sym()}${fmt(expenses)}`}
            fill={income + expenses > 0 ? expenses / (income + expenses) : 0}
          />
        </motion.div>

        {/* Recent activity */}
        <section className="flex flex-col gap-4">
          <SectionHeader title="Recent activity" />
          {displayTransactions.length === 0 ? (
            <Card className="items-center text-center py-8 gap-1">
              <h3 className="bw-h3">No transactions yet</h3>
              <p className="bw-body-sm text-muted-foreground">Your income and expenses will appear here.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {displayTransactions.map((tx, i) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.03 }}
                >
                  <ListRow
                    icon={tx.type === 'income' ? <ArrowDownLeft /> : <ArrowUpRight />}
                    title={tx.title}
                    subtitle={`${tx.tag} · ${tx.date}`}
                    trailing={
                      <span className={tx.type === 'income' ? 'bw-label-md shrink-0' : 'bw-label-md shrink-0 text-muted-foreground'}>
                        {tx.amount}
                      </span>
                    }
                  />
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Add transaction (Figma Sheet, Style=Dark) */}
      <BwSheet
        open={showAddTransaction}
        onClose={() => setShowAddTransaction(false)}
        overline="Money flow"
        title="Add transaction"
        zIndex={180}
        footer={
          <PillButton
            onClick={handleAddTransaction}
            loading={saving}
            disabled={!txTitle.trim() || !txAmount}
            icon={<Check className="w-[18px] h-[18px]" />}
          >
            Add {txType === 'income' ? 'income' : 'expense'}
          </PillButton>
        }
      >
        <div className="dark flex flex-col gap-6 text-foreground">
          {txError && (
            <p role="alert" className="bw-body-sm text-destructive">{txError}</p>
          )}
          {/* Type */}
          <div className="flex gap-2" role="group" aria-label="Transaction type">
            <Selector
              size="md"
              selected={txType === 'income'}
              onClick={() => {
                setTxType('income');
                setTxCategory('GIG');
              }}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" /> Income
            </Selector>
            <Selector
              size="md"
              selected={txType === 'expense'}
              onClick={() => {
                setTxType('expense');
                setTxCategory('EQUIPMENT');
              }}
            >
              <ArrowUpRight className="w-3.5 h-3.5" /> Expense
            </Selector>
          </div>

          <PillField
            label="Description"
            value={txTitle}
            onChange={(e) => setTxTitle(e.target.value)}
            placeholder="e.g., Jazz Night @ Blue Note"
          />
          <PillField
            label={`Amount (${sym()})`}
            type="number"
            inputMode="decimal"
            value={txAmount}
            onChange={(e) => setTxAmount(e.target.value)}
            placeholder="0.00"
          />
          <PillField
            label="Date"
            type="date"
            value={txDate}
            onChange={(e) => setTxDate(e.target.value)}
            icon={<Calendar className="w-5 h-5" />}
          />

          <fieldset className="flex flex-col gap-2">
            <legend className="bw-label-sm text-muted-foreground mb-2">Category</legend>
            <div className="flex flex-wrap gap-2">
              {categories[txType].map((cat) => (
                <Selector key={cat} selected={txCategory === cat} onClick={() => setTxCategory(cat)}>
                  {cat}
                </Selector>
              ))}
            </div>
          </fieldset>
        </div>
      </BwSheet>
    </ExpandedCardWrapper>
  );
};
