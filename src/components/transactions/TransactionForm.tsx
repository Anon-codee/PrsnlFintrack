import { useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { DEFAULT_INCOME_CATEGORIES, DEFAULT_EXPENSE_CATEGORIES } from '@/lib/categories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface TransactionFormProps {
  type: 'income' | 'expense';
}

export function TransactionForm({ type }: TransactionFormProps) {
  const { state, addTransaction, depositToVault } = useFinance();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('');
  const [shortDesc, setShortDesc] = useState('');
  const [detailedDesc, setDetailedDesc] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'cash'>('bank');

  const defaultCategories = type === 'income' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
  const customCategories = type === 'income' ? state.customCategories.income : state.customCategories.expense;
  const allCategories = [...defaultCategories, ...customCategories];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !category || !date) {
      toast.error('Please fill in all required fields');
      return;
    }

    const isSavings = type === 'expense' && category === 'Savings';

    addTransaction({
      amount: parseFloat(amount),
      date,
      category,
      shortDescription: shortDesc,
      detailedDescription: detailedDesc,
      type,
      paymentMethod,
      neglected: isSavings ? true : false,
    });

    if (isSavings) {
      depositToVault(parseFloat(amount));
      toast.success(`₹${parseFloat(amount).toLocaleString()} added to your Savings Vault! 🏦`);
    } else {
      toast.success(`${type === 'income' ? 'Income' : 'Expense'} added successfully`);
    }

    setAmount('');
    setShortDesc('');
    setDetailedDesc('');
    setCategory('');
  };

  const isIncome = type === 'income';

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="glass-card rounded-xl p-6 space-y-5 max-w-lg"
    >
      <div className="space-y-2">
        <Label htmlFor="amount" className="text-xs uppercase tracking-wider text-muted-foreground">
          Amount (₹)
        </Label>
        <Input
          id="amount"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="text-2xl font-mono font-bold h-14 bg-secondary/50"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="date" className="text-xs uppercase tracking-wider text-muted-foreground">
            Date
          </Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-secondary/50"
            required
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Category
          </Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="bg-secondary/50">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {allCategories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Savings hint */}
      {type === 'expense' && category === 'Savings' && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-sm text-primary"
        >
          🏦 This will be automatically added to your Savings Vault and excluded from expenses!
        </motion.div>
      )}

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Payment Method
        </Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={paymentMethod === 'bank' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPaymentMethod('bank')}
          >
            🏦 Bank
          </Button>
          <Button
            type="button"
            variant={paymentMethod === 'cash' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPaymentMethod('cash')}
          >
            💵 Cash
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="shortDesc" className="text-xs uppercase tracking-wider text-muted-foreground">
          Short Description
        </Label>
        <Input
          id="shortDesc"
          placeholder="Brief note..."
          value={shortDesc}
          onChange={e => setShortDesc(e.target.value)}
          className="bg-secondary/50"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="detailedDesc" className="text-xs uppercase tracking-wider text-muted-foreground">
          Detailed Description
        </Label>
        <Textarea
          id="detailedDesc"
          placeholder="Add more details..."
          value={detailedDesc}
          onChange={e => setDetailedDesc(e.target.value)}
          className="bg-secondary/50 min-h-[80px]"
        />
      </div>

      <Button
        type="submit"
        variant={isIncome ? 'income' : 'expense'}
        className="w-full h-12 text-base font-semibold"
      >
        {isIncome ? '+ Add Income' : '− Add Expense'}
      </Button>
    </motion.form>
  );
}