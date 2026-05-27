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

export async function fetchAIInsights(
  summary: StatisticsSummary,
  signal?: AbortSignal
): Promise<InsightsResponse> {
  const payload = buildAIPayload(summary);
  const res = await fetch('/api/insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: payload }),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Insights API failed: ${res.status}`);
  }
  const data = await res.json();
  return {
    headline: typeof data.headline === 'string' ? data.headline : '',
    insights: Array.isArray(data.insights) ? data.insights : [],
  };
}
