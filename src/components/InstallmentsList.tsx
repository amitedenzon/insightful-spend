import { Transaction } from '@/types/transaction';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CreditCard, CalendarClock } from 'lucide-react';

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
    <div className="space-y-4" dir="rtl">
      <ScrollArea className="h-[300px] w-full pl-4">
        <div className="space-y-3">
          {uniqueInstallments.map((t) => {
            const { current, total } = t.installments!;
            const remaining = total - current;
            const remainingDebt = remaining * t.chargeAmount;

            return (
              <div 
                key={t.id} 
                className={`flex flex-col p-4 rounded-xl transition-colors gap-3 border ${
                  remaining === 0 
                    ? 'bg-green-100/40 dark:bg-green-900/20 border-green-200/50 hover:bg-green-100/60 dark:hover:bg-green-900/30' 
                    : 'bg-muted/50 border-transparent hover:bg-muted'
                }`}
              >
                {/* Header: Icon+Name (Start/Right) ... Amount (End/Left) */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                     <div className={`p-2 rounded-full shrink-0 ${
                       remaining === 0 ? 'bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-primary/10 text-primary'
                     }`}>
                        <CreditCard className="h-4 w-4" />
                     </div>
                     <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{t.merchantName}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          {t.purchaseDate.toLocaleDateString('he-IL')}
                        </div>
                     </div>
                  </div>
                  <div className="text-left shrink-0">
                    <div className="font-bold text-spending">
                      {t.chargeAmount.toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })}
                    </div>
                    <div className="text-xs text-muted-foreground text-left">לחודש</div>
                  </div>
                </div>

                {/* Footer: Badge (Start/Right) ... Remaining Debt (End/Left) */}
                <div className="flex items-center justify-between mt-1 text-sm text-muted-foreground">
                  <Badge variant="outline" className="bg-background/80 px-2.5 py-0.5">
                    תשלום {current} מתוך {total}
                  </Badge>

                  <div className="text-xs font-medium ml-1">
                    <span>יתרה:&nbsp;</span>
                    <span className={remaining === 0 ? 'text-green-600 dark:text-green-400' : ''}>
                      {remainingDebt.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Progress Bar at Bottom */}
                <div className="h-1.5 w-full bg-background/50 rounded-full overflow-hidden mt-1">
                    <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                            remaining === 0 ? 'bg-green-500' : 'bg-primary/80'
                        }`} 
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
