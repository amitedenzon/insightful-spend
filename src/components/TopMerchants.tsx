import { MerchantData } from '@/types/transaction';
import { cn } from '@/lib/utils';

interface TopMerchantsProps {
  merchants: MerchantData[];
}

const formatILS = (n: number) =>
  n.toLocaleString('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  });

export function TopMerchants({ merchants }: TopMerchantsProps) {
  if (merchants.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        אין נתונים
      </div>
    );
  }

  const maxAmount = Math.max(...merchants.map(m => m.total));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
      {merchants.map((merchant, index) => {
        const percentage = (merchant.total / maxAmount) * 100;

        return (
          <div key={merchant.name} className="space-y-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={cn(
                    'w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono font-semibold shrink-0',
                    index === 0 && 'bg-spending/15 text-spending',
                    index === 1 && 'bg-warning/15 text-warning',
                    index >= 2 && 'bg-muted text-muted-foreground'
                  )}
                >
                  {index + 1}
                </span>
                <span className="font-medium text-foreground truncate">
                  {merchant.name}
                </span>
              </div>
              <span className="font-semibold text-foreground tabular-nums text-sm whitespace-nowrap">
                {formatILS(merchant.total)}
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  index === 0 && 'bg-spending',
                  index === 1 && 'bg-warning',
                  index >= 2 && 'bg-primary/60'
                )}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              {merchant.count} עסקאות
            </div>
          </div>
        );
      })}
    </div>
  );
}
