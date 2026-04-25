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

function formatHoursDecimal(m: number): string {
  return `${(m / 60).toFixed(1)} hours`;
}

export default function TotalsScreen({}: Props) {
  const { earliestDate, totals, totalMinutes, daysCount, loading } = useAppTotals();

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

  const avgPerDay = daysCount > 0 ? totalMinutes / daysCount : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Total Time</Text>
      {earliestDate && (
        <Text style={styles.subtitle}>
          Since {formatSinceDate(earliestDate)} ({daysCount} day{daysCount === 1 ? '' : 's'})
        </Text>
      )}

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total</Text>
          <Text style={styles.summaryValue}>{formatHoursDecimal(totalMinutes)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Average</Text>
          <Text style={styles.summaryValue}>{formatHoursDecimal(avgPerDay)} / day</Text>
        </View>
      </View>

      <Text style={styles.sectionHeader}>By app</Text>
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
  subtitle: { fontSize: 14, color: '#666', marginBottom: 16 },
  summary: { marginBottom: 24, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ddd' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { fontSize: 16, fontWeight: '600', color: '#111' },
  summaryValue: { fontSize: 16, color: '#111', fontVariant: ['tabular-nums'] },
  sectionHeader: { fontSize: 13, fontWeight: '600', color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
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
