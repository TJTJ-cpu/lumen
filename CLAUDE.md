# Lumen — CLAUDE.md

## What is Lumen?

Lumen is a personal iOS app built exclusively for TJ. It combines Apple Health data (sleep, heart rate, activity) with manually captured screen time data into a single daily dashboard. The core purpose is to surface correlations between phone habits and physical wellbeing — e.g. "You slept worse on nights you used Instagram after midnight." It is not a public product and will never be published to the App Store.

---

## Guiding Philosophy

- **Personal first.** This app has exactly one user. Every decision should optimise for TJ's workflow, not generalisation or scalability.
- **Data over noise.** Show the data cleanly. Let the AI insights do the interpretive work. Don't clutter the UI.
- **Low friction.** The screen time capture flow must be as fast as possible — ideally under 30 seconds start to finish.
- **Honest data.** Never interpolate or fabricate data points. If data is missing for a day, show it as missing.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | React Native + TypeScript | Expo managed workflow |
| Local Storage | SQLite via `expo-sqlite` | Primary read layer, works offline |
| Cloud Sync | Supabase (Postgres) | Mirrors local SQLite data, free tier |
| Health Data | `react-native-health` | Reads directly from Apple HealthKit |
| Screen Time | Apple Shortcut + Gemini Vision API | Screenshot → AI parse → structured JSON |
| AI Insights | Gemini API (`gemini-2.0-flash`) | Two jobs: screenshot parsing + insight generation |
| Build Pipeline | GitHub Actions (macos-latest runner) | Compiles `.ipa` |
| Deployment | Sideloadly on Windows | Sideloaded directly to TJ's iPhone |

**There is no backend.** Gemini and Supabase are called directly from the React Native client. This is intentional and safe because the app is never distributed publicly.

---

## Project Structure

```
lumen/
├── src/
│   ├── screens/
│   │   ├── DashboardScreen.tsx       # Daily summary — home screen
│   │   ├── HistoryScreen.tsx         # Scrollable past days
│   │   └── CaptureScreen.tsx         # Screen time screenshot upload flow
│   ├── components/
│   │   ├── DailyCard.tsx             # The core day summary card
│   │   ├── SleepBlock.tsx            # Bedtime, wake time, stages
│   │   ├── ScreenTimeBlock.tsx       # App usage list
│   │   ├── InsightBanner.tsx         # AI-generated insight text
│   │   └── MissingDataPrompt.tsx     # Shown when screen time not yet logged
│   ├── services/
│   │   ├── health.ts                 # Apple HealthKit reads via react-native-health
│   │   ├── gemini.ts                 # Gemini API calls (parse + insights)
│   │   ├── storage.ts                # SQLite read/write helpers
│   │   └── sync.ts                   # Supabase sync logic
│   ├── hooks/
│   │   ├── useHealthData.ts          # Pulls today's health snapshot
│   │   ├── useScreenTime.ts          # Reads screen time from SQLite
│   │   └── useDailyInsight.ts        # Fetches or generates today's insight
│   ├── types/
│   │   └── index.ts                  # Shared TypeScript types
│   └── constants/
│       └── config.ts                 # API keys, Supabase URL, config flags
├── CLAUDE.md                         # This file
├── app.json
├── package.json
└── tsconfig.json
```

---

## Data Architecture

### SQLite Schema (local)

