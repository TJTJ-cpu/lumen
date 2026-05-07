export const parseScreenTimePrompt = `You are parsing an iOS Screen Time screenshot. Extract all visible data and return ONLY a valid JSON object with this exact structure, no preamble or markdown:

{
  "date": "YYYY-MM-DD or null if unclear",
  "total_minutes": number,
  "apps": [
    { "name": string, "minutes": number }
  ],
  "hourly": [
    { "hour": number, "minutes": number }
  ]
}

Rules:
- Convert all time strings (e.g. "1h 2m", "58m") to integer minutes
- Include only apps with a visible time value greater than zero
- For hourly: there is always a bar chart in a Screen Time screenshot. Follow these steps exactly:
  STEP 1 — Find the chart. It is a horizontal row of vertical bars sitting above a baseline. The x-axis shows the labels 00, 06, 12, 18 evenly spaced. The y-axis on the right shows a time scale (e.g. 30m, 1h, 2h). This chart is always present.
  STEP 2 — Understand the structure. There are exactly 24 bars total, one for each hour of the day. The labels 00, 06, 12, 18 mark the START of every 6th bar group — they are NOT the only bars. Between "00" and "06" there are 6 bars (hours 0,1,2,3,4,5). Between "06" and "12" there are 6 bars (hours 6,7,8,9,10,11). Between "12" and "18" there are 6 bars (hours 12,13,14,15,16,17). After "18" there are 6 bars (hours 18,19,20,21,22,23).
  STEP 3 — Read each bar. Starting from the left, count each bar one by one. For each bar, look at its height relative to the scale on the right. If the scale shows "30m" at a certain height, a bar that reaches half that height = 15m. A bar at the baseline = 0 minutes, skip it.
  STEP 4 — You MUST produce output. Even if bars are small or faint, estimate from what you can see. A very short bar is still a value — guess 2m or 5m rather than skipping it. Only skip a bar if it is completely flat at the baseline with absolutely no height whatsoever.
- Examine the screenshot carefully before responding. The sum of all app minutes should equal total_minutes — cross-check your values before returning.
- If a field is genuinely not visible, omit it or set to null
- Return nothing except the JSON object`;
