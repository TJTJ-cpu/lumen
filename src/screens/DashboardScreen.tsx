import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, ScrollView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useDailyLog } from '../hooks/useDailyLog';
import { getCorrelationData, get21DayAverages, upsertDailyLog } from '../services/storage';
import { generateOverallInsight } from '../services/ai';
import { pullFromSupabase } from '../services/sync';
import { computeHardCall } from '../utils/hardCall';

const INSIGHT_KEY = 'overall_insight';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

function formatMins(m: number): string {
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function DashboardScreen({ navigation }: Props) {
  const [offset, setOffset] = useState(1);
  const dateObj = new Date(Date.now() - offset * 86400000);
  const date = dateObj.toISOString().slice(0, 10);
  const dateLabel =
    offset === 0 ? 'Today' :
    offset === 1 ? 'Yesterday' :
    dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const { log, loading, refresh } = useDailyLog(date);
  const [hardCallScore, setHardCallScore] = useState<number | null>(null);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightDate, setInsightDate] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  const onGenerateInsight = async () => {
    setInsightLoading(true);
    try {
      const data = await getCorrelationData();
      const text = await generateOverallInsight(data);
      const now = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      await AsyncStorage.setItem(INSIGHT_KEY, text);
      await AsyncStorage.setItem(INSIGHT_KEY + '_date', now);
      setInsight(text);
      setInsightDate(now);
    } catch (err) {
      Alert.alert('Failed', err instanceof Error ? err.message : 'Could not generate insight.');
    } finally {
      setInsightLoading(false);
    }
  };

  const loadInsight = async () => {
    const saved = await AsyncStorage.getItem(INSIGHT_KEY);
    const savedDate = await AsyncStorage.getItem(INSIGHT_KEY + '_date');
    if (saved) setInsight(saved);
    if (savedDate) setInsightDate(savedDate);
  };

  useState(() => { loadInsight(); });

  useEffect(() => {
    if (!log) { setHardCallScore(null); return; }
    get21DayAverages().then(avg => {
      const score = computeHardCall(
        { hrv: log.hrv, respiratoryRate: log.respiratoryRate, wristTempDeviation: log.wristTempDeviation },
        avg
      );
      setHardCallScore(score);
      if (score != null && log.stressLevel !== score) {
        upsertDailyLog({ date: log.date, stressLevel: score }).catch(() => {});
      }
    });
  }, [log]);

  const onRestore = async () => {
    const result = await pullFromSupabase();
    await refresh();
    Alert.alert(
      'Restore done',
      `Restored ${result.restored} rows from Supabase.${result.failed > 0 ? ` Failed ${result.failed}.` : ''}`
    );
  };

return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Lumen</Text>
      <Text style={styles.subtitle}>{dateLabel}</Text>

      <View style={styles.dayNav}>
        <Button title="← Prev" onPress={() => setOffset(o => o + 1)} />
        <Button
          title="Next →"
          onPress={() => setOffset(o => Math.max(0, o - 1))}
          disabled={offset === 0}
        />
      </View>

      {loading ? (
        <Text style={styles.body}>Loading…</Text>
      ) : log ? (
        <View style={styles.dataBlock}>
          <Text style={styles.body}>Sleep: {log.sleepDurationMin ? formatMins(log.sleepDurationMin) : '—'}</Text>
          <Text style={styles.body}>Screen time: {log.screenTimeTotalMin ? formatMins(log.screenTimeTotalMin) : '—'}</Text>
          <Text style={styles.body}>Resting HR: {log.restingHr ? `${log.restingHr} bpm` : '—'}</Text>
          <Text style={styles.body}>Stress Level: {hardCallScore != null ? `${hardCallScore} / 100` : '—'}</Text>

          {log.screenTimeApps && log.screenTimeApps.length > 0 && (() => {
            const max = Math.max(...log.screenTimeApps!.map(a => a.minutes));
            return (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Apps</Text>
                {log.screenTimeApps!.map((app) => (
                  <View key={app.name} style={styles.appRow}>
                    <Text style={styles.appName} numberOfLines={1}>{app.name}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${(app.minutes / max) * 100}%` }]} />
                    </View>
                    <Text style={styles.appTime}>{formatMins(app.minutes)}</Text>
                  </View>
                ))}
              </View>
            );
          })()}

           {/* {log.screenTimeHourly && log.screenTimeHourly.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Hourly</Text>
              {log.screenTimeHourly.map((h) => (
                <Text key={h.hour} style={styles.rowSmall}>
                  {String(h.hour).padStart(2, '0')}:00 — {h.minutes} min
                  {h.dominantCategory ? ` (${h.dominantCategory})` : ''}
                </Text>
              ))}
            </View>
          )} */}

        </View>
      ) : (
        <Text style={styles.body}>No data for {date}</Text>
      )}

      {(insight || insightLoading) && (
        <View style={styles.insightBlock}>
          <Text style={styles.sectionTitle}>Overall Insight</Text>
          {insightDate && <Text style={styles.insightDate}>Generated {insightDate}</Text>}
          {insightLoading ? (
            <Text style={styles.insightText}>Generating…</Text>
          ) : (
            <Text style={styles.insightText}>{insight}</Text>
          )}
        </View>
      )}

      <View style={styles.buttons}>
        <Button title="Trends" onPress={() => navigation.navigate('Trends')} />
        <Button title="Total Screen Time" onPress={() => navigation.navigate('Totals')} />
        <Button title="Capture Screen Time" onPress={() => navigation.navigate('Capture')} />
        <Button title="Restore from Supabase" onPress={onRestore} />
        <Button title={insight ? "Regenerate Insight" : "Generate Insight"} onPress={onGenerateInsight} />
        <Button title="Detail Insight" onPress={() => navigation.navigate('DetailInsight')} />
        {/* <Button title="Wipe DB" color="#c00" onPress={onWipe} /> */}
      </View>
    </ScrollView>
  );

}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, paddingBottom: 48 },
  title: { fontSize: 32, fontWeight: '600', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24 },
  body: { fontSize: 16, marginBottom: 8 },
  dataBlock: { marginBottom: 24, alignItems: 'center' },
  dayNav: { flexDirection: 'row', gap: 24, marginBottom: 16 },
  section: { marginTop: 16, alignItems: 'flex-start', alignSelf: 'stretch' },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4, color: '#444' },
  rowSmall: { fontSize: 13, color: '#555' },
  buttons: { gap: 12, width: '100%' },
  insightBlock: { marginTop: 20, padding: 14, backgroundColor: '#f5f5f5', borderRadius: 10, alignSelf: 'stretch' },
  insightDate: { fontSize: 12, color: '#999', marginBottom: 6 },
  insightText: { fontSize: 14, color: '#333', lineHeight: 20 },
  appRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  appName: { width: 110, fontSize: 13, color: '#333' },
  barTrack: { flex: 1, height: 6, backgroundColor: '#e0e0e0', borderRadius: 3, overflow: 'hidden', marginHorizontal: 8 },
  barFill: { height: 6, backgroundColor: '#333', borderRadius: 3 },
  appTime: { width: 48, fontSize: 13, color: '#555', textAlign: 'right' },
});
