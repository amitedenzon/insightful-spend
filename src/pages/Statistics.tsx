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
  Crown,
  UserPlus,
  UserMinus,
  Loader2,
  RefreshCw,
  Activity,
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const Statistics = ({ transactions }: StatisticsProps) => {
  const navigate = useNavigate();

  const availableMonths = useMemo(
    () => getAvailableStatementMonths(transactions),
    [transactions]
  );
  const latest = useMemo(() => getLatestStatementPeriod(transactions), [transactions]);
  const [selected, setSelected] = useState<Period | null>(latest);

  useEffect(() => {
    if (!selected && latest) setSelected(latest);
  }, [latest, selected]);

  const summary = useMemo(
    () => (selected ? getStatisticsSummary(transactions, selected) : null),
    [transactions, selected]
  );

  // AI insights cache keyed by period — switching back to a previously-loaded
  // month re-uses the result instead of re-paying the API call.
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
    <div className="space-y-4">
      <PageHeader
        availableMonths={availableMonths}
        selected={selected}
        onChange={setSelected}
        onRefreshAI={refreshAI}
        aiLoading={aiLoading}
      />

      {/* Top row — change-vs-baseline on the left, AI narrative on the right.
          Both deliberately avoid restating numbers already on the Dashboard
          (total, top merchants, daily breakdown). */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <DeltaCard summary={summary} className="lg:col-span-2" />
        <AINarrativeCard
          headline={headline}
          insights={insights}
          loading={aiLoading}
          error={aiError}
          onRetry={refreshAI}
          className="lg:col-span-3"
        />
      </div>

      {/* Categories that moved vs the trailing 3-month average. The Dashboard
          shows current-period shares — this section shows *change*. */}
      <CategoryMoversCard summary={summary} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <LifestyleCard summary={summary} />
        <AnomaliesCard summary={summary} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <SubscriptionsCard summary={summary} />
        <MerchantChurnCard summary={summary} />
      </div>
    </div>
  );
};

