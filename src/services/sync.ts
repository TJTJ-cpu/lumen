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

