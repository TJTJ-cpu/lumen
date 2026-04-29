import { useState } from 'react';
import { StyleSheet, Text, View, Button, ScrollView, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useDailyLog } from '../hooks/useDailyLog';
import { useInsight } from '../hooks/useInsight';
import { wipeDailyLogs, wipeInsights } from '../services/storage';
import { backfillToSupabase, pullFromSupabase } from '../services/sync';

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
  const { insight, loading: insightLoading } = useInsight(log);

  const onRestore = async () => {
    const result = await pullFromSupabase();
    await refresh();
    Alert.alert(
      'Restore done',
      `Restored ${result.restored} rows from Supabase.${result.failed > 0 ? ` Failed ${result.failed}.` : ''}`
    );
  };

  const onBackfill = async () => {
    const result = await backfillToSupabase();
    Alert.alert(
      'Backfill done',
      `Pushed ${result.pushed}.${result.failed > 0 ? ` Failed ${result.failed}.` : ''}`
    );
  };

  const onWipeInsights = () => {
    Alert.alert(
      'Wipe all insights?',
      'This clears every saved insight. They will regenerate next time you view each day.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Wipe',
          style: 'destructive',
          onPress: async () => {
            await wipeInsights();
            await refresh();
          },
        },
      ]
    );
  };

  const onWipe = () => {
    Alert.alert(
      'Wipe DB?',
      'This deletes all local rows. Cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Wipe',
          style: 'destructive',
          onPress: async () => {
            await wipeDailyLogs();
            await refresh();
          },
        },
      ]
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
          <Text style={styles.body}>Sleep: {log.sleepDurationMin ?? '—'} min</Text>
          <Text style={styles.body}>Screen time: {log.screenTimeTotalMin ?? '—'} min</Text>

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

          {(insight || insightLoading) && (
            <View style={styles.insightBlock}>
              <Text style={styles.sectionTitle}>Insight</Text>
              {insightLoading ? (
                <Text style={styles.insightText}>Generating…</Text>
              ) : (
                <Text style={styles.insightText}>{insight}</Text>
              )}
            </View>
          )}

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

      <View style={styles.buttons}>
        <Button title="Total Screen Time" onPress={() => navigation.navigate('Totals')} />
        <Button title="History" onPress={() => navigation.navigate('History')} />
        <Button title="Capture Screen Time" onPress={() => navigation.navigate('Capture')} />
        <Button title="Restore from Supabase" onPress={onRestore} />
        <Button title="Sync to Supabase" onPress={onBackfill} />
        <Button title="Wipe Insights" color="#c00" onPress={onWipeInsights} />
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
  insightText: { fontSize: 14, color: '#333', lineHeight: 20 },
  appRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  appName: { width: 110, fontSize: 13, color: '#333' },
  barTrack: { flex: 1, height: 6, backgroundColor: '#e0e0e0', borderRadius: 3, overflow: 'hidden', marginHorizontal: 8 },
  barFill: { height: 6, backgroundColor: '#333', borderRadius: 3 },
  appTime: { width: 48, fontSize: 13, color: '#555', textAlign: 'right' },
});
