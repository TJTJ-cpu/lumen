import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { AppUsage } from '../types';
import { getAppTotals } from '../services/storage';

export function useAppTotals(): {
  earliestDate: string | null;
  totals: AppUsage[];
  totalMinutes: number;
  daysCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [earliestDate, setEarliestDate] = useState<string | null>(null);
  const [totals, setTotals] = useState<AppUsage[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [daysCount, setDaysCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await getAppTotals();
    setEarliestDate(result.earliestDate);
    setTotals(result.totals);
    setTotalMinutes(result.totalMinutes);
    setDaysCount(result.daysCount);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { earliestDate, totals, totalMinutes, daysCount, loading, refresh };
}
