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
  getRecurringMerchantNames,
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

  const recurringMerchants = useMemo(
    () => getRecurringMerchantNames(transactions),
    [transactions]
  );

  const recurrentPayments = useMemo(
    () => findRecurrentPayments(transactions),
    [transactions]
  );

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">תשלומים חוזרים</h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">{periodLabel}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="הוראות קבע"
          subtitle="תשלומים קבועים שזוהו"
          delay={0}
        >
          <StandingOrdersList
            transactions={filteredTransactions}
            recurringMerchants={recurringMerchants}
          />
        </ChartCard>

        <ChartCard
          title="תשלומים חוזרים"
          subtitle="בתי עסק עם חיובים דומים בכל חודש"
          delay={50}
        >
          <RecurrentPayments payments={recurrentPayments} />
        </ChartCard>

        <ChartCard
          title="פריסת תשלומים"
          subtitle="מעקב אחרי עסקאות בתשלומים"
          delay={100}
        >
          <InstallmentsList
            transactions={filteredTransactions}
            isYearlyView={viewMode !== 'month'}
          />
        </ChartCard>

        <ChartCard
          title="תשלומים שהשתנו"
          subtitle="הפרשים מהממוצע של החודשים האחרונים"
          delay={150}
        >
          <PaymentChanges
            changes={paymentChanges}
            disabled={viewMode !== 'month'}
          />
        </ChartCard>
      </div>
    </div>
  );
};

export default RecurringPaymentsPage;
