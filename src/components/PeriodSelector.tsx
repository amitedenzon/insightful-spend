import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ViewMode } from '@/types/transaction';

interface PeriodSelectorProps {
  viewMode: ViewMode;
  selectedYear: number;
  selectedMonth: number;
  availableYears: number[];
  availableMonths: number[];
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
}

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

export function PeriodSelector({
  viewMode,
  selectedYear,
  selectedMonth,
  availableYears,
  availableMonths,
  onYearChange,
  onMonthChange,
}: PeriodSelectorProps) {
  return (
    <div className="flex gap-3">
      <Select
        value={selectedYear.toString()}
        onValueChange={(v) => onYearChange(parseInt(v))}
      >
        <SelectTrigger className="w-[120px] bg-background">
          <SelectValue placeholder="בחר שנה" />
        </SelectTrigger>
        <SelectContent>
          {availableYears.map(year => (
            <SelectItem key={year} value={year.toString()}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {viewMode === 'month' && (
        <Select
          value={selectedMonth.toString()}
          onValueChange={(v) => onMonthChange(parseInt(v))}
        >
          <SelectTrigger className="w-[140px] bg-background">
            <SelectValue placeholder="בחר חודש" />
          </SelectTrigger>
          <SelectContent>
            {availableMonths.map(month => (
              <SelectItem key={month} value={month.toString()}>
                {HEBREW_MONTHS[month]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
