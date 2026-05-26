import { Transaction, WeeklyData, DailyData, MerchantData, RecurrentPayment, PaymentChange } from '@/types/transaction';

export function calculateTotalSpending(transactions: Transaction[]): number {
  return transactions.reduce((sum, t) => sum + t.chargeAmount, 0);
}

export function calculateDailyAverage(transactions: Transaction[], daysInPeriod: number): number {
  const total = calculateTotalSpending(transactions);
  return daysInPeriod > 0 ? total / daysInPeriod : 0;
}

export function calculateStandingOrdersTotal(
  transactions: Transaction[],
  recurringMerchants: Set<string> = new Set()
): number {
  return transactions
    .filter(t => t.isStandingOrder || recurringMerchants.has(t.merchantName))
    .reduce((sum, t) => sum + t.chargeAmount, 0);
}

// Returns the set of merchant names considered "regular" spending: bank-flagged
// standing orders, plus merchants auto-detected as recurring by findRecurrentPayments.
export function getRecurringMerchantNames(allTransactions: Transaction[]): Set<string> {
  const set = new Set<string>();
  for (const t of allTransactions) {
    if (t.isStandingOrder) set.add(t.merchantName);
  }
  for (const r of findRecurrentPayments(allTransactions)) {
    set.add(r.merchantName);
  }
  return set;
}

export function findPaymentChanges(
  allTransactions: Transaction[],
  selectedMonth: number,
  selectedYear: number,
  lookbackMonths: number = 3
): PaymentChange[] {
  const byMerchant = new Map<string, Map<string, number>>();
  for (const t of allTransactions) {
    const key = `${t.statementDate.getFullYear()}-${t.statementDate.getMonth()}`;
    if (!byMerchant.has(t.merchantName)) byMerchant.set(t.merchantName, new Map());
    const m = byMerchant.get(t.merchantName)!;
    m.set(key, (m.get(key) || 0) + t.chargeAmount);
  }

  const currentKey = `${selectedYear}-${selectedMonth}`;
  const baselineKeys: string[] = [];
  for (let i = 1; i <= lookbackMonths; i++) {
    const d = new Date(selectedYear, selectedMonth - i, 1);
    baselineKeys.push(`${d.getFullYear()}-${d.getMonth()}`);
  }

  const out: PaymentChange[] = [];
  byMerchant.forEach((months, merchantName) => {
    const current = months.get(currentKey);
    if (current == null) return;

    const baselineValues: number[] = [];
    for (const k of baselineKeys) {
      const v = months.get(k);
      if (v != null) baselineValues.push(v);
    }
    if (baselineValues.length === 0) return;

    const baseline = baselineValues.reduce((a, b) => a + b, 0) / baselineValues.length;
    const delta = current - baseline;

    if (Math.abs(delta) < 10) return;
    if (baseline > 0 && Math.abs(delta) / baseline < 0.1) return;

    out.push({
      merchantName,
      currentAmount: current,
      baselineAmount: baseline,
      delta,
      baselineMonthCount: baselineValues.length,
    });
  });

  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export function getTopMerchant(transactions: Transaction[]): MerchantData | null {
  const merchantMap = new Map<string, MerchantData>();

  transactions.forEach(t => {
    const existing = merchantMap.get(t.merchantName) || { name: t.merchantName, total: 0, count: 0 };
    existing.total += t.chargeAmount;
    existing.count += 1;
    merchantMap.set(t.merchantName, existing);
  });

  let topMerchant: MerchantData | null = null;
  merchantMap.forEach(merchant => {
    if (!topMerchant || merchant.total > topMerchant.total) {
      topMerchant = merchant;
    }
  });

  return topMerchant;
}

export function getWeeklyBreakdown(transactions: Transaction[], month: number, year: number): WeeklyData[] {
  const weeks: WeeklyData[] = [
    { week: 1, label: '1-7', amount: 0 },
    { week: 2, label: '8-14', amount: 0 },
    { week: 3, label: '15-21', amount: 0 },
    { week: 4, label: '22+', amount: 0 },
  ];

  transactions.forEach(t => {
    const day = t.purchaseDate.getDate();
    if (day <= 7) weeks[0].amount += t.chargeAmount;
    else if (day <= 14) weeks[1].amount += t.chargeAmount;
    else if (day <= 21) weeks[2].amount += t.chargeAmount;
    else weeks[3].amount += t.chargeAmount;
  });

  return weeks;
}

export function getDailyBreakdown(transactions: Transaction[], month: number, year: number): DailyData[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dailyData: DailyData[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dayTransactions = transactions.filter(t => 
      t.purchaseDate.getDate() === day
    );
    const amount = dayTransactions.reduce((sum, t) => sum + t.chargeAmount, 0);
    dailyData.push({
      day,
      date: `${day}`,
      amount,
    });
  }

  return dailyData;
}

export function getMonthlyBreakdown(transactions: Transaction[], year: number): { month: string; amount: number; monthIndex: number }[] {
  const hebrewMonths = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];

  const monthlyData = hebrewMonths.map((name, index) => {
    const monthTransactions = transactions.filter(t =>
      t.statementDate.getMonth() === index && t.statementDate.getFullYear() === year
    );
    return {
      month: name,
      monthIndex: index,
      amount: monthTransactions.reduce((sum, t) => sum + t.chargeAmount, 0),
    };
  });

  return monthlyData;
}

