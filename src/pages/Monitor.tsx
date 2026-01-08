import { Dashboard } from '@/components/Dashboard';
import { Transaction } from '@/types/transaction';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface MonitorProps {
  transactions: Transaction[];
  onCategoryChange: (id: string, newCategory: string) => void;
}

const Monitor = ({ transactions, onCategoryChange }: MonitorProps) => {
  const navigate = useNavigate();

  if (transactions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <FileQuestion className="h-16 w-16 mx-auto text-muted-foreground" />
          <h2 className="text-2xl font-bold text-foreground">אין נתונים להצגה</h2>
          <p className="text-muted-foreground">יש להעלות קבצי CSV תחילה</p>
          <Button onClick={() => navigate('/upload')} className="mt-4">
            העלה קבצים
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <Dashboard transactions={transactions} onCategoryChange={onCategoryChange} />
      </main>
    </div>
  );
};

export default Monitor;
