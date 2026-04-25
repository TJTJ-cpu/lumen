// src/services/storage.ts
import * as SQLite from 'expo-sqlite';
import type { DailyLog, AppUsage, HourlyUsage } from '../types';

const DB_NAME = 'lumen.db';

const dbPromise: Promise<SQLite.SQLiteDatabase> = (async () => {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await runMigrations(db);
  return db;
})();

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  return dbPromise;
}

async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS daily_log (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,

      sleep_start TEXT,
      sleep_end TEXT,
      sleep_duration_min INTEGER,
      sleep_deep_min INTEGER,
      sleep_rem_min INTEGER,
      sleep_light_min INTEGER,
      sleep_score INTEGER,

      screen_time_total_min INTEGER,
      screen_time_apps TEXT,
      screen_time_hourly TEXT,

      resting_hr INTEGER,
      hrv INTEGER,
      steps INTEGER,

      insight TEXT,
      insight_generated_at TEXT,

      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

type DailyLogRow = {
  id: string;
  date: string;
  sleep_start: string | null;
  sleep_end: string | null;
  sleep_duration_min: number | null;
  sleep_deep_min: number | null;
  sleep_rem_min: number | null;
  sleep_light_min: number | null;
  sleep_score: number | null;
  screen_time_total_min: number | null;
  screen_time_apps: string | null;
  screen_time_hourly: string | null;
  resting_hr: number | null;
  hrv: number | null;
  steps: number | null;
  insight: string | null;
  insight_generated_at: string | null;
  created_at: string;
  updated_at: string;
};

// renaming function
function rowToDailyLog(row: DailyLogRow): DailyLog {
  return {
    id: row.id,
    date: row.date,
    sleepStart: row.sleep_start ?? undefined,
    sleepEnd: row.sleep_end ?? undefined,
    sleepDurationMin: row.sleep_duration_min ?? undefined,
    sleepDeepMin: row.sleep_deep_min ?? undefined,
    sleepRemMin: row.sleep_rem_min ?? undefined,
    sleepLightMin: row.sleep_light_min ?? undefined,
    sleepScore: row.sleep_score ?? undefined,
    screenTimeTotalMin: row.screen_time_total_min ?? undefined,
    screenTimeApps: row.screen_time_apps
      ? (JSON.parse(row.screen_time_apps) as AppUsage[])
      : undefined,
    screenTimeHourly: row.screen_time_hourly
      ? (JSON.parse(row.screen_time_hourly) as HourlyUsage[])
      : undefined,
    restingHr: row.resting_hr ?? undefined,
    hrv: row.hrv ?? undefined,
    steps: row.steps ?? undefined,
    insight: row.insight ?? undefined,
    insightGeneratedAt: row.insight_generated_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// upsert = update and insert
export async function upsertDailyLog(
  log: Partial<DailyLog> & { date: string }
): Promise<void> {
  const db = await getDb();
  const id = log.date;

  await db.runAsync(
    `INSERT INTO daily_log (
      id, date,
      sleep_start, sleep_end, sleep_duration_min,
      sleep_deep_min, sleep_rem_min, sleep_light_min, sleep_score,
      screen_time_total_min, screen_time_apps, screen_time_hourly,
      resting_hr, hrv, steps,
      insight, insight_generated_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(date) DO UPDATE SET
      sleep_start = COALESCE(excluded.sleep_start, sleep_start),
      sleep_end = COALESCE(excluded.sleep_end, sleep_end),
      sleep_duration_min = COALESCE(excluded.sleep_duration_min, sleep_duration_min),
      sleep_deep_min = COALESCE(excluded.sleep_deep_min, sleep_deep_min),
      sleep_rem_min = COALESCE(excluded.sleep_rem_min, sleep_rem_min),
      sleep_light_min = COALESCE(excluded.sleep_light_min, sleep_light_min),
      sleep_score = COALESCE(excluded.sleep_score, sleep_score),
      screen_time_total_min = COALESCE(excluded.screen_time_total_min, screen_time_total_min),
      screen_time_apps = COALESCE(excluded.screen_time_apps, screen_time_apps),
      screen_time_hourly = COALESCE(excluded.screen_time_hourly, screen_time_hourly),
      resting_hr = COALESCE(excluded.resting_hr, resting_hr),
      hrv = COALESCE(excluded.hrv, hrv),
      steps = COALESCE(excluded.steps, steps),
      insight = COALESCE(excluded.insight, insight),
      insight_generated_at = COALESCE(excluded.insight_generated_at, insight_generated_at),
      updated_at = datetime('now')`,
    [
      id,
      log.date,
      log.sleepStart ?? null,
      log.sleepEnd ?? null,
      log.sleepDurationMin ?? null,
      log.sleepDeepMin ?? null,
      log.sleepRemMin ?? null,
      log.sleepLightMin ?? null,
      log.sleepScore ?? null,
      log.screenTimeTotalMin ?? null,
      log.screenTimeApps ? JSON.stringify(log.screenTimeApps) : null,
      log.screenTimeHourly ? JSON.stringify(log.screenTimeHourly) : null,
      log.restingHr ?? null,
      log.hrv ?? null,
      log.steps ?? null,
      log.insight ?? null,
      log.insightGeneratedAt ?? null,
    ]
  );
}

export async function getDailyLog(date: string): Promise<DailyLog | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<DailyLogRow>(
    'SELECT * FROM daily_log WHERE date = ?',
    date
  );
  return row ? rowToDailyLog(row) : null;
}

export async function wipeDailyLogs(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM daily_log');
}

export async function getAppTotals(recentDays: number = 14): Promise<{
  earliestDate: string | null;
  totals: AppUsage[];
  totalMinutes: number;
  daysCount: number;
  recentTotalMinutes: number;
  recentDaysCount: number;
}> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ date: string; screen_time_apps: string | null }>(
    'SELECT date, screen_time_apps FROM daily_log WHERE screen_time_apps IS NOT NULL ORDER BY date ASC'
  );

  if (rows.length === 0) {
    return {
      earliestDate: null,
      totals: [],
      totalMinutes: 0,
      daysCount: 0,
      recentTotalMinutes: 0,
      recentDaysCount: 0,
    };
  }

  const earliestDate = rows[0].date;
  const sums = new Map<string, number>();
  const recentCutoff = new Date(Date.now() - recentDays * 86400000).toISOString().slice(0, 10);
  let recentTotalMinutes = 0;
  let recentDaysCount = 0;

  for (const row of rows) {
    if (!row.screen_time_apps) continue;
    const apps = JSON.parse(row.screen_time_apps) as AppUsage[];

    let dayMinutes = 0;
    for (const app of apps) {
      sums.set(app.name, (sums.get(app.name) ?? 0) + app.minutes);
      dayMinutes += app.minutes;
    }

    if (row.date >= recentCutoff) {
      recentTotalMinutes += dayMinutes;
      recentDaysCount++;
    }
  }

  const totals = Array.from(sums.entries())
    .map(([name, minutes]) => ({ name, minutes }))
    .sort((a, b) => b.minutes - a.minutes);

  const totalMinutes = totals.reduce((sum, app) => sum + app.minutes, 0);

  return {
    earliestDate,
    totals,
    totalMinutes,
    daysCount: rows.length,
    recentTotalMinutes,
    recentDaysCount,
  };
}

export async function getRecentDailyLogs(limit: number): Promise<DailyLog[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DailyLogRow>(
    'SELECT * FROM daily_log ORDER BY date DESC LIMIT ?',
    limit
  );
  return rows.map(rowToDailyLog);
}
