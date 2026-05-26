export interface Transaction {
  id: string;
  purchaseDate: Date;
  statementDate: Date;
  merchantName: string;
  chargeAmount: number;
  currency: string;
  additionalInfo: string;
  isStandingOrder: boolean;
  installments?: {
    current: number;
    total: number;
  };
  category: string;
}

export interface MonthlyData {
  month: number;
  year: number;
  transactions: Transaction[];
  totalSpending: number;
  standingOrdersTotal: number;
}

export interface WeeklyData {
  week: number;
  label: string;
  amount: number;
}

export interface DailyData {
  day: number;
  date: string;
  amount: number;
}

export interface MerchantData {
  name: string;
  total: number;
  count: number;
}

export interface RecurrentPayment {
  merchantName: string;
  averageAmount: number;
  months: string[];
  frequency: number;
}

export interface PaymentChange {
  merchantName: string;
  currentAmount: number;
  baselineAmount: number;
  delta: number;
  baselineMonthCount: number;
}

export type ViewMode = 'month' | 'year';
