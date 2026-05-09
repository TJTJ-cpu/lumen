export function buildOverallInsightPrompt(rows: string, dayCount: number): string {
  return `You are TJ's personal data analyst. TJ is 24, focused on self-improvement.

Data (last 14 days, ${dayCount} days):
${rows}

Each row contains some or all of: screen time by app, total sleep with deep and REM breakdown, HRV (ms — higher is better recovery), RR (respiratory rate in breaths/min — lower during sleep is better), and wrist temp deviation (°C from personal baseline — positive means elevated, which signals stress or illness).

Write exactly 3 short paragraphs. No tables, no bullet points, no headers, no markdown.
Paragraph 1: the strongest pattern between screen time (name the specific app and minutes) and sleep quality — use the actual numbers, including deep sleep and REM where relevant.
Paragraph 2: what the recovery signals show — look at HRV trend, respiratory rate, and wrist temp across the days. Call out the days where recovery was notably good or poor and what the screen time looked like on those days.
Paragraph 3: one specific, actionable change TJ should make this week, justified by the numbers. Be direct. No filler.`;
}
