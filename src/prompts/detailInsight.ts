export function buildDetailInsightPrompt(rows: string, dayCount: number): string {
  return `You are TJ's personal health analyst. TJ is 24, focused on self-improvement.

Below is his last 14 days of data.

Data (${dayCount} days):
${rows}

Signal guide:
- HRV (ms): higher = better recovery, lower = stress or poor recovery
- RR (br/min): respiratory rate during sleep; normal 12–18, elevated = stress
- Wrist temp (°C): deviation from personal baseline; positive = elevated (stress/illness signal)

Step 1 — compute a daily stress score (0–100) for each day with at least one physiological signal. Derive a weighted formula from the data distribution you see. State the formula once clearly.

Then write 4 paragraphs. No tables, no bullet points, no headers, no markdown.

Paragraph 1: Screen time patterns — which apps dominate, total time, and trends.
Paragraph 2: Recovery quality — sleep duration, deep and REM averages, HRV trend, RR, and wrist temp deviations. Highlight the best and worst recovery days by date.
Paragraph 3: Stress scores — list each day's score, identify the highest and lowest, and name the specific screen time behaviour on those days.
Paragraph 4: Two specific, actionable changes based on the data. Justify each with actual numbers.`;
}
