import { useMemo, useState } from 'react';
import { CreditCard, TrendingDown, TrendingUp, Calendar, Store, Repeat, Wallet, Receipt } from 'lucide-react';
import { Transaction, ViewMode } from '@/types/transaction';
import { MetricCard } from './MetricCard';
import { ViewToggle } from './ViewToggle';
import { PeriodSelector } from './PeriodSelector';
import { ChartCard } from './ChartCard';
import { WeeklyPieChart } from './charts/WeeklyPieChart';
import { DailyBarChart } from './charts/DailyBarChart';
import { MonthlyPieChart } from './charts/MonthlyPieChart';
import { TrendLineChart } from './charts/TrendLineChart';
import { TransactionTable } from './TransactionTable';
import { TopMerchants } from './TopMerchants';
import { BudgetProgress } from './BudgetProgress';
import { LargestTransactions } from './LargestTransactions';
import { useMonthlyBudget } from '@/utils/budgets';
import { CategoryPieChart } from './charts/CategoryPieChart';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES } from '@/utils/categories';
import { Filter } from 'lucide-react';
import {
  calculateTotalSpending,
  calculateDailyAverage,
  calculateStandingOrdersTotal,
  getTopMerchant,
  getWeeklyBreakdown,
  getDailyBreakdown,
  getMonthlyBreakdown,
  getMonthlyTrend,
  getTopMerchants,
  filterTransactionsByPeriod,
  getAvailableYears,
  getAvailableMonths,
  getCategoryBreakdown,
  getRecurringMerchantNames,
  getCategorySpending,
  forecastMonthlyTotal,
  getLargestTransactions,
  projectCategoryBudgets,
} from '@/utils/analytics';

interface DashboardProps {
  transactions: Transaction[];
  onCategoryChange: (id: string, newCategory: string) => void;
  onBatchCategoryChange?: (merchantCategoryMap: Map<string, string>) => void;
}

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

