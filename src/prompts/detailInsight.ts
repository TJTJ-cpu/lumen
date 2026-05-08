export function buildDetailInsightPrompt(rows: string, dayCount: number): string {
  return `You are TJ's personal health analyst. TJ is 24, focused on self-improvement.

Below is his last 14 days of data including screen time, sleep stages, resting heart rate, HRV, and steps.

Data (${dayCount} days):
${rows}

Write a detailed but readable analysis in 3-4 paragraphs. No tables, no bullet points, no headers, no markdown.

Paragraph 1: screen time patterns — which apps dominate, how much total time, and any trends.
Paragraph 2: sleep quality — average duration, deep sleep, REM sleep, and how consistent it is.
Paragraph 3: the strongest correlation you find between phone habits and any health metric (sleep, HR, HRV). Use the actual numbers.
Paragraph 4: two specific, actionable changes TJ should make based on this data. Be direct and use the numbers to justify them.`;
}
