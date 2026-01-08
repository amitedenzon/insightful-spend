import { Transaction, WeeklyData, DailyData, MerchantData, RecurrentPayment } from '@/types/transaction';

export function calculateTotalSpending(transactions: Transaction[]): number {
  return transactions.reduce((sum, t) => sum + t.chargeAmount, 0);
}

export function calculateDailyAverage(transactions: Transaction[], daysInPeriod: number): number {
  const total = calculateTotalSpending(transactions);
  return daysInPeriod > 0 ? total / daysInPeriod : 0;
}

export function calculateStandingOrdersTotal(transactions: Transaction[]): number {
  return transactions
    .filter(t => t.isStandingOrder)
    .reduce((sum, t) => sum + t.chargeAmount, 0);
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
      t.purchaseDate.getMonth() === index && t.purchaseDate.getFullYear() === year
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

  // Group transactions by merchant and month, SUMMING amounts
  transactions.forEach(t => {
    const monthKey = `${t.purchaseDate.getFullYear()}-${t.purchaseDate.getMonth() + 1}`;
    
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
    const tYear = t.purchaseDate.getFullYear();
    const tMonth = t.purchaseDate.getMonth();
    
    if (month === null) {
      return tYear === year;
    }
    return tYear === year && tMonth === month;
  });
}

export function getAvailableYears(transactions: Transaction[]): number[] {
  const years = new Set<number>();
  transactions.forEach(t => years.add(t.purchaseDate.getFullYear()));
  return Array.from(years).sort((a, b) => b - a);
}

export function getAvailableMonths(transactions: Transaction[], year: number): number[] {
  const months = new Set<number>();
  transactions
    .filter(t => t.purchaseDate.getFullYear() === year)
    .forEach(t => months.add(t.purchaseDate.getMonth()));
  return Array.from(months).sort((a, b) => a - b);
}
