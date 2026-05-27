import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AIInsight,
  InsightsResponse,
  QuotaError,
  hashSummary,
  streamAIInsights,
} from '@/utils/insights';
import { Period, StatisticsSummary } from '@/utils/statistics';

// Cache key shape — period + content hash. The hash means a stale cache from a
// previous upload is automatically ignored once new data lands.
const cacheKey = (period: Period, summary: StatisticsSummary | null) =>
  `insights:${period.year}-${period.month}:${hashSummary(summary)}`;

const STORAGE_PREFIX = 'insights:';

interface CachedEntry extends InsightsResponse {
  cachedAt: number;
}

function readCache(key: string): CachedEntry | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.insights)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: CachedEntry) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or disabled — silently skip */
  }
}

// Clear entries that share the period prefix but a different hash. Keeps
// localStorage from accumulating stale snapshots as the user re-uploads.
function pruneStaleForPeriod(period: Period, keepKey: string) {
  try {
    const prefix = `${STORAGE_PREFIX}${period.year}-${period.month}:`;
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix) && k !== keepKey) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export interface InsightsState {
  insights: AIInsight[];
  headline: string;
  loading: boolean;
  error: string | null;
  quota: QuotaError | null;
  fromCache: boolean;
}

const EMPTY: InsightsState = {
  insights: [],
  headline: '',
  loading: false,
  error: null,
  quota: null,
  fromCache: false,
};

export interface UseInsightsStore {
  get: (period: Period | null, summary: StatisticsSummary | null) => InsightsState;
  ensure: (period: Period | null, summary: StatisticsSummary | null) => void;
  refresh: (period: Period, summary: StatisticsSummary) => void;
  // Most recent quota error seen on this client, if any. Cleared automatically
  // once `retryAfterSec` elapses.
  quota: QuotaError | null;
}

// Owns a state Map<periodKey, InsightsState> plus in-flight AbortControllers.
// Lifted to App level so navigating between pages doesn't drop the cache or
// cancel an in-flight prefetch.
export function useInsightsStore(): UseInsightsStore {
  const [states, setStates] = useState<Map<string, InsightsState>>(() => new Map());
  const [quota, setQuota] = useState<QuotaError | null>(null);
  const quotaTimerRef = useRef<number | null>(null);
  const inflightRef = useRef<Map<string, AbortController>>(new Map());

  // Bumps the visible quota and schedules its expiry. `setStoreQuota` shadows
  // any earlier timer so the latest retry-after wins.
  const setStoreQuota = useCallback((info: QuotaError) => {
    setQuota(info);
    if (quotaTimerRef.current) window.clearTimeout(quotaTimerRef.current);
    quotaTimerRef.current = window.setTimeout(() => {
      setQuota(null);
      quotaTimerRef.current = null;
    }, info.retryAfterSec * 1000);
  }, []);

  const update = useCallback(
    (key: string, updater: (prev: InsightsState | undefined) => InsightsState) => {
      setStates(prev => {
        const next = new Map(prev);
        next.set(key, updater(prev.get(key)));
        return next;
      });
    },
    []
  );

  const start = useCallback(
    (period: Period, summary: StatisticsSummary, key: string) => {
      // Abort any prior stream for the same key (e.g. user pressed refresh).
      inflightRef.current.get(key)?.abort();
      const controller = new AbortController();
      inflightRef.current.set(key, controller);

      update(key, () => ({
        insights: [],
        headline: '',
        loading: true,
        error: null,
        quota: null,
        fromCache: false,
      }));

      const collected: AIInsight[] = [];
      let headline = '';
      let quota: QuotaError | null = null;

      streamAIInsights(
        summary,
        {
          onHeadline: h => {
            headline = h;
            update(key, cur => ({
              ...(cur ?? EMPTY),
              headline: h,
              loading: true,
              error: null,
              quota: null,
              fromCache: false,
            }));
          },
          onInsight: ins => {
            collected.push(ins);
            update(key, cur => ({
              ...(cur ?? EMPTY),
              insights: [...collected],
              loading: true,
              error: null,
              quota: null,
              fromCache: false,
            }));
          },
          onQuota: info => {
            quota = info;
            // Don't surface it to the per-period state — the page reads quota
            // from the store-level field below so the banner works even for
            // periods the user hasn't visited yet.
          },
          onError: msg => {
            if (controller.signal.aborted) return;
            update(key, () => ({
              insights: collected,
              headline,
              loading: false,
              error: msg,
              quota: null,
              fromCache: false,
            }));
          },
          onDone: () => {
            if (controller.signal.aborted) return;
            update(key, () => ({
              insights: collected,
              headline,
              loading: false,
              error: null,
              quota,
              fromCache: false,
            }));
            // Only persist a full result. A quota'd response has no content
            // and shouldn't poison the cache.
            if (collected.length > 0 && !quota) {
              writeCache(key, {
                insights: collected,
                headline,
                cachedAt: Date.now(),
              });
              pruneStaleForPeriod(period, key);
            }
          },
        },
        controller.signal
      )
        .catch(err => {
          if (controller.signal.aborted) return;
          update(key, () => ({
            insights: collected,
            headline,
            loading: false,
            error: err?.message || 'הפקת תובנות נכשלה',
            quota: null,
            fromCache: false,
          }));
        })
        .finally(() => {
          if (inflightRef.current.get(key) === controller) {
            inflightRef.current.delete(key);
          }
          if (quota) {
            setStoreQuota(quota);
          }
        });
    },
    [update, setStoreQuota]
  );

  const get = useCallback<UseInsightsStore['get']>(
    (period, summary) => {
      if (!period) return EMPTY;
      const key = cacheKey(period, summary);
      const live = states.get(key);
      if (live) return live;
      const cached = readCache(key);
      if (cached) {
        return {
          insights: cached.insights,
          headline: cached.headline,
          loading: false,
          error: null,
          fromCache: true,
        };
      }
      return EMPTY;
    },
    [states]
  );

  const ensure = useCallback<UseInsightsStore['ensure']>(
    (period, summary) => {
      if (!period || !summary) return;
      const key = cacheKey(period, summary);
      if (states.has(key)) return;
      const cached = readCache(key);
      if (cached) {
        update(key, () => ({
          insights: cached.insights,
          headline: cached.headline,
          loading: false,
          error: null,
          quota: null,
          fromCache: true,
        }));
        return;
      }
      if (inflightRef.current.has(key)) return;
      // Don't auto-start a fetch while we know the API quota is exhausted —
      // an explicit refresh() still goes through, in case the user wants to
      // retry sooner than our local backoff.
      if (quota) return;
      start(period, summary, key);
    },
    [states, start, update, quota]
  );

  const refresh = useCallback<UseInsightsStore['refresh']>(
    (period, summary) => {
      const key = cacheKey(period, summary);
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      start(period, summary, key);
    },
    [start]
  );

  // Abort any in-flight streams when the host unmounts (app teardown).
  useEffect(() => {
    const inflight = inflightRef.current;
    return () => {
      inflight.forEach(c => c.abort());
      inflight.clear();
      if (quotaTimerRef.current) {
        window.clearTimeout(quotaTimerRef.current);
        quotaTimerRef.current = null;
      }
    };
  }, []);

  return { get, ensure, refresh, quota };
}