export function getMonthlyTrend(transactions: Transaction[], year: number): { month: string; amount: number }[] {
  return getMonthlyBreakdown(transactions, year).map(m => ({
    month: m.month,
    amount: m.amount,
  }));
}

export function findRecurrentPayments(transactions: Transaction[]): RecurrentPayment[] {
  const merchantMonthlyData = new Map<string, Map<string, number>>();

  // Group transactions by merchant and statement-month, SUMMING amounts
  transactions.forEach(t => {
    const monthKey = `${t.statementDate.getFullYear()}-${t.statementDate.getMonth() + 1}`;
    
    if (!merchantMonthlyData.has(t.merchantName)) {
      merchantMonthlyData.set(t.merchantName, new Map());
    }
    
    const monthMap = merchantMonthlyData.get(t.merchantName)!;
    const currentSum = monthMap.get(monthKey) || 0;
    monthMap.set(monthKey, currentSum + t.chargeAmount);
  });

  const recurrentPayments: RecurrentPayment[] = [];

  merchantMonthlyData.forEach((monthMap, merchantName) => {
    // Check if we have data for at least 3 distinct months
    if (monthMap.size >= 3) {
      const amounts: number[] = [];
      const months: string[] = [];

      monthMap.forEach((monthlyTotal, monthKey) => {
        amounts.push(monthlyTotal);
        months.push(monthKey);
      });

      // Calculate average of the MONTHLY TOTALS
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      
      // Check if monthly totals are similar (within 20% of average)
      const isSimilar = amounts.every(a => Math.abs(a - avgAmount) / avgAmount < 0.2);

      if (isSimilar) {
        recurrentPayments.push({
          merchantName,
          averageAmount: avgAmount,
          months,
          frequency: months.length,
        });
      }
    }
  });

  return recurrentPayments.sort((a, b) => b.frequency - a.frequency);
}

