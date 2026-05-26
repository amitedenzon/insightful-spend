import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Loader2, ChevronDown, BarChart3, Shield, Zap, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
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
  const [csvOpen, setCsvOpen] = useState(false);
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
      setOtpProvider(null);
    } finally {
      setSubmittingOtp(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-3xl space-y-10 animate-fade-in">
          {/* Title */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-savings" />
              <span>$ bezbezni --sync</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-foreground">
              בזבזני
            </h1>
            <p className="text-muted-foreground">
              סנכרן את הנתונים שלך ישירות מספקי האשראי
            </p>
            {transactionCount > 0 && (
              <p className="text-xs font-mono text-savings">
                {transactionCount.toLocaleString('he-IL')} עסקאות בזיכרון
              </p>
            )}
          </div>

          {/* Primary: scrape */}
          <div className="bg-card border border-border rounded-xl p-8 shadow-sm space-y-5">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">סנכרון אוטומטי</h2>
              <p className="text-sm text-muted-foreground">
                שליפת עסקאות ישירות מישראכרט. דורש פרטי כניסה ב-<code className="text-foreground font-mono text-xs px-1 py-0.5 rounded bg-muted">.env</code>.
              </p>
            </div>

            <Button
              size="lg"
              onClick={handleSync}
              disabled={syncing}
              className="w-full gap-2 h-12 text-base"
            >
              {syncing ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
              {syncing ? (statusMsg || 'מסנכרן…') : 'סנכרן עכשיו'}
            </Button>

            {syncing && statusMsg && (
              <p className="text-xs font-mono text-muted-foreground text-center">{statusMsg}</p>
            )}

            {transactionCount > 0 && !syncing && (
              <div className="flex justify-center">
                <Button variant="ghost" size="sm" asChild className="gap-1">
                  <Link to="/monitor">
                    דלג לדשבורד
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            )}
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: Zap, title: 'מהיר', desc: 'דקה בלבד' },
              { icon: BarChart3, title: 'מנותח', desc: 'גרפים אוטומטיים' },
              { icon: Shield, title: 'פרטי', desc: 'הכל מקומי' },
            ].map((feature, i) => (
              <div
                key={feature.title}
                className={cn(
                  'p-4 rounded-xl bg-card/50 border border-border/60',
                  'animate-slide-up'
                )}
                style={{ animationDelay: `${200 + i * 80}ms` }}
              >
                <feature.icon className="h-4 w-4 mb-2 text-muted-foreground" />
                <h3 className="font-medium text-sm text-foreground">{feature.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{feature.desc}</p>
              </div>
            ))}
          </div>

          {/* Secondary: CSV upload (collapsible) */}
          <div className="border-t border-border pt-6">
            <button
              type="button"
              onClick={() => setCsvOpen(v => !v)}
              className="w-full flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>או העלה קובץ CSV/Excel ידנית</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform',
                  csvOpen && 'rotate-180'
                )}
              />
            </button>
            {csvOpen && (
              <div className="mt-4 animate-fade-in">
                <FileUpload onFilesSelected={onFilesSelected} isLoading={isLoading} />
              </div>
            )}
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
            className="text-center text-lg tracking-widest font-mono"
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
