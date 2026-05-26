import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'monthly_budget_total';

function readTotal(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch (e) {
    console.error('Failed to read budget total', e);
    return 0;
  }
}

function writeTotal(total: number) {
  try {
    if (total > 0) localStorage.setItem(STORAGE_KEY, String(total));
    else localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('budgets-changed'));
  } catch (e) {
    console.error('Failed to save budget total', e);
  }
}

export function useMonthlyBudget(): {
  total: number;
  setTotal: (n: number) => void;
} {
  const [total, setTotalState] = useState<number>(() => readTotal());

  useEffect(() => {
    const refresh = () => setTotalState(readTotal());
    window.addEventListener('budgets-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('budgets-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const setTotal = useCallback((n: number) => {
    const clean = Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
    writeTotal(clean);
    setTotalState(clean);
  }, []);

  return { total, setTotal };
}