export default Statistics;

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function PageHeader({
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
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">תובנות</h1>
        <p className="text-muted-foreground text-sm">
          מה השתנה ב{selected.label} מול החודשים שקדמו לו
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefreshAI}
          disabled={aiLoading}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', aiLoading && 'animate-spin')} />
          רענן
        </Button>
        <Select
          value={value}
          onValueChange={v => {
            const [y, m] = v.split('-').map(Number);
            const found = availableMonths.find(p => p.year === y && p.month === m);
            if (found) onChange(found);
          }}
        >
          <SelectTrigger className="w-[180px] bg-background">
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
// Section shell (tight, borderless)
// ---------------------------------------------------------------------------

function Card({
  title,
  subtitle,
  icon,
  children,
  className,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn('bg-card rounded-lg p-4 animate-slide-up', className)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delta card — change vs previous month + end-of-month projection
// ---------------------------------------------------------------------------

function DeltaCard({
  summary,
  className,
}: {
  summary: StatisticsSummary;
  className?: string;
}) {
  const { totalDelta, totalPctChange, hasPrevious, burnRate, previous, previousTotals } = summary;
  const positive = totalDelta <= 0;
  const arrow = totalDelta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />;
  const isCurrentMonth = burnRate.daysElapsed < burnRate.daysInMonth;
  const projectionDelta = burnRate.projectedTotal - previousTotals.total;

  return (
    <Card
      title="שינוי מול החודש הקודם"
      subtitle={hasPrevious ? `${previous.label}` : 'אין מספיק היסטוריה להשוואה'}
      className={className}
      icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
    >
      <div className="space-y-3">
        {hasPrevious ? (
          <div className="flex items-baseline gap-3 flex-wrap">
            <div
              className={cn(
                'inline-flex items-center gap-1 text-2xl font-semibold tracking-tight tabular-nums',
                positive ? 'text-savings' : 'text-spending'
              )}
            >
              {arrow}
              {formatILS(Math.abs(totalDelta))}
            </div>
            <span className="text-sm text-muted-foreground">
              ({formatPct(totalPctChange, true)})
            </span>
          </div>
        ) : (
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {formatILS(summary.currentTotals.total)}
          </p>
        )}

        {isCurrentMonth && (
          <div className="pt-3 border-t border-border">
            <div className="flex items-baseline justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">צפי לסוף החודש</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatILS(burnRate.projectedTotal)}
                </p>
              </div>
              <div className="text-left">
                <p className="text-xs text-muted-foreground">
                  {burnRate.daysElapsed}/{burnRate.daysInMonth} ימים
                </p>
                {hasPrevious && (
                  <p
                    className={cn(
                      'text-xs font-medium tabular-nums',
                      projectionDelta > 0 ? 'text-spending' : 'text-savings'
                    )}
                  >
                    {projectionDelta > 0 ? '+' : ''}
                    {formatILS(Math.abs(projectionDelta))} מול הקודם
                  </p>
                )}
              </div>
            </div>
            {burnRate.typicalDailyAverage > 0 && (
              <BurnRateBar
                current={burnRate.dailyAverageThisMonth}
                baseline={burnRate.typicalDailyAverage}
              />
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function BurnRateBar({ current, baseline }: { current: number; baseline: number }) {
  const ratio = baseline > 0 ? current / baseline : 1;
  const widthPct = Math.min(200, ratio * 100);
  const over = ratio > 1;
  const diffPct = Math.round((ratio - 1) * 100);
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
        <span>קצב יומי {formatILS(current)}</span>
        <span>ממוצע 3ח׳ {formatILS(baseline)}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            over ? 'bg-spending/70' : 'bg-savings/70'
          )}
          style={{ width: `${widthPct / 2}%` }}
        />
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-foreground/30" />
      </div>
      <p
        className={cn(
          'text-[11px] mt-1',
          over ? 'text-spending' : 'text-savings'
        )}
      >
        {over ? `מבזבז ${diffPct}% מעל הממוצע` : `חסכוני ב-${Math.abs(diffPct)}%`}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI narrative — single card with headline + bullet list (not 4 separate cards)
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

function severityIconClass(s: InsightSeverity) {
  return {
    positive: 'bg-savings/15 text-savings',
    neutral: 'bg-muted text-muted-foreground',
    warning: 'bg-warning/15 text-warning',
    alert: 'bg-spending/15 text-spending',
  }[s];
}

function AINarrativeCard({
  headline,
  insights,
  loading,
  error,
  onRetry,
  className,
}: {
  headline: string;
  insights: AIInsight[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <Card
      title="תובנת AI"
      subtitle="ניתוח חכם של החודש"
      icon={<Sparkles className="h-4 w-4 text-primary" />}
      className={className}
    >
      {loading ? (
        <div className="space-y-2">
          <div className="h-5 w-3/4 rounded bg-muted/60 animate-pulse" />
          <div className="space-y-1.5 pt-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-3 rounded bg-muted/40 animate-pulse" />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-spending shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground">תובנות AI לא זמינות</p>
            <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={onRetry}>
            נסה שוב
          </Button>
        </div>
      ) : insights.length === 0 ? (
        <p className="text-sm text-muted-foreground">אין תובנות זמינות לחודש זה</p>
      ) : (
        <div className="space-y-3">
          {headline && (
            <p className="text-base font-semibold text-foreground leading-snug">
              {headline}
            </p>
          )}
          <ul className="space-y-2">
            {insights.slice(0, 5).map((ins, i) => {
              const IconComp = ICON_MAP[ins.iconHint] || Info;
              return (
                <li key={i} className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      'w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5',
                      severityIconClass(ins.severity)
                    )}
                  >
                    <IconComp className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">
                      <span className="font-medium">{ins.title}.</span>{' '}
                      <span className="text-foreground/80">{ins.body}</span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Category movers — the "what changed" section
// ---------------------------------------------------------------------------

function CategoryMoversCard({ summary }: { summary: StatisticsSummary }) {
  if (summary.categoryMovers.length === 0) {
    return null;
  }
  return (
    <Card
      title="קטגוריות שזזו"
      subtitle="שינוי בהוצאה לעומת ממוצע 3 החודשים האחרונים"
      icon={<Activity className="h-4 w-4 text-muted-foreground" />}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {summary.categoryMovers.map(m => {
          const up = m.delta > 0;
          return (
            <div
              key={m.category}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-muted/40 transition-colors"
            >
              <div
                className={cn(
                  'w-7 h-7 rounded-md flex items-center justify-center shrink-0',
                  up ? 'bg-spending/10 text-spending' : 'bg-savings/10 text-savings'
                )}
              >
                {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-foreground break-words leading-tight">
                    {m.category}
                  </p>
                  {m.isHighestEver && (
                    <Badge variant="outline" className="text-[10px] gap-0.5 px-1 py-0 border-warning/40 text-warning leading-none h-4">
                      <Crown className="h-2.5 w-2.5" />
                      שיא
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {formatILS(m.current)} · ממוצע {formatILS(m.baseline)}
                </p>
              </div>
              <div className="text-left shrink-0">
                <p
                  className={cn(
                    'text-sm font-semibold tabular-nums',
                    up ? 'text-spending' : 'text-savings'
                  )}
                >
                  {up ? '+' : ''}
                  {formatILS(Math.abs(m.delta))}
                </p>
                {Number.isFinite(m.pctChange) && m.baseline > 0 && (
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    {formatPct(m.pctChange, true)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Lifestyle — behavioural rollups (restaurants, coffee, deliveries)
// ---------------------------------------------------------------------------

function LifestyleCard({ summary }: { summary: StatisticsSummary }) {
  const { lifestyle } = summary;
  const restaurantDelta = lifestyle.restaurantCount - lifestyle.restaurantCountPrev;
  const homeRatio = Math.round(lifestyle.groceryVsRestaurant * 100);

  const rows: {
    icon: React.ReactNode;
    label: string;
    primary: string;
    secondary?: string;
    delta?: { text: string; tone: 'positive' | 'warning' };
  }[] = [
    {
      icon: <Utensils className="h-3.5 w-3.5" />,
      label: 'יציאות לאוכל',
      primary: `${lifestyle.restaurantCount} פעמים`,
      secondary: formatILS(lifestyle.restaurantTotal),
      delta: summary.hasPrevious
        ? {
            text: `${restaurantDelta >= 0 ? '+' : ''}${restaurantDelta} מהחודש שעבר`,
            tone: restaurantDelta > 0 ? 'warning' : 'positive',
          }
        : undefined,
    },
    {
      icon: <Coffee className="h-3.5 w-3.5" />,
      label: 'קפה ומאפים',
      primary: `${lifestyle.coffeeCount} ביקורים`,
      secondary: formatILS(lifestyle.coffeeTotal),
    },
    {
      icon: <ShoppingBag className="h-3.5 w-3.5" />,
      label: 'משלוחים',
      primary: `${lifestyle.deliveryCount} הזמנות`,
      secondary: formatILS(lifestyle.deliveryTotal),
    },
    {
      icon: <PiggyBank className="h-3.5 w-3.5" />,
      label: 'בישול מול אוכל בחוץ',
      primary: `${homeRatio}% בבית`,
      secondary: `${formatILS(lifestyle.groceryTotal)} סופר · ${formatILS(lifestyle.restaurantTotal)} מסעדות`,
    },
  ];

  return (
    <Card
      title="הרגלים"
      subtitle="ספירות שלא מופיעות בטאב ההוצאות"
      icon={<Utensils className="h-4 w-4 text-muted-foreground" />}
    >
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/40 transition-colors">
            <span className="w-7 h-7 rounded-md flex items-center justify-center bg-muted text-muted-foreground shrink-0">
              {r.icon}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{r.label}</p>
              <p className="text-sm font-medium text-foreground">{r.primary}</p>
              {r.secondary && (
                <p className="text-[11px] text-muted-foreground tabular-nums">{r.secondary}</p>
              )}
            </div>
            {r.delta && (
              <p
                className={cn(
                  'text-[11px] font-medium tabular-nums shrink-0',
                  r.delta.tone === 'positive' ? 'text-savings' : 'text-spending'
                )}
              >
                {r.delta.text}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Anomalies — outlier transaction + spiked categories
// ---------------------------------------------------------------------------

function AnomaliesCard({ summary }: { summary: StatisticsSummary }) {
  const { anomalies } = summary;
  const big = anomalies.largestTransaction;
  const hasSpike = anomalies.spikedCategories.length > 0;
  const hasBigOutlier = big && anomalies.largestZScore > 2;

  return (
    <Card
      title="חריגות"
      subtitle="עסקאות וקטגוריות יוצאות דופן ביחס להיסטוריה"
      icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
    >
      {!hasSpike && !big ? (
        <p className="text-sm text-muted-foreground py-2">לא נמצאו חריגות מהותיות החודש</p>
      ) : (
        <div className="space-y-3">
          {big && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">העסקה הגדולה החודש</p>
              <div className="flex items-baseline gap-2 flex-wrap">
                <p className="text-xl font-semibold tabular-nums text-foreground">
                  {formatILS(big.chargeAmount)}
                </p>
                {hasBigOutlier && (
                  <Badge className="text-[10px] px-1.5 py-0 h-5 bg-warning/15 text-warning hover:bg-warning/20 gap-1">
                    <Flame className="h-2.5 w-2.5" />
                    {anomalies.largestZScore.toFixed(1)}σ מעל הממוצע
                  </Badge>
                )}
              </div>
              <p className="text-sm text-foreground mt-1 break-words">{big.merchantName}</p>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 mt-1">
                {big.category}
              </Badge>
            </div>
          )}

          {hasSpike && (
            <div className={cn(big && 'pt-3 border-t border-border')}>
              <p className="text-xs text-muted-foreground mb-2">קטגוריות שזינקו</p>
              <ul className="space-y-1.5">
                {anomalies.spikedCategories.map(c => (
                  <li key={c.category} className="flex items-start gap-2">
                    <Flame className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-medium text-foreground break-words">{c.category}</p>
                        <p className="text-xs text-warning tabular-nums shrink-0">
                          {c.z.toFixed(1)}σ
                        </p>
                      </div>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        החודש {formatILS(c.current)} · ממוצע {formatILS(c.mean)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Subscriptions — new + stopped (current set lives on the Recurring tab)
// ---------------------------------------------------------------------------

function SubscriptionsCard({ summary }: { summary: StatisticsSummary }) {
  const { subscriptions } = summary;
  const baseShare = summary.currentTotals.total > 0
    ? subscriptions.monthlyBase / summary.currentTotals.total
    : 0;
  const newOnes = subscriptions.newRecurring;
  const stopped = subscriptions.stoppedRecurring;

  return (
    <Card
      title="מנויים שהשתנו"
      subtitle="זוהו דרך 3 מתוך 4 החודשים האחרונים"
      icon={<Repeat className="h-4 w-4 text-muted-foreground" />}
      action={
        <div className="text-left">
          <p className="text-[11px] text-muted-foreground">בסיס חודשי</p>
          <p className="text-sm font-semibold tabular-nums">{formatILS(subscriptions.monthlyBase)}</p>
          <p className="text-[10px] text-muted-foreground">
            {formatPct(baseShare)} מההוצאות
          </p>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SubscriptionList
          icon={<UserPlus className="h-3.5 w-3.5" />}
          label="חדשים"
          emptyLabel="לא התחילו מנויים חדשים"
          tone="primary"
          items={newOnes.map(s => ({
            merchant: s.merchant,
            amount: s.amount,
            sub: `החל ב${s.firstSeen}`,
          }))}
        />
        <SubscriptionList
          icon={<UserMinus className="h-3.5 w-3.5" />}
          label="הופסקו"
          emptyLabel="אין מנויים שהופסקו"
          tone="neutral"
          items={stopped.map(s => ({
            merchant: s.merchant,
            amount: s.amount,
            sub: `אחרון ב${s.lastSeen}`,
          }))}
        />
      </div>
    </Card>
  );
}

function SubscriptionList({
  icon,
  label,
  emptyLabel,
  items,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  emptyLabel: string;
  items: { merchant: string; amount: number; sub?: string }[];
  tone: 'primary' | 'neutral';
}) {
  const wrapCls =
    tone === 'primary' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground';
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5 text-xs text-muted-foreground">
        <span className={cn('w-5 h-5 rounded-md flex items-center justify-center', wrapCls)}>
          {icon}
        </span>
        {label}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1.5">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1">
          {items.map(it => (
            <li key={it.merchant} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground break-words leading-tight">{it.merchant}</p>
                {it.sub && <p className="text-[10px] text-muted-foreground">{it.sub}</p>}
              </div>
              <p className="text-sm font-semibold tabular-nums shrink-0">{formatILS(it.amount)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Merchant churn — new + lapsed
// ---------------------------------------------------------------------------

function MerchantChurnCard({ summary }: { summary: StatisticsSummary }) {
  const newOnes = summary.newMerchants;
  const lapsed = summary.lapsedMerchants;
  const both = newOnes.length === 0 && lapsed.length === 0;

  return (
    <Card
      title="הגעות ועזיבות"
      subtitle="בתי עסק חדשים השבוע מול קבועים שלא חזרו"
      icon={<UserPlus className="h-4 w-4 text-muted-foreground" />}
    >
      {both ? (
        <p className="text-sm text-muted-foreground py-2">אין שינויים בולטים במצבת בתי העסק</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <MerchantList
            items={newOnes}
            icon={<UserPlus className="h-3.5 w-3.5" />}
            emptyLabel="אין בתי עסק חדשים"
            tone="primary"
            label="חדשים החודש"
          />
          <MerchantList
            items={lapsed}
            icon={<UserMinus className="h-3.5 w-3.5" />}
            emptyLabel="כל הקבועים חזרו"
            tone="neutral"
            label="קבועים שלא חזרו"
            secondaryLabel="חיוב ממוצע"
          />
        </div>
      )}
    </Card>
  );
}

function MerchantList({
  items,
  icon,
  tone,
  label,
  emptyLabel,
  secondaryLabel,
}: {
  items: StatisticsSummary['newMerchants'];
  icon: React.ReactNode;
  tone: 'primary' | 'neutral';
  label: string;
  emptyLabel: string;
  secondaryLabel?: string;
}) {
  const wrapCls =
    tone === 'primary' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground';
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5 text-xs text-muted-foreground">
        <span className={cn('w-5 h-5 rounded-md flex items-center justify-center', wrapCls)}>
          {icon}
        </span>
        {label}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1.5">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1 max-h-[200px] overflow-auto pl-1">
          {items.slice(0, 6).map(m => (
            <li
              key={m.merchant}
              className="flex items-center justify-between gap-2 px-1 py-1 rounded-md hover:bg-muted/40 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground break-words leading-tight">{m.merchant}</p>
                <p className="text-[10px] text-muted-foreground">
                  {m.category}{m.count > 1 ? ` · ${m.count} עסקאות` : ''}
                </p>
              </div>
              <div className="text-left shrink-0">
                <p className="text-sm font-semibold tabular-nums">{formatILS(m.amount)}</p>
                {secondaryLabel && <p className="text-[10px] text-muted-foreground">{secondaryLabel}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
