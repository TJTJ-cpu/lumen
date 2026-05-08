export const parseScreenTimePrompt = `You are parsing an iOS Screen Time screenshot. Extract all visible data and return ONLY a valid JSON object with this exact structure, no preamble or markdown:

{
  "date": "YYYY-MM-DD or null if unclear",
  "total_minutes": number,
  "apps": [
    { "name": string, "minutes": number }
  ]
}

Rules:
- Convert all time strings (e.g. "1h 2m", "58m") to integer minutes
- Include only apps with a visible time value greater than zero
- Examine the screenshot carefully. The sum of all app minutes should equal total_minutes — cross-check your values before returning.
- If a field is not visible, omit it or set to null
- Return nothing except the JSON object`;
