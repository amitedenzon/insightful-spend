import { Transaction } from '@/types/transaction';
import { CATEGORIES, isBudgetableCategory } from './categories';

// ---------------------------------------------------------------------------
// Statistics utilities. Pure functions over Transaction[]. All "current" /
// "previous" calculations are statement-month based, matching the rest of the
// analytics pipeline (Dashboard.tsx uses statementDate for filtering too).
// ---------------------------------------------------------------------------

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

const HEBREW_DOW = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export interface Period {
  month: number; // 0-indexed
  year: number;
  label: string; // "מאי 2026"
}

export function periodFrom(year: number, month: number): Period {
  return { year, month, label: `${HEBREW_MONTHS[month]} ${year}` };
}

export function previousPeriod(p: Period): Period {
  const d = new Date(p.year, p.month - 1, 1);
  return periodFrom(d.getFullYear(), d.getMonth());
}

function expensesOnly(transactions: Transaction[]): Transaction[] {
  return transactions.filter(t => t.chargeAmount > 0);
}

function inPeriod(t: Transaction, p: Period): boolean {
  return (
    t.statementDate.getFullYear() === p.year &&
    t.statementDate.getMonth() === p.month
  );
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const v = mean(values.map(x => (x - m) ** 2));
  return Math.sqrt(v);
}

// ---------------------------------------------------------------------------
// Aggregate types
// ---------------------------------------------------------------------------

export interface PeriodTotals {
  total: number;
  income: number;
  transactionCount: number;
  avgTransaction: number;
  uniqueMerchants: number;
}

export interface CategoryMover {
  category: string;
  current: number;
  baseline: number;
  delta: number;
  pctChange: number; // 0..N, e.g. 1.5 = +150%
  isHighestEver: boolean;
}

export interface MerchantSummary {
  merchant: string;
  amount: number;
  count: number;
  category: string;
}

export interface BehaviorStats {
  daysWithSpend: number;
  totalDaysInMonth: number;
  daysElapsedInMonth: number;
  longestSpendingStreak: number;
  longestDryStreak: number;
  weekendSpend: number;
  weekdaySpend: number;
  weekendRatio: number; // weekend / (weekend + weekday)
  biggestDayName: string; // Hebrew day name with highest avg
  biggestDayAmount: number;
}

export interface SubscriptionStats {
  monthlyBase: number;
  newRecurring: { merchant: string; amount: number; firstSeen: string }[];
  stoppedRecurring: { merchant: string; amount: number; lastSeen: string }[];
  totalRecurringMerchants: number;
}

export interface LifestyleStats {
  restaurantCount: number;
  restaurantTotal: number;
  restaurantCountPrev: number;
  coffeeCount: number;
  coffeeTotal: number;
  deliveryCount: number;
  deliveryTotal: number;
  groceryTotal: number;
  groceryVsRestaurant: number; // grocery / (grocery + restaurant)
}

export interface AnomalyStats {
  largestTransaction: Transaction | null;
  largestZScore: number;
  spikedCategories: { category: string; current: number; mean: number; z: number }[];
}

export interface BurnRateStats {
  dailyAverageThisMonth: number;
  typicalDailyAverage: number; // from last 3 statement months
  projectedTotal: number; // extrapolated to full month
  daysElapsed: number;
  daysInMonth: number;
}

export interface StatisticsSummary {
  current: Period;
  previous: Period;
  hasPrevious: boolean;
  currentTotals: PeriodTotals;
  previousTotals: PeriodTotals;
  totalDelta: number;
  totalPctChange: number; // signed
  burnRate: BurnRateStats;
  categoryMovers: CategoryMover[];
  topCategoryShares: { category: string; share: number; prevShare: number }[];
  newMerchants: MerchantSummary[];
  lapsedMerchants: MerchantSummary[];
  topMerchants: MerchantSummary[];
  topMerchantsConcentration: number; // 0..1
  behavior: BehaviorStats;
  subscriptions: SubscriptionStats;
  lifestyle: LifestyleStats;
  anomalies: AnomalyStats;
  savingsRate: number | null; // null if no income
}

// ---------------------------------------------------------------------------
// Core computations
// ---------------------------------------------------------------------------

