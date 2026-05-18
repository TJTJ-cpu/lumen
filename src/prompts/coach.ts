import type { DailyLog } from '../types';
import { computeHardCall } from '../utils/hardCall';
import { HEALTH_PROTOCOLS } from '../data/healthProtocols';

function fmt(mins: number | undefined): string {
  if (!mins) return '—';
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function buildCoachSystemPrompt(
  logs: DailyLog[],
  avg21: { hrv: number | null; respiratoryRate: number | null }
): string {
  const rows = [...logs].reverse().map(l => {
    const parts: string[] = [l.date];
    if (l.sleepDurationMin)
      parts.push(`sleep ${fmt(l.sleepDurationMin)} (deep ${l.sleepDeepMin ?? 0}m, REM ${l.sleepRemMin ?? 0}m)`);
    if (l.screenTimeTotalMin) {
      const top = l.screenTimeApps?.slice(0, 4).map(a => `${a.name} ${fmt(a.minutes)}`).join(', ') ?? '';
      parts.push(`screen ${fmt(l.screenTimeTotalMin)}${top ? ` (${top})` : ''}`);
    }
    if (l.hrv) parts.push(`HRV ${l.hrv}ms`);
    if (l.respiratoryRate) parts.push(`RR ${l.respiratoryRate.toFixed(1)}br/min`);
    if (l.wristTempDeviation != null)
      parts.push(`wrist ${l.wristTempDeviation > 0 ? '+' : ''}${l.wristTempDeviation.toFixed(2)}°C`);
    const stress = l.stressLevel ?? computeHardCall(
      { hrv: l.hrv, respiratoryRate: l.respiratoryRate, wristTempDeviation: l.wristTempDeviation },
      avg21
    );
    if (stress != null) parts.push(`stress ${stress}/100`);
    return parts.join(' | ');
  }).join('\n');

  const hrvAvg = avg21.hrv ? `${Math.round(avg21.hrv)}ms` : 'unknown';
  const rrAvg = avg21.respiratoryRate ? `${avg21.respiratoryRate.toFixed(1)}br/min` : 'unknown';

  return `You are TJ's personal health coach inside the Lumen app. TJ is 24, focused on self-improvement.

When giving advice, apply the evidence-based protocols below from Andrew Huberman and Bryan Johnson. Ground your recommendations in their frameworks — caffeine timing, HRV interpretation, sleep temperature, evening screen use, morning light, etc.

${HEALTH_PROTOCOLS}

---

TJ's last 14 days of data (oldest first):
${rows}

His 21-day averages: HRV ${hrvAvg}, respiratory rate ${rrAvg}.
Stress score: 0 = fully recovered, 100 = maximum stress — derived from HRV (50%), respiratory rate (25%), and wrist temperature deviation (25%) vs his personal 21-day baseline.

Your role: answer TJ's questions about his data like a direct, knowledgeable coach. Apply Huberman/Johnson principles to his actual numbers. Keep answers short — 2 to 4 sentences unless more is clearly needed. Do not repeat his data back at him unnecessarily. Never invent data not in the context. If you don't have enough data to answer, say so. Always use metric units — Celsius for temperature, kilometres for distance, kilograms for weight. Write in plain text only — no markdown, no asterisks, no bold, no bullet points, no numbered lists, no headers. Just natural sentences.`;
}
