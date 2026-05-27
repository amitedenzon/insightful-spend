import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Loader2, Settings, FileSpreadsheet, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { normalizeUploadedFiles } from '@/utils/xlsxToCsv';

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

type EnvField = { key: string; label: string; secret: boolean; value: string };

const ACCEPTED_EXTENSIONS = /\.(csv|xlsx?)$/i;

const Upload = ({ onFilesSelected, isLoading, transactionCount, onSync }: UploadProps) => {
  const [syncing, setSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [otpProvider, setOtpProvider] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [submittingOtp, setSubmittingOtp] = useState(false);
  const [credsOpen, setCredsOpen] = useState(false);
  const [envFields, setEnvFields] = useState<EnvField[] | null>(null);
  const [savingEnv, setSavingEnv] = useState(false);
  const pollRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Poll /api/scrape/status while the sync is in flight.
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

  const openCredentials = async () => {
    setCredsOpen(true);
    if (envFields !== null) return;
    try {
      const res = await fetch('/api/env');
      if (!res.ok) throw new Error(`status ${res.status}`);
      const { fields } = await res.json();
      setEnvFields(fields);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'טעינת הפרטים נכשלה';
      toast.error('שגיאה', { description: msg });
    }
  };

  const saveCredentials = async () => {
    if (!envFields) return;
    setSavingEnv(true);
    try {
      const payload = envFields.reduce<Record<string, string>>((acc, f) => {
        acc[f.key] = f.value;
        return acc;
      }, {});
      const res = await fetch('/api/env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: payload }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'שמירה נכשלה' }));
        throw new Error(error);
      }
      toast.success('הפרטים נשמרו');
      setCredsOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'שמירה נכשלה';
      toast.error('שגיאה', { description: msg });
    } finally {
      setSavingEnv(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const processFiles = async (rawFiles: File[]) => {
    const accepted = rawFiles.filter(f => ACCEPTED_EXTENSIONS.test(f.name));
    if (!accepted.length) return;

    let files: File[];
    try {
      files = await normalizeUploadedFiles(accepted);
    } catch (error) {
      console.error('Failed to convert Excel file to CSV:', error);
      toast.error('המרה לקובץ CSV נכשלה');
      return;
    }

    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    try {
      await fetch('/api/upload', { method: 'POST', body: formData });
      onFilesSelected(files);
      toast.success(`הועלו ${files.length} קבצים`);
    } catch (error) {
      console.error('Upload failed:', error);
      onFilesSelected(files);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-2xl space-y-8 animate-fade-in">
          <div className="text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-xl bg-foreground text-background flex items-center justify-center shadow-sm">
              <span className="text-3xl font-semibold leading-none">$</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Spender</h1>
            {transactionCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {transactionCount.toLocaleString('he-IL')} עסקאות בזיכרון
              </p>
            )}
          </div>

          {/* Two side-by-side actions */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Button
                size="lg"
                onClick={handleSync}
                disabled={syncing}
                className="w-full h-14 gap-2 text-base"
              >
                {syncing ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
                {syncing ? (statusMsg || 'מסנכרן…') : 'סנכרון'}
              </Button>
              <button
                type="button"
                onClick={openCredentials}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <Settings className="h-3 w-3" />
                ניהול פרטי כניסה
              </button>
            </div>

            <div className="space-y-2">
              <Button
                size="lg"
                variant="outline"
                onClick={handleUploadClick}
                disabled={isLoading}
                className="w-full h-14 gap-2 text-base"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-5 w-5" />
                )}
                העלאת קובץ
              </Button>
              <Link
                to="/data"
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <Database className="h-3 w-3" />
                ניהול נתונים
              </Link>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                multiple
                className="hidden"
                onChange={(e) => processFiles(Array.from(e.target.files || []))}
              />
            </div>
          </div>
        </div>
      </div>

      {/* OTP modal */}
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

      {/* Credentials editor */}
      <Dialog open={credsOpen} onOpenChange={setCredsOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>פרטי כניסה לסנכרון</DialogTitle>
            <p className="text-sm text-muted-foreground">
              הפרטים נשמרים בקובץ <code className="text-foreground text-xs">.env</code> מקומי בלבד.
            </p>
          </DialogHeader>

          {envFields === null ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pl-1">
              {envFields.map((f, i) => (
                <div key={f.key} className="space-y-1">
                  <label className="text-xs text-muted-foreground">{f.label}</label>
                  <Input
                    type={f.secret ? 'password' : 'text'}
                    value={f.value}
                    onChange={(e) => {
                      setEnvFields(prev => {
                        if (!prev) return prev;
                        const next = [...prev];
                        next[i] = { ...next[i], value: e.target.value };
                        return next;
                      });
                    }}
                    dir="ltr"
                    className="text-left"
                  />
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setCredsOpen(false)} disabled={savingEnv}>
              ביטול
            </Button>
            <Button onClick={saveCredentials} disabled={!envFields || savingEnv}>
              {savingEnv ? <Loader2 className="h-4 w-4 animate-spin" /> : 'שמור'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Upload;
