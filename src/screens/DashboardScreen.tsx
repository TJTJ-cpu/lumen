import { useState } from 'react';
import { StyleSheet, Text, View, Button } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useDailyLog } from '../hooks/useDailyLog';
import { upsertDailyLog } from '../services/storage';

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

  return (
    <View style={styles.container}>
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
        </View>
      ) : (
        <Text style={styles.body}>No data for {date}</Text>
      )}

      <View style={styles.buttons}>
        <Button title="Seed test data" onPress={onSeed} />
        <Button title="History" onPress={() => navigation.navigate('History')} />
        <Button title="Capture Screen Time" onPress={() => navigation.navigate('Capture')} />
      </View>
    </View>
  );

}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: '600', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24 },
  body: { fontSize: 16, marginBottom: 8 },
  dataBlock: { marginBottom: 24, alignItems: 'center' },
  dayNav: { flexDirection: 'row', gap: 24, marginBottom: 16 },
  buttons: { gap: 12, width: '100%' },
});
