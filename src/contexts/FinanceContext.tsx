import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Transaction, Budget, SavingsVault, CustomCategories, FinanceState, VaultTransaction } from '@/types/finance';
import { supabase } from '@/lib/supabase';

const defaultState: FinanceState = {
  transactions: [],
  budgets: [],
  cashBalance: 0,
  vault: { balance: 0, pin: null, history: [] },
  customCategories: { income: [], expense: [] },
  theme: 'dark',
};

interface AuthState {
  userId: string | null;
  email: string | null;
  loading: boolean;
}

interface FinanceContextType {
  state: FinanceState;
  auth: AuthState;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  addTransaction: (tx: Omit<Transaction, 'id'>) => Promise<void>;
  updateTransaction: (tx: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  toggleNeglect: (id: string) => Promise<void>;
  addBudget: (budget: Budget) => Promise<void>;
  removeBudget: (category: string) => Promise<void>;
  updateCashBalance: (amount: number) => void;
  depositToVault: (amount: number) => void;
  withdrawFromVault: (amount: number) => void;
  setVaultPin: (pin: string | null) => void;
  addCustomCategory: (type: 'income' | 'expense', category: string) => void;
  removeCustomCategory: (type: 'income' | 'expense', category: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'gradient') => void;
  resetAllData: () => Promise<void>;
  exportData: () => string;
  importData: (json: string) => Promise<boolean>;
}

const FinanceContext = createContext<FinanceContextType | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FinanceState>(defaultState);
  const [auth, setAuth] = useState<AuthState>({ userId: null, email: null, loading: true });

  // ─── Auth listener ──────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuth({
        userId: session?.user?.id ?? null,
        email: session?.user?.email ?? null,
        loading: false,
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth({
        userId: session?.user?.id ?? null,
        email: session?.user?.email ?? null,
        loading: false,
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  // ─── Load all cloud data when user logs in ──────────────────────────────
  useEffect(() => {
    if (!auth.userId) {
      setState(defaultState);
      return;
    }
    fetchAllData(auth.userId);
  }, [auth.userId]);

  async function fetchAllData(userId: string) {
    const [
      { data: transactions },
      { data: budgets },
      { data: settings }
    ] = await Promise.all([
      supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }),
      supabase.from('budgets').select('*').eq('user_id', userId),
      supabase.from('user_settings').select('*').eq('user_id', userId).single(),
    ]);

    setState({
      transactions: (transactions ?? []).map(mapTransaction),
      budgets: (budgets ?? []).map(mapBudget),
      cashBalance: settings?.cash_balance ?? 0,
      vault: {
        balance: settings?.vault_balance ?? 0,
        pin: settings?.vault_pin ?? null,
        history: settings?.vault_history ?? [],
      },
      customCategories: settings?.custom_categories ?? { income: [], expense: [] },
      theme: settings?.theme ?? 'dark',
    });
  }

  function mapTransaction(row: any): Transaction {
    return {
      id: row.id,
      amount: row.amount,
      type: row.type,
      category: row.category,
      shortDescription: row.short_description ?? '',
      detailedDescription: row.detailed_description ?? '',
      paymentMethod: row.payment_method ?? 'bank',
      date: row.date,
      neglected: row.neglected ?? false,
    };
  }

  function mapBudget(row: any): Budget {
    return {
      category: row.category,
      limit: row.limit_amount,
    };
  }

  async function saveSettings(userId: string, updates: Partial<{
    cash_balance: number;
    vault_balance: number;
    vault_pin: string | null;
    vault_history: VaultTransaction[];
    custom_categories: CustomCategories;
    theme: string;
  }>) {
    await supabase.from('user_settings').upsert({
      user_id: userId,
      ...updates,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  }

  // ─── Theme effect ───────────────────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'theme-gradient');
    if (state.theme === 'dark') root.classList.add('dark');
    else if (state.theme === 'gradient') root.classList.add('dark', 'theme-gradient');
  }, [state.theme]);

