import { GEMINI_API_KEY } from "../constants/config";
import type { AppUsage, GeminiScreenTimeResponse } from "../types";

// const MODEL = 'gemini-2.5-flash';
const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const PARSE_PROMPT = `You are parsing an iOS Screen Time screenshot. Extract all visible data and return ONLY a valid JSON object with this exact structure, no preamble or markdown:

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
- Return nothing except the JSON object`;


const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;

function isRetryable(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503;
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function parseScreenTime(
  base64Image: string,
  mimeType: string = 'image/jpeg'
): Promise<GeminiScreenTimeResponse> {
  const todayISO = new Date().toISOString().slice(0, 10);
  const prompt = `Today's date is ${todayISO}. If the screenshot shows a day/month without a year (e.g. "Yesterday, 22 April"), infer the year from today's date — prefer the most recent matching day that is not in the future.\n\n${PARSE_PROMPT}`;

  const body = JSON.stringify({
    contents: [
      {
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64Image } },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0,
    },
  });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${ENDPOINT}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    } catch (err) {
      const isLast = attempt === MAX_ATTEMPTS;
      const msg = err instanceof Error ? err.message : String(err);
      if (isLast) {
        throw new Error(`Gemini network error after ${attempt} attempt(s): ${msg}`);
      }
      const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 500);
      console.log(`Gemini network error on attempt ${attempt} (${msg}), retrying in ${delayMs}ms`);
      await sleep(delayMs);
      continue;
    }

    if (res.ok) {
      const json = await res.json();
      const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error(`Gemini returned no text: ${JSON.stringify(json)}`);
      }
      return JSON.parse(text) as GeminiScreenTimeResponse;
    }

    const errText = await res.text();
    const isLast = attempt === MAX_ATTEMPTS;

    if (!isRetryable(res.status) || isLast) {
      throw new Error(`Gemini API error ${res.status} after ${attempt} attempt(s): ${errText}`);
    }

    const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 500);
    console.log(`Gemini ${res.status} on attempt ${attempt}, retrying in ${delayMs}ms`);
    await sleep(delayMs);
  }

  throw new Error('parseScreenTime: exhausted retries');
}

export async function generateOverallInsight(
  logs: Array<{
    date: string;
    screenTimeTotalMin?: number;
    screenTimeApps?: AppUsage[];
    sleepDurationMin?: number;
    sleepDeepMin?: number;
    sleepRemMin?: number;
  }>
): Promise<string> {
  const withBoth = logs.filter(l => l.screenTimeTotalMin && l.sleepDurationMin);
  if (withBoth.length === 0) throw new Error('No days with both screen time and sleep data');

  const rows = withBoth.map(l => {
    const screenH = Math.floor(l.screenTimeTotalMin! / 60);
    const screenM = l.screenTimeTotalMin! % 60;
    const screen = screenH > 0 ? `${screenH}h ${screenM}m` : `${screenM}m`;
    const sleepH = Math.floor(l.sleepDurationMin! / 60);
    const sleepM = l.sleepDurationMin! % 60;
    const sleep = `${sleepH}h ${sleepM}m`;
    const deep = l.sleepDeepMin ?? 0;
    const rem = l.sleepRemMin ?? 0;
    const topApps = l.screenTimeApps?.slice(0, 3).map(a => `${a.name} ${a.minutes}m`).join(', ') ?? '';
    return `${l.date}: screen ${screen} (${topApps}), sleep ${sleep} (deep ${deep}m, REM ${rem}m)`;
  }).join('\n');

  const prompt = `You are TJ's blunt personal data analyst. TJ is 23, focused on self-improvement.

Below is his history of screen time and sleep data. Find the strongest real correlation between his phone habits and sleep quality. Be specific — name actual apps, actual numbers, actual patterns.

Data (${withBoth.length} days):
${rows}

Write 3-4 sentences. Lead with the strongest correlation you find. Be direct and specific — use the actual numbers. End with one concrete change.
Rules: second person ("You"), no bullet points, no headers, no filler. Return only the insight text.`;

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7 },
  });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${ENDPOINT}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    } catch (err) {
      const isLast = attempt === MAX_ATTEMPTS;
      const msg = err instanceof Error ? err.message : String(err);
      if (isLast) throw new Error(`Gemini network error after ${attempt} attempt(s): ${msg}`);
      await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 500));
      continue;
    }

    if (res.ok) {
      const json = await res.json();
      const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error(`Gemini returned no text: ${JSON.stringify(json)}`);
      return text.trim();
    }

    const errText = await res.text();
    const isLast = attempt === MAX_ATTEMPTS;
    if (!isRetryable(res.status) || isLast) {
      throw new Error(`Gemini API error ${res.status} after ${attempt} attempt(s): ${errText}`);
    }
    await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 500));
  }

  throw new Error('generateOverallInsight: exhausted retries');
}