export function getPeriodTotals(transactions: Transaction[], p: Period): PeriodTotals {
  const txs = transactions.filter(t => inPeriod(t, p));
  const expenses = expensesOnly(txs);
  const income = txs
    .filter(t => t.chargeAmount < 0)
    .reduce((s, t) => s + -t.chargeAmount, 0);
  const total = expenses.reduce((s, t) => s + t.chargeAmount, 0);
  const uniqueMerchants = new Set(expenses.map(t => t.merchantName)).size;
  return {
    total,
    income,
    transactionCount: expenses.length,
    avgTransaction: expenses.length ? total / expenses.length : 0,
    uniqueMerchants,
  };
}

// Returns spending sum grouped by category for a given period.
function categorySpend(transactions: Transaction[], p: Period): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of expensesOnly(transactions.filter(t => inPeriod(t, p)))) {
    const c = t.category || CATEGORIES.OTHER;
    out.set(c, (out.get(c) || 0) + t.chargeAmount);
  }
  return out;
}

// Spending per category over the LAST `n` complete months BEFORE `p`.
// Returns avg-per-month for each category.
function categoryBaseline(
  transactions: Transaction[],
  p: Period,
  n: number
): Map<string, number> {
  const months: Period[] = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(p.year, p.month - i, 1);
    months.push(periodFrom(d.getFullYear(), d.getMonth()));
  }
  const sums = new Map<string, number>();
  for (const m of months) {
    categorySpend(transactions, m).forEach((v, k) => {
      sums.set(k, (sums.get(k) || 0) + v);
    });
  }
  const out = new Map<string, number>();
  sums.forEach((v, k) => out.set(k, v / n));
  return out;
}

// All historical month totals for a category (statement-month → total).
function categoryMonthlyHistory(
  transactions: Transaction[],
  category: string
): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of expensesOnly(transactions)) {
    if ((t.category || CATEGORIES.OTHER) !== category) continue;
    const k = `${t.statementDate.getFullYear()}-${t.statementDate.getMonth()}`;
    out.set(k, (out.get(k) || 0) + t.chargeAmount);
  }
  return out;
}

export function getCategoryMovers(
  transactions: Transaction[],
  p: Period,
  lookback: number = 3,
  limit: number = 6
): CategoryMover[] {
  const current = categorySpend(transactions, p);
  const baseline = categoryBaseline(transactions, p, lookback);
  const all = new Set<string>([...current.keys(), ...baseline.keys()]);
  const movers: CategoryMover[] = [];

  const currentKey = `${p.year}-${p.month}`;

  all.forEach(cat => {
    const cur = current.get(cat) || 0;
    const base = baseline.get(cat) || 0;
    // Skip categories with both sides near zero — uninteresting noise.
    if (cur < 20 && base < 20) return;
    const delta = cur - base;
    // Require either a meaningful absolute delta OR a meaningful percent change.
    if (Math.abs(delta) < 50 && (base === 0 || Math.abs(delta) / base < 0.15)) return;

    let isHighestEver = false;
    if (cur > 0) {
      const hist = categoryMonthlyHistory(transactions, cat);
      const otherMax = Math.max(
        0,
        ...Array.from(hist.entries())
          .filter(([k]) => k !== currentKey)
          .map(([, v]) => v)
      );
      isHighestEver = hist.size >= 3 && cur > otherMax;
    }

    movers.push({
      category: cat,
      current: cur,
      baseline: base,
      delta,
      pctChange: base > 0 ? delta / base : (cur > 0 ? Infinity : 0),
      isHighestEver,
    });
  });

  return movers
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, limit);
}

export function getCategoryShares(
  transactions: Transaction[],
  current: Period,
  previous: Period,
  limit: number = 5
): { category: string; share: number; prevShare: number }[] {
  const cur = categorySpend(transactions, current);
  const prev = categorySpend(transactions, previous);
  const curTotal = sum(Array.from(cur.values()));
  const prevTotal = sum(Array.from(prev.values()));
  if (curTotal === 0) return [];

  return Array.from(cur.entries())
    .map(([category, amount]) => ({
      category,
      share: amount / curTotal,
      prevShare: prevTotal > 0 ? (prev.get(category) || 0) / prevTotal : 0,
    }))
    .sort((a, b) => b.share - a.share)
    .slice(0, limit);
}

