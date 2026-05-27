import { StatisticsSummary, buildAIPayload } from './statistics';

export type InsightSeverity = 'positive' | 'neutral' | 'warning' | 'alert';

export interface AIInsight {
  title: string;
  body: string;
  severity: InsightSeverity;
  iconHint: string;
  suggestion?: string;
}

export interface InsightsResponse {
  insights: AIInsight[];
  headline: string;
}

export type QuotaErrorKind = 'daily' | 'minute';

export interface QuotaError {
  kind: QuotaErrorKind;
  retryAfterSec: number;
}

export interface InsightsStreamHandlers {
  onHeadline?: (headline: string) => void;
  onInsight?: (insight: AIInsight) => void;
  onError?: (message: string) => void;
  onQuota?: (info: QuotaError) => void;
  onDone?: () => void;
}

// djb2 — fast, non-cryptographic; collisions don't matter because the worst case
// is one extra API call. Used to invalidate cached insights when the underlying
// summary changes between sessions.
export function hashSummary(summary: StatisticsSummary | null): string {
  if (!summary) return '0';
  const payload = JSON.stringify(buildAIPayload(summary));
  let h = 5381;
  for (let i = 0; i < payload.length; i++) {
    h = ((h << 5) + h + payload.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

// Streams insights from the server, splitting the SSE byte stream into events
// and dispatching each one. Returns a promise that resolves on `done` or when
// the caller aborts. On error the promise still resolves — handlers fire first.
export async function streamAIInsights(
  summary: StatisticsSummary,
  handlers: InsightsStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const payload = buildAIPayload(summary);
  const res = await fetch('/api/insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ summary: payload }),
    signal,
  });

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}));
    handlers.onError?.(err.error || `Insights API failed: ${res.status}`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatch = (event: string, data: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }
    if (event === 'headline') {
      const value = (parsed as { value?: string }).value;
      if (typeof value === 'string') handlers.onHeadline?.(value);
    } else if (event === 'insight') {
      const v = parsed as AIInsight;
      if (v && typeof v.title === 'string' && typeof v.body === 'string') {
        handlers.onInsight?.(v);
      }
    } else if (event === 'quota') {
      const q = parsed as Partial<QuotaError>;
      const kind: QuotaErrorKind = q.kind === 'daily' ? 'daily' : 'minute';
      const retryAfterSec =
        typeof q.retryAfterSec === 'number' && q.retryAfterSec > 0
          ? q.retryAfterSec
          : kind === 'daily'
            ? 3600
            : 30;
      handlers.onQuota?.({ kind, retryAfterSec });
    } else if (event === 'error') {
      const msg = (parsed as { message?: string }).message;
      handlers.onError?.(msg || 'הפקת תובנות נכשלה');
    } else if (event === 'done') {
      handlers.onDone?.();
    }
  };

  // SSE frames are separated by blank lines. Each frame is one or more
  // `field: value` lines. We only handle `event:` and `data:` here.
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let event = 'message';
      const dataLines: string[] = [];
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length > 0) dispatch(event, dataLines.join('\n'));
    }
  }
}
