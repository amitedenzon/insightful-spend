import { TrendingUp, Calendar } from 'lucide-react';
import { RecurrentPayment } from '@/types/transaction';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface RecurrentPaymentsProps {
  payments: RecurrentPayment[];
}

export function RecurrentPayments({ payments }: RecurrentPaymentsProps) {
  if (payments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        לא נמצאו תשלומים חוזרים
      </div>
    );
  }

  return (
    <div className="space-y-1 h-full overflow-auto pl-1">
      {payments.slice(0, 12).map((payment) => (
        <div
          key={payment.merchantName}
          className={cn(
            'flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors',
            'hover:bg-muted/60'
          )}
        >
          <div className={cn(
            'w-7 h-7 rounded-md flex items-center justify-center shrink-0',
            'bg-savings/10 text-savings'
          )}>
            <TrendingUp className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground break-words leading-tight">{payment.merchantName}</p>
            <Badge variant="secondary" className="text-[10px] mt-0.5 h-4 px-1.5 gap-1">
              <Calendar className="h-2.5 w-2.5" />
              {payment.frequency} חודשים
            </Badge>
          </div>
          <div className="text-left shrink-0">
            <p className="text-sm font-semibold text-foreground tabular-nums">
              ~{payment.averageAmount.toLocaleString('he-IL', {
                style: 'currency',
                currency: 'ILS',
                maximumFractionDigits: 0,
              })}
            </p>
            <p className="text-[10px] text-muted-foreground">לחודש</p>
          </div>
        </div>
      ))}
    </div>
  );
}
