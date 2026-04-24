import { FlatList, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, DailyLog } from '../types';
import { useRecentDailyLogs } from '../hooks/useRecentDailyLogs';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

export default function HistoryScreen({}: Props) {
  const { logs, loading } = useRecentDailyLogs(30);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Loading…</Text>
      </View>
    );
  }

  if (logs.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>
          No data yet. Capture a screenshot or seed some data from the Dashboard.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={logs}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <DayCard log={item} />}
      contentContainerStyle={styles.list}
    />
  );
}

function DayCard({ log }: { log: DailyLog }) {
  return (
    <View style={styles.card}>
      <Text style={styles.date}>{log.date}</Text>
      <Text style={styles.row}>Sleep: {log.sleepDurationMin ?? '—'} min</Text>
      <Text style={styles.row}>Screen time: {log.screenTimeTotalMin ?? '—'} min</Text>
      {log.insight && (
        <Text style={styles.insight} numberOfLines={2}>
          {log.insight}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: { fontSize: 14, color: '#666', textAlign: 'center' },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16 },
  date: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  row: { fontSize: 14, color: '#333', marginBottom: 4 },
  insight: { fontSize: 13, color: '#666', marginTop: 8, fontStyle: 'italic' },
});
