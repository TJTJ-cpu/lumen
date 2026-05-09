export function computeHardCall(
  today: {
    hrv?: number;
    respiratoryRate?: number;
    wristTempDeviation?: number;
  },
  avg21: {
    hrv: number | null;
    respiratoryRate: number | null;
  }
): number | null {
  let total = 0;
  let weight = 0;

  // HRV — 50%: 100 when today >= avg, 0 when today < 40% of avg
  if (today.hrv && avg21.hrv) {
    const ratio = today.hrv / avg21.hrv;
    const score = Math.min(1, Math.max(0, (ratio - 0.4) / 0.6));
    total += score * 0.5;
    weight += 0.5;
  }

  // Respiratory rate — 25%: 100 within ±0.5 of avg, 0 when >3 above avg
  if (today.respiratoryRate && avg21.respiratoryRate) {
    const delta = today.respiratoryRate - avg21.respiratoryRate;
    const score = delta <= 0.5 ? 1 : delta >= 3.0 ? 0 : 1 - (delta - 0.5) / 2.5;
    total += score * 0.25;
    weight += 0.25;
  }

  // Wrist temp — 25%: 100 at ≤0°C deviation, 0 at ≥1.2°C
  if (today.wristTempDeviation != null) {
    const wt = today.wristTempDeviation;
    const score = wt <= 0 ? 1 : wt >= 1.2 ? 0 : 1 - wt / 1.2;
    total += score * 0.25;
    weight += 0.25;
  }

  if (weight === 0) return null;
  // Invert so 100 = maximum stress, 0 = fully recovered
  return Math.round((1 - total / weight) * 100);
}
