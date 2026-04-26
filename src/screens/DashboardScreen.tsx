import { useState } from 'react';
import { StyleSheet, Text, View, Button, ScrollView, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useDailyLog } from '../hooks/useDailyLog';
import { upsertDailyLog, wipeDailyLogs } from '../services/storage';
import { backfillToSupabase } from '../services/sync';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export default function DashboardScreen({ navigation }: Props) {
  const [offset, setOffset] = useState(1);
  const date = new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
  const { log, loading, refresh } = useDailyLog(date);

  const onSeed = async () => {
    await upsertDailyLog({
      date,
      sleepDurationMin: 420,
      screenTimeTotalMin: 180,
    });
    await refresh();
  };

  const onBackfill = async () => {
    const result = await backfillToSupabase();
    Alert.alert(
      'Backfill done',
      `Pushed ${result.pushed}.${result.failed > 0 ? ` Failed ${result.failed}.` : ''}`
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
      <Text style={styles.subtitle}>{date}</Text>

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

          {log.screenTimeApps && log.screenTimeApps.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Apps</Text>
              {log.screenTimeApps.map((app) => (
                <Text key={app.name} style={styles.rowSmall}>
                  {app.name}: {app.minutes} min
                </Text>
              ))}
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
        <Button title="Seed test data" onPress={onSeed} />
        <Button title="Total Screen Time" onPress={() => navigation.navigate('Totals')} />
        <Button title="History" onPress={() => navigation.navigate('History')} />
        <Button title="Capture Screen Time" onPress={() => navigation.navigate('Capture')} />
        <Button title="Sync to Supabase" onPress={onBackfill} />
        <Button title="Wipe DB" color="#c00" onPress={onWipe} />
      </View>
    </ScrollView>
  );

}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: '600', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24 },
  body: { fontSize: 16, marginBottom: 8 },
  dataBlock: { marginBottom: 24, alignItems: 'center' },
  dayNav: { flexDirection: 'row', gap: 24, marginBottom: 16 },
  section: { marginTop: 16, alignItems: 'flex-start', alignSelf: 'stretch' },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4, color: '#444' },
  rowSmall: { fontSize: 13, color: '#555' },
  buttons: { gap: 12, width: '100%' },
});
