import { useState } from 'react';
import { CreditCard, Menu, X, Upload, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { NavLink } from '@/components/NavLink';

interface AppHeaderProps {
  transactionCount: number;
}

export const AppHeader = ({ transactionCount }: AppHeaderProps) => {
  const [open, setOpen] = useState(false);

  const navItems = [
    { to: '/upload', label: 'העלאת קבצים', icon: Upload },
    { to: '/monitor', label: 'מעקב הוצאות', icon: BarChart3 },
  ];

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-chart-5 flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">FinanceView</h1>
            {transactionCount > 0 && (
              <p className="text-xs text-muted-foreground">{transactionCount} עסקאות</p>
            )}
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              activeClassName="bg-primary/10 text-primary font-medium"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Mobile Hamburger Menu */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <nav className="flex flex-col gap-2 mt-8">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-foreground hover:bg-muted transition-colors"
                  activeClassName="bg-primary/10 text-primary font-medium"
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};