export function Dashboard({ transactions, onCategoryChange, onBatchCategoryChange }: DashboardProps) {
  const availableYears = useMemo(() => getAvailableYears(transactions), [transactions]);
  const [selectedYear, setSelectedYear] = useState(availableYears[0] || new Date().getFullYear());
  
  const availableMonths = useMemo(() => 
    getAvailableMonths(transactions, selectedYear), 
    [transactions, selectedYear]
  );
  const [selectedMonth, setSelectedMonth] = useState(availableMonths[availableMonths.length - 1] ?? 0);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [pieMode, setPieMode] = useState<'time' | 'category'>('time');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Filtered transactions based on view mode and category
  const filteredTransactions = useMemo(() => {
    let filtered = filterTransactionsByPeriod(
      transactions, 
      viewMode === 'month' ? selectedMonth : null, 
      selectedYear
    );

    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }

    return filtered;
  }, [transactions, viewMode, selectedMonth, selectedYear, selectedCategory]);

  // Calculate metrics
  const totalSpending = useMemo(() => 
    calculateTotalSpending(filteredTransactions), 
    [filteredTransactions]
  );

  const daysInPeriod = useMemo(() => {
    if (viewMode === 'month') {
      return new Date(selectedYear, selectedMonth + 1, 0).getDate();
    }
    // For year view, count actual days with transactions
    const now = new Date();
    if (selectedYear === now.getFullYear()) {
      const startOfYear = new Date(selectedYear, 0, 1);
      return Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    }
    return 365;
  }, [viewMode, selectedMonth, selectedYear]);

  const dailyAverage = useMemo(() => 
    calculateDailyAverage(filteredTransactions, daysInPeriod),
    [filteredTransactions, daysInPeriod]
  );

  const recurringMerchants = useMemo(
    () => getRecurringMerchantNames(transactions),
    [transactions]
  );

  const standingOrdersTotal = useMemo(() =>
    calculateStandingOrdersTotal(filteredTransactions, recurringMerchants),
    [filteredTransactions, recurringMerchants]
  );

  // Chart data
  const weeklyData = useMemo(() => 
    getWeeklyBreakdown(filteredTransactions, selectedMonth, selectedYear),
    [filteredTransactions, selectedMonth, selectedYear]
  );

  const dailyData = useMemo(() => 
    getDailyBreakdown(filteredTransactions, selectedMonth, selectedYear),
    [filteredTransactions, selectedMonth, selectedYear]
  );

  const monthlyData = useMemo(() => 
    getMonthlyBreakdown(transactions, selectedYear),
    [transactions, selectedYear]
  );

  const trendData = useMemo(() => 
    getMonthlyTrend(transactions, selectedYear),
    [transactions, selectedYear]
  );

  const categoryData = useMemo(() => 
    getCategoryBreakdown(filteredTransactions),
    [filteredTransactions]
  );

  const topMerchants = useMemo(() =>
    getTopMerchants(filteredTransactions, 6),
    [filteredTransactions]
  );

  const { total: monthlyBudgetTotal } = useMonthlyBudget();

  const categorySpending = useMemo(
    () => getCategorySpending(filteredTransactions),
    [filteredTransactions]
  );

  // Derive per-category budget amounts from the single total and history.
  // Categories never spent on in the lookback simply get no allocation
  // (BudgetProgress hides them).
  const projectedBudgets = useMemo(
    () =>
      projectCategoryBudgets(
        transactions,
        monthlyBudgetTotal,
        selectedYear,
        selectedMonth
      ),
    [transactions, monthlyBudgetTotal, selectedYear, selectedMonth]
  );

  // Forecast applies the filtered slice (matches the metric value when a
  // category filter is active). Monthly view only.
  const forecastTotal = useMemo(() => {
    if (viewMode !== 'month') return null;
    return forecastMonthlyTotal(filteredTransactions, selectedYear, selectedMonth);
  }, [filteredTransactions, selectedYear, selectedMonth, viewMode]);

  // YoY compares this period's filtered slice to last year's same-month slice
  // under the same category filter. Inline (rather than going through the
  // analytics helper) so the comparison set respects the active filter.
  const yoy = useMemo(() => {
    if (viewMode !== 'month') return null;
    const lastYear = transactions.filter(
      t =>
        t.statementDate.getFullYear() === selectedYear - 1 &&
        t.statementDate.getMonth() === selectedMonth &&
        (selectedCategory === 'all' || t.category === selectedCategory)
    );
    if (lastYear.length === 0) return null;
    const lastYearAmount = lastYear.reduce((s, t) => s + t.chargeAmount, 0);
    if (lastYearAmount <= 0) return null;
    const currentAmount = filteredTransactions.reduce((s, t) => s + t.chargeAmount, 0);
    const delta = currentAmount - lastYearAmount;
    return {
      lastYearAmount,
      delta,
      percentDelta: (delta / lastYearAmount) * 100,
    };
  }, [filteredTransactions, transactions, selectedMonth, selectedYear, selectedCategory, viewMode]);

  const largestTransactions = useMemo(
    () => getLargestTransactions(filteredTransactions, 5),
    [filteredTransactions]
  );

  const periodLabel = viewMode === 'month'
    ? `${HEBREW_MONTHS[selectedMonth]} ${selectedYear}`
    : `שנת ${selectedYear}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">מעקב הוצאות</h1>
          <p className="text-muted-foreground mt-1">{periodLabel}</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
             <SelectTrigger className="w-[220px] bg-background">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="סינון סוג" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל העסקאות</SelectItem>
              {Object.values(CATEGORIES).map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <PeriodSelector
            viewMode={viewMode}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            availableYears={availableYears}
            availableMonths={availableMonths}
            onYearChange={setSelectedYear}
            onMonthChange={setSelectedMonth}
          />
          <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          title="סה״כ הוצאות"
          value={totalSpending}
          icon={<CreditCard className="h-6 w-6" />}
          variant="spending"
          delay={0}
          footer={
            (forecastTotal != null || yoy != null) ? (
              <>
                {forecastTotal != null && (
                  <p className="truncate">
                    צפי לסוף חודש:{' '}
                    <span className="font-medium text-foreground tabular-nums">
                      {forecastTotal.toLocaleString('he-IL', {
                        style: 'currency',
                        currency: 'ILS',
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </p>
                )}
                {yoy != null && (
                  <p className="flex items-center gap-1 truncate">
                    <span>שנה שעברה:</span>
                    <span className="font-medium text-foreground tabular-nums">
                      {yoy.lastYearAmount.toLocaleString('he-IL', {
                        style: 'currency',
                        currency: 'ILS',
                        maximumFractionDigits: 0,
                      })}
                    </span>
                    <span
                      className={
                        yoy.delta >= 0
                          ? 'text-destructive flex items-center gap-0.5'
                          : 'text-emerald-600 flex items-center gap-0.5'
                      }
                    >
                      {yoy.delta >= 0 ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5" />
                      )}
                      {`${yoy.delta >= 0 ? '+' : ''}${yoy.percentDelta.toFixed(0)}%`}
                    </span>
                  </p>
                )}
              </>
            ) : undefined
          }
        />
        <MetricCard
          title="ממוצע יומי"
          value={dailyAverage}
          subtitle={`${daysInPeriod} ימים`}
          icon={<TrendingDown className="h-6 w-6" />}
          variant="primary"
          delay={50}
        />
        <MetricCard
          title="הוראות קבע"
          value={standingOrdersTotal}
          icon={<Repeat className="h-6 w-6" />}
          variant="savings"
          delay={100}
        />
      </div>

      {/* Budget Progress (monthly view only) */}
      {viewMode === 'month' && (
        <BudgetProgress
          budgets={Object.fromEntries(projectedBudgets)}
          categorySpending={categorySpending}
          monthlyBudgetTotal={monthlyBudgetTotal}
        />
      )}

      {/* Main Charts & Top Merchants Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top Merchants (25%) */}
        <ChartCard 
          title="בתי עסק מובילים" 
          subtitle="6 בתי העסק עם ההוצאות הגבוהות ביותר"
          delay={200}
          className="lg:col-span-3"
        >
          <TopMerchants merchants={topMerchants} />
        </ChartCard>

        {viewMode === 'month' ? (
          <>
            {/* Pie Chart (25%) with Toggle */}
            <ChartCard 
              title={pieMode === 'time' ? "התפלגות שבועית" : "התפלגות לפי קטגוריה"}
              subtitle={pieMode === 'time' ? "הוצאות לפי שבוע בחודש" : "הוצאות לפי סוג"}
              delay={250}
              className="lg:col-span-3"
              action={
                <Tabs value={pieMode} onValueChange={(v) => setPieMode(v as 'time' | 'category')} className="w-[100px]">
                  <TabsList className="grid w-full grid-cols-2 h-8">
                    <TabsTrigger value="time" className="text-xs px-1">זמן</TabsTrigger>
                    <TabsTrigger value="category" className="text-xs px-1">סוג</TabsTrigger>
                  </TabsList>
                </Tabs>
              }
            >
              {pieMode === 'time' ? (
                <WeeklyPieChart data={weeklyData} />
              ) : (
                <CategoryPieChart 
                  data={categoryData}
                  onCategoryClick={(category) => setSelectedCategory(category)}
                />
              )}
            </ChartCard>
            
            {/* Daily Bar (50%) */}
            <ChartCard 
              title="הוצאות יומיות" 
              subtitle="פעילות יומית לאורך החודש"
              delay={300}
              className="lg:col-span-6"
            >
              <DailyBarChart data={dailyData} onDayClick={setSelectedDay} />
            </ChartCard>
          </>
        ) : (
          <>
            {/* Pie Chart (25%) with Toggle */}
            <ChartCard 
              title={pieMode === 'time' ? "התפלגות חודשית" : "התפלגות לפי קטגוריה"}
              subtitle={pieMode === 'time' ? "הוצאות לפי חודש (לחץ למעבר)" : "הוצאות לפי סוג"}
              delay={250}
              className="lg:col-span-3"
              action={
                <Tabs value={pieMode} onValueChange={(v) => setPieMode(v as 'time' | 'category')} className="w-[100px]">
                  <TabsList className="grid w-full grid-cols-2 h-8">
                    <TabsTrigger value="time" className="text-xs px-1">זמן</TabsTrigger>
                    <TabsTrigger value="category" className="text-xs px-1">סוג</TabsTrigger>
                  </TabsList>
                </Tabs>
              }
            >
              {pieMode === 'time' ? (
                <MonthlyPieChart 
                  data={monthlyData} 
                  onMonthClick={(monthName) => {
                    const monthIndex = HEBREW_MONTHS.indexOf(monthName);
                    if (monthIndex !== -1) {
                      setSelectedMonth(monthIndex);
                      setViewMode('month');
                    }
                  }}
                />
              ) : (
                <CategoryPieChart 
                  data={categoryData}
                  onCategoryClick={(category) => setSelectedCategory(category)}
                />
              )}
            </ChartCard>

            {/* Trend Line (50%) */}
            <ChartCard 
              title="מגמת הוצאות" 
              subtitle="התפתחות ההוצאות לאורך השנה"
              delay={300}
              className="lg:col-span-6"
            >
              <TrendLineChart data={trendData} />
            </ChartCard>
          </>
        )}
      </div>

      {/* Largest single transactions */}
      <ChartCard
        title="עסקאות גדולות"
        subtitle="5 העסקאות הבודדות הגדולות בתקופה"
        delay={350}
      >
        <LargestTransactions transactions={largestTransactions} />
      </ChartCard>

      {/* Transaction Table */}
      <TransactionTable
        transactions={filteredTransactions}
        onCategoryChange={onCategoryChange}
        onBatchCategoryChange={onBatchCategoryChange}
      />

      <DayDetailDialog
        day={selectedDay}
        month={selectedMonth}
        year={selectedYear}
        transactions={filteredTransactions}
        onClose={() => setSelectedDay(null)}
      />
    </div>
  );
}

interface DayDetailDialogProps {
  day: number | null;
  month: number;
  year: number;
  transactions: Transaction[];
  onClose: () => void;
}

function DayDetailDialog({ day, month, year, transactions, onClose }: DayDetailDialogProps) {
  const dayTransactions = useMemo(() => {
    if (day == null) return [];
    return transactions
      .filter(t =>
        t.purchaseDate.getDate() === day &&
        t.purchaseDate.getMonth() === month &&
        t.purchaseDate.getFullYear() === year
      )
      .sort((a, b) => b.chargeAmount - a.chargeAmount);
  }, [day, month, year, transactions]);

  const total = useMemo(
    () => dayTransactions.reduce((sum, t) => sum + t.chargeAmount, 0),
    [dayTransactions]
  );

  const formatCurrency = (n: number) =>
    n.toLocaleString('he-IL', { style: 'currency', currency: 'ILS' });

  return (
    <Dialog open={day != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {day != null && `${day} ${HEBREW_MONTHS[month]} ${year}`}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {dayTransactions.length === 0
              ? 'אין עסקאות ביום זה'
              : `${dayTransactions.length} עסקאות · סה״כ ${formatCurrency(total)}`}
          </p>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6">
          {dayTransactions.length > 0 && (
            <ul className="divide-y divide-border">
              {dayTransactions.map(t => (
                <li key={t.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground truncate">{t.merchantName}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">{t.category}</Badge>
                      {t.isStandingOrder && (
                        <Badge variant="outline" className="text-xs">הוראת קבע</Badge>
                      )}
                      {t.installments && (
                        <Badge variant="outline" className="text-xs">
                          תשלום {t.installments.current}/{t.installments.total}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-sm font-semibold whitespace-nowrap">
                    {formatCurrency(t.chargeAmount)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
