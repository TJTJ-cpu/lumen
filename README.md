@ -0,0 +1,42 @@
# Lumen

Personal iOS app that correlates Apple Health data (sleep, HR, HRV) with iOS Screen Time to surface how phone habits affect physical wellbeing. Single-user, sideloaded — never published.

## How it works

1. Take a screenshot of iOS Settings → Screen Time
2. Pick it in the app
3. Gemini Vision parses the screenshot into structured JSON (total minutes, per-app breakdown, hourly chart)
4. Data is saved to local SQLite and mirrored to Supabase
5. Apple Health data (planned) auto-fills sleep + HR fields
6. Gemini generates a daily insight correlating the two

## Stack

- React Native + Expo (TypeScript)
- SQLite via `expo-sqlite` (source of truth)
- Supabase (cloud mirror)
- Gemini 2.5 API (vision parsing + insights)
- `react-native-health` for HealthKit (planned)

Scan the QR code with Expo Go on iOS.

## Status

| Done | Planned |
|---|---|
| Capture pipeline (screenshot → Gemini → SQLite) | Apple Health integration |
| Dashboard, History, Totals screens | Daily AI insight generation |
| Multi-image upload with retry/backoff | Apple Shortcut for capture |
| All-time + last-2-weeks app stats | Sleep stage UI |
| Supabase mirror | Sideloadly build pipeline |

See [CLAUDE.md](CLAUDE.md) for full architecture and development notes.
