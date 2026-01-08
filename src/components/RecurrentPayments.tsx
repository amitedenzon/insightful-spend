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
    <div className="space-y-3 max-h-[300px] overflow-auto">
      {payments.slice(0, 10).map((payment, index) => (
        <div 
          key={payment.merchantName}
          className={cn(
            "flex items-center gap-3 p-3 rounded-xl transition-colors",
            "bg-muted/50 hover:bg-muted"
          )}
        >
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            "bg-savings/10 text-savings"
          )}>
            <TrendingUp className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">{payment.merchantName}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                <Calendar className="h-3 w-3 ml-1" />
                {payment.frequency} חודשים
              </Badge>
            </div>
          </div>
          <div className="text-left">
            <p className="font-semibold text-foreground">
              ~{payment.averageAmount.toLocaleString('he-IL', { 
                style: 'currency', 
                currency: 'ILS',
                maximumFractionDigits: 0
              })}
            </p>
            <p className="text-xs text-muted-foreground">לחודש</p>
          </div>
        </div>
      ))}
    </div>
  );
}
