import { useMemo, useState, useEffect } from 'react';
import { Target, Save, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Transaction } from '@/types/transaction';
import { useMonthlyBudget } from '@/utils/budgets';
import {
  projectCategoryBudgets,
  getCategorySpending,
  filterTransactionsByPeriod,
} from '@/utils/analytics';
import { BudgetProgress } from '@/components/BudgetProgress';

interface BudgetsPageProps {
  transactions?: Transaction[];
}

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

const BudgetsPage = ({ transactions = [] }: BudgetsPageProps) => {
  const { total, setTotal } = useMonthlyBudget();
  const [draft, setDraft] = useState<string>(total > 0 ? String(total) : '');

  useEffect(() => {
    setDraft(total > 0 ? String(total) : '');
  }, [total]);

  // Use the latest statement-month that has data as the "current period" for
  // the progress display. Allocation is derived from the 12 months ending at
  // that same point — so progress is "what the regression would have allocated
  // for this month vs what you actually spent".
  const latestPeriod = useMemo(() => {
    let latestYear = -Infinity;
    let latestMonth = -Infinity;
    for (const t of transactions) {
      const y = t.statementDate.getFullYear();
      const m = t.statementDate.getMonth();
      if (y > latestYear || (y === latestYear && m > latestMonth)) {
        latestYear = y;
        latestMonth = m;
      }
    }
    if (latestYear === -Infinity) return null;
    return { year: latestYear, month: latestMonth };
  }, [transactions]);

  const draftTotal = useMemo(() => {
    const n = Number(draft);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  }, [draft]);

  // Allocation projection: predict the latest month using its 12 prior months.
  const allocation = useMemo(() => {
    if (!latestPeriod || draftTotal <= 0) return new Map<string, number>();
    return projectCategoryBudgets(
      transactions,
      draftTotal,
      latestPeriod.year,
      latestPeriod.month
    );
  }, [transactions, draftTotal, latestPeriod]);

  // Actual spending in the latest month, by category — for the live progress bars.
  // budgetableOnly: investments are tracked separately and shouldn't roll up
  // into "total spent vs total budget".
  const currentMonthSpending = useMemo(() => {
    if (!latestPeriod) return new Map<string, number>();
    return getCategorySpending(
      filterTransactionsByPeriod(transactions, latestPeriod.month, latestPeriod.year),
      true,
    );
  }, [transactions, latestPeriod]);

  const periodLabel = latestPeriod
    ? `${HEBREW_MONTHS[latestPeriod.month]} ${latestPeriod.year}`
    : undefined;

  const handleSave = () => {
    setTotal(draftTotal);
    toast.success(draftTotal > 0 ? 'התקציב נשמר' : 'התקציב אופס');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Target className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">תקציב חודשי</h1>
          <p className="text-muted-foreground mt-1">
            קבע תקציב כולל לחודש – החלוקה לקטגוריות נגזרת אוטומטית מ-12 החודשים האחרונים. השקעות לא נכללות בתקציב.
          </p>
        </div>
      </div>

        {/* Budget total input */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-3">
          <label className="block text-sm font-medium text-foreground" htmlFor="budget-total">
            תקציב חודשי כולל
          </label>
          <div className="flex items-center gap-3 flex-wrap">
            <Input
              id="budget-total"
              type="number"
              inputMode="numeric"
              min={0}
              step={100}
              placeholder="לדוגמה: 8000"
              className="w-48 text-left text-lg"
              value={draft}
              onChange={e => setDraft(e.target.value)}
            />
            <span className="text-muted-foreground">₪</span>
            <Button className="mr-auto" onClick={handleSave}>
              <Save className="h-4 w-4 ml-2" />
              שמור
            </Button>
          </div>
          {total > 0 && total !== draftTotal && (
            <p className="text-xs text-muted-foreground">
              שמור: {total.toLocaleString('he-IL')}&nbsp;₪ · עריכה לא שמורה
            </p>
          )}
        </div>

        {/* Allocation + live progress */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-foreground">חלוקה אוטומטית והתקדמות</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            רגרסיה לינארית על סך ההוצאות החודשי בכל קטגוריה ב-12 החודשים האחרונים,
            מנורמלת לחלקים מסך התקציב
          </p>

          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              אין נתונים זמינים. העלה דפי חשבון תחילה כדי לראות את החלוקה
            </p>
          ) : (
            <BudgetProgress
              budgets={Object.fromEntries(allocation)}
              categorySpending={currentMonthSpending}
              monthlyBudgetTotal={draftTotal}
              periodLabel={periodLabel}
            />
          )}
        </div>
    </div>
  );
};

export default BudgetsPage;
