import { useState, useEffect, useRef } from 'react';
import { CreditCard, BarChart3, Shield, RefreshCw, Loader2 } from 'lucide-react';
import { FileUpload } from '@/components/FileUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface UploadProps {
  onFilesSelected: (files: File[]) => void;
  isLoading: boolean;
  transactionCount: number;
  onSync: () => Promise<void>;
}

type ScrapeStatus = {
  status: 'idle' | 'running' | 'awaiting_otp' | 'done' | 'failed';
  message: string;
  provider: string | null;
  result?: { totalTransactions?: number; errors?: { message: string }[] } | null;
};

const Upload = ({ onFilesSelected, isLoading, transactionCount, onSync }: UploadProps) => {
  const [syncing, setSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [otpProvider, setOtpProvider] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [submittingOtp, setSubmittingOtp] = useState(false);
  const pollRef = useRef<number | null>(null);

  // Poll /api/scrape/status while the sync is in flight. When the server
  // signals awaiting_otp we surface the modal; when status reaches done/failed
  // we finalize the toast and stop polling.
  useEffect(() => {
    if (!syncing) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch('/api/scrape/status');
        if (!res.ok || cancelled) return;
        const s = (await res.json()) as ScrapeStatus;
        setStatusMsg(s.message || '');
        if (s.status === 'awaiting_otp') {
          setOtpProvider(s.provider);
        } else if (s.status === 'done') {
          setOtpProvider(null);
          await onSync();
          const count = s.result?.totalTransactions ?? 0;
          const errs = s.result?.errors ?? [];
          if (errs.length > 0) {
            toast.warning(`נטענו ${count} עסקאות, אך חלק מהספקים נכשלו`, {
              description: errs.map(e => e.message).join(' · '),
            });
          } else {
            toast.success(`סנכרון הושלם · ${count} עסקאות`);
          }
          setSyncing(false);
        } else if (s.status === 'failed') {
          setOtpProvider(null);
          toast.error('סנכרון נכשל', { description: s.message });
          setSyncing(false);
        }
      } catch {
        // network blip; just retry on next tick
      }
    };

    pollRef.current = window.setInterval(tick, 1000);
    tick();

    return () => {
      cancelled = true;
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [syncing, onSync]);

  const handleSync = async () => {
    try {
      const res = await fetch('/api/scrape', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error('סנכרון נכשל', { description: data?.error || `שגיאה ${res.status}` });
        return;
      }
      setSyncing(true);
      setStatusMsg('מתחיל…');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'שגיאה לא ידועה';
      toast.error('סנכרון נכשל', { description: msg });
    }
  };

  const handleOtpSubmit = async () => {
    if (!otpCode.trim()) return;
    setSubmittingOtp(true);
    try {
      const res = await fetch('/api/scrape/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: otpCode.trim() }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'שליחת הקוד נכשלה' }));
        toast.error('שגיאה', { description: error });
        return;
      }
      setOtpCode('');
      setOtpProvider(null); // close modal; polling will continue tracking the scrape
    } finally {
      setSubmittingOtp(false);
    }
  };

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

          {/* Direct sync with bank/credit-card */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center w-full gap-3 text-xs text-muted-foreground">
              <span className="flex-1 h-px bg-border" />
              <span>או</span>
              <span className="flex-1 h-px bg-border" />
            </div>
            <Button
              variant="outline"
              size="lg"
              onClick={handleSync}
              disabled={syncing}
              className="gap-2"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {syncing ? (statusMsg || 'מסנכרן…') : 'סנכרן עם ישראכרט ואוצר החייל'}
            </Button>
            <p className="text-xs text-muted-foreground text-center max-w-md">
              דורש מילוי פרטי התחברות בקובץ <code className="text-foreground">.env</code>.
              הריצה הראשונה עשויה לקחת דקה או שתיים.
            </p>
          </div>

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

      <Dialog open={!!otpProvider} onOpenChange={() => { /* must submit or wait */ }}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>קוד אימות (OTP)</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {otpProvider} ביקש קוד אימות שנשלח אליך ב-SMS. הזן את הקוד כדי להמשיך.
            </p>
          </DialogHeader>
          <Input
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            inputMode="numeric"
            autoFocus
            maxLength={8}
            className="text-center text-lg tracking-widest"
            onKeyDown={(e) => { if (e.key === 'Enter') handleOtpSubmit(); }}
          />
          <DialogFooter>
            <Button onClick={handleOtpSubmit} disabled={!otpCode.trim() || submittingOtp} className="w-full">
              {submittingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : 'שלח קוד'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Upload;
