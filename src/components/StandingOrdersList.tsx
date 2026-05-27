import { Transaction } from '@/types/transaction';
import { cn } from '@/lib/utils';

interface StandingOrdersListProps {
  transactions: Transaction[];
}

// Only true standing orders: rows the bank/CSV explicitly flagged as
// "הוראת קבע". Auto-detected recurring merchants live in the neighbouring
// "תשלומים חוזרים" card — duplicating them here just made the two cards
// indistinguishable.
export function StandingOrdersList({ transactions }: StandingOrdersListProps) {
  const standingOrders = transactions.filter(t => t.isStandingOrder);
  
  // Group by merchant
  const grouped = standingOrders.reduce((acc, t) => {
    const key = t.merchantName;
    if (!acc[key]) {
      acc[key] = { name: key, total: 0, count: 0 };
    }
    acc[key].total += t.chargeAmount;
    acc[key].count += 1;
    return acc;
  }, {} as Record<string, { name: string; total: number; count: number }>);

  const sortedOrders = Object.values(grouped).sort((a, b) => b.total - a.total);
  const totalAmount = sortedOrders.reduce((sum, o) => sum + o.total, 0);

  if (sortedOrders.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        לא נמצאו הוראות קבע
      </div>
    );
  }

  return (
    <div className="space-y-2 h-full flex flex-col">
      <div className="flex items-center justify-between pb-2 border-b border-border shrink-0">
        <span className="text-xs text-muted-foreground">סה"כ הוראות קבע</span>
        <span className="font-semibold text-foreground text-sm tabular-nums">
          {totalAmount.toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })}
        </span>
      </div>

      <div className="space-y-1 flex-1 min-h-0 overflow-auto pl-1">
        {sortedOrders.map((order, index) => (
          <div
            key={order.name}
            className={cn(
              'flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors',
              'hover:bg-muted/60'
            )}
          >
            <div className={cn(
              'w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-semibold tabular-nums shrink-0',
              'bg-primary/10 text-primary'
            )}>
              {index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground break-words leading-tight">{order.name}</p>
              <p className="text-[11px] text-muted-foreground">{order.count} חיובים</p>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground tabular-nums">
                {order.total.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
