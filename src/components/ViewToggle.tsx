import { Calendar, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ViewMode } from '@/types/transaction';

interface ViewToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
  return (
    <div className="flex gap-1 bg-muted p-1 rounded-xl">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onViewModeChange('month')}
        className={cn(
          "rounded-lg transition-all duration-200",
          viewMode === 'month' && "bg-background shadow-sm"
        )}
      >
        <Calendar className="ml-2 h-4 w-4" />
        חודש
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onViewModeChange('year')}
        className={cn(
          "rounded-lg transition-all duration-200",
          viewMode === 'year' && "bg-background shadow-sm"
        )}
      >
        <CalendarDays className="ml-2 h-4 w-4" />
        שנה
      </Button>
    </div>
  );
}
