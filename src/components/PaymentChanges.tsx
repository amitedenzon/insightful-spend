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
    <div className="space-y-2 max-h-[280px] overflow-auto">
      {changes.map((c) => {
        const isIncrease = c.delta > 0;
        const baselineLabel = c.baselineMonthCount === 1
          ? 'חודש קודם'
          : `ממוצע ${c.baselineMonthCount} חודשים`;
        return (
          <div
            key={c.merchantName}
            className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
          >
            <div
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center',
                isIncrease
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-emerald-500/10 text-emerald-600'
              )}
            >
              {isIncrease ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{c.merchantName}</p>
              <p className="text-xs text-muted-foreground truncate">
                {formatILS(c.currentAmount)} · {baselineLabel}: {formatILS(c.baselineAmount)}
              </p>
            </div>
            <div
              className={cn(
                'text-left font-semibold whitespace-nowrap',
                isIncrease ? 'text-destructive' : 'text-emerald-600'
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
