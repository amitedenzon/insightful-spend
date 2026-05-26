import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'category_budgets';

export type CategoryBudgets = Record<string, number>;

function readBudgets(): CategoryBudgets {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const out: CategoryBudgets = {};
      for (const [k, v] of Object.entries(parsed)) {
        const n = typeof v === 'number' ? v : Number(v);
        if (Number.isFinite(n) && n > 0) out[k] = n;
      }
      return out;
    }
  } catch (e) {
    console.error('Failed to read budgets', e);
  }
  return {};
}

function writeBudgets(budgets: CategoryBudgets) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(budgets));
    window.dispatchEvent(new Event('budgets-changed'));
  } catch (e) {
    console.error('Failed to save budgets', e);
  }
}

export function useBudgets(): {
  budgets: CategoryBudgets;
  setBudget: (category: string, amount: number | null) => void;
  setAll: (budgets: CategoryBudgets) => void;
  totalBudget: number;
} {
  const [budgets, setBudgets] = useState<CategoryBudgets>(() => readBudgets());

  useEffect(() => {
    const refresh = () => setBudgets(readBudgets());
    window.addEventListener('budgets-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('budgets-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const setBudget = useCallback((category: string, amount: number | null) => {
    setBudgets(prev => {
      const next = { ...prev };
      if (amount == null || !Number.isFinite(amount) || amount <= 0) {
        delete next[category];
      } else {
        next[category] = amount;
      }
      writeBudgets(next);
      return next;
    });
  }, []);

  const setAll = useCallback((next: CategoryBudgets) => {
    setBudgets(next);
    writeBudgets(next);
  }, []);

  const totalBudget = Object.values(budgets).reduce((sum, n) => sum + n, 0);

  return { budgets, setBudget, setAll, totalBudget };
}
