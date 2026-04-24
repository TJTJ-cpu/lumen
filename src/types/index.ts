export interface DailyLog {
  id: string;
  date: string;

  sleepStart?: string;
  sleepEnd?: string;
  sleepDurationMin?: number;
  sleepDeepMin?: number;
  sleepRemMin?: number;
  sleepLightMin?: number;
  sleepScore?: number;

  screenTimeTotalMin?: number;
  screenTimeApps?: AppUsage[];
  screenTimeHourly?: HourlyUsage[];
  preSleepScreenMin?: number;

  restingHr?: number;
  hrv?: number;
  steps?: number;

  insight?: string;
  insightGeneratedAt?: string;

  createdAt: string;
  updatedAt: string;
}

export interface AppUsage {
  name: string;
  minutes: number;
}

export interface HourlyUsage {
  hour: number;
  minutes: number;
  dominantCategory?: string | null;
}

export interface GeminiScreenTimeResponse {
  date: string | null;
  total_minutes: number;
  apps: AppUsage[];
  hourly: HourlyUsage[];
}

export type RootStackParamList = {
  Dashboard: undefined;
  History: undefined;
  Capture: undefined;
};
