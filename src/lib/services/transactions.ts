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
