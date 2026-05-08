import { LM_STUDIO_HOST, LM_STUDIO_MODEL } from "../constants/config";
import type { AppUsage, GeminiScreenTimeResponse } from "../types";
import { parseScreenTimePrompt } from "../prompts/parseScreenTime";
import { buildOverallInsightPrompt } from "../prompts/overallInsight";
import { buildDetailInsightPrompt } from "../prompts/detailInsight";

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
        { type: 'text', text: `Today's date is ${new Date().toISOString().slice(0, 10)}. Use this to infer the correct year if the screenshot only shows a day and month.\n\n${parseScreenTimePrompt}` },
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

export async function generateDetailInsight(
  logs: Array<{
    date: string;
    screenTimeTotalMin?: number;
    screenTimeApps?: AppUsage[];
    sleepDurationMin?: number;
    sleepDeepMin?: number;
    sleepRemMin?: number;
    restingHr?: number;
    hrv?: number;
    steps?: number;
  }>
): Promise<string> {
  if (logs.length === 0) throw new Error('No data available for the last 14 days');

  const rows = logs.map(l => {
    const parts: string[] = [`${l.date}:`];
    if (l.screenTimeTotalMin) {
      const topApps = l.screenTimeApps?.slice(0, 5).map(a => `${a.name} ${a.minutes}m`).join(', ') ?? '';
      const h = Math.floor(l.screenTimeTotalMin / 60), m = l.screenTimeTotalMin % 60;
      parts.push(`screen ${h}h ${m}m (${topApps})`);
    }
    if (l.sleepDurationMin) {
      const h = Math.floor(l.sleepDurationMin / 60), m = l.sleepDurationMin % 60;
      parts.push(`sleep ${h}h ${m}m (deep ${l.sleepDeepMin ?? 0}m, REM ${l.sleepRemMin ?? 0}m)`);
    }
    if (l.restingHr) parts.push(`HR ${l.restingHr}bpm`);
    if (l.hrv) parts.push(`HRV ${l.hrv}ms`);
    if (l.steps) parts.push(`steps ${l.steps.toLocaleString()}`);
    return parts.join(' ');
  }).join('\n');

  const messages = [{ role: 'user', content: buildDetailInsightPrompt(rows, logs.length) }];
  return (await callLMStudio(messages, 0.7)).trim();
}
