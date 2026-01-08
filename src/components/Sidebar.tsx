import { useState } from 'react';
import { NavLink as RouterNavLink } from 'react-router-dom';
import { 
  Upload, 
  BarChart3, 
  ChevronLeft, 
  ChevronRight, 
  CreditCard,
  Sun,
  Moon,
  Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTheme } from "next-themes";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { theme, setTheme } = useTheme();

  const navItems = [
    { to: '/upload', label: 'העלאת קבצים', icon: Upload },
    { to: '/monitor', label: 'מעקב הוצאות', icon: BarChart3 },
    { to: '/data', label: 'ניהול נתונים', icon: Database },
  ];

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div 
      className={cn(
        "h-screen bg-card border-l border-border transition-all duration-300 flex flex-col sticky top-0",
        collapsed ? "w-20" : "w-64",
        className
      )}
    >
      <div className="p-4 flex items-center justify-between border-b border-border h-16">
        {!collapsed && (
          <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-chart-5 flex items-center justify-center shrink-0">
               {/* Shekel Icon */}
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground">
                  <path d="M6 18V6h4v12" />
                  <path d="M18 6v12h-4V6" />
                  <path d="M6 18h12" />
               </svg>
            </div>
            <span className="font-bold text-lg text-foreground">בזבזני</span>
          </div>
        )}
         {collapsed && (
            <div className="w-full flex justify-center">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-chart-5 flex items-center justify-center shrink-0">
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground">
                      <path d="M6 18V6h4v12" />
                      <path d="M18 6v12h-4V6" />
                      <path d="M6 18h12" />
                   </svg>
                </div>
            </div>
         )}
      </div>

      <nav className="flex-1 p-2 space-y-2 mt-4">
        {navItems.map((item) => (
          <RouterNavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
              isActive 
                ? "bg-primary/10 text-primary font-medium" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              collapsed && "justify-center"
            )}
          >
            <item.icon className={cn("h-5 w-5 shrink-0", collapsed ? "mr-0" : "")} />
            {!collapsed && <span>{item.label}</span>}
            
            {/* Tooltip for collapsed state */}
            {collapsed && (
                <div className="absolute right-full translate-x-2 mr-2 px-2 py-1 bg-popover text-popover-foreground text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-md border border-border z-50">
                    {item.label}
                </div>
            )}
          </RouterNavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-border space-y-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className={cn("w-full flex items-center", collapsed ? "justify-center" : "justify-start gap-3 px-2")}
        >
          {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          {!collapsed && <span>{theme === 'dark' ? 'מצב לילה' : 'מצב יום'}</span>}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span className="mr-2">סגור תפריט</span>}
        </Button>
      </div>
    </div>
  );
}
