import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Flame,
  Coffee,
  Utensils,
  ShoppingBag,
  Calendar,
  Repeat,
  Wallet,
  PiggyBank,
  Info,
  FileQuestion,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Crown,
  UserPlus,
  UserMinus,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Transaction } from '@/types/transaction';
import {
  getAvailableStatementMonths,
  getLatestStatementPeriod,
  getStatisticsSummary,
  Period,
  StatisticsSummary,
} from '@/utils/statistics';
import { AIInsight, fetchAIInsights, InsightSeverity } from '@/utils/insights';

interface StatisticsProps {
  transactions: Transaction[];
}

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

const formatILS = (n: number) =>
  n.toLocaleString('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  });

const formatPct = (n: number, withSign = false) => {
  const v = Math.round(n * 100);
  const sign = v > 0 && withSign ? '+' : '';
  return `${sign}${v}%`;
};

const Statistics = ({ transactions }: StatisticsProps) => {
  const navigate = useNavigate();

  const availableMonths = useMemo(
    () => getAvailableStatementMonths(transactions),
    [transactions]
  );
  const latest = useMemo(() => getLatestStatementPeriod(transactions), [transactions]);
  const [selected, setSelected] = useState<Period | null>(latest);

  // Re-anchor selection when data loads / latest period changes (e.g. new
  // CSVs uploaded mid-session) — but only if the user hasn't picked something.
  useEffect(() => {
    if (!selected && latest) setSelected(latest);
  }, [latest, selected]);

  const summary = useMemo(
    () => (selected ? getStatisticsSummary(transactions, selected) : null),
    [transactions, selected]
  );

  // AI insights state — fetched on demand. Cached per period key in component
  // memory; switching back to a previously-loaded period re-uses the result.
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [headline, setHeadline] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, { insights: AIInsight[]; headline: string }>>(
    new Map()
  );
  const lastFetchedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!summary || !selected) return;
    const key = `${selected.year}-${selected.month}`;
    if (lastFetchedKey.current === key) return;
    const cached = cacheRef.current.get(key);
    if (cached) {
      setInsights(cached.insights);
      setHeadline(cached.headline);
      setAiError(null);
      lastFetchedKey.current = key;
      return;
    }
    const controller = new AbortController();
    lastFetchedKey.current = key;
    setAiLoading(true);
    setAiError(null);
    fetchAIInsights(summary, controller.signal)
      .then(r => {
        cacheRef.current.set(key, r);
        setInsights(r.insights);
        setHeadline(r.headline);
      })
      .catch(e => {
        if (controller.signal.aborted) return;
        setAiError(e?.message || 'הפקת תובנות נכשלה');
        setInsights([]);
        setHeadline('');
      })
      .finally(() => {
        if (!controller.signal.aborted) setAiLoading(false);
      });
    return () => controller.abort();
  }, [summary, selected]);

  const refreshAI = () => {
    if (!selected) return;
    const key = `${selected.year}-${selected.month}`;
    cacheRef.current.delete(key);
    lastFetchedKey.current = null;
    // Trigger the effect: bump a state to force re-run.
    setSelected({ ...selected });
  };

  if (transactions.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
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

  if (!summary || !selected) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header
        availableMonths={availableMonths}
        selected={selected}
        onChange={setSelected}
        onRefreshAI={refreshAI}
        aiLoading={aiLoading}
      />

      {headline && !aiLoading && (
        <HeadlineBanner headline={headline} />
      )}

      <HeroMetric summary={summary} />

      <QuickStatsRow summary={summary} />

      <AISection
        insights={insights}
        loading={aiLoading}
        error={aiError}
        onRetry={refreshAI}
      />

      {summary.categoryMovers.length > 0 && (
        <Section title="התנועות הגדולות בקטגוריות" subtitle="הקטגוריות שגדלו וקטנו מול 3 החודשים האחרונים">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {summary.categoryMovers.map(m => (
              <CategoryMoverCard key={m.category} mover={m} />
            ))}
          </div>
        </Section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {summary.newMerchants.length > 0 && (
          <Section
            title="בתי עסק חדשים"
            subtitle="לקוחות בפעם הראשונה בחודש הזה"
            compact
          >
            <MerchantList
              items={summary.newMerchants}
              icon={<UserPlus className="w-4 h-4" />}
              tone="primary"
            />
          </Section>
        )}
        {summary.lapsedMerchants.length > 0 && (
          <Section
            title="קבועים שנעלמו"
            subtitle="מקומות שביקרת בהם קבוע ולא חזרו החודש"
            compact
          >
            <MerchantList
              items={summary.lapsedMerchants}
              icon={<UserMinus className="w-4 h-4" />}
              tone="neutral"
              showLabel="חיוב ממוצע"
            />
          </Section>
        )}
      </div>

      <SubscriptionsSection summary={summary} />

      <LifestyleSection summary={summary} />

      <BehaviorSection summary={summary} />

      <AnomaliesSection summary={summary} />
    </div>
  );
};

export default Statistics;

// ---------------------------------------------------------------------------
// Header + period selector
// ---------------------------------------------------------------------------

function Header({
  availableMonths,
  selected,
  onChange,
  onRefreshAI,
  aiLoading,
}: {
  availableMonths: Period[];
  selected: Period;
  onChange: (p: Period) => void;
  onRefreshAI: () => void;
  aiLoading: boolean;
}) {
  const value = `${selected.year}-${selected.month}`;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">תובנות וסטטיסטיקה</h1>
        <p className="text-muted-foreground mt-1 text-sm">{selected.label}</p>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={onRefreshAI}
          disabled={aiLoading}
          className="gap-2"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', aiLoading && 'animate-spin')} />
          רענן תובנות
        </Button>
        <Select
          value={value}
          onValueChange={v => {
            const [y, m] = v.split('-').map(Number);
            const found = availableMonths.find(p => p.year === y && p.month === m);
            if (found) onChange(found);
          }}
        >
          <SelectTrigger className="w-[200px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableMonths.map(p => (
              <SelectItem key={`${p.year}-${p.month}`} value={`${p.year}-${p.month}`}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI headline banner
// ---------------------------------------------------------------------------

function HeadlineBanner({ headline }: { headline: string }) {
  return (
    <div className="rounded-lg p-4 bg-gradient-to-l from-primary/[0.07] to-primary/[0.02] border border-primary/15 flex items-start gap-3 animate-slide-up">
      <div className="w-9 h-9 rounded-md bg-primary/15 text-primary flex items-center justify-center shrink-0">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-1">תובנת AI</p>
        <p className="text-base font-semibold text-foreground leading-snug">{headline}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero metric: this month vs last, with end-of-month projection
// ---------------------------------------------------------------------------

function HeroMetric({ summary }: { summary: StatisticsSummary }) {
  const { currentTotals, totalDelta, totalPctChange, hasPrevious, burnRate } = summary;
  const positive = totalDelta <= 0; // less spend = good
  const arrow = totalDelta >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />;
  const isCurrentMonth = burnRate.daysElapsed < burnRate.daysInMonth;
  const projectionDelta = burnRate.projectedTotal - summary.previousTotals.total;

  return (
    <div className="rounded-lg bg-card p-6 animate-slide-up grid grid-cols-1 md:grid-cols-3 gap-6">
      <div>
        <p className="text-sm text-muted-foreground mb-2">סה״כ הוצאות החודש</p>
        <p className="text-4xl font-semibold tracking-tight tabular-nums text-foreground">
          {formatILS(currentTotals.total)}
        </p>
        {hasPrevious && (
          <div
            className={cn(
              'mt-2 inline-flex items-center gap-1 text-sm font-medium',
              positive ? 'text-emerald-600' : 'text-destructive'
            )}
          >
            {arrow}
            <span>
              {formatILS(Math.abs(totalDelta))} ({formatPct(totalPctChange, true)}) מול{' '}
              {summary.previous.label}
            </span>
          </div>
        )}
      </div>

      <div>
        <p className="text-sm text-muted-foreground mb-2">קצב יומי</p>
        <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
          {formatILS(burnRate.dailyAverageThisMonth)}
        </p>
        {burnRate.typicalDailyAverage > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            ממוצע 3 החודשים האחרונים: {formatILS(burnRate.typicalDailyAverage)}
          </p>
        )}
        {burnRate.typicalDailyAverage > 0 && (
          <BurnRateBar
            current={burnRate.dailyAverageThisMonth}
            baseline={burnRate.typicalDailyAverage}
          />
        )}
      </div>

      <div>
        <p className="text-sm text-muted-foreground mb-2">
          {isCurrentMonth ? 'צפי לסוף החודש' : 'סיכום חודשי'}
        </p>
        <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
          {formatILS(burnRate.projectedTotal)}
        </p>
        {hasPrevious && isCurrentMonth && (
          <p
            className={cn(
              'text-xs mt-1',
              projectionDelta > 0 ? 'text-destructive' : 'text-emerald-600'
            )}
          >
            {projectionDelta > 0 ? '+' : ''}
            {formatILS(Math.abs(projectionDelta))} מול {summary.previous.label}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {burnRate.daysElapsed} מתוך {burnRate.daysInMonth} ימים
        </p>
      </div>
    </div>
  );
}

function BurnRateBar({ current, baseline }: { current: number; baseline: number }) {
  // Visualize current vs baseline. Cap at 200% so a runaway month still shows
  // *something* meaningful instead of a tiny baseline marker.
  const ratio = baseline > 0 ? current / baseline : 1;
  const widthPct = Math.min(200, ratio * 100);
  const over = ratio > 1;
  return (
    <div className="mt-2 relative h-1.5 rounded-full bg-muted overflow-hidden">
      <div
        className={cn(
          'h-full rounded-full',
          over ? 'bg-destructive/70' : 'bg-emerald-500/70'
        )}
        style={{ width: `${widthPct / 2}%` }}
      />
      {/* baseline marker at 50% of the bar (which is 100% of baseline). */}
      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-foreground/40" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick stat badges row
// ---------------------------------------------------------------------------

function QuickStatsRow({ summary }: { summary: StatisticsSummary }) {
  const txDelta = summary.currentTotals.transactionCount - summary.previousTotals.transactionCount;
  const avgDelta = summary.currentTotals.avgTransaction - summary.previousTotals.avgTransaction;
  const subRate =
    summary.savingsRate != null ? formatPct(summary.savingsRate, true) : '—';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <QuickStat
        icon={<Activity className="h-4 w-4" />}
        label="מספר עסקאות"
        value={String(summary.currentTotals.transactionCount)}
        sub={summary.hasPrevious ? `${txDelta >= 0 ? '+' : ''}${txDelta} מהחודש שעבר` : undefined}
        tone={txDelta > 0 ? 'warning' : 'positive'}
      />
      <QuickStat
        icon={<Wallet className="h-4 w-4" />}
        label="ממוצע לעסקה"
        value={formatILS(summary.currentTotals.avgTransaction)}
        sub={
          summary.hasPrevious
            ? `${avgDelta >= 0 ? '+' : ''}${formatILS(Math.abs(avgDelta))}`
            : undefined
        }
        tone={avgDelta > 0 ? 'warning' : 'positive'}
      />
      <QuickStat
        icon={<Calendar className="h-4 w-4" />}
        label="ימים עם הוצאה"
        value={`${summary.behavior.daysWithSpend} / ${summary.behavior.daysElapsedInMonth}`}
        sub={
          summary.behavior.longestDryStreak > 1
            ? `${summary.behavior.longestDryStreak} ימים יבשים ברצף`
            : undefined
        }
      />
      <QuickStat
        icon={<PiggyBank className="h-4 w-4" />}
        label={summary.savingsRate == null ? 'הכנסות' : 'שיעור חיסכון'}
        value={
          summary.savingsRate == null
            ? formatILS(summary.currentTotals.income)
            : subRate
        }
        sub={
          summary.savingsRate != null
            ? `${formatILS(summary.currentTotals.income - summary.currentTotals.total)} נותרו`
            : undefined
        }
        tone={
          summary.savingsRate != null && summary.savingsRate > 0
            ? 'positive'
            : summary.savingsRate != null
              ? 'warning'
              : 'neutral'
        }
      />
    </div>
  );
}

function QuickStat({
  icon,
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: 'positive' | 'warning' | 'neutral';
}) {
  const toneCls = {
    positive: 'text-emerald-600',
    warning: 'text-destructive',
    neutral: 'text-muted-foreground',
  }[tone];
  return (
    <div className="rounded-lg bg-card p-3 animate-slide-up">
      <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
      {sub && <p className={cn('text-xs mt-0.5', toneCls)}>{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI insights section
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'alert-triangle': AlertTriangle,
  sparkles: Sparkles,
  flame: Flame,
  coffee: Coffee,
  utensils: Utensils,
  'shopping-bag': ShoppingBag,
  calendar: Calendar,
  repeat: Repeat,
  wallet: Wallet,
  'piggy-bank': PiggyBank,
  info: Info,
};

function severityStyles(s: InsightSeverity) {
  return {
    positive: {
      wrap: 'bg-emerald-500/[0.07] border-emerald-500/20',
      icon: 'bg-emerald-500/15 text-emerald-600',
      badge: 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20',
      badgeLabel: 'חיובי',
    },
    neutral: {
      wrap: 'bg-card border-border',
      icon: 'bg-muted text-muted-foreground',
      badge: 'bg-muted text-muted-foreground',
      badgeLabel: 'תצפית',
    },
    warning: {
      wrap: 'bg-amber-500/[0.07] border-amber-500/20',
      icon: 'bg-amber-500/15 text-amber-600',
      badge: 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/20',
      badgeLabel: 'שימו לב',
    },
    alert: {
      wrap: 'bg-destructive/[0.07] border-destructive/20',
      icon: 'bg-destructive/15 text-destructive',
      badge: 'bg-destructive/15 text-destructive hover:bg-destructive/20',
      badgeLabel: 'חריגה',
    },
  }[s];
}

function AISection({
  insights,
  loading,
  error,
  onRetry,
}: {
  insights: AIInsight[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <Section
      title="תובנות AI"
      subtitle="ניתוח חכם של ההוצאות שלך החודש"
      icon={<Sparkles className="h-4 w-4 text-primary" />}
    >
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className="rounded-lg bg-muted/40 h-24 animate-pulse"
            />
          ))}
        </div>
      )}
      {error && !loading && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/[0.07] p-4 flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground text-sm">תובנות AI לא זמינות</p>
              <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={onRetry}>
            נסה שוב
          </Button>
        </div>
      )}
      {!loading && !error && insights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.map((ins, i) => (
            <InsightCard key={i} insight={ins} delay={i * 50} />
          ))}
        </div>
      )}
      {!loading && !error && insights.length === 0 && (
        <div className="text-sm text-muted-foreground py-6 text-center">
          אין תובנות זמינות לחודש זה
        </div>
      )}
    </Section>
  );
}

function InsightCard({ insight, delay = 0 }: { insight: AIInsight; delay?: number }) {
  const styles = severityStyles(insight.severity);
  const IconComp = ICON_MAP[insight.iconHint] || Info;
  return (
    <div
      className={cn(
        'rounded-lg border p-4 animate-slide-up',
        styles.wrap
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start gap-3">
        <div className={cn('w-9 h-9 rounded-md flex items-center justify-center shrink-0', styles.icon)}>
          <IconComp className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="font-semibold text-foreground text-sm">{insight.title}</h4>
            <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0', styles.badge)}>
              {styles.badgeLabel}
            </Badge>
          </div>
          <p className="text-sm text-foreground/85 leading-snug">{insight.body}</p>
          {insight.suggestion && (
            <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
              <span className="font-medium">המלצה: </span>
              {insight.suggestion}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  title,
  subtitle,
  icon,
  children,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn('bg-card rounded-lg p-4 animate-slide-up', compact && 'p-4')}>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <div>
          <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category mover card
// ---------------------------------------------------------------------------

function CategoryMoverCard({
  mover,
}: {
  mover: StatisticsSummary['categoryMovers'][number];
}) {
  const up = mover.delta > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  const tone = up ? 'destructive' : 'emerald';
  const toneCls = up
    ? 'bg-destructive/10 text-destructive'
    : 'bg-emerald-500/10 text-emerald-600';
  const sign = up ? '+' : '';
  return (
    <div className="rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors p-3 flex items-start gap-3">
      <div className={cn('w-9 h-9 rounded-md flex items-center justify-center shrink-0', toneCls)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-foreground text-sm break-words">{mover.category}</p>
          {mover.isHighestEver && (
            <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0 border-amber-500/40 text-amber-600">
              <Crown className="h-2.5 w-2.5" />
              שיא
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatILS(mover.current)} · ממוצע 3ח׳: {formatILS(mover.baseline)}
        </p>
        <p
          className={cn(
            'text-sm font-semibold tabular-nums mt-1',
            up ? 'text-destructive' : 'text-emerald-600'
          )}
        >
          {sign}{formatILS(Math.abs(mover.delta))}
          {Number.isFinite(mover.pctChange) && mover.baseline > 0 && (
            <span className="text-xs font-normal text-muted-foreground"> · {formatPct(mover.pctChange, true)}</span>
          )}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Merchant list (new / lapsed)
// ---------------------------------------------------------------------------

function MerchantList({
  items,
  icon,
  tone = 'neutral',
  showLabel,
}: {
  items: StatisticsSummary['newMerchants'];
  icon: React.ReactNode;
  tone?: 'primary' | 'neutral';
  showLabel?: string;
}) {
  const wrapCls =
    tone === 'primary'
      ? 'bg-primary/10 text-primary'
      : 'bg-muted text-muted-foreground';
  return (
    <ul className="space-y-1.5 max-h-[300px] overflow-auto -mx-1 px-1">
      {items.map(m => (
        <li
          key={m.merchant}
          className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
        >
          <div className={cn('w-7 h-7 rounded-md flex items-center justify-center shrink-0', wrapCls)}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{m.merchant}</p>
            <p className="text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">{m.category}</Badge>
              {m.count > 1 ? ` · ${m.count} עסקאות` : ''}
            </p>
          </div>
          <div className="text-left whitespace-nowrap">
            <p className="text-sm font-semibold tabular-nums">{formatILS(m.amount)}</p>
            {showLabel && <p className="text-[10px] text-muted-foreground">{showLabel}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Subscriptions section
// ---------------------------------------------------------------------------

function SubscriptionsSection({ summary }: { summary: StatisticsSummary }) {
  const { subscriptions } = summary;
  const baseShare = summary.currentTotals.total > 0
    ? subscriptions.monthlyBase / summary.currentTotals.total
    : 0;

  return (
    <Section
      title="מנויים ותשלומים קבועים"
      subtitle="המעקב מאתר אוטומטית עסקים שחוזרים ב-3 מתוך 4 החודשים האחרונים"
      icon={<Repeat className="h-4 w-4 text-muted-foreground" />}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg bg-muted/30 p-4">
          <p className="text-xs text-muted-foreground">בסיס חודשי קבוע</p>
          <p className="text-2xl font-semibold tabular-nums mt-1">{formatILS(subscriptions.monthlyBase)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {subscriptions.totalRecurringMerchants} עסקים · {formatPct(baseShare)} מההוצאות
          </p>
          <Progress value={Math.min(100, baseShare * 100)} className="mt-2 h-1.5" />
        </div>

        <div className="rounded-lg bg-muted/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <p className="text-xs font-medium text-foreground">חדשים</p>
          </div>
          {subscriptions.newRecurring.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">לא התחילו מנויים חדשים לאחרונה</p>
          ) : (
            <ul className="space-y-1.5">
              {subscriptions.newRecurring.map(s => (
                <li key={s.merchant} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{s.merchant}</p>
                    <p className="text-[10px] text-muted-foreground">החל ב{s.firstSeen}</p>
                  </div>
                  <p className="font-semibold tabular-nums shrink-0">{formatILS(s.amount)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg bg-muted/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <UserMinus className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium text-foreground">הופסקו</p>
          </div>
          {subscriptions.stoppedRecurring.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">אין מנויים שהופסקו</p>
          ) : (
            <ul className="space-y-1.5">
              {subscriptions.stoppedRecurring.map(s => (
                <li key={s.merchant} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{s.merchant}</p>
                    <p className="text-[10px] text-muted-foreground">אחרון ב{s.lastSeen}</p>
                  </div>
                  <p className="font-semibold tabular-nums shrink-0">{formatILS(s.amount)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Lifestyle section: eating-out, coffee, delivery
// ---------------------------------------------------------------------------

function LifestyleSection({ summary }: { summary: StatisticsSummary }) {
  const { lifestyle } = summary;
  const restaurantDelta = lifestyle.restaurantCount - lifestyle.restaurantCountPrev;
  const avgRestaurant = lifestyle.restaurantCount > 0
    ? lifestyle.restaurantTotal / lifestyle.restaurantCount
    : 0;
  const avgCoffee = lifestyle.coffeeCount > 0
    ? lifestyle.coffeeTotal / lifestyle.coffeeCount
    : 0;

  return (
    <Section
      title="הרגלי בילוי וצריכה"
      subtitle="ניתוח התנהגותי על בסיס שמות בתי העסק"
      icon={<Utensils className="h-4 w-4 text-muted-foreground" />}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <LifestyleCard
          icon={<Utensils className="h-4 w-4" />}
          label="יציאות לאוכל"
          primary={`${lifestyle.restaurantCount} פעמים`}
          secondary={formatILS(lifestyle.restaurantTotal)}
          tertiary={
            avgRestaurant > 0 ? `~${formatILS(avgRestaurant)} בממוצע` : undefined
          }
          deltaLabel={
            summary.hasPrevious
              ? `${restaurantDelta >= 0 ? '+' : ''}${restaurantDelta} מהחודש שעבר`
              : undefined
          }
          deltaTone={restaurantDelta > 0 ? 'warning' : 'positive'}
        />
        <LifestyleCard
          icon={<Coffee className="h-4 w-4" />}
          label="קפה ומאפים"
          primary={`${lifestyle.coffeeCount} ביקורים`}
          secondary={formatILS(lifestyle.coffeeTotal)}
          tertiary={avgCoffee > 0 ? `~${formatILS(avgCoffee)} לפעם` : undefined}
        />
        <LifestyleCard
          icon={<ShoppingBag className="h-4 w-4" />}
          label="משלוחים"
          primary={`${lifestyle.deliveryCount} הזמנות`}
          secondary={formatILS(lifestyle.deliveryTotal)}
        />
        <LifestyleCard
          icon={<PiggyBank className="h-4 w-4" />}
          label="בית מול בחוץ"
          primary={`${Math.round(lifestyle.groceryVsRestaurant * 100)}% בבית`}
          secondary={`${formatILS(lifestyle.groceryTotal)} סופר · ${formatILS(lifestyle.restaurantTotal)} בחוץ`}
        />
      </div>
    </Section>
  );
}

function LifestyleCard({
  icon,
  label,
  primary,
  secondary,
  tertiary,
  deltaLabel,
  deltaTone,
}: {
  icon: React.ReactNode;
  label: string;
  primary: string;
  secondary?: string;
  tertiary?: string;
  deltaLabel?: string;
  deltaTone?: 'positive' | 'warning';
}) {
  return (
    <div className="rounded-lg bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-lg font-semibold text-foreground">{primary}</p>
      {secondary && <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">{secondary}</p>}
      {tertiary && <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">{tertiary}</p>}
      {deltaLabel && (
        <p
          className={cn(
            'text-[11px] mt-1 font-medium',
            deltaTone === 'positive' ? 'text-emerald-600' : 'text-destructive'
          )}
        >
          {deltaLabel}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Behavior / day-of-week section
// ---------------------------------------------------------------------------

function BehaviorSection({ summary }: { summary: StatisticsSummary }) {
  const { behavior } = summary;
  const weekendPct = Math.round(behavior.weekendRatio * 100);
  return (
    <Section
      title="התנהגות לאורך החודש"
      icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">סוף שבוע מול חול</p>
          <p className="text-lg font-semibold mt-1">{weekendPct}%</p>
          <div className="mt-2 flex h-1.5 rounded-full overflow-hidden bg-muted">
            <div className="bg-primary/70" style={{ width: `${weekendPct}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">סופ״ש · חול</p>
        </div>
        <div className="rounded-lg bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">היום החזק</p>
          <p className="text-lg font-semibold mt-1">יום {behavior.biggestDayName}</p>
          <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">{formatILS(behavior.biggestDayAmount)} סה״כ</p>
        </div>
        <div className="rounded-lg bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">רצף ימי הוצאה</p>
          <p className="text-lg font-semibold mt-1">{behavior.longestSpendingStreak} ימים</p>
          <p className="text-xs text-muted-foreground mt-0.5">הרצף הארוך ביותר</p>
        </div>
        <div className="rounded-lg bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">ימים יבשים</p>
          <p className="text-lg font-semibold mt-1">{behavior.longestDryStreak} ימים</p>
          <p className="text-xs text-muted-foreground mt-0.5">בלי הוצאה ברצף</p>
        </div>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Anomalies section
// ---------------------------------------------------------------------------

function AnomaliesSection({ summary }: { summary: StatisticsSummary }) {
  const { anomalies, topMerchants, topMerchantsConcentration } = summary;
  const hasAnomalies =
    (anomalies.largestTransaction && anomalies.largestZScore > 2) ||
    anomalies.spikedCategories.length > 0;

  return (
    <Section
      title="חריגות וריכוזיות"
      subtitle="עסקאות וקטגוריות בולטות יחסית להיסטוריה"
      icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted/30 p-4">
          <p className="text-xs text-muted-foreground mb-1">העסקה הגדולה החודש</p>
          {anomalies.largestTransaction ? (
            <>
              <p className="text-2xl font-semibold tabular-nums">
                {formatILS(anomalies.largestTransaction.chargeAmount)}
              </p>
              <p className="text-sm text-foreground mt-1 break-words">
                {anomalies.largestTransaction.merchantName}
              </p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {anomalies.largestTransaction.category}
                </Badge>
                {anomalies.largestZScore > 2 && (
                  <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-700 hover:bg-amber-500/20">
                    <Flame className="h-2.5 w-2.5 ml-1" />
                    חריג ({anomalies.largestZScore.toFixed(1)}σ)
                  </Badge>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">אין עסקאות בחודש זה</p>
          )}
        </div>

        <div className="rounded-lg bg-muted/30 p-4">
          <p className="text-xs text-muted-foreground mb-2">5 העסקים הגדולים</p>
          {topMerchants.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין נתונים</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                {formatPct(topMerchantsConcentration)} מההוצאות מתוכם
              </p>
              <ul className="space-y-1">
                {topMerchants.map((m, i) => (
                  <li key={m.merchant} className="flex items-center gap-2 text-sm">
                    <span className="w-5 text-xs text-muted-foreground text-center">{i + 1}</span>
                    <span className="flex-1 truncate font-medium text-foreground">{m.merchant}</span>
                    <span className="tabular-nums shrink-0">{formatILS(m.amount)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {anomalies.spikedCategories.length > 0 && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {anomalies.spikedCategories.map(c => (
            <div
              key={c.category}
              className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3"
            >
              <div className="flex items-center gap-2 mb-1">
                <Flame className="h-3.5 w-3.5 text-amber-600" />
                <p className="text-sm font-medium text-foreground">{c.category}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                החודש: {formatILS(c.current)} · ממוצע: {formatILS(c.mean)}
              </p>
              <p className="text-xs text-amber-700 mt-1 font-medium">
                חריגה של {c.z.toFixed(1)} סטיות תקן
              </p>
            </div>
          ))}
        </div>
      )}

      {!hasAnomalies && (
        <p className="text-xs text-muted-foreground mt-2">לא נמצאו חריגות מהותיות החודש 🎯</p>
      )}
    </Section>
  );
}
