import { FlatList, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useAppTotals } from '../hooks/useAppTotals';

type Props = NativeStackScreenProps<RootStackParamList, 'Totals'>;

function formatSinceDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem} min`;
  return `${h}h ${rem}m`;
}

export default function TotalsScreen({}: Props) {
  const { earliestDate, totals, loading } = useAppTotals();

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Loading…</Text>
      </View>
    );
  }

  if (totals.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>No app data yet. Capture a screenshot first.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Total Time</Text>
      {earliestDate && (
        <Text style={styles.subtitle}>Since {formatSinceDate(earliestDate)}</Text>
      )}
      <FlatList
        data={totals}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.appName}>{item.name}</Text>
            <Text style={styles.appMinutes}>{formatMinutes(item.minutes)}</Text>
          </View>
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: { fontSize: 14, color: '#666', textAlign: 'center' },
  title: { fontSize: 32, fontWeight: '600', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24 },
  list: { paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  appName: { fontSize: 16, color: '#111' },
  appMinutes: { fontSize: 16, color: '#555', fontVariant: ['tabular-nums'] },
});
