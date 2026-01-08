import { Store } from 'lucide-react';
import { MerchantData } from '@/types/transaction';
import { cn } from '@/lib/utils';

interface TopMerchantsProps {
  merchants: MerchantData[];
}

export function TopMerchants({ merchants }: TopMerchantsProps) {
  const maxAmount = Math.max(...merchants.map(m => m.total));

  if (merchants.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        אין נתונים
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {merchants.map((merchant, index) => {
        const percentage = (merchant.total / maxAmount) * 100;
        
        return (
          <div key={merchant.name} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold",
                  index === 0 && "bg-spending/20 text-spending",
                  index === 1 && "bg-warning/20 text-warning",
                  index >= 2 && "bg-muted text-muted-foreground"
                )}>
                  {index + 1}
                </div>
                <span className="font-medium text-foreground truncate max-w-[150px]">
                  {merchant.name}
                </span>
              </div>
              <span className="font-semibold text-foreground tabular-nums">
                {merchant.total.toLocaleString('he-IL', { 
                  style: 'currency', 
                  currency: 'ILS',
                  maximumFractionDigits: 0 
                })}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  index === 0 && "bg-spending",
                  index === 1 && "bg-warning",
                  index >= 2 && "bg-primary/60"
                )}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
