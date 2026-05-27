import { useState } from 'react';
import { NavLink as RouterNavLink } from 'react-router-dom';
import {
  Upload,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Database,
  Repeat,
  Target,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { theme, setTheme } = useTheme();

  const navItems = [
    { to: '/upload', label: 'סנכרון', icon: Upload },
    { to: '/monitor', label: 'מעקב הוצאות', icon: BarChart3 },
    { to: '/statistics', label: 'תובנות', icon: Sparkles },
    { to: '/recurring', label: 'תשלומים חוזרים', icon: Repeat },
    { to: '/budgets', label: 'תקציבים', icon: Target },
    { to: '/data', label: 'ניהול נתונים', icon: Database },
  ];

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div
      className={cn(
        'h-screen bg-card/50 backdrop-blur-sm border-l border-border transition-all duration-300 flex flex-col sticky top-0',
        collapsed ? 'w-16' : 'w-56',
        className
      )}
    >
      <div className="px-4 flex items-center justify-between border-b border-border h-16">
        {!collapsed ? (
          <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
            <div className="w-8 h-8 rounded-md bg-foreground text-background flex items-center justify-center shrink-0 text-lg font-semibold leading-none">
              $
            </div>
            <span className="font-semibold text-base text-foreground tracking-tight">Spender</span>
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <div className="w-8 h-8 rounded-md bg-foreground text-background flex items-center justify-center shrink-0 text-lg font-semibold leading-none">
              $
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 p-2 space-y-1 mt-3">
        {navItems.map((item) => (
          <RouterNavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md transition-colors group relative text-sm',
                isActive
                  ? 'bg-foreground/[0.06] text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground',
                collapsed && 'justify-center'
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}

            {collapsed && (
              <div className="absolute right-full translate-x-2 mr-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-md border border-border z-50">
                {item.label}
              </div>
            )}
          </RouterNavLink>
        ))}
      </nav>

      <div className="p-2 border-t border-border space-y-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className={cn(
            'w-full text-muted-foreground hover:text-foreground',
            collapsed ? 'justify-center px-0' : 'justify-start gap-3'
          )}
        >
          {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          {!collapsed && <span className="text-sm">{theme === 'dark' ? 'מצב לילה' : 'מצב יום'}</span>}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'w-full text-muted-foreground hover:text-foreground',
            collapsed ? 'justify-center px-0' : 'justify-start gap-3'
          )}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span className="text-sm">סגור</span>}
        </Button>
      </div>
    </div>
  );
}
