import { Receipt } from 'lucide-react';
import { Transaction } from '@/types/transaction';
import { cn } from '@/lib/utils';

interface LargestTransactionsProps {
  transactions: Transaction[];
}

const formatILS = (n: number) =>
  n.toLocaleString('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  });

const formatDate = (d: Date) =>
  d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });

export function LargestTransactions({ transactions }: LargestTransactionsProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        אין עסקאות בתקופה זו
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[280px] overflow-auto">
      {transactions.map((t, index) => (
        <div
          key={t.id}
          className={cn(
            'flex items-center gap-3 p-3 rounded-xl transition-colors',
            'bg-muted/50 hover:bg-muted'
          )}
        >
          <div
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
              'bg-primary/10 text-primary'
            )}
          >
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">{t.merchantName}</p>
            <p className="text-xs text-muted-foreground truncate">
              {formatDate(t.purchaseDate)} · {t.category}
            </p>
          </div>
          <div className="text-left font-semibold text-foreground whitespace-nowrap flex items-center gap-2">
            <Receipt className="h-3.5 w-3.5 text-muted-foreground opacity-60" />
            {formatILS(t.chargeAmount)}
          </div>
        </div>
      ))}
    </div>
  );
}
