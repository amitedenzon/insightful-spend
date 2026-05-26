import { useMemo, useState, useEffect } from 'react';
import { Target, Save, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Transaction } from '@/types/transaction';
import { useMonthlyBudget } from '@/utils/budgets';
import { projectCategoryBudgets } from '@/utils/analytics';

interface BudgetsPageProps {
  // Optional: when wired through from App.tsx, the page previews the
  // auto-allocation. Without it the user can still save a total — preview
  // appears once App.tsx passes the prop in.
  transactions?: Transaction[];
}

const formatILS = (n: number) =>
  n.toLocaleString('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  });

const BudgetsPage = ({ transactions = [] }: BudgetsPageProps) => {
  const { total, setTotal } = useMonthlyBudget();
  const [draft, setDraft] = useState<string>(total > 0 ? String(total) : '');

  useEffect(() => {
    setDraft(total > 0 ? String(total) : '');
  }, [total]);

  // Reference month for projection = the next calendar month after today, so
  // the preview is "this is how a typical upcoming month would be split".
  const refDate = useMemo(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  }, []);

  const draftTotal = useMemo(() => {
    const n = Number(draft);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  }, [draft]);

  const allocation = useMemo(
    () =>
      projectCategoryBudgets(
        transactions,
        draftTotal,
        refDate.year,
        refDate.month
      ),
    [transactions, draftTotal, refDate]
  );

  const sortedAllocation = useMemo(
    () =>
      Array.from(allocation.entries()).sort((a, b) => b[1] - a[1]),
    [allocation]
  );

  const handleSave = () => {
    setTotal(draftTotal);
    toast.success(
      draftTotal > 0 ? 'התקציב נשמר' : 'התקציב אופס'
    );
  };

  const insufficientData = transactions.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Target className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">תקציב חודשי</h1>
            <p className="text-muted-foreground mt-1">
              קבע תקציב כולל לחודש – החלוקה לקטגוריות תיגזר אוטומטית
              לפי 12 החודשים האחרונים
            </p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <label className="block text-sm font-medium text-foreground" htmlFor="budget-total">
            תקציב חודשי כולל
          </label>
          <div className="flex items-center gap-3">
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
              שמור: {formatILS(total)} · עריכה לא שמורה
            </p>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-foreground">חלוקה אוטומטית</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            רגרסיה לינארית על סך ההוצאות החודשי בכל קטגוריה ב-12 החודשים
            האחרונים, מנורמלת לחלקים מסך התקציב
          </p>

          {insufficientData ? (
            <p className="text-sm text-muted-foreground py-4">
              אין נתונים זמינים. העלה דפי חשבון תחילה כדי לראות את החלוקה
            </p>
          ) : draftTotal <= 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              הזן סכום תקציב למעלה כדי לראות את החלוקה
            </p>
          ) : sortedAllocation.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              אין מספיק היסטוריה כדי לחשב חלוקה
            </p>
          ) : (
            <div className="divide-y divide-border">
              {sortedAllocation.map(([cat, amount]) => {
                const share = draftTotal > 0 ? (amount / draftTotal) * 100 : 0;
                return (
                  <div
                    key={cat}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <span className="font-medium text-foreground truncate">{cat}</span>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground tabular-nums">
                        {share.toFixed(0)}%
                      </span>
                      <span className="font-semibold text-foreground tabular-nums whitespace-nowrap">
                        {formatILS(amount)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default BudgetsPage;
