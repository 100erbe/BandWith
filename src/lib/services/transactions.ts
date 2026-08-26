import { supabase } from '../supabase';

// Types
export type TransactionType = 'income' | 'expense';
export type TransactionCategory = 'GIG' | 'ROYALTY' | 'GEAR' | 'RENT' | 'TRAVEL' | 'OTHER';

export interface Transaction {
  id: string;
  band_id: string;
  title: string;
  description?: string;
  amount: number;
  type: TransactionType;
  category?: TransactionCategory;
  event_id?: string;
  quote_id?: string;
  date: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// TRANSACTIONS CRUD
// ============================================

export const getTransactions = async (
  bandId: string,
  options?: {
    type?: TransactionType;
    category?: TransactionCategory;
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }
): Promise<{ data: Transaction[] | null; error: Error | null }> => {
  try {
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('band_id', bandId)
      .order('date', { ascending: false });

    if (options?.type) {
      query = query.eq('type', options.type);
    }

    if (options?.category) {
      query = query.eq('category', options.category);
    }

    if (options?.fromDate) {
      query = query.gte('date', options.fromDate);
    }

    if (options?.toDate) {
      query = query.lte('date', options.toDate);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const createTransaction = async (
  transactionData: Partial<Transaction>
): Promise<{ data: Transaction | null; error: Error | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        ...transactionData,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const updateTransaction = async (
  transactionId: string,
  updates: Partial<Transaction>
): Promise<{ data: Transaction | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', transactionId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

export const deleteTransaction = async (transactionId: string): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId);

    if (error) throw error;

    return { error: null };
  } catch (error: any) {
    return { error };
  }
};

// ============================================
// STATISTICS
// ============================================

export const getFinancialStats = async (
  bandId: string,
  year?: number,
  month?: number
): Promise<{
  data: {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    transactionCount: number;
    monthlyData?: { month: string; income: number; expense: number }[];
  } | null;
  error: Error | null;
}> => {
  try {
    const currentYear = year || new Date().getFullYear();
    const startDate = month 
      ? `${currentYear}-${String(month).padStart(2, '0')}-01`
      : `${currentYear}-01-01`;
    const endDate = month
      ? `${currentYear}-${String(month).padStart(2, '0')}-31`
      : `${currentYear}-12-31`;

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('amount, type, date')
      .eq('band_id', bandId)
      .gte('date', startDate)
      .lte('date', endDate);

    if (error) throw error;

    const stats = {
      totalIncome: transactions
        ?.filter(t => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0,
      totalExpenses: transactions
        ?.filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0,
      netProfit: 0,
      transactionCount: transactions?.length || 0,
    };

    stats.netProfit = stats.totalIncome - stats.totalExpenses;

    return { data: stats, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
};

// ============================================
// BAND FINANCIAL SUMMARY (admin)
// ============================================

export interface BandFinancialSummary {
  income: {
    gigIncome: number;
    otherIncome: number;
    total: number;
    gigs: { eventId: string; title: string; event_date: string; fee: number }[];
  };
  expenses: {
    musicianPayouts: number;
    otherExpenses: number;
    total: number;
    payouts: { eventId: string; title: string; event_date: string; memberName: string; fee: number }[];
  };
  net: number;
  recentTransactions: Transaction[];
}

export const getBandFinancialSummary = async (
  bandId: string,
  options?: { limit?: number }
): Promise<{ data: BandFinancialSummary | null; error: Error | null }> => {
  try {
    const limit = options?.limit || 10;

    // 1) Confirmed/completed gigs = income
    const { data: gigs, error: gigsError } = await supabase
      .from('events')
      .select('id, title, event_date, fee')
      .eq('band_id', bandId)
      .in('status', ['confirmed', 'completed'])
      .neq('event_type', 'rehearsal')
      .order('event_date', { ascending: false });

    if (gigsError) throw gigsError;

    const confirmedGigs = gigs || [];
    const gigIncome = confirmedGigs.reduce((s, g) => s + Number(g.fee || 0), 0);
    const gigIds = confirmedGigs.map((g) => g.id);

    // 2) Confirmed members' payouts on those gigs = expense
    let payouts: BandFinancialSummary['expenses']['payouts'] = [];
    let musicianPayouts = 0;
    if (gigIds.length > 0) {
      const { data: memberRows, error: membersError } = await supabase
        .from('event_members')
        .select('event_id, user_id, fee, profiles:user_id ( full_name )')
        .in('event_id', gigIds)
        .eq('status', 'confirmed');

      if (membersError) throw membersError;

      const gigById = new Map(confirmedGigs.map((g) => [g.id, g]));
      payouts = (memberRows || []).map((m: any) => {
        const gig = gigById.get(m.event_id);
        return {
          eventId: m.event_id,
          title: gig?.title || 'Gig',
          event_date: gig?.event_date || '',
          memberName: m.profiles?.full_name || 'Musician',
          fee: Number(m.fee || 0),
        };
      });
      musicianPayouts = payouts.reduce((s, p) => s + p.fee, 0);
    }

    // 3) Manual transactions (income + expenses)
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('band_id', bandId)
      .order('date', { ascending: false });

    if (txError) throw txError;

    const txs = transactions || [];
    const otherIncome = txs.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const otherExpenses = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

    const income = {
      gigIncome,
      otherIncome,
      total: gigIncome + otherIncome,
      gigs: confirmedGigs.map((g) => ({
        eventId: g.id,
        title: g.title || 'Gig',
        event_date: g.event_date,
        fee: Number(g.fee || 0),
      })),
    };

    const expenses = {
      musicianPayouts,
      otherExpenses,
      total: musicianPayouts + otherExpenses,
      payouts,
    };

    return {
      data: {
        income,
        expenses,
        net: income.total - expenses.total,
        recentTransactions: txs.slice(0, limit),
      },
      error: null,
    };
  } catch (error: any) {
    return { data: null, error };
  }
};
