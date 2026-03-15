import { useState, useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { CategoryBreakdown } from '@/components/reports/CategoryBreakdown';
import { WeekdayVsWeekend, MonthPartSpending, MonthlyComparisonChart } from '@/components/reports/SpendingAnalysis';
import { BarChart3 } from 'lucide-react';
import { FilterPeriod, MonthFilter } from '@/types/finance';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function Reports() {
  const { state } = useFinance();
  const now = new Date();
  const [period, setPeriod] = useState<FilterPeriod>('lifetime');
  const [monthFilter, setMonthFilter] = useState<MonthFilter>({
    month: now.getMonth(),
    year: now.getFullYear(),
  });

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const filteredTransactions = useMemo(() => {
    const active = state.transactions.filter(t => !t.neglected);
    if (period === 'lifetime') return active;
    return active.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === monthFilter.month && d.getFullYear() === monthFilter.year;
    });
  }, [state.transactions, period, monthFilter]);

  // Monthly summary stats
  const totalIncome = filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = filteredTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const savings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.round((savings / totalIncome) * 100) : 0;

  // Cash fix: only add cashBalance offset in lifetime view
  const cashExpense = filteredTransactions.filter(t => t.type === 'expense' && t.paymentMethod === 'cash').reduce((s, t) => s + t.amount, 0);
  const cashIncome = filteredTransactions.filter(t => t.type === 'income' && t.paymentMethod === 'cash').reduce((s, t) => s + t.amount, 0);
  const cashInHand = (cashIncome - cashExpense) + (period === 'lifetime' ? state.cashBalance : 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reports</h1>
            <p className="text-sm text-muted-foreground">Advanced spending analytics</p>
          </div>
        </div>

        {/* Period filter */}
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

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card rounded-xl p-4 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Income</p>
          <p className="text-xl font-bold font-mono text-income">₹{totalIncome.toLocaleString()}</p>
        </div>
        <div className="glass-card rounded-xl p-4 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Expenses</p>
          <p className="text-xl font-bold font-mono text-expense">₹{totalExpense.toLocaleString()}</p>
        </div>
        <div className="glass-card rounded-xl p-4 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Net Savings</p>
          <p className={`text-xl font-bold font-mono ${savings >= 0 ? 'text-income' : 'text-expense'}`}>
            ₹{savings.toLocaleString()}
          </p>
        </div>
        <div className="glass-card rounded-xl p-4 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Savings Rate</p>
          <p className={`text-xl font-bold font-mono ${savingsRate >= 20 ? 'text-income' : 'text-vault'}`}>
            {savingsRate}%
          </p>
        </div>
      </div>

      {/* Cash in hand for this period */}
      {period === 'monthly' && (
        <div className="glass-card rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Cash Flow This Month</p>
            <p className={`text-lg font-bold font-mono mt-1 ${cashInHand >= 0 ? 'text-income' : 'text-expense'}`}>
              ₹{cashInHand.toLocaleString()}
            </p>
          </div>
          <p className="text-xs text-muted-foreground max-w-[200px] text-right">
            Cash income minus cash expenses for {months[monthFilter.month]}
          </p>
        </div>
      )}

      {/* Analysis Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <WeekdayVsWeekend transactions={filteredTransactions} />
        <MonthPartSpending transactions={filteredTransactions} />
      </div>

      {/* Monthly Comparison — only show in lifetime view */}
      {period === 'lifetime' && (
        <MonthlyComparisonChart transactions={filteredTransactions} />
      )}

      {/* Category Breakdown */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Expense Breakdown by Category
        </h3>
        <CategoryBreakdown transactions={filteredTransactions} type="expense" />
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Income Breakdown by Category
        </h3>
        <CategoryBreakdown transactions={filteredTransactions} type="income" />
      </div>
    </div>
  );
}