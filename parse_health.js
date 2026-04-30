// Streams export.xml line by line and aggregates health data by date.
// Run from project root: node parse_health.js
// Output: health_data.json (add to .gitignore — contains personal data)

const fs = require('fs');
const readline = require('readline');
const path = require('path');

const INPUT = path.join(__dirname, 'apple_health_export', 'export.xml');
const OUTPUT = path.join(__dirname, 'health_data.json');
const isWatch = (name) => /apple.?watch/i.test(name);
const MIN_SLEEP_MIN = 180;
const MAX_GAP_MS = 2 * 60 * 60 * 1000; // 2-hour gap = different sleep night

function parseAttrs(line) {
  const attrs = {};
  const re = /(\w+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(line)) !== null) attrs[m[1]] = m[2];
  return attrs;
}

function toDate(dt) { return dt.slice(0, 10); }

function parseDate(dt) {
  // "2022-03-14 19:45:19 +0200" → "2022-03-14T19:45:19+02:00"
  return new Date(dt.replace(' ', 'T').replace(' ', '').replace(/([+-])(\d{2})(\d{2})$/, '$1$2:$3'));
}

function durationMins(start, end) {
  return Math.round((parseDate(end) - parseDate(start)) / 60000);
}

const days = {};
const allSleepSegs = [];

function getDay(date) {
  if (!days[date]) days[date] = { steps: 0, restingHr: null, hrv: [] };
  return days[date];
}

const rl = readline.createInterface({
  input: fs.createReadStream(INPUT, { encoding: 'utf8' }),
  crlfDelay: Infinity,
});

let lineCount = 0;

rl.on('line', (line) => {
  lineCount++;
  if (lineCount % 1000000 === 0) process.stdout.write(`\r  ${(lineCount / 1000000).toFixed(1)}M lines...`);
  if (!line.includes('<Record ')) return;

  const a = parseAttrs(line);
  if (!a.startDate || !a.endDate) return;

  switch (a.type) {
    case 'HKQuantityTypeIdentifierStepCount': {
      if (!isWatch(a.sourceName)) break;
      const date = toDate(a.startDate);
      getDay(date).steps += Math.round(parseFloat(a.value) || 0);
      break;
    }
    case 'HKQuantityTypeIdentifierRestingHeartRate': {
      if (!isWatch(a.sourceName)) break;
      const date = toDate(a.endDate);
      getDay(date).restingHr = Math.round(parseFloat(a.value));
      break;
    }
    case 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': {
      if (!isWatch(a.sourceName)) break;
      const date = toDate(a.startDate);
      getDay(date).hrv.push(parseFloat(a.value));
      break;
    }
    case 'HKCategoryTypeIdentifierSleepAnalysis': {
      if (!isWatch(a.sourceName)) break;
      if (a.value === 'HKCategoryValueSleepAnalysisInBed') break;
      const mins = durationMins(a.startDate, a.endDate);
      if (mins > 0) allSleepSegs.push({ value: a.value, mins, startDate: a.startDate, endDate: a.endDate });
      break;
    }
  }
});

rl.on('close', () => {
  console.log(`\n  Done — ${lineCount.toLocaleString()} lines processed.`);

  // Cluster sleep segments into nights: gap > 2h = new night
  allSleepSegs.sort((a, b) => parseDate(a.startDate) - parseDate(b.startDate));

  const clusters = [];
  let cluster = null;

  for (const seg of allSleepSegs) {
    const segStart = parseDate(seg.startDate).getTime();
    if (!cluster || segStart - cluster.lastEnd > MAX_GAP_MS) {
      cluster = { segs: [], lastEnd: 0 };
      clusters.push(cluster);
    }
    cluster.segs.push(seg);
    cluster.lastEnd = Math.max(cluster.lastEnd, parseDate(seg.endDate).getTime());
  }

  // Attribute each cluster to its wake-up date and merge into days
  for (const cl of clusters) {
    const wakeDate = toDate(new Date(cl.lastEnd).toISOString());
    const day = getDay(wakeDate);

    const starts = cl.segs.map(s => parseDate(s.startDate).getTime());

    let deepMin = 0, remMin = 0, lightMin = 0;
    for (const seg of cl.segs) {
      if (seg.value === 'HKCategoryValueSleepAnalysisAsleepDeep') deepMin += seg.mins;
      else if (seg.value === 'HKCategoryValueSleepAnalysisAsleepREM') remMin += seg.mins;
      else if (seg.value === 'HKCategoryValueSleepAnalysisAsleepCore') lightMin += seg.mins;
      else if (seg.value === 'HKCategoryValueSleepAnalysisAsleepUnspecified') lightMin += seg.mins;
    }

    const totalMin = deepMin + remMin + lightMin;
    if (totalMin >= MIN_SLEEP_MIN) {
      day.sleepStart = new Date(Math.min(...starts)).toISOString();
      day.sleepEnd = new Date(cl.lastEnd).toISOString();
      day.sleepDurationMin = totalMin;
      day.sleepDeepMin = deepMin;
      day.sleepRemMin = remMin;
      day.sleepLightMin = lightMin;
    }
  }

  // Build output — skip days with no meaningful data
  const output = {};
  for (const [date, day] of Object.entries(days)) {
    const entry = {};
    if (day.steps > 0) entry.steps = day.steps;
    if (day.restingHr) entry.restingHr = day.restingHr;
    if (day.hrv.length > 0) entry.hrv = Math.round(day.hrv.reduce((a, b) => a + b, 0) / day.hrv.length);
    if (day.sleepDurationMin) {
      entry.sleepStart = day.sleepStart;
      entry.sleepEnd = day.sleepEnd;
      entry.sleepDurationMin = day.sleepDurationMin;
      entry.sleepDeepMin = day.sleepDeepMin;
      entry.sleepRemMin = day.sleepRemMin;
      entry.sleepLightMin = day.sleepLightMin;
    }
    if (Object.keys(entry).length > 0) output[date] = entry;
  }

  const dates = Object.keys(output).sort();
  const sleepDays = dates.filter(d => output[d].sleepDurationMin).length;
  console.log(`  ${dates.length} days total, ${sleepDays} with sleep (${dates[0]} → ${dates[dates.length - 1]})`);
  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
  console.log(`  Written to ${OUTPUT}`);
});

console.log('Parsing export.xml...');
