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
import { StandingOrdersList } from './StandingOrdersList';
import { RecurrentPayments } from './RecurrentPayments';
import { TopMerchants } from './TopMerchants';
import {
  calculateTotalSpending,
  calculateDailyAverage,
  calculateStandingOrdersTotal,
  getTopMerchant,
  getWeeklyBreakdown,
  getDailyBreakdown,
  getMonthlyBreakdown,
  getMonthlyTrend,
  findRecurrentPayments,
  getTopMerchants,
  filterTransactionsByPeriod,
  getAvailableYears,
  getAvailableMonths,
} from '@/utils/analytics';

interface DashboardProps {
  transactions: Transaction[];
}

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

export function Dashboard({ transactions }: DashboardProps) {
  const availableYears = useMemo(() => getAvailableYears(transactions), [transactions]);
  const [selectedYear, setSelectedYear] = useState(availableYears[0] || new Date().getFullYear());
  
  const availableMonths = useMemo(() => 
    getAvailableMonths(transactions, selectedYear), 
    [transactions, selectedYear]
  );
  const [selectedMonth, setSelectedMonth] = useState(availableMonths[availableMonths.length - 1] ?? 0);
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  // Filtered transactions based on view mode
  const filteredTransactions = useMemo(() => 
    filterTransactionsByPeriod(
      transactions, 
      viewMode === 'month' ? selectedMonth : null, 
      selectedYear
    ),
    [transactions, viewMode, selectedMonth, selectedYear]
  );

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

  const standingOrdersTotal = useMemo(() => 
    calculateStandingOrdersTotal(filteredTransactions),
    [filteredTransactions]
  );

  const topMerchant = useMemo(() => 
    getTopMerchant(filteredTransactions),
    [filteredTransactions]
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

  const recurrentPayments = useMemo(() => 
    findRecurrentPayments(transactions),
    [transactions]
  );

  const topMerchants = useMemo(() => 
    getTopMerchants(filteredTransactions, 5),
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
          <h1 className="text-3xl font-bold text-foreground">דשבורד פיננסי</h1>
          <p className="text-muted-foreground mt-1">{periodLabel}</p>
        </div>
        <div className="flex items-center gap-4">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <MetricCard
          title="בית עסק מוביל"
          value={topMerchant?.name || 'אין נתונים'}
          subtitle={topMerchant ? topMerchant.total.toLocaleString('he-IL', { style: 'currency', currency: 'ILS' }) : undefined}
          icon={<Store className="h-6 w-6" />}
          variant="default"
          delay={150}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {viewMode === 'month' ? (
          <>
            <ChartCard 
              title="התפלגות שבועית" 
              subtitle="הוצאות לפי שבוע בחודש"
              delay={200}
            >
              <WeeklyPieChart data={weeklyData} />
            </ChartCard>
            <ChartCard 
              title="הוצאות יומיות" 
              subtitle="פעילות יומית לאורך החודש"
              delay={250}
            >
              <DailyBarChart data={dailyData} />
            </ChartCard>
          </>
        ) : (
          <>
            <ChartCard 
              title="התפלגות חודשית" 
              subtitle="הוצאות לפי חודש (לחץ למעבר)"
              delay={200}
            >
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
            </ChartCard>
            <ChartCard 
              title="מגמת הוצאות" 
              subtitle="התפתחות ההוצאות לאורך השנה"
              delay={250}
            >
              <TrendLineChart data={trendData} />
            </ChartCard>
          </>
        )}
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard 
          title="בתי עסק מובילים" 
          subtitle="5 בתי העסק עם ההוצאות הגבוהות ביותר"
          delay={300}
        >
          <TopMerchants merchants={topMerchants} />
        </ChartCard>
        
        <ChartCard 
          title="הוראות קבע" 
          subtitle="תשלומים קבועים שזוהו"
          delay={350}
        >
          <StandingOrdersList transactions={filteredTransactions} />
        </ChartCard>

        <ChartCard 
          title="תשלומים חוזרים" 
          subtitle="בתי עסק עם חיובים דומים בכל חודש"
          delay={400}
        >
          <RecurrentPayments payments={recurrentPayments} />
        </ChartCard>
      </div>

      {/* Transaction Table */}
      <TransactionTable transactions={filteredTransactions} />
    </div>
  );
}
