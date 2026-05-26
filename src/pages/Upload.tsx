import { CreditCard, BarChart3, Shield } from 'lucide-react';
import { FileUpload } from '@/components/FileUpload';
import { cn } from '@/lib/utils';

interface UploadProps {
  onFilesSelected: (files: File[]) => void;
  isLoading: boolean;
  transactionCount: number;
}

const Upload = ({ onFilesSelected, isLoading, transactionCount }: UploadProps) => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-2xl w-full space-y-12 animate-fade-in">
          {/* Logo & Title */}
          <div className="text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-primary to-chart-5 flex items-center justify-center shadow-glass-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground">
                  <path d="M6 18V6h4v12" />
                  <path d="M18 6v12h-4V6" />
                  <path d="M6 18h12" />
               </svg>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground">
              בזבזני
            </h1>
            <p className="text-xl text-muted-foreground max-w-md mx-auto">
              נתח את ההוצאות שלך בצורה חכמה ויזואלית
            </p>
            {transactionCount > 0 && (
              <p className="text-sm text-primary font-medium">
                {transactionCount} עסקאות נטענו
              </p>
            )}
          </div>

          {/* Upload Area */}
          <FileUpload onFilesSelected={onFilesSelected} isLoading={isLoading} />

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
            <p>העלה קבצי CSV או Excel של דפי חשבון כרטיס אשראי</p>
            <p className="mt-1">תומך בפורמט דפי חשבון ישראליים</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Upload;
