import { GEMINI_API_KEY } from "../constants/config";
import type { GeminiScreenTimeResponse } from "../types";

// const MODEL = 'gemini-2.5-flash';
const MODEL = 'gemini-2.5-flash-lite';
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

