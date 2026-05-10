import { useState, useEffect } from 'react';
import type { DailyLog } from '../types';
import { generateInsight } from '../services/ai';
import { getRecentDailyLogs } from '../services/storage';
import { saveDailyLog } from '../services/sync';

export function useInsight(log: DailyLog | null): {
  insight: string | null;
  loading: boolean;
} {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Clear stale insight immediately when date changes
    setInsight(null);
    setLoading(false);

    if (!log) return;

    // Already stored — show immediately, no API call
    if (log.insight) {
      setInsight(log.insight);
      return;
    }

    // Need at least this day's screen time to bother generating
    if (!log.screenTimeTotalMin) return;

    let cancelled = false;

    const generate = async () => {
      setLoading(true);
      try {
        const recentLogs = await getRecentDailyLogs(7);
        const text = await generateInsight(log.date, recentLogs);
        if (cancelled) return;
        setInsight(text);
        await saveDailyLog({
          date: log.date,
          insight: text,
          insightGeneratedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Insight generation failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    generate();
    return () => { cancelled = true; };
  }, [log?.date, log?.insight, log?.screenTimeTotalMin]);

  return { insight, loading };
}
