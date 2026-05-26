import { useState, useEffect } from 'react';
import { Target, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CATEGORIES } from '@/utils/categories';
import { useBudgets } from '@/utils/budgets';
import { toast } from 'sonner';

const BudgetsPage = () => {
  const { budgets, setAll, totalBudget } = useBudgets();
  const [draft, setDraft] = useState<Record<string, string>>({});

  // Initialize draft from saved budgets when they change (e.g. on first load).
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const cat of Object.values(CATEGORIES)) {
      next[cat] = budgets[cat] != null ? String(budgets[cat]) : '';
    }
    setDraft(next);
  }, [budgets]);

  const handleSave = () => {
    const next: Record<string, number> = {};
    for (const [cat, raw] of Object.entries(draft)) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) {
        next[cat] = Math.round(n);
      }
    }
    setAll(next);
    toast.success('התקציבים נשמרו');
  };

  const handleClear = () => {
    setAll({});
    toast.success('התקציבים אופסו');
  };

  const draftTotal = Object.values(draft).reduce((sum, raw) => {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? sum + n : sum;
  }, 0);

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Target className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">תקציבים</h1>
              <p className="text-muted-foreground mt-1">
                הגדר תקציב חודשי לכל קטגוריה
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          {Object.values(CATEGORIES).map(cat => (
            <div
              key={cat}
              className="flex items-center justify-between gap-4 pb-4 border-b border-border last:border-0 last:pb-0"
            >
              <label className="text-foreground font-medium flex-1" htmlFor={`budget-${cat}`}>
                {cat}
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id={`budget-${cat}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={50}
                  placeholder="לא נקבע"
                  className="w-32 text-left"
                  value={draft[cat] ?? ''}
                  onChange={e =>
                    setDraft(prev => ({ ...prev, [cat]: e.target.value }))
                  }
                />
                <span className="text-muted-foreground">₪</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-muted-foreground">
            סה״כ תקציב:{' '}
            <span className="font-bold text-foreground">
              {draftTotal.toLocaleString('he-IL', {
                style: 'currency',
                currency: 'ILS',
                maximumFractionDigits: 0,
              })}
            </span>
            {totalBudget !== draftTotal && (
              <span className="text-xs mr-2">(טרם נשמר)</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClear}>
              <Trash2 className="h-4 w-4 ml-2" />
              אפס הכל
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 ml-2" />
              שמור
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default BudgetsPage;
