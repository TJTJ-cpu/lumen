export function buildOverallInsightPrompt(rows: string, dayCount: number): string {
  return `You are TJ's personal data analyst. TJ is 24, focused on self-improvement.

Data (last 14 days, ${dayCount} days with both screen time and sleep):
${rows}

Write exactly 2 short paragraphs. No tables, no bullet points, no headers, no markdown.
Paragraph 1: the strongest pattern you find in the numbers — name the specific app, the actual minutes, and the actual sleep impact (e.g. "On days you used X for more than 60 minutes, you slept 45 minutes less on average").
Paragraph 2: one specific, actionable recommendation based on that pattern. Be direct. No filler.`;
}