```sql
-- One row per day
CREATE TABLE daily_log (
  id TEXT PRIMARY KEY,              -- ISO date string e.g. "2026-04-22"
  date TEXT NOT NULL UNIQUE,

  -- Sleep (from Apple Health)
  sleep_start TEXT,                 -- ISO datetime
  sleep_end TEXT,                   -- ISO datetime
  sleep_duration_min INTEGER,       -- total minutes
  sleep_deep_min INTEGER,
  sleep_rem_min INTEGER,
  sleep_light_min INTEGER,
  sleep_score INTEGER,              -- derived 0-100

  -- Screen time (from Gemini-parsed screenshot)
  screen_time_total_min INTEGER,
  screen_time_apps TEXT,       -- JSON array: [{app, minutes}]
  screen_time_hourly TEXT,     -- JSON array: [{hour, minutes, category}]

  -- Health signals (from Apple Health)
  resting_hr INTEGER,
  hrv INTEGER,
  steps INTEGER,

  -- AI
  insight TEXT,                     -- Gemini-generated insight for the day
  insight_generated_at TEXT,        -- ISO datetime

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

### Supabase Schema

Mirrors the SQLite schema exactly. Sync runs on app open and after any write. Conflict resolution: local wins (last write wins per `updated_at`).

---

## Data Sources & How They Work

### Apple Health (automatic)

Reads are triggered every time the app opens. Uses `react-native-health` to query:

- `HKCategoryTypeIdentifierSleepAnalysis` — sleep stages and times
- `HKQuantityTypeIdentifierHeartRate` — resting heart rate
- `HKQuantityTypeIdentifierHeartRateVariabilitySDNN` — HRV
- `HKQuantityTypeIdentifierStepCount` — steps

No user action required after initial permissions grant.

### Screen Time (semi-manual)

Flow:
1. User taps **"Capture Screen Time"** on the Dashboard or Capture screen
2. App opens the Apple Shortcut via deep link (`shortcuts://run-shortcut?name=LumenCapture`)
3. Shortcut navigates to the Screen Time settings page, takes a screenshot, saves to Photos
4. User returns to Lumen (manually or via Shortcut's "Open App" action at the end)
5. App opens the image picker pre-filtered to the last photo taken
6. Selected image is base64-encoded and sent to Gemini Vision API
7. Gemini returns structured JSON (see below)
8. Data is written to SQLite and synced to Supabase

**Target capture frequency:** Every few days, before the 14-day Apple rolling window expires. The app should surface a warning banner on the dashboard if the last screen time capture was more than 10 days ago.

---

## Gemini API Usage

### Job 1 — Screenshot Parsing

**Model:** `gemini-2.0-flash`

**Prompt template:**

```
You are parsing an iOS Screen Time screenshot. Extract all visible data and return ONLY a valid JSON object with this exact structure, no preamble or markdown:

{
  "date": "YYYY-MM-DD or null if unclear",
  "total_minutes": number,
  "apps": [
    { "name": string, "minutes": number }
  ],
  "hourly": [
    { "hour": number, "minutes": number, "dominant_category": string | null }
  ]
}

Rules:
- Convert all time strings (e.g. "1h 2m", "58m") to integer minutes
- Include only apps with a visible time value
- For hourly: hour is 0-23, estimate minutes from bar chart height if exact values not shown
- For dominant_category: infer from the bar colour if visible (e.g. "Social", "Entertainment", "Games", "Other") — set to null if ambiguous or not visible
- Only include hourly entries where usage is greater than zero
- If a field is not visible in the screenshot, omit it or set to null
- Return nothing except the JSON object
```

### Job 2 — Daily Insight Generation

**Model:** `gemini-2.0-flash`

**Trigger:** Generated once per day, on first app open after midnight, if both sleep data and screen time data exist for the previous day. Stored in `daily_log.insight` so it is never regenerated for the same day.

**Prompt template:**

```
You are a personal health analyst for TJ, a 23-year-old male focused on self-improvement.
Analyse the following data for {date} and write ONE insight of 2-3 sentences.
Focus on the relationship between screen time and sleep quality.
Be direct, specific, and use the actual numbers. Do not be generic.

Data:
- Bedtime: {sleep_start}
- Wake time: {sleep_end}
- Total sleep: {sleep_duration_min} minutes
- Deep sleep: {sleep_deep_min} min, REM: {sleep_rem_min} min
- Resting HR: {resting_hr} bpm
- Total screen time: {screen_time_total_min} minutes
- Screen time in 2 hours before bed: {pre_sleep_screen_min} minutes
- Top apps: {top_apps}
- Hourly usage pattern: {screen_time_hourly}

Use the hourly pattern to identify when phone use spiked relative to bedtime.
Write the insight in second person ("You..."). No bullet points. No headers.
```

---

## Key Screens

### Dashboard (Home)

- Displays data for **yesterday** by default (since that's when Apple Watch sleep data is complete)
- Date picker at top to navigate to any past day
- Sections in order:
  1. **Sleep block** — bedtime, wake time, duration, stage breakdown bar
  2. **Screen time block** — total time, top apps list with time bars
  3. **Pre-sleep phone use** — minutes on phone in 2hrs before bed (derived)
  4. **AI Insight** — Gemini-generated text
  5. **Capture prompt** — if screen time is missing for this day, show a soft prompt

### History

- Scrollable list of past days as cards
- Each card shows: date, sleep duration, total screen time, insight preview
- Tap to expand to full DailyCard view

### Capture Screen

- Large "Capture Screen Time" button
- Instructions for first-time users
- Image picker fallback if Shortcut isn't set up yet
- Shows last capture date so TJ knows if he's close to the 14-day window

---

## Apple Shortcut — LumenCapture

The shortcut must be set up manually by TJ once on his iPhone. It does the following:

1. Open URL `apple-screentime://` (navigates to Screen Time settings)
2. Wait 1.5 seconds
3. Take Screenshot
4. Save to Photos album "Lumen"
5. Open App "Lumen"

The shortcut is triggered from within Lumen via:
```typescript
Linking.openURL('shortcuts://run-shortcut?name=LumenCapture');
```

---

## TypeScript Types

```typescript
// types/index.ts

export interface DailyLog {
  id: string;                    // ISO date "YYYY-MM-DD"
  date: string;

  // Sleep
  sleepStart?: string;           // ISO datetime
  sleepEnd?: string;
  sleepDurationMin?: number;
  sleepDeepMin?: number;
  sleepRemMin?: number;
  sleepLightMin?: number;
  sleepScore?: number;

  // Screen time
  screenTimeTotalMin?: number;
  screenTimeApps?: AppUsage[];
  screenTimeHourly?: HourlyUsage[];
  preSleepScreenMin?: number;

  // Health
  restingHr?: number;
  hrv?: number;
  steps?: number;

  // AI
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
  hour: number;                    // 0-23
  minutes: number;
  dominantCategory?: string | null; // "Social", "Entertainment", "Games", "Other" — from bar colour
}

export interface GeminiScreenTimeResponse {
  date: string | null;
  total_minutes: number;
  apps: AppUsage[];
  hourly: HourlyUsage[];
}
```

---

## Environment Variables

Stored in `.env` at project root (never committed to git):

```
GEMINI_API_KEY=your_key_here
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key
```

Accessed via `expo-constants` or `react-native-dotenv`.

Add `.env` to `.gitignore` immediately.

---

## Coding Conventions

- **TypeScript strict mode** — no `any`, no implicit nulls
- **Functional components only** — no class components
- **Custom hooks** for all data fetching — no fetch calls inside components
- **SQLite is the source of truth** — Supabase is a mirror, never read from it at runtime
- **Gemini calls are expensive** — cache insight in SQLite, never call twice for the same day
- **Error boundaries** around Gemini calls — if the API fails, show the raw data without the insight, never crash
- **Missing data is valid** — a day with no screen time logged is still a valid day row; show it gracefully

---

## Pair Programming Notes

TJ is approximately 3 years into his development journey. He:
- Prioritises understanding over speed
- Is comfortable with React, TypeScript, and Supabase from prior projects
- Has not built a React Native app before — explain any RN-specific concepts clearly
- Prefers to understand the "why" before the "how"

When pair programming on Lumen, explain each step before asking TJ to type it. If introducing a new concept (HealthKit permissions, SQLite migrations, Expo config plugins), give a one-paragraph plain-English explanation before showing the code.