export function getTopMerchants(transactions: Transaction[], limit: number = 5): MerchantData[] {
  const merchantMap = new Map<string, MerchantData>();

  transactions.forEach(t => {
    const existing = merchantMap.get(t.merchantName) || { name: t.merchantName, total: 0, count: 0 };
    existing.total += t.chargeAmount;
    existing.count += 1;
    merchantMap.set(t.merchantName, existing);
  });

  return Array.from(merchantMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export function filterTransactionsByPeriod(
  transactions: Transaction[],
  month: number | null,
  year: number
): Transaction[] {
  return transactions.filter(t => {
    const tYear = t.statementDate.getFullYear();
    const tMonth = t.statementDate.getMonth();

    if (month === null) {
      return tYear === year;
    }
    return tYear === year && tMonth === month;
  });
}

export function getAvailableYears(transactions: Transaction[]): number[] {
  const years = new Set<number>();
  transactions.forEach(t => years.add(t.statementDate.getFullYear()));
  return Array.from(years).sort((a, b) => b - a);
}

export function getAvailableMonths(transactions: Transaction[], year: number): number[] {
  const months = new Set<number>();
  transactions
    .filter(t => t.statementDate.getFullYear() === year)
    .forEach(t => months.add(t.statementDate.getMonth()));
  return Array.from(months).sort((a, b) => a - b);
}

export function getCategoryBreakdown(transactions: Transaction[]): { name: string; value: number }[] {
  const categoryMap = new Map<string, number>();

  transactions.forEach(t => {
    const category = t.category || 'אחר';
    const current = categoryMap.get(category) || 0;
    categoryMap.set(category, current + t.chargeAmount);
  });

  return Array.from(categoryMap.entries())
    .map(([name, value]) => ({ name, value }))
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

// Sum spending per category for the given (already filtered) transactions.
export function getCategorySpending(transactions: Transaction[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of transactions) {
    const cat = t.category || 'אחר';
    map.set(cat, (map.get(cat) || 0) + t.chargeAmount);
  }
  return map;
}

// Distribute a single monthly budget across categories by fitting a linear
// regression on each category's monthly totals over the last 12 statement
// months strictly before (refYear, refMonth). Predict next month's value per
// category, normalize to shares, multiply by `total`.
//
// Sparse categories (< 3 nonzero months) fall back to their plain mean — a
// regression on 1-2 nonzero points overfits to noise. Predictions are clipped
// at 0 so a long downtrend doesn't produce a negative allocation.
export function projectCategoryBudgets(
  allTransactions: Transaction[],
  total: number,
  refYear: number,
  refMonth: number,
  lookbackMonths: number = 12
): Map<string, number> {
  const out = new Map<string, number>();
  if (total <= 0) return out;

  // Build the lookback window: lookbackMonths consecutive statement-months
  // ending just before the reference month.
  const monthKeys: string[] = [];
  for (let i = lookbackMonths; i >= 1; i--) {
    const d = new Date(refYear, refMonth - i, 1);
    monthKeys.push(`${d.getFullYear()}-${d.getMonth()}`);
  }
  const monthIndex = new Map<string, number>();
  monthKeys.forEach((k, i) => monthIndex.set(k, i));

  // Per-category, per-month-index totals.
  const series = new Map<string, number[]>();
  for (const t of allTransactions) {
    const k = `${t.statementDate.getFullYear()}-${t.statementDate.getMonth()}`;
    const idx = monthIndex.get(k);
    if (idx == null) continue;
    const cat = t.category || 'אחר';
    if (!series.has(cat)) series.set(cat, new Array(monthKeys.length).fill(0));
    series.get(cat)![idx] += t.chargeAmount;
  }

  if (series.size === 0) return out;

  // For each category, predict the next-month value.
  const predictions = new Map<string, number>();
  series.forEach((ys, cat) => {
    const n = ys.length;
    const nonzero = ys.filter(v => v > 0).length;
    let next: number;

    if (nonzero < 3) {
      // Too few points for regression — use the mean of all months (zeros
      // included), since infrequent categories should get smaller shares.
      next = ys.reduce((a, b) => a + b, 0) / n;
    } else {
      // Ordinary least-squares fit of y over x = 0..n-1.
      const xs = ys.map((_, i) => i);
      const meanX = xs.reduce((a, b) => a + b, 0) / n;
      const meanY = ys.reduce((a, b) => a + b, 0) / n;
      let num = 0;
      let den = 0;
      for (let i = 0; i < n; i++) {
        num += (xs[i] - meanX) * (ys[i] - meanY);
        den += (xs[i] - meanX) ** 2;
      }
      const slope = den === 0 ? 0 : num / den;
      const intercept = meanY - slope * meanX;
      // Predict at x = n (next month after the lookback window).
      next = Math.max(0, slope * n + intercept);
    }

    if (next > 0) predictions.set(cat, next);
  });

  const sum = Array.from(predictions.values()).reduce((a, b) => a + b, 0);
  if (sum <= 0) return out;

  predictions.forEach((v, k) => {
    out.set(k, (v / sum) * total);
  });
  return out;
}
