import { useState, useCallback } from 'react';
import { CreditCard, BarChart3, Shield } from 'lucide-react';
import { FileUpload } from '@/components/FileUpload';
import { Dashboard } from '@/components/Dashboard';
import { Transaction } from '@/types/transaction';
import { parseMultipleCSVs } from '@/utils/csvParser';
import { cn } from '@/lib/utils';

const Index = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasData, setHasData] = useState(false);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    setIsLoading(true);
    try {
      const parsed = await parseMultipleCSVs(files);
      setTransactions(prev => {
        const combined = [...prev, ...parsed];
        // Deduplicate
        const seen = new Set<string>();
        return combined.filter(t => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        });
      });
      setHasData(true);
    } catch (error) {
      console.error('Error parsing CSV files:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  if (hasData && transactions.length > 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-chart-5 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">FinanceView</h1>
                <p className="text-xs text-muted-foreground">{transactions.length} עסקאות</p>
              </div>
            </div>
            <FileUpload onFilesSelected={handleFilesSelected} isLoading={isLoading} />
          </div>
        </header>
        
        <main className="container mx-auto px-4 py-8">
          <Dashboard transactions={transactions} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-2xl w-full space-y-12 animate-fade-in">
          {/* Logo & Title */}
          <div className="text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-primary to-chart-5 flex items-center justify-center shadow-glass-lg">
              <CreditCard className="h-10 w-10 text-primary-foreground" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground">
              Finance<span className="gradient-text">View</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-md mx-auto">
              נתח את ההוצאות שלך בצורה חכמה ויזואלית
            </p>
          </div>

          {/* Upload Area */}
          <FileUpload onFilesSelected={handleFilesSelected} isLoading={isLoading} />

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: BarChart3, title: 'ניתוח מעמיק', desc: 'גרפים ותובנות' },
              { icon: CreditCard, title: 'זיהוי אוטומטי', desc: 'הוראות קבע וחוזרים' },
              { icon: Shield, title: 'פרטיות מלאה', desc: 'הנתונים נשארים אצלך' },
            ].map((feature, i) => (
              <div 
                key={feature.title}
                className={cn(
                  "p-4 rounded-xl bg-card border border-border text-center",
                  "transition-all duration-300 hover:shadow-lg hover:-translate-y-1",
                  "animate-slide-up"
                )}
                style={{ animationDelay: `${200 + i * 100}ms` }}
              >
                <feature.icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                <h3 className="font-semibold text-foreground">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>

          {/* Instructions */}
          <div className="text-center text-sm text-muted-foreground">
            <p>העלה קבצי CSV של דפי חשבון כרטיס אשראי</p>
            <p className="mt-1">תומך בפורמט דפי חשבון ישראליים</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
