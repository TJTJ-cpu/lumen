// src/services/sync.ts
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants/config';
import { upsertDailyLog, getRecentDailyLogs } from './storage';
import type { DailyLog } from '../types';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function logToRow(log: Partial<DailyLog> & { date: string }): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: log.date,
    date: log.date,
    updated_at: new Date().toISOString(),
  };
  if (log.sleepStart !== undefined) row.sleep_start = log.sleepStart;
  if (log.sleepEnd !== undefined) row.sleep_end = log.sleepEnd;
  if (log.sleepDurationMin !== undefined) row.sleep_duration_min = log.sleepDurationMin;
  if (log.sleepDeepMin !== undefined) row.sleep_deep_min = log.sleepDeepMin;
  if (log.sleepRemMin !== undefined) row.sleep_rem_min = log.sleepRemMin;
  if (log.sleepLightMin !== undefined) row.sleep_light_min = log.sleepLightMin;
  if (log.sleepScore !== undefined) row.sleep_score = log.sleepScore;
  if (log.screenTimeTotalMin !== undefined) row.screen_time_total_min = log.screenTimeTotalMin;
  if (log.screenTimeApps !== undefined) row.screen_time_apps = JSON.stringify(log.screenTimeApps);
  if (log.screenTimeHourly !== undefined) row.screen_time_hourly = JSON.stringify(log.screenTimeHourly);
  if (log.restingHr !== undefined) row.resting_hr = log.restingHr;
  if (log.hrv !== undefined) row.hrv = log.hrv;
  if (log.steps !== undefined) row.steps = log.steps;
  if (log.insight !== undefined) row.insight = log.insight;
  if (log.insightGeneratedAt !== undefined) row.insight_generated_at = log.insightGeneratedAt;
  return row;
}

export async function pushDailyLog(
  log: Partial<DailyLog> & { date: string }
): Promise<void> {
  const { error } = await supabase
    .from('daily_log')
    .upsert(logToRow(log), { onConflict: 'date' });
  if (error) throw new Error(`Supabase push failed: ${error.message}`);
}

export async function saveDailyLog(
  log: Partial<DailyLog> & { date: string }
): Promise<void> {
  await upsertDailyLog(log);
  try {
    await pushDailyLog(log);
  } catch (err) {
    console.warn('Sync push failed (data saved locally):', err);
  }
}

function rowToLog(row: Record<string, unknown>): Partial<DailyLog> & { date: string } {
  const log: Partial<DailyLog> & { date: string } = { date: row.date as string };
  if (row.sleep_start != null) log.sleepStart = row.sleep_start as string;
  if (row.sleep_end != null) log.sleepEnd = row.sleep_end as string;
  if (row.sleep_duration_min != null) log.sleepDurationMin = row.sleep_duration_min as number;
  if (row.sleep_deep_min != null) log.sleepDeepMin = row.sleep_deep_min as number;
  if (row.sleep_rem_min != null) log.sleepRemMin = row.sleep_rem_min as number;
  if (row.sleep_light_min != null) log.sleepLightMin = row.sleep_light_min as number;
  if (row.sleep_score != null) log.sleepScore = row.sleep_score as number;
  if (row.screen_time_total_min != null) log.screenTimeTotalMin = row.screen_time_total_min as number;
  if (row.screen_time_apps != null) log.screenTimeApps = JSON.parse(row.screen_time_apps as string);
  if (row.screen_time_hourly != null) log.screenTimeHourly = JSON.parse(row.screen_time_hourly as string);
  if (row.resting_hr != null) log.restingHr = row.resting_hr as number;
  if (row.hrv != null) log.hrv = row.hrv as number;
  if (row.steps != null) log.steps = row.steps as number;
  if (row.insight != null) log.insight = row.insight as string;
  if (row.insight_generated_at != null) log.insightGeneratedAt = row.insight_generated_at as string;
  return log;
}

export async function pullFromSupabase(): Promise<{ restored: number; failed: number }> {
  const { data, error } = await supabase.from('daily_log').select('*');
  if (error) throw new Error(`Supabase pull failed: ${error.message}`);
  let restored = 0;
  let failed = 0;
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    try {
      await upsertDailyLog(rowToLog(row));
      restored++;
    } catch (err) {
      console.warn(`Restore failed for ${row.date}:`, err);
      failed++;
    }
  }
  return { restored, failed };
}

export async function backfillToSupabase(): Promise<{ pushed: number; failed: number }> {
  const logs = await getRecentDailyLogs(10000);
  let pushed = 0;
  let failed = 0;
  for (const log of logs) {
    try {
      await pushDailyLog(log);
      pushed++;
    } catch (err) {
      console.warn(`Backfill failed for ${log.date}:`, err);
      failed++;
    }
  }
  return { pushed, failed };
}

