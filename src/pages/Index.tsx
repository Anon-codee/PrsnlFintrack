import { useState, useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { StatCard } from '@/components/dashboard/StatCard';
import { InsightEngine } from '@/components/dashboard/InsightEngine';
import { generateInsights } from '@/lib/insights';
import { TrendingUp, TrendingDown, Wallet, Banknote, Shield } from 'lucide-react';
import { FilterPeriod, MonthFilter } from '@/types/finance';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { motion } from 'framer-motion';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function Dashboard() {
  const { state } = useFinance();
  const now = new Date();
  const [period, setPeriod] = useState<FilterPeriod>('lifetime');
  const [monthFilter, setMonthFilter] = useState<MonthFilter>({
    month: now.getMonth(),
    year: now.getFullYear(),
  });

  const filteredTransactions = useMemo(() => {
    if (period === 'lifetime') return state.transactions;
    return state.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === monthFilter.month && d.getFullYear() === monthFilter.year;
    });
  }, [state.transactions, period, monthFilter]);

  // Bank only — period filtered
  const bankIncome = filteredTransactions
    .filter(t => t.type === 'income' && (t.paymentMethod || 'bank') === 'bank')
    .reduce((s, t) => s + t.amount, 0);
  const bankExpense = filteredTransactions
    .filter(t => t.type === 'expense' && (t.paymentMethod || 'bank') === 'bank')
    .reduce((s, t) => s + t.amount, 0);
  const bankBalance = bankIncome - bankExpense;

  // Cash — period filtered (for the 2 extra cards)
  const cashIncome = filteredTransactions
    .filter(t => t.type === 'income' && t.paymentMethod === 'cash')
    .reduce((s, t) => s + t.amount, 0);
   const cashExpense = filteredTransactions
    .filter(t => t.type === 'expense' && t.paymentMethod === 'cash' && !t.neglected)
    .reduce((s, t) => s + t.amount, 0);

  // Cash in Hand — always running total, never filtered
  const allCashIncome = state.transactions
    .filter(t => t.type === 'income' && t.paymentMethod === 'cash')
    .reduce((s, t) => s + t.amount, 0);
  const allCashExpense = state.transactions
    .filter(t => t.type === 'expense' && t.paymentMethod === 'cash' && !t.neglected)
    .reduce((s, t) => s + t.amount, 0);
  const cashInHand = (allCashIncome - allCashExpense) + state.cashBalance;

  const insights = useMemo(() => generateInsights(state.transactions.filter(t => !t.neglected)), [state.transactions]);

  const budgetAlerts = useMemo(() => {
    const currentExpenses = state.transactions.filter(t => {
      const d = new Date(t.date);
      return t.type === 'expense' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    return state.budgets.filter(b => {
      const spent = currentExpenses.filter(t => t.category === b.category).reduce((s, t) => s + t.amount, 0);
      return spent >= b.limit * 0.8;
    }).map(b => {
      const spent = currentExpenses.filter(t => t.category === b.category).reduce((s, t) => s + t.amount, 0);
      return { ...b, spent, overBudget: spent > b.limit };
    });
  }, [state.transactions, state.budgets]);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your financial overview at a glance</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as FilterPeriod)}>
            <SelectTrigger className="w-[130px] bg-secondary/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lifetime">Lifetime</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>

          {period === 'monthly' && (
            <>
              <Select
                value={String(monthFilter.month)}
                onValueChange={v => setMonthFilter(f => ({ ...f, month: parseInt(v) }))}
              >
                <SelectTrigger className="w-[130px] bg-secondary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m, i) => (
                    <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(monthFilter.year)}
                onValueChange={v => setMonthFilter(f => ({ ...f, year: parseInt(v) }))}
              >
                <SelectTrigger className="w-[90px] bg-secondary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      </div>

      {/* Main Stats Grid — bank only */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard title="Bank Income" value={`₹${bankIncome.toLocaleString()}`} icon={TrendingUp} variant="income" />
        <StatCard title="Bank Expenses" value={`₹${bankExpense.toLocaleString()}`} icon={TrendingDown} variant="expense" />
        <StatCard title="Bank Balance" value={`₹${bankBalance.toLocaleString()}`} icon={Wallet} variant="balance" />
        <StatCard title="Cash in Hand" value={`₹${cashInHand.toLocaleString()}`} icon={Banknote} variant="cash" />
        <StatCard title="Savings Vault" value={`₹${state.vault.balance.toLocaleString()}`} icon={Shield} variant="vault" />
      </div>

      {/* Cash breakdown — 2 extra cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <StatCard title="Cash Income" value={`₹${cashIncome.toLocaleString()}`} icon={TrendingUp} variant="income" />
        <StatCard title="Cash Expenses" value={`₹${cashExpense.toLocaleString()}`} icon={TrendingDown} variant="expense" />
      </div>

      {/* Budget Alerts */}
      {budgetAlerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          {budgetAlerts.map(alert => (
            <div
              key={alert.category}
              className={`glass-card rounded-lg p-4 border ${
                alert.overBudget ? 'border-expense/30 bg-expense/5' : 'border-vault/30 bg-vault/5'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-card-foreground">
                  {alert.overBudget ? '🚨' : '⚠️'} {alert.category}: ₹{alert.spent.toLocaleString()} / ₹{alert.limit.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">
                  {Math.round((alert.spent / alert.limit) * 100)}% used
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    alert.overBudget ? 'bg-expense' : 'bg-vault'
                  }`}
                  style={{ width: `${Math.min(100, (alert.spent / alert.limit) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Smart Insights */}
      <InsightEngine insights={insights} />

      {/* Recent Transactions */}
      <div className="glass-card rounded-xl p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Recent Transactions
        </h3>
        {filteredTransactions.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No transactions yet. Start by adding income or expenses.
          </p>
        ) : (
          <div className="space-y-2">
            {filteredTransactions.slice(0, 8).map(tx => (
              <div key={tx.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                    tx.type === 'income' ? 'bg-income/10' : 'bg-expense/10'
                  }`}>
                    {tx.type === 'income' ? (
                      <TrendingUp className="h-3.5 w-3.5 text-income" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5 text-expense" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{tx.shortDescription || tx.category}</p>
                    <p className="text-xs text-muted-foreground">
                      {tx.category} • {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
                <span className={`font-mono text-sm font-semibold ${
                  tx.type === 'income' ? 'text-income' : 'text-expense'
                }`}>
                  {tx.type === 'income' ? '+' : '-'}₹{tx.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}