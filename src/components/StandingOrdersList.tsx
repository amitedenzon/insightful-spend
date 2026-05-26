import { Repeat, TrendingUp } from 'lucide-react';
import { Transaction } from '@/types/transaction';
import { cn } from '@/lib/utils';

interface StandingOrdersListProps {
  transactions: Transaction[];
  recurringMerchants?: Set<string>;
}

export function StandingOrdersList({ transactions, recurringMerchants }: StandingOrdersListProps) {
  const standingOrders = transactions.filter(
    t => t.isStandingOrder || (recurringMerchants?.has(t.merchantName) ?? false)
  );
  
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
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <span className="text-sm text-muted-foreground">סה"כ הוראות קבע</span>
        <span className="font-bold text-foreground">
          {totalAmount.toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })}
        </span>
      </div>
      
      <div className="space-y-2 max-h-[250px] overflow-auto">
        {sortedOrders.map((order, index) => (
          <div 
            key={order.name}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-colors",
              "bg-muted/50 hover:bg-muted"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
              "bg-primary/10 text-primary"
            )}>
              {index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{order.name}</p>
              <p className="text-xs text-muted-foreground">{order.count} חיובים</p>
            </div>
            <div className="text-left">
              <p className="font-semibold text-foreground">
                {order.total.toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
