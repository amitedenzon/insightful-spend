import { TrendingUp, TrendingDown } from 'lucide-react';
import { PaymentChange } from '@/types/transaction';
import { cn } from '@/lib/utils';

interface PaymentChangesProps {
  changes: PaymentChange[];
  disabled?: boolean;
}

const formatILS = (n: number) =>
  n.toLocaleString('he-IL', { style: 'currency', currency: 'ILS' });

export function PaymentChanges({ changes, disabled }: PaymentChangesProps) {
  if (disabled) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        זמין רק בתצוגה חודשית
      </div>
    );
  }

  if (changes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        לא נמצאו שינויים משמעותיים
      </div>
    );
  }

  return (
    <div className="space-y-1 h-full overflow-auto pl-1">
      {changes.map((c) => {
        const isIncrease = c.delta > 0;
        const baselineLabel = c.baselineMonthCount === 1
          ? 'חודש קודם'
          : `ממוצע ${c.baselineMonthCount} חודשים`;
        return (
          <div
            key={c.merchantName}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors"
          >
            <div
              className={cn(
                'w-7 h-7 rounded-md flex items-center justify-center shrink-0',
                isIncrease ? 'bg-destructive/10 text-destructive' : 'bg-savings/10 text-savings'
              )}
            >
              {isIncrease ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground break-words leading-tight">{c.merchantName}</p>
              <p className="text-[10px] text-muted-foreground">
                {formatILS(c.currentAmount)} · {baselineLabel}: {formatILS(c.baselineAmount)}
              </p>
            </div>
            <div
              className={cn(
                'text-left text-sm font-semibold whitespace-nowrap tabular-nums shrink-0',
                isIncrease ? 'text-destructive' : 'text-savings'
              )}
            >
              {isIncrease ? '+' : ''}
              {formatILS(c.delta)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
