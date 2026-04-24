import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { DailyLog } from '../types';
import { getRecentDailyLogs } from '../services/storage';

export function useRecentDailyLogs(limit: number): {
  logs: DailyLog[];
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await getRecentDailyLogs(limit);
    setLogs(result);
    setLoading(false);
  }, [limit]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { logs, loading, refresh };
}
