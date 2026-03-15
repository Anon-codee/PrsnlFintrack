import { useState, useRef, useEffect } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "Where did I spend the most?",
  "How can I save more?",
  "Plan my budget for next month",
  "Give me a spending summary",
];

export function AIAssistant() {
  const { state } = useFinance();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function buildSystemPrompt() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthTx = state.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalIncome = state.transactions
      .filter(t => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);

    const totalExpense = state.transactions
      .filter(t => t.type === 'expense' && !t.neglected)
      .reduce((s, t) => s + t.amount, 0);

    const monthIncome = thisMonthTx
      .filter(t => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);

    const monthExpense = thisMonthTx
      .filter(t => t.type === 'expense' && !t.neglected)
      .reduce((s, t) => s + t.amount, 0);

    // Category breakdown
    const catBreakdown: Record<string, number> = {};
    thisMonthTx
      .filter(t => t.type === 'expense' && !t.neglected)
      .forEach(t => {
        catBreakdown[t.category] = (catBreakdown[t.category] || 0) + t.amount;
      });

    const topCategories = Object.entries(catBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, amt]) => `${cat}: ₹${amt.toLocaleString()}`)
      .join(', ');

    const recentTx = state.transactions
      .slice(0, 10)
      .map(t => `${t.date} | ${t.type} | ${t.category} | ₹${t.amount} | ${t.shortDescription}`)
      .join('\n');

    const budgets = state.budgets
      .map(b => {
        const spent = thisMonthTx
          .filter(t => t.type === 'expense' && t.category === b.category)
          .reduce((s, t) => s + t.amount, 0);
        return `${b.category}: spent ₹${spent} of ₹${b.limit} limit`;
      })
      .join(', ');

    return `You are a smart personal finance assistant for an Indian user. You have access to their real financial data. Be helpful, friendly, specific, and concise. Use ₹ for amounts. Give actionable advice based on their actual data.

FINANCIAL SNAPSHOT:
- Lifetime Income: ₹${totalIncome.toLocaleString()}
- Lifetime Expenses: ₹${totalExpense.toLocaleString()}
- Bank Balance: ₹${(totalIncome - totalExpense).toLocaleString()}
- Cash in Hand: ₹${state.cashBalance.toLocaleString()}
- Savings Vault: ₹${state.vault.balance.toLocaleString()}

THIS MONTH (${now.toLocaleString('default', { month: 'long', year: 'numeric' })}):
- Income: ₹${monthIncome.toLocaleString()}
- Expenses: ₹${monthExpense.toLocaleString()}
- Net: ₹${(monthIncome - monthExpense).toLocaleString()}
- Top spending categories: ${topCategories || 'No expenses yet'}

BUDGETS: ${budgets || 'No budgets set'}

RECENT TRANSACTIONS:
${recentTx}

Total transactions tracked: ${state.transactions.length}

Answer questions about their finances, give budgeting advice, spending analysis, and saving tips based on this real data.`;
  }

  async function sendMessage(text?: string) {
    const userMessage = text || input.trim();
    if (!userMessage || loading) return;

    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            ...newMessages,
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || 'Sorry, I could not get a response. Please try again.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please check your connection and try again.',
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      <motion.button
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg hover:bg-primary/90 transition-all ${open ? 'hidden' : 'flex'}`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
      >
        <Sparkles className="h-4 w-4" />
        <span className="text-sm font-medium">Ask AI</span>
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 flex flex-col w-[90vw] max-w-sm h-[70vh] max-h-[600px] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-card-foreground">Finance AI</p>
                  <p className="text-xs text-muted-foreground">Powered by Groq</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Sparkles className="h-3 w-3 text-primary" />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm bg-secondary/50 px-3 py-2 text-sm text-card-foreground">
                      Hi! I'm your personal finance assistant. I have access to all your transaction data. Ask me anything about your spending! 💰
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground px-1">Suggested questions:</p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_QUESTIONS.map(q => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  {msg.role === 'assistant' && (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Sparkles className="h-3 w-3 text-primary" />
                    </div>
                  )}
                  <div className={`rounded-2xl px-3 py-2 text-sm max-w-[80%] whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-secondary/50 text-card-foreground rounded-tl-sm'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-start gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Sparkles className="h-3 w-3 text-primary" />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-secondary/50 px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border p-3 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Ask about your finances..."
                className="flex-1 rounded-xl bg-secondary/50 border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-all"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}