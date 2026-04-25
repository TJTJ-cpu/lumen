import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { AppUsage } from '../types';
import { getAppTotals } from '../services/storage';

export function useAppTotals(recentDays: number = 14): {
  earliestDate: string | null;
  totals: AppUsage[];
  totalMinutes: number;
  daysCount: number;
  recentTotalMinutes: number;
  recentDaysCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [earliestDate, setEarliestDate] = useState<string | null>(null);
  const [totals, setTotals] = useState<AppUsage[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [daysCount, setDaysCount] = useState(0);
  const [recentTotalMinutes, setRecentTotalMinutes] = useState(0);
  const [recentDaysCount, setRecentDaysCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await getAppTotals(recentDays);
    setEarliestDate(result.earliestDate);
    setTotals(result.totals);
    setTotalMinutes(result.totalMinutes);
    setDaysCount(result.daysCount);
    setRecentTotalMinutes(result.recentTotalMinutes);
    setRecentDaysCount(result.recentDaysCount);
    setLoading(false);
  }, [recentDays]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return {
    earliestDate,
    totals,
    totalMinutes,
    daysCount,
    recentTotalMinutes,
    recentDaysCount,
    loading,
    refresh,
  };
}
