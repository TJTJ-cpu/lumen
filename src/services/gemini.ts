import { LM_STUDIO_HOST, LM_STUDIO_MODEL } from "../constants/config";
import type { AppUsage, GeminiScreenTimeResponse } from "../types";
import { parseScreenTimePrompt } from "../prompts/parseScreenTime";
import { buildOverallInsightPrompt } from "../prompts/overallInsight";

const ENDPOINT = `${LM_STUDIO_HOST}/v1/chat/completions`;

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1000;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function callLMStudio(messages: object[], temperature: number = 0): Promise<string> {
  const body = JSON.stringify({
    model: LM_STUDIO_MODEL,
    messages,
    temperature,
    stream: false,
  });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt === MAX_ATTEMPTS) throw new Error(`LM Studio network error after ${attempt} attempt(s): ${msg}`);
      await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1));
      continue;
    }

    if (res.ok) {
      const json = await res.json();
      const text: string | undefined = json?.choices?.[0]?.message?.content;
      if (!text) throw new Error(`LM Studio returned no text: ${JSON.stringify(json)}`);
      return text;
    }

    const errText = await res.text();
    if (attempt === MAX_ATTEMPTS) throw new Error(`LM Studio error ${res.status}: ${errText}`);
    await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1));
  }

  throw new Error('callLMStudio: exhausted retries');
}

export async function parseScreenTime(
  base64Image: string,
  mimeType: string = 'image/jpeg'
): Promise<GeminiScreenTimeResponse> {
  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: parseScreenTimePrompt },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
      ],
    },
  ];

  const text = await callLMStudio(messages, 0);

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON found in response: ${text}`);
  return JSON.parse(jsonMatch[0]) as GeminiScreenTimeResponse;
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

  const messages = [{ role: 'user', content: buildOverallInsightPrompt(rows, withBoth.length) }];
  return (await callLMStudio(messages, 0.7)).trim();
}
