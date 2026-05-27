import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  delay?: number;
  action?: ReactNode;
}

// Edge-less card: solid card background, no border. Lets the dashboard read
// as a single composed surface instead of a grid of boxed-up tiles.
export function ChartCard({ title, subtitle, children, className, delay = 0, action }: ChartCardProps) {
  return (
    <div
      className={cn(
        'bg-card rounded-lg p-4 animate-slide-up',
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}
