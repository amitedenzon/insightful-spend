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
  delay = 0,
}: MetricCardProps) {
  // Subtle left-edge accent rather than full-card gradients. Reads as a clean
  // code-editor swatch instead of a colored marketing tile.
  const accent = {
    default: 'before:bg-muted-foreground/30',
    spending: 'before:bg-spending',
    savings: 'before:bg-savings',
    primary: 'before:bg-primary',
  }[variant];

  // Values stay neutral — the accent bar already conveys variant. Only the
  // spending tile gets a touch of color so the headline expense number reads
  // at a glance.
  const valueColor = {
    default: 'text-foreground',
    spending: 'text-spending',
    savings: 'text-foreground',
    primary: 'text-foreground',
  }[variant];

  const iconColor = {
    default: 'text-muted-foreground',
    spending: 'text-spending',
    savings: 'text-savings',
    primary: 'text-primary',
  }[variant];

  return (
    <div
      className={cn(
        'relative bg-card border border-border rounded-xl p-5 animate-slide-up',
        'before:absolute before:top-4 before:bottom-4 before:right-0 before:w-[3px] before:rounded-l-full',
        accent
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
            {title}
          </p>
          <p
            className={cn(
              'text-3xl font-semibold tracking-tight tabular-nums truncate',
              valueColor
            )}
          >
            {typeof value === 'number'
              ? value.toLocaleString('he-IL', {
                  style: 'currency',
                  currency: 'ILS',
                  maximumFractionDigits: 0,
                })
              : value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1.5 truncate">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className={cn('shrink-0', iconColor)}>{icon}</div>
        )}
      </div>
    </div>
  );
}
