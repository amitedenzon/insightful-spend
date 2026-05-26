import { useMemo, useState } from 'react';
import { CreditCard, TrendingDown, Calendar, Store, Repeat, Wallet } from 'lucide-react';
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
import { CategoryPieChart } from './charts/CategoryPieChart';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
              <DailyBarChart data={dailyData} />
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

      {/* Transaction Table */}
      <TransactionTable 
        transactions={filteredTransactions} 
        onCategoryChange={onCategoryChange} 
        onBatchCategoryChange={onBatchCategoryChange}
      />
    </div>
  );
}
