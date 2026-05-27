import { Transaction } from '@/types/transaction';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InstallmentsListProps {
  transactions: Transaction[];
  isYearlyView?: boolean;
}

export function InstallmentsList({ transactions, isYearlyView = false }: InstallmentsListProps) {
  // Filter for only installment transactions
  const installmentTransactions = transactions.filter(t => t.installments);

  let displayedInstallments = installmentTransactions;

  // Only deduplicate/find max payment if we are in yearly view
  if (isYearlyView) {
    // Group by unique deal (Merchant + Total Installments + Amount) and keep only the latest payment (max current)
    const uniqueInstallmentsMap = new Map<string, Transaction>();

    installmentTransactions.forEach(t => {
      if (!t.installments) return;
      // Round amount to integer to handle small variations in payments (e.g. 469.33 vs 469.37)
      const key = `${t.merchantName}-${t.installments.total}-${Math.round(t.chargeAmount)}`;
      const existing = uniqueInstallmentsMap.get(key);

      if (!existing || (existing.installments?.current || 0) < t.installments.current) {
        uniqueInstallmentsMap.set(key, t);
      }
    });

    displayedInstallments = Array.from(uniqueInstallmentsMap.values());
  }
  
  // Sort regardless of view (latest first)
  const uniqueInstallments = displayedInstallments.sort((a, b) => b.purchaseDate.getTime() - a.purchaseDate.getTime());

  if (uniqueInstallments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        לא נמצאו עסקאות בתשלומים
      </div>
    );
  }

  return (
    <div dir="rtl" className="h-full">
      <ScrollArea className="h-full w-full pl-2">
        <div className="space-y-1.5">
          {uniqueInstallments.map((t) => {
            const { current, total } = t.installments!;
            const remaining = total - current;
            const remainingDebt = remaining * t.chargeAmount;
            const done = remaining === 0;

            return (
              <div
                key={t.id}
                className={cn(
                  'flex flex-col gap-1.5 px-2 py-1.5 rounded-md transition-colors',
                  done ? 'bg-savings/[0.08] hover:bg-savings/[0.12]' : 'hover:bg-muted/60'
                )}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn(
                      'w-7 h-7 rounded-md flex items-center justify-center shrink-0',
                      done ? 'bg-savings/15 text-savings' : 'bg-primary/10 text-primary'
                    )}>
                      <CreditCard className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground break-words leading-tight">{t.merchantName}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {t.purchaseDate.toLocaleDateString('he-IL')} · תשלום {current}/{total}
                      </div>
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <div className={cn('text-sm font-semibold tabular-nums', done ? 'text-savings' : 'text-spending')}>
                      {t.chargeAmount.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      יתרה {remainingDebt.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
                <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', done ? 'bg-savings' : 'bg-primary/70')}
                    style={{ width: `${(current / total) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
