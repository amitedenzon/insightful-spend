import { Target, AlertTriangle } from 'lucide-react';
import { CATEGORIES } from '@/utils/categories';
import { cn } from '@/lib/utils';

interface BudgetProgressProps {
  budgets: Record<string, number>;
  categorySpending: Map<string, number>;
  monthlyBudgetTotal: number;
  periodLabel?: string;
}

const formatILS = (n: number) =>
  n.toLocaleString('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  });

export function BudgetProgress({
  budgets,
  categorySpending,
  monthlyBudgetTotal,
  periodLabel,
}: BudgetProgressProps) {
  const entries = Object.entries(budgets).sort((a, b) => b[1] - a[1]);

  // Two distinct empty states: no total set, vs total set but no history to distribute across.
  if (monthlyBudgetTotal <= 0) {
    return (
      <div className="flex items-center gap-4 p-6 bg-card border border-dashed border-border rounded-xl">
        <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Target className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-foreground">לא הוגדר תקציב חודשי</p>
          <p className="text-sm text-muted-foreground">
            קבע סכום למעלה כדי לראות חלוקה אוטומטית והתקדמות
          </p>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex items-center gap-4 p-6 bg-card border border-dashed border-border rounded-xl">
        <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Target className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-foreground">אין מספיק היסטוריה לחלוקה</p>
          <p className="text-sm text-muted-foreground">
            העלה עוד דפי חשבון כדי שהמערכת תוכל לחלק את התקציב לקטגוריות
          </p>
        </div>
      </div>
    );
  }

  const totalBudget = monthlyBudgetTotal;
  // Sum across ALL categories that had any spending — not only allocated
  // ones — so this number matches the dashboard's "total expenses" tile.
  const totalSpent = Array.from(categorySpending.values()).reduce((a, b) => a + b, 0);
  const totalPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Target className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-foreground">
            {periodLabel ? `התקדמות ב${periodLabel}` : 'התקדמות'}
          </h3>
          <p className="text-sm text-muted-foreground truncate">
            {formatILS(totalSpent)} מתוך {formatILS(totalBudget)} ({totalPercent.toFixed(0)}%)
          </p>
        </div>
      </div>

      <ProgressBar percent={totalPercent} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 pt-2">
        {entries.map(([category, budget]) => {
          const spent = categorySpending.get(category) || 0;
          const percent = budget > 0 ? (spent / budget) * 100 : 0;
          const isOver = spent > budget;
          // Sanity check that the budget references a known category (cheap dev guardrail).
          const known = (Object.values(CATEGORIES) as string[]).includes(category);
          return (
            <div key={category} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span
                  className={cn(
                    'font-medium truncate',
                    known ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {category}
                </span>
                <span
                  className={cn(
                    'whitespace-nowrap tabular-nums',
                    isOver ? 'text-destructive font-semibold' : 'text-muted-foreground'
                  )}
                >
                  {formatILS(spent)} / {formatILS(budget)}
                </span>
              </div>
              <ProgressBar percent={percent} isOver={isOver} />
              {isOver && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  חריגה של {formatILS(spent - budget)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProgressBar({ percent, isOver }: { percent: number; isOver?: boolean }) {
  const clamped = Math.min(100, Math.max(0, percent));
  const isWarn = percent >= 80 && !isOver;
  return (
    <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
      <div
        className={cn(
          'h-full transition-all',
          isOver ? 'bg-destructive' : isWarn ? 'bg-amber-500' : 'bg-primary'
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
