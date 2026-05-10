export function buildOverallInsightPrompt(rows: string, dayCount: number): string {
  return `You are TJ's personal data analyst. TJ is 24, focused on self-improvement.

Data (last 14 days, ${dayCount} days):
${rows}

Each row contains some or all of: screen time by app, total sleep with deep and REM breakdown, HRV (ms — higher is better recovery), RR (respiratory rate in breaths/min — lower during sleep is better), and wrist temp deviation (°C from personal baseline — positive means elevated, which signals stress or illness).

Write exactly 2 short paragraphs. No tables, no bullet points, no headers, no markdown. Write conversationally — like a coach summarising a trend, not a data report. Do not list specific dates or day-by-day stats.

Paragraph 1: the strongest overall pattern you see — which app or habit tends to go hand-in-hand with worse sleep or lower HRV. Describe the general tendency (e.g. "When you use X heavily, your sleep tends to be shorter and your HRV lower the next morning"). Use rough averages if helpful, not a list of dates.
Paragraph 2: one specific, actionable change based on that pattern. Keep it practical and direct.`;
}
