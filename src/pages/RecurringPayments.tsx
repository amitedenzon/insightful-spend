import { useMemo, useState } from 'react';
import { FileQuestion } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Transaction, ViewMode } from '@/types/transaction';
import { Button } from '@/components/ui/button';
import { ChartCard } from '@/components/ChartCard';
import { PeriodSelector } from '@/components/PeriodSelector';
import { ViewToggle } from '@/components/ViewToggle';
import { StandingOrdersList } from '@/components/StandingOrdersList';
import { RecurrentPayments } from '@/components/RecurrentPayments';
import { InstallmentsList } from '@/components/InstallmentsList';
import { PaymentChanges } from '@/components/PaymentChanges';
import {
  filterTransactionsByPeriod,
  getAvailableYears,
  getAvailableMonths,
  findRecurrentPayments,
  findPaymentChanges,
} from '@/utils/analytics';

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

interface RecurringPaymentsPageProps {
  transactions: Transaction[];
}

const RecurringPaymentsPage = ({ transactions }: RecurringPaymentsPageProps) => {
  const navigate = useNavigate();

  const availableYears = useMemo(() => getAvailableYears(transactions), [transactions]);
  const [selectedYear, setSelectedYear] = useState(
    availableYears[0] || new Date().getFullYear()
  );

  const availableMonths = useMemo(
    () => getAvailableMonths(transactions, selectedYear),
    [transactions, selectedYear]
  );
  const [selectedMonth, setSelectedMonth] = useState(
    availableMonths[availableMonths.length - 1] ?? 0
  );
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  const filteredTransactions = useMemo(
    () =>
      filterTransactionsByPeriod(
        transactions,
        viewMode === 'month' ? selectedMonth : null,
        selectedYear
      ),
    [transactions, viewMode, selectedMonth, selectedYear]
  );

  const recurrentPayments = useMemo(() => {
    const all = findRecurrentPayments(transactions);
    // Only show merchants that actually charged in the selected period —
    // a merchant that was recurring earlier this year but has since stopped
    // should not appear when viewing a later month.
    if (viewMode === 'month') {
      const key = `${selectedYear}-${selectedMonth + 1}`;
      return all.filter(p => p.months.includes(key));
    }
    const yearPrefix = `${selectedYear}-`;
    return all.filter(p => p.months.some(m => m.startsWith(yearPrefix)));
  }, [transactions, viewMode, selectedMonth, selectedYear]);

  const paymentChanges = useMemo(
    () => findPaymentChanges(transactions, selectedMonth, selectedYear),
    [transactions, selectedMonth, selectedYear]
  );

  if (transactions.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <FileQuestion className="h-16 w-16 mx-auto text-muted-foreground" />
          <h2 className="text-2xl font-bold text-foreground">אין נתונים להצגה</h2>
          <p className="text-muted-foreground">יש להעלות קבצי CSV תחילה</p>
          <Button onClick={() => navigate('/upload')} className="mt-4">
            העלה קבצים
          </Button>
        </div>
      </div>
    );
  }

  const periodLabel = viewMode === 'month'
    ? `${HEBREW_MONTHS[selectedMonth]} ${selectedYear}`
    : `שנת ${selectedYear}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">תשלומים חוזרים</h1>
          <p className="text-muted-foreground text-sm">{periodLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Top row — both cards share a fixed height so the page never grows
            past the viewport; scrolling stays inside each list. */}
        <ChartCard
          title="הוראות קבע"
          subtitle="חיובים שסומנו בדפי החשבון כ-הוראת קבע"
          delay={0}
          className="lg:h-[300px] lg:flex lg:flex-col"
        >
          <div className="flex-1 min-h-0">
            <StandingOrdersList transactions={filteredTransactions} />
          </div>
        </ChartCard>

        <ChartCard
          title="פריסת תשלומים"
          subtitle="מעקב אחרי עסקאות בתשלומים"
          delay={50}
          className="lg:h-[300px] lg:flex lg:flex-col"
        >
          <div className="flex-1 min-h-0">
            <InstallmentsList
              transactions={filteredTransactions}
              isYearlyView={viewMode !== 'month'}
            />
          </div>
        </ChartCard>

        {/* Bottom row */}
        <ChartCard
          title="תשלומים חוזרים"
          subtitle="בתי עסק עם חיובים דומים בכל חודש"
          delay={100}
          className="lg:h-[300px] lg:flex lg:flex-col"
        >
          <div className="flex-1 min-h-0">
            <RecurrentPayments payments={recurrentPayments} />
          </div>
        </ChartCard>

        <ChartCard
          title="תשלומים שהשתנו"
          subtitle="הפרשים מהממוצע של החודשים האחרונים"
          delay={150}
          className="lg:h-[300px] lg:flex lg:flex-col"
        >
          <div className="flex-1 min-h-0">
            <PaymentChanges
              changes={paymentChanges}
              disabled={viewMode !== 'month'}
            />
          </div>
        </ChartCard>
      </div>
    </div>
  );
};

export default RecurringPaymentsPage;