function merchantSummariesInPeriod(
  transactions: Transaction[],
  p: Period
): Map<string, MerchantSummary> {
  const out = new Map<string, MerchantSummary>();
  for (const t of expensesOnly(transactions.filter(t => inPeriod(t, p)))) {
    const existing = out.get(t.merchantName);
    if (existing) {
      existing.amount += t.chargeAmount;
      existing.count += 1;
    } else {
      out.set(t.merchantName, {
        merchant: t.merchantName,
        amount: t.chargeAmount,
        count: 1,
        category: t.category || CATEGORIES.OTHER,
      });
    }
  }
  return out;
}

export function getNewMerchants(
  transactions: Transaction[],
  p: Period,
  minAmount: number = 30,
  limit: number = 8
): MerchantSummary[] {
  // A merchant is "new" if it appears in this period and has never appeared
  // in any prior statement month.
  const allByMerchant = new Map<string, Date>();
  for (const t of expensesOnly(transactions)) {
    const existing = allByMerchant.get(t.merchantName);
    if (!existing || t.statementDate < existing) {
      allByMerchant.set(t.merchantName, t.statementDate);
    }
  }
  const current = merchantSummariesInPeriod(transactions, p);
  const periodStart = new Date(p.year, p.month, 1);

  return Array.from(current.values())
    .filter(m => {
      if (m.amount < minAmount) return false;
      const firstSeen = allByMerchant.get(m.merchant);
      // First seen must be inside this period (i.e. same year/month).
      return (
        firstSeen != null &&
        firstSeen.getFullYear() === p.year &&
        firstSeen.getMonth() === p.month
      );
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

export function getLapsedMerchants(
  transactions: Transaction[],
  p: Period,
  lookback: number = 3,
  minAvg: number = 50,
  limit: number = 8
): MerchantSummary[] {
  // A merchant "lapsed" if they spent in each of the last `lookback` months
  // (a regular) but not at all in the current period.
  const monthKeys: string[] = [];
  for (let i = 1; i <= lookback; i++) {
    const d = new Date(p.year, p.month - i, 1);
    monthKeys.push(`${d.getFullYear()}-${d.getMonth()}`);
  }
  const currentKey = `${p.year}-${p.month}`;

  const merchantMonths = new Map<string, Map<string, { amount: number; count: number; category: string }>>();
  for (const t of expensesOnly(transactions)) {
    const k = `${t.statementDate.getFullYear()}-${t.statementDate.getMonth()}`;
    if (!merchantMonths.has(t.merchantName)) merchantMonths.set(t.merchantName, new Map());
    const m = merchantMonths.get(t.merchantName)!;
    const e = m.get(k) || { amount: 0, count: 0, category: t.category || CATEGORIES.OTHER };
    e.amount += t.chargeAmount;
    e.count += 1;
    m.set(k, e);
  }

  const lapsed: MerchantSummary[] = [];
  merchantMonths.forEach((months, merchant) => {
    if (months.has(currentKey)) return;
    const baselineAmounts: number[] = [];
    let lastCategory: string = CATEGORIES.OTHER;
    let lastCount = 0;
    for (const k of monthKeys) {
      const e = months.get(k);
      if (!e) return; // not a regular
      baselineAmounts.push(e.amount);
      lastCategory = e.category;
      lastCount = e.count;
    }
    const avg = mean(baselineAmounts);
    if (avg < minAvg) return;
    lapsed.push({ merchant, amount: avg, count: lastCount, category: lastCategory });
  });

  return lapsed.sort((a, b) => b.amount - a.amount).slice(0, limit);
}

export function getTopMerchantsForPeriod(
  transactions: Transaction[],
  p: Period,
  limit: number = 5
): MerchantSummary[] {
  return Array.from(merchantSummariesInPeriod(transactions, p).values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

export function getBehaviorStats(
  transactions: Transaction[],
  p: Period
): BehaviorStats {
  const expenses = expensesOnly(transactions.filter(t => inPeriod(t, p)));
  const daysInMonth = new Date(p.year, p.month + 1, 0).getDate();

  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === p.year && today.getMonth() === p.month;
  const daysElapsed = isCurrentMonth ? today.getDate() : daysInMonth;

  const spendByDay = new Array(daysInMonth + 1).fill(0);
  for (const t of expenses) {
    const d = t.purchaseDate.getDate();
    if (d >= 1 && d <= daysInMonth) spendByDay[d] += t.chargeAmount;
  }

  let daysWithSpend = 0;
  let longestSpendingStreak = 0;
  let longestDryStreak = 0;
  let curSpend = 0;
  let curDry = 0;
  for (let i = 1; i <= daysElapsed; i++) {
    if (spendByDay[i] > 0) {
      daysWithSpend++;
      curSpend++;
      curDry = 0;
      if (curSpend > longestSpendingStreak) longestSpendingStreak = curSpend;
    } else {
      curDry++;
      curSpend = 0;
      if (curDry > longestDryStreak) longestDryStreak = curDry;
    }
  }

  let weekendSpend = 0;
  let weekdaySpend = 0;
  const dowTotals = new Array(7).fill(0);
  const dowCounts = new Array(7).fill(0);
  for (const t of expenses) {
    const dow = t.purchaseDate.getDay();
    dowTotals[dow] += t.chargeAmount;
    dowCounts[dow] += 1;
    // Israeli weekend = Friday (5) + Saturday (6).
    if (dow === 5 || dow === 6) weekendSpend += t.chargeAmount;
    else weekdaySpend += t.chargeAmount;
  }
  let biggestDow = 0;
  let biggestAvg = 0;
  for (let i = 0; i < 7; i++) {
    const avg = dowCounts[i] > 0 ? dowTotals[i] / dowCounts[i] : 0;
    if (avg > biggestAvg) {
      biggestAvg = avg;
      biggestDow = i;
    }
  }

  const totalCombined = weekendSpend + weekdaySpend;
  return {
    daysWithSpend,
    totalDaysInMonth: daysInMonth,
    daysElapsedInMonth: daysElapsed,
    longestSpendingStreak,
    longestDryStreak,
    weekendSpend,
    weekdaySpend,
    weekendRatio: totalCombined > 0 ? weekendSpend / totalCombined : 0,
    biggestDayName: HEBREW_DOW[biggestDow],
    biggestDayAmount: dowTotals[biggestDow],
  };
}

export function getSubscriptionStats(
  transactions: Transaction[],
  p: Period,
  lookback: number = 4
): SubscriptionStats {
  // Recurring detection: merchant appears in ≥ 3 of the last `lookback` months
  // with at least one charge per matched month.
  const periodKeys: string[] = [];
  for (let i = 0; i < lookback; i++) {
    const d = new Date(p.year, p.month - i, 1);
    periodKeys.push(`${d.getFullYear()}-${d.getMonth()}`);
  }
  const olderKeys: string[] = [];
  for (let i = lookback; i < lookback + 4; i++) {
    const d = new Date(p.year, p.month - i, 1);
    olderKeys.push(`${d.getFullYear()}-${d.getMonth()}`);
  }

  const byMerchant = new Map<
    string,
    {
      monthlyAmounts: Map<string, number>;
      isStanding: boolean;
    }
  >();
  for (const t of expensesOnly(transactions)) {
    const k = `${t.statementDate.getFullYear()}-${t.statementDate.getMonth()}`;
    if (!byMerchant.has(t.merchantName)) {
      byMerchant.set(t.merchantName, { monthlyAmounts: new Map(), isStanding: false });
    }
    const e = byMerchant.get(t.merchantName)!;
    e.monthlyAmounts.set(k, (e.monthlyAmounts.get(k) || 0) + t.chargeAmount);
    if (t.isStandingOrder) e.isStanding = true;
  }

  const recurringNow = new Set<string>();
  let monthlyBase = 0;
  const newRecurring: { merchant: string; amount: number; firstSeen: string }[] = [];

  byMerchant.forEach((e, merchant) => {
    const hitsRecent = periodKeys.filter(k => e.monthlyAmounts.has(k)).length;
    const isRecurring = e.isStanding || hitsRecent >= 3;
    if (!isRecurring) return;
    recurringNow.add(merchant);
    const currentMonthAmount = e.monthlyAmounts.get(periodKeys[0]) || 0;
    monthlyBase += currentMonthAmount;

    // "New" = no charges in any of the older window months.
    const hitsOlder = olderKeys.filter(k => e.monthlyAmounts.has(k)).length;
    if (hitsOlder === 0 && currentMonthAmount > 0) {
      // First month within the recent window where this merchant appears.
      let firstKey = periodKeys[periodKeys.length - 1];
      for (let i = periodKeys.length - 1; i >= 0; i--) {
        if (e.monthlyAmounts.has(periodKeys[i])) firstKey = periodKeys[i];
      }
      newRecurring.push({
        merchant,
        amount: currentMonthAmount || mean(Array.from(e.monthlyAmounts.values())),
        firstSeen: formatMonthKey(firstKey),
      });
    }
  });

  // Stopped: was recurring just before this period but not in current month.
  const stoppedRecurring: { merchant: string; amount: number; lastSeen: string }[] = [];
  byMerchant.forEach((e, merchant) => {
    if (recurringNow.has(merchant)) return;
    // Was it recurring in the 4 months ENDING just before current period?
    const priorWindow: string[] = [];
    for (let i = 1; i <= 4; i++) {
      const d = new Date(p.year, p.month - i, 1);
      priorWindow.push(`${d.getFullYear()}-${d.getMonth()}`);
    }
    const hitsPrior = priorWindow.filter(k => e.monthlyAmounts.has(k)).length;
    const currentHit = e.monthlyAmounts.has(periodKeys[0]);
    if (hitsPrior >= 3 && !currentHit) {
      let lastKey = '';
      for (const k of priorWindow) {
        if (e.monthlyAmounts.has(k)) {
          lastKey = k;
          break;
        }
      }
      const lastAmount = e.monthlyAmounts.get(lastKey) || 0;
      stoppedRecurring.push({
        merchant,
        amount: lastAmount,
        lastSeen: formatMonthKey(lastKey),
      });
    }
  });

  return {
    monthlyBase,
    newRecurring: newRecurring.sort((a, b) => b.amount - a.amount).slice(0, 5),
    stoppedRecurring: stoppedRecurring.sort((a, b) => b.amount - a.amount).slice(0, 5),
    totalRecurringMerchants: recurringNow.size,
  };
}

function formatMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${HEBREW_MONTHS[m]} ${y}`;
}

// Lifestyle keywords — kept narrow on purpose. The categorizer already groups
// LEISURE etc; here we're after specific behavioral counts that the user can
// actually relate to ("you ate out X times").
const COFFEE_KEYWORDS = ['ארומה', 'ארקפה', 'לנדוור', 'גרג', 'קופי', 'cofix', 'קופיקס', 'roladin', 'רולדין', 'starbucks', 'סטארבקס', 'נספרסו', 'nespresso', 'קפה'];
const DELIVERY_KEYWORDS = ['wolt', 'תן ביס', 'משלוח', 'mishloha', 'glovo', 'cibus', 'סיבוס'];
const RESTAURANT_KEYWORDS = ['מסעדה', 'פיצה', 'בורגר', 'סושי', 'גריל', 'שווארמה', 'פלאפל', 'humus', 'חומוס', 'ארוחה', 'בית קפה'];

function matchesAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k.toLowerCase()));
}

export function getLifestyleStats(
  transactions: Transaction[],
  p: Period,
  prev: Period
): LifestyleStats {
  const expensesCur = expensesOnly(transactions.filter(t => inPeriod(t, p)));
  const expensesPrev = expensesOnly(transactions.filter(t => inPeriod(t, prev)));

  let restaurantCount = 0;
  let restaurantTotal = 0;
  let coffeeCount = 0;
  let coffeeTotal = 0;
  let deliveryCount = 0;
  let deliveryTotal = 0;
  let groceryTotal = 0;
  for (const t of expensesCur) {
    const name = t.merchantName + ' ' + (t.additionalInfo || '');
    const isCoffee = matchesAny(name, COFFEE_KEYWORDS);
    const isDelivery = matchesAny(name, DELIVERY_KEYWORDS);
    const isRest = matchesAny(name, RESTAURANT_KEYWORDS);
    if (isCoffee) {
      coffeeCount++;
      coffeeTotal += t.chargeAmount;
    } else if (isDelivery) {
      deliveryCount++;
      deliveryTotal += t.chargeAmount;
      restaurantCount++;
      restaurantTotal += t.chargeAmount;
    } else if (isRest || t.category === CATEGORIES.LEISURE) {
      // Use LEISURE category as a wider safety net for eating/going-out spend
      // because the explicit keyword list will miss long-tail merchant names.
      restaurantCount++;
      restaurantTotal += t.chargeAmount;
    }
    if (t.category === CATEGORIES.FOOD) groceryTotal += t.chargeAmount;
  }

  let restaurantCountPrev = 0;
  for (const t of expensesPrev) {
    const name = t.merchantName + ' ' + (t.additionalInfo || '');
    const isDelivery = matchesAny(name, DELIVERY_KEYWORDS);
    const isRest = matchesAny(name, RESTAURANT_KEYWORDS);
    if (isDelivery || isRest || t.category === CATEGORIES.LEISURE) restaurantCountPrev++;
  }

  const combined = groceryTotal + restaurantTotal;
  return {
    restaurantCount,
    restaurantTotal,
    restaurantCountPrev,
    coffeeCount,
    coffeeTotal,
    deliveryCount,
    deliveryTotal,
    groceryTotal,
    groceryVsRestaurant: combined > 0 ? groceryTotal / combined : 0,
  };
}

export function getAnomalies(
  transactions: Transaction[],
  p: Period,
  lookback: number = 6
): AnomalyStats {
  const txsCur = expensesOnly(transactions.filter(t => inPeriod(t, p)));

  // Build a window of recent monthly amounts to compute mean/stddev for the
  // z-score of the largest transaction.
  const allRecent: number[] = [];
  for (let i = 0; i < lookback; i++) {
    const d = new Date(p.year, p.month - i, 1);
    for (const t of expensesOnly(transactions)) {
      if (
        t.statementDate.getFullYear() === d.getFullYear() &&
        t.statementDate.getMonth() === d.getMonth()
      ) {
        allRecent.push(t.chargeAmount);
      }
    }
  }
  const m = mean(allRecent);
  const sd = stddev(allRecent);

  let largest: Transaction | null = null;
  for (const t of txsCur) {
    if (!largest || t.chargeAmount > largest.chargeAmount) largest = t;
  }
  const z = largest && sd > 0 ? (largest.chargeAmount - m) / sd : 0;

  // Category-level spikes: any category whose current is > mean + 2*sd over
  // last `lookback` months (and at least ₪150 above the mean).
  const allCats = new Set<string>();
  for (const t of expensesOnly(transactions)) {
    allCats.add(t.category || CATEGORIES.OTHER);
  }
  const spiked: AnomalyStats['spikedCategories'] = [];
  allCats.forEach(cat => {
    const monthly: number[] = [];
    for (let i = 1; i <= lookback; i++) {
      const d = new Date(p.year, p.month - i, 1);
      monthly.push(categorySpend(transactions, periodFrom(d.getFullYear(), d.getMonth())).get(cat) || 0);
    }
    const cur = categorySpend(transactions, p).get(cat) || 0;
    const cMean = mean(monthly);
    const cSd = stddev(monthly);
    if (cSd <= 0) return;
    const zc = (cur - cMean) / cSd;
    if (zc >= 2 && cur - cMean >= 150) {
      spiked.push({ category: cat, current: cur, mean: cMean, z: zc });
    }
  });

  return {
    largestTransaction: largest,
    largestZScore: z,
    spikedCategories: spiked.sort((a, b) => b.z - a.z).slice(0, 3),
  };
}

export function getBurnRate(
  transactions: Transaction[],
  p: Period,
  lookback: number = 3
): BurnRateStats {
  const expenses = expensesOnly(transactions.filter(t => inPeriod(t, p)));
  const totalCur = sum(expenses.map(t => t.chargeAmount));
  const daysInMonth = new Date(p.year, p.month + 1, 0).getDate();

  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === p.year && today.getMonth() === p.month;
  const daysElapsed = isCurrentMonth ? today.getDate() : daysInMonth;

  const dailyAverageThisMonth = daysElapsed > 0 ? totalCur / daysElapsed : 0;

  const baselineDaily: number[] = [];
  for (let i = 1; i <= lookback; i++) {
    const d = new Date(p.year, p.month - i, 1);
    const period = periodFrom(d.getFullYear(), d.getMonth());
    const dim = new Date(period.year, period.month + 1, 0).getDate();
    const total = sum(
      expensesOnly(transactions.filter(t => inPeriod(t, period))).map(t => t.chargeAmount)
    );
    if (total > 0) baselineDaily.push(total / dim);
  }
  const typicalDailyAverage = baselineDaily.length > 0 ? mean(baselineDaily) : 0;

  return {
    dailyAverageThisMonth,
    typicalDailyAverage,
    projectedTotal: dailyAverageThisMonth * daysInMonth,
    daysElapsed,
    daysInMonth,
  };
}

// ---------------------------------------------------------------------------
// Top-level summary used by the Statistics page and the AI insights endpoint.
// ---------------------------------------------------------------------------

export function getStatisticsSummary(
  transactions: Transaction[],
  current: Period
): StatisticsSummary {
  const previous = previousPeriod(current);
  const currentTotals = getPeriodTotals(transactions, current);
  const previousTotals = getPeriodTotals(transactions, previous);
  const hasPrevious = previousTotals.transactionCount > 0;

  const totalDelta = currentTotals.total - previousTotals.total;
  const totalPctChange = previousTotals.total > 0
    ? totalDelta / previousTotals.total
    : 0;

  const burnRate = getBurnRate(transactions, current);
  const categoryMovers = getCategoryMovers(transactions, current);
  const topCategoryShares = getCategoryShares(transactions, current, previous);
  const newMerchants = getNewMerchants(transactions, current);
  const lapsedMerchants = getLapsedMerchants(transactions, current);
  const topMerchants = getTopMerchantsForPeriod(transactions, current);
  const topMerchantsConcentration = currentTotals.total > 0
    ? sum(topMerchants.map(m => m.amount)) / currentTotals.total
    : 0;
  const behavior = getBehaviorStats(transactions, current);
  const subscriptions = getSubscriptionStats(transactions, current);
  const lifestyle = getLifestyleStats(transactions, current, previous);
  const anomalies = getAnomalies(transactions, current);

  const savingsRate = currentTotals.income > 0
    ? (currentTotals.income - currentTotals.total) / currentTotals.income
    : null;

  return {
    current,
    previous,
    hasPrevious,
    currentTotals,
    previousTotals,
    totalDelta,
    totalPctChange,
    burnRate,
    categoryMovers,
    topCategoryShares,
    newMerchants,
    lapsedMerchants,
    topMerchants,
    topMerchantsConcentration,
    behavior,
    subscriptions,
    lifestyle,
    anomalies,
    savingsRate,
  };
}

// Latest statement month that actually has expense transactions. Falls back
// to the most recent statement date if no expenses exist.
export function getLatestStatementPeriod(transactions: Transaction[]): Period | null {
  if (transactions.length === 0) return null;
  const months = new Set<string>();
  for (const t of expensesOnly(transactions)) {
    months.add(`${t.statementDate.getFullYear()}-${t.statementDate.getMonth()}`);
  }
  if (months.size === 0) return null;
  let latest: { y: number; m: number } | null = null;
  months.forEach(k => {
    const [y, m] = k.split('-').map(Number);
    if (!latest || y > latest.y || (y === latest.y && m > latest.m)) {
      latest = { y, m };
    }
  });
  return latest ? periodFrom(latest.y, latest.m) : null;
}

export function getAvailableStatementMonths(transactions: Transaction[]): Period[] {
  const months = new Set<string>();
  for (const t of expensesOnly(transactions)) {
    months.add(`${t.statementDate.getFullYear()}-${t.statementDate.getMonth()}`);
  }
  return Array.from(months)
    .map(k => {
      const [y, m] = k.split('-').map(Number);
      return periodFrom(y, m);
    })
    .sort((a, b) => (a.year !== b.year ? b.year - a.year : b.month - a.month));
}

// Compact, AI-friendly payload of the summary — small numbers rounded, no
// raw transaction blobs. Sent to /api/insights so the model has just enough
// context to reason without us shipping the user's whole CSV.
export function buildAIPayload(s: StatisticsSummary): Record<string, unknown> {
  return {
    period: s.current.label,
    previousPeriod: s.previous.label,
    hasPrevious: s.hasPrevious,
    totals: {
      current: Math.round(s.currentTotals.total),
      previous: Math.round(s.previousTotals.total),
      delta: Math.round(s.totalDelta),
      pctChange: Number((s.totalPctChange * 100).toFixed(1)),
      transactions: s.currentTotals.transactionCount,
      avgTransaction: Math.round(s.currentTotals.avgTransaction),
      uniqueMerchants: s.currentTotals.uniqueMerchants,
      income: Math.round(s.currentTotals.income),
      savingsRatePct:
        s.savingsRate == null ? null : Number((s.savingsRate * 100).toFixed(1)),
    },
    burnRate: {
      currentDailyAvg: Math.round(s.burnRate.dailyAverageThisMonth),
      typicalDailyAvg: Math.round(s.burnRate.typicalDailyAverage),
      projectedMonthlyTotal: Math.round(s.burnRate.projectedTotal),
      daysElapsed: s.burnRate.daysElapsed,
      daysInMonth: s.burnRate.daysInMonth,
    },
    categoryMovers: s.categoryMovers.map(m => ({
      category: m.category,
      current: Math.round(m.current),
      baseline3moAvg: Math.round(m.baseline),
      delta: Math.round(m.delta),
      pctChange:
        m.pctChange === Infinity ? null : Number((m.pctChange * 100).toFixed(1)),
      isHighestEver: m.isHighestEver,
    })),
    topCategoryShares: s.topCategoryShares.map(c => ({
      category: c.category,
      sharePct: Number((c.share * 100).toFixed(1)),
      previousSharePct: Number((c.prevShare * 100).toFixed(1)),
    })),
    topMerchants: s.topMerchants.map(m => ({
      merchant: m.merchant,
      category: m.category,
      amount: Math.round(m.amount),
      count: m.count,
    })),
    topMerchantConcentrationPct: Number(
      (s.topMerchantsConcentration * 100).toFixed(1)
    ),
    newMerchants: s.newMerchants.slice(0, 6).map(m => ({
      merchant: m.merchant,
      amount: Math.round(m.amount),
      count: m.count,
    })),
    lapsedMerchants: s.lapsedMerchants.slice(0, 6).map(m => ({
      merchant: m.merchant,
      typicalAmount: Math.round(m.amount),
    })),
    behavior: {
      daysWithSpend: s.behavior.daysWithSpend,
      daysElapsed: s.behavior.daysElapsedInMonth,
      longestSpendingStreak: s.behavior.longestSpendingStreak,
      longestDryStreak: s.behavior.longestDryStreak,
      weekendSharePct: Number((s.behavior.weekendRatio * 100).toFixed(1)),
      biggestDayName: s.behavior.biggestDayName,
    },
    subscriptions: {
      monthlyBase: Math.round(s.subscriptions.monthlyBase),
      activeCount: s.subscriptions.totalRecurringMerchants,
      newRecurring: s.subscriptions.newRecurring.map(r => ({
        merchant: r.merchant,
        amount: Math.round(r.amount),
        firstSeen: r.firstSeen,
      })),
      stoppedRecurring: s.subscriptions.stoppedRecurring.map(r => ({
        merchant: r.merchant,
        lastAmount: Math.round(r.amount),
        lastSeen: r.lastSeen,
      })),
    },
    lifestyle: {
      restaurantOrDeliveryCount: s.lifestyle.restaurantCount,
      restaurantOrDeliveryTotal: Math.round(s.lifestyle.restaurantTotal),
      restaurantCountPrevious: s.lifestyle.restaurantCountPrev,
      coffeeVisits: s.lifestyle.coffeeCount,
      coffeeTotal: Math.round(s.lifestyle.coffeeTotal),
      deliveryCount: s.lifestyle.deliveryCount,
      deliveryTotal: Math.round(s.lifestyle.deliveryTotal),
      grocerySharePct: Number((s.lifestyle.groceryVsRestaurant * 100).toFixed(1)),
    },
    anomalies: {
      largestTransaction: s.anomalies.largestTransaction
        ? {
            merchant: s.anomalies.largestTransaction.merchantName,
            amount: Math.round(s.anomalies.largestTransaction.chargeAmount),
            category: s.anomalies.largestTransaction.category,
            zScoreVsRecent: Number(s.anomalies.largestZScore.toFixed(2)),
          }
        : null,
      spikedCategories: s.anomalies.spikedCategories.map(c => ({
        category: c.category,
        current: Math.round(c.current),
        recentMean: Math.round(c.mean),
        z: Number(c.z.toFixed(2)),
      })),
    },
  };
}
