import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  variant?: 'default' | 'spending' | 'savings' | 'primary';
  delay?: number;
}

export function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  variant = 'default',
  delay = 0 
}: MetricCardProps) {
  const variantStyles = {
    default: 'bg-card border-border',
    spending: 'bg-gradient-to-br from-spending/10 to-spending/5 border-spending/20',
    savings: 'bg-gradient-to-br from-savings/10 to-savings/5 border-savings/20',
    primary: 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20',
  };

  const valueStyles = {
    default: 'text-foreground',
    spending: 'text-spending',
    savings: 'text-savings',
    primary: 'text-primary',
  };

  return (
    <div 
      className={cn(
        "rounded-2xl border p-6 transition-all duration-300 hover-lift animate-slide-up",
        variantStyles[variant]
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground mb-1">
            {title}
          </p>
          <p className={cn(
            "text-3xl font-bold tracking-tight truncate",
            valueStyles[variant]
          )}>
            {typeof value === 'number' ? value.toLocaleString('he-IL', { 
              style: 'currency', 
              currency: 'ILS',
              maximumFractionDigits: 0 
            }) : value}
          </p>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1 truncate">
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
            variant === 'spending' && 'bg-spending/20 text-spending',
            variant === 'savings' && 'bg-savings/20 text-savings',
            variant === 'primary' && 'bg-primary/20 text-primary',
            variant === 'default' && 'bg-muted text-muted-foreground'
          )}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
