export function buildOverallInsightPrompt(rows: string, dayCount: number): string {
  return `
You are TJ's personal data analyst. TJ is 24, focused on self-improvement.

Below is his history of screen time and sleep data. Find the strongest real correlation between his phone habits and sleep quality. Be specific — name actual apps, actual numbers, actual patterns.

Data (${dayCount} days):
${rows}

Analyze the dataset to identify the most significant correlation between specific app usage (minutes) and sleep metrics (hours/quality). Calculate the likely impact of the top 'sleep-disrupting' app by comparing days of high usage versus low usage. Lead with the specific delta (e.g., 'Using [App] for more than 45 minutes correlates with a 12% drop in sleep duration'). Avoid anecdotal observations; stick to the math provided in the rows `;
}
