// Drop export.zip in the project root, then run: node parse_health.js
// It will unzip, parse, write health_data.json, push to Supabase, and clean up.

const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();

const ZIP_PATH = path.join(__dirname, 'export.zip');
const TEMP_DIR = path.join(__dirname, 'export_temp');
const OUTPUT = path.join(__dirname, 'health_data.json');

const isWatch = (name) => /apple.?watch/i.test(name);
const MIN_SLEEP_MIN = 180;
const MAX_GAP_MS = 2 * 60 * 60 * 1000;

// --- Unzip ---
if (!fs.existsSync(ZIP_PATH)) {
  console.error('export.zip not found in project root. Put it there and re-run.');
  process.exit(1);
}

console.log('Unzipping export.zip...');
if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true });
fs.mkdirSync(TEMP_DIR, { recursive: true });
execSync(`tar -xf "${ZIP_PATH}" -C "${TEMP_DIR}"`);

// --- Find export.xml ---
function findFile(dir, filename) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(full, filename);
      if (found) return found;
    } else if (entry.name === filename) {
      return full;
    }
  }
  return null;
}

const INPUT = findFile(TEMP_DIR, 'export.xml');
if (!INPUT) {
  console.error('export.xml not found inside the zip.');
  process.exit(1);
}
console.log(`Found export.xml at: ${INPUT}`);

// --- Parse ---
function parseAttrs(line) {
  const attrs = {};
  const re = /(\w+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(line)) !== null) attrs[m[1]] = m[2];
  return attrs;
}

function toDate(dt) { return dt.slice(0, 10); }

function parseDate(dt) {
  return new Date(dt.replace(' ', 'T').replace(' ', '').replace(/([+-])(\d{2})(\d{2})$/, '$1$2:$3'));
}

function durationMins(start, end) {
  return Math.round((parseDate(end) - parseDate(start)) / 60000);
}

const days = {};
const allSleepSegs = [];

function getDay(date) {
  if (!days[date]) days[date] = { steps: 0, restingHr: null, hrv: [], respiratoryRate: [], wristTemp: [] };
  return days[date];
}

const rl = readline.createInterface({
  input: fs.createReadStream(INPUT, { encoding: 'utf8' }),
  crlfDelay: Infinity,
});

let lineCount = 0;

console.log('Parsing export.xml...');

rl.on('line', (line) => {
  lineCount++;
  if (lineCount % 1000000 === 0) process.stdout.write(`\r  ${(lineCount / 1000000).toFixed(1)}M lines...`);
  if (!line.includes('<Record ')) return;

  const a = parseAttrs(line);
  if (!a.startDate || !a.endDate) return;

  switch (a.type) {
    case 'HKQuantityTypeIdentifierStepCount': {
      if (!isWatch(a.sourceName)) break;
      getDay(toDate(a.startDate)).steps += Math.round(parseFloat(a.value) || 0);
      break;
    }
    case 'HKQuantityTypeIdentifierRestingHeartRate': {
      if (!isWatch(a.sourceName)) break;
      getDay(toDate(a.endDate)).restingHr = Math.round(parseFloat(a.value));
      break;
    }
    case 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': {
      if (!isWatch(a.sourceName)) break;
      getDay(toDate(a.startDate)).hrv.push(parseFloat(a.value));
      break;
    }
    case 'HKQuantityTypeIdentifierRespiratoryRate': {
      if (!isWatch(a.sourceName)) break;
      getDay(toDate(a.startDate)).respiratoryRate.push(parseFloat(a.value));
      break;
    }
    case 'HKQuantityTypeIdentifierAppleSleepingWristTemperature': {
      getDay(toDate(a.startDate)).wristTemp.push(parseFloat(a.value));
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

rl.on('close', async () => {
  console.log(`\n  Done — ${lineCount.toLocaleString()} lines processed.`);

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

  const output = {};
  for (const [date, day] of Object.entries(days)) {
    const entry = {};
    if (day.steps > 0) entry.steps = day.steps;
    if (day.restingHr) entry.restingHr = day.restingHr;
    if (day.hrv.length > 0) entry.hrv = Math.round(day.hrv.reduce((a, b) => a + b, 0) / day.hrv.length);
    if (day.respiratoryRate.length > 0) entry.respiratoryRate = parseFloat((day.respiratoryRate.reduce((a, b) => a + b, 0) / day.respiratoryRate.length).toFixed(1));
    if (day.wristTemp.length > 0) entry.wristTempDeviation = parseFloat((day.wristTemp.reduce((a, b) => a + b, 0) / day.wristTemp.length).toFixed(2));
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

  // --- Push to Supabase ---
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log('  Supabase credentials not found in .env — skipping push.');
  } else {
    console.log('  Pushing to Supabase...');
    const rows = Object.entries(output).map(([date, day]) => ({
      id: date,
      date,
      steps: day.steps ?? null,
      resting_hr: day.restingHr ?? null,
      hrv: day.hrv ?? null,
      respiratory_rate: day.respiratoryRate ?? null,
      wrist_temp_deviation: day.wristTempDeviation ?? null,
      sleep_start: day.sleepStart ?? null,
      sleep_end: day.sleepEnd ?? null,
      sleep_duration_min: day.sleepDurationMin ?? null,
      sleep_deep_min: day.sleepDeepMin ?? null,
      sleep_rem_min: day.sleepRemMin ?? null,
      sleep_light_min: day.sleepLightMin ?? null,
      updated_at: new Date().toISOString(),
    }));

    const CHUNK = 100;
    let pushed = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const res = await fetch(`${supabaseUrl}/rest/v1/daily_log`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error(`  Supabase error on chunk ${i / CHUNK + 1}: ${err}`);
      } else {
        pushed += chunk.length;
        process.stdout.write(`\r  Pushed ${pushed}/${rows.length} rows...`);
      }
    }
    console.log(`\n  Done — ${pushed} rows pushed to Supabase.`);
  }

  // --- Cleanup ---
  fs.rmSync(TEMP_DIR, { recursive: true });
  console.log('  Cleaned up export_temp/');
});