  // ─── Auth methods ───────────────────────────────────────────────────────
  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState(defaultState);
  }, []);

  // ─── Vault methods (defined first so deleteTransaction can use them) ────
  const depositToVault = useCallback((amount: number) => {
    setState(prev => {
      const vaultTx: VaultTransaction = {
        id: crypto.randomUUID(),
        amount,
        date: new Date().toISOString(),
        type: 'deposit',
      };
      const newVault = {
        ...prev.vault,
        balance: prev.vault.balance + amount,
        history: [vaultTx, ...prev.vault.history],
      };
      if (auth.userId) saveSettings(auth.userId, {
        vault_balance: newVault.balance,
        vault_history: newVault.history,
      });
      return { ...prev, vault: newVault };
    });
  }, [auth.userId]);

  const withdrawFromVault = useCallback((amount: number) => {
    setState(prev => {
      const vaultTx: VaultTransaction = {
        id: crypto.randomUUID(),
        amount,
        date: new Date().toISOString(),
        type: 'withdraw',
      };
      const newVault = {
        ...prev.vault,
        balance: Math.max(0, prev.vault.balance - amount),
        history: [vaultTx, ...prev.vault.history],
      };
      if (auth.userId) saveSettings(auth.userId, {
        vault_balance: newVault.balance,
        vault_history: newVault.history,
      });
      return { ...prev, vault: newVault };
    });
  }, [auth.userId]);

  // ─── Transaction methods ────────────────────────────────────────────────
  const addTransaction = useCallback(async (tx: Omit<Transaction, 'id'>) => {
    if (!auth.userId) return;
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: auth.userId,
        amount: tx.amount,
        type: tx.type,
        category: tx.category,
        short_description: tx.shortDescription,
        detailed_description: tx.detailedDescription,
        payment_method: tx.paymentMethod,
        date: tx.date,
        neglected: tx.neglected ?? false,
      })
      .select()
      .single();

    if (!error && data) {
      setState(prev => ({
        ...prev,
        transactions: [mapTransaction(data), ...prev.transactions],
      }));
    }
  }, [auth.userId]);

  const updateTransaction = useCallback(async (tx: Transaction) => {
    if (!auth.userId) return;
    const { error } = await supabase
      .from('transactions')
      .update({
        amount: tx.amount,
        type: tx.type,
        category: tx.category,
        short_description: tx.shortDescription,
        detailed_description: tx.detailedDescription,
        payment_method: tx.paymentMethod,
        date: tx.date,
        neglected: tx.neglected,
      })
      .eq('id', tx.id)
      .eq('user_id', auth.userId);

    if (!error) {
      setState(prev => ({
        ...prev,
        transactions: prev.transactions.map(t => t.id === tx.id ? tx : t),
      }));
    }
  }, [auth.userId]);

  const deleteTransaction = useCallback(async (id: string) => {
    if (!auth.userId) return;

    // Find the transaction before deleting
    const tx = state.transactions.find(t => t.id === id);

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.userId);

    if (!error) {
      setState(prev => ({
        ...prev,
        transactions: prev.transactions.filter(t => t.id !== id),
      }));

      // If it was a savings transaction, withdraw from vault
      if (tx && tx.category === 'Savings' && tx.neglected) {
        withdrawFromVault(tx.amount);
      }
    }
  }, [auth.userId, state.transactions, withdrawFromVault]);

  const toggleNeglect = useCallback(async (id: string) => {
    if (!auth.userId) return;
    const tx = state.transactions.find(t => t.id === id);
    if (!tx) return;
    await updateTransaction({ ...tx, neglected: !tx.neglected });
  }, [auth.userId, state.transactions, updateTransaction]);

  // ─── Budget methods ─────────────────────────────────────────────────────
  const addBudget = useCallback(async (budget: Budget) => {
    if (!auth.userId) return;
    const { data, error } = await supabase
      .from('budgets')
      .upsert({
        user_id: auth.userId,
        category: budget.category,
        limit_amount: budget.limit,
      }, { onConflict: 'user_id,category' })
      .select()
      .single();

    if (!error && data) {
      setState(prev => ({
        ...prev,
        budgets: [...prev.budgets.filter(b => b.category !== budget.category), mapBudget(data)],
      }));
    }
  }, [auth.userId]);

  const removeBudget = useCallback(async (category: string) => {
    if (!auth.userId) return;
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('user_id', auth.userId)
      .eq('category', category);

    if (!error) {
      setState(prev => ({ ...prev, budgets: prev.budgets.filter(b => b.category !== category) }));
    }
  }, [auth.userId]);

  // ─── Other settings methods ─────────────────────────────────────────────
  const updateCashBalance = useCallback((amount: number) => {
    setState(prev => ({ ...prev, cashBalance: amount }));
    if (auth.userId) saveSettings(auth.userId, { cash_balance: amount });
  }, [auth.userId]);

  const setVaultPin = useCallback((pin: string | null) => {
    setState(prev => ({ ...prev, vault: { ...prev.vault, pin } }));
    if (auth.userId) saveSettings(auth.userId, { vault_pin: pin });
  }, [auth.userId]);

  const addCustomCategory = useCallback((type: 'income' | 'expense', category: string) => {
    setState(prev => {
      const newCats = {
        ...prev.customCategories,
        [type]: [...prev.customCategories[type], category],
      };
      if (auth.userId) saveSettings(auth.userId, { custom_categories: newCats });
      return { ...prev, customCategories: newCats };
    });
  }, [auth.userId]);

  const removeCustomCategory = useCallback((type: 'income' | 'expense', category: string) => {
    setState(prev => {
      const newCats = {
        ...prev.customCategories,
        [type]: prev.customCategories[type].filter(c => c !== category),
      };
      if (auth.userId) saveSettings(auth.userId, { custom_categories: newCats });
      return { ...prev, customCategories: newCats };
    });
  }, [auth.userId]);

  const setTheme = useCallback((theme: 'light' | 'dark' | 'gradient') => {
    setState(prev => ({ ...prev, theme }));
    if (auth.userId) saveSettings(auth.userId, { theme });
  }, [auth.userId]);

  const resetAllData = useCallback(async () => {
    if (auth.userId) {
      await Promise.all([
        supabase.from('transactions').delete().eq('user_id', auth.userId),
        supabase.from('budgets').delete().eq('user_id', auth.userId),
        supabase.from('user_settings').delete().eq('user_id', auth.userId),
      ]);
    }
    setState(defaultState);
  }, [auth.userId]);

  const exportData = useCallback(() => {
    return JSON.stringify(state, null, 2);
  }, [state]);

  const importData = useCallback(async (json: string): Promise<boolean> => {
    try {
      const parsed = JSON.parse(json);
      const merged: FinanceState = { ...defaultState, ...parsed };

      if (auth.userId) {
        if (merged.transactions.length > 0) {
          const rows = merged.transactions.map(tx => ({
            id: tx.id,
            user_id: auth.userId!,
            amount: tx.amount,
            type: tx.type,
            category: tx.category,
            short_description: tx.shortDescription,
            detailed_description: tx.detailedDescription,
            payment_method: tx.paymentMethod,
            date: tx.date,
            neglected: tx.neglected ?? false,
          }));
          await supabase.from('transactions').upsert(rows, { onConflict: 'id' });
        }

        if (merged.budgets.length > 0) {
          const rows = merged.budgets.map(b => ({
            user_id: auth.userId!,
            category: b.category,
            limit_amount: b.limit,
          }));
          await supabase.from('budgets').upsert(rows, { onConflict: 'user_id,category' });
        }

        await saveSettings(auth.userId, {
          cash_balance: merged.cashBalance,
          vault_balance: merged.vault.balance,
          vault_pin: merged.vault.pin,
          vault_history: merged.vault.history,
          custom_categories: merged.customCategories,
          theme: merged.theme,
        });
      }

      setState(merged);
      return true;
    } catch {
      return false;
    }
  }, [auth.userId]);

  return (
    <FinanceContext.Provider value={{
      state,
      auth,
      signUp,
      signIn,
      signOut,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      toggleNeglect,
      addBudget,
      removeBudget,
      updateCashBalance,
      depositToVault,
      withdrawFromVault,
      setVaultPin,
      addCustomCategory,
      removeCustomCategory,
      setTheme,
      resetAllData,
      exportData,
      importData,
    }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}