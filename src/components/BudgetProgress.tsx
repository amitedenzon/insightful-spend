import { Link } from 'react-router-dom';
import { Target, AlertTriangle } from 'lucide-react';
import { CATEGORIES } from '@/utils/categories';
import { CategoryBudgets } from '@/utils/budgets';
import { cn } from '@/lib/utils';

interface BudgetProgressProps {
  budgets: CategoryBudgets;
  categorySpending: Map<string, number>;
}

const formatILS = (n: number) =>
  n.toLocaleString('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  });

export function BudgetProgress({ budgets, categorySpending }: BudgetProgressProps) {
  const entries = Object.entries(budgets).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-between gap-4 p-6 bg-card border border-dashed border-border rounded-2xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Target className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground">לא הוגדרו תקציבים</p>
            <p className="text-sm text-muted-foreground truncate">
              הגדר תקציב חודשי לכל קטגוריה כדי לעקוב אחרי ההוצאות שלך
            </p>
          </div>
        </div>
        <Link
          to="/budgets"
          className="text-sm font-medium text-primary hover:underline whitespace-nowrap"
        >
          הגדר תקציב ←
        </Link>
      </div>
    );
  }

  const totalBudget = entries.reduce((sum, [, b]) => sum + b, 0);
  const totalSpent = entries.reduce(
    (sum, [cat]) => sum + (categorySpending.get(cat) || 0),
    0
  );
  const totalPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-5 animate-slide-up">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Target className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground">תקציב חודשי</h3>
            <p className="text-sm text-muted-foreground truncate">
              {formatILS(totalSpent)} מתוך {formatILS(totalBudget)}
            </p>
          </div>
        </div>
        <Link
          to="/budgets"
          className="text-sm font-medium text-primary hover:underline whitespace-nowrap"
        >
          ערוך
        </Link>
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
