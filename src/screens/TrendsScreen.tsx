import { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { get21DayAverages, getRecentDailyLogs } from '../services/storage';
import { computeHardCall } from '../utils/hardCall';
import type { DailyLog } from '../types';

const CHART_WIDTH = Dimensions.get('window').width - 48;

function dayLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Tooltip({ date, value }: { date: string; value: string }) {
  return (
    <View style={styles.tooltip}>
      <Text style={styles.tooltipDate}>{date}</Text>
      <Text style={styles.tooltipValue}>{value}</Text>
    </View>
  );
}

export default function TrendsScreen() {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSleep, setSelectedSleep] = useState<number | null>(null);
  const [selectedScreen, setSelectedScreen] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([getRecentDailyLogs(14), get21DayAverages()]).then(([raw, avg]) => {
      const annotated = raw.map(l => ({
        ...l,
        stressLevel: l.stressLevel ?? computeHardCall(
          { hrv: l.hrv, respiratoryRate: l.respiratoryRate, wristTempDeviation: l.wristTempDeviation },
          avg
        ) ?? undefined,
      }));
      setLogs([...annotated].reverse());
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }

  const barWidth = 14;
  const spacing = Math.max(4, Math.floor((CHART_WIDTH - 40) / logs.length) - barWidth);

  const sleepData = logs.map(l => ({
    value: l.sleepDurationMin ? Math.round((l.sleepDurationMin / 60) * 10) / 10 : 0,
    label: dayLabel(l.date),
    frontColor: l.sleepDurationMin ? '#333' : '#e0e0e0',
    date: l.date,
  }));

  const screenData = logs.map(l => ({
    value: l.screenTimeTotalMin ? Math.round((l.screenTimeTotalMin / 60) * 10) / 10 : 0,
    label: dayLabel(l.date),
    frontColor: l.screenTimeTotalMin ? '#555' : '#e0e0e0',
    date: l.date,
  }));

  const stressData = logs.map(l => ({
    value: l.stressLevel ?? 0,
    label: dayLabel(l.date),
    date: l.date,
    hideDataPoint: l.stressLevel == null,
  }));

  const hasSleep = logs.some(l => l.sleepDurationMin != null);
  const hasScreen = logs.some(l => l.screenTimeTotalMin != null);
  const hasStress = logs.some(l => l.stressLevel != null);

  const maxSleep = Math.ceil(Math.max(...sleepData.map(d => d.value), 8));
  const maxScreen = Math.ceil(Math.max(...screenData.map(d => d.value), 6));

  const dateRange = logs.length > 0
    ? `${formatDate(logs[0].date)} – ${formatDate(logs[logs.length - 1].date)}`
    : '';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.dateRange}>{dateRange}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sleep</Text>
        <Text style={styles.sectionUnit}>hours per night · tap a bar</Text>
        {hasSleep ? (
          <BarChart
            data={sleepData}
            width={CHART_WIDTH}
            barWidth={barWidth}
            spacing={spacing}
            barBorderRadius={3}
            noOfSections={4}
            maxValue={maxSleep}
            yAxisTextStyle={styles.axisText}
            xAxisLabelTextStyle={styles.axisText}
            hideRules
            isAnimated
            onPress={(item: any, index: number) =>
              setSelectedSleep(selectedSleep === index ? null : index)
            }
            renderTooltip={(item: any, index: number) =>
              selectedSleep === index
                ? <Tooltip date={formatDate(item.date)} value={`${item.value}h`} />
                : null
            }
          />
        ) : (
          <Text style={styles.noData}>No sleep data yet</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Screen Time</Text>
        <Text style={styles.sectionUnit}>hours per day · tap a bar</Text>
        {hasScreen ? (
          <BarChart
            data={screenData}
            width={CHART_WIDTH}
            barWidth={barWidth}
            spacing={spacing}
            barBorderRadius={3}
            noOfSections={4}
            maxValue={maxScreen}
            yAxisTextStyle={styles.axisText}
            xAxisLabelTextStyle={styles.axisText}
            hideRules
            isAnimated
            onPress={(item: any, index: number) =>
              setSelectedScreen(selectedScreen === index ? null : index)
            }
            renderTooltip={(item: any, index: number) =>
              selectedScreen === index
                ? <Tooltip date={formatDate(item.date)} value={`${item.value}h`} />
                : null
            }
          />
        ) : (
          <Text style={styles.noData}>No screen time data yet</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stress Level</Text>
        <Text style={styles.sectionUnit}>0 = recovered · 100 = stressed · hold &amp; drag</Text>
        {hasStress ? (
          <LineChart
            data={stressData}
            width={CHART_WIDTH}
            color={'#333'}
            thickness={2}
            dataPointsColor={'#333'}
            dataPointsRadius={4}
            noOfSections={4}
            maxValue={100}
            yAxisTextStyle={styles.axisText}
            xAxisLabelTextStyle={styles.axisText}
            hideRules
            isAnimated
            pointerConfig={{
              activatePointersOnLongPress: true,
              pointerStripHeight: 180,
              pointerStripColor: '#ddd',
              pointerStripWidth: 1,
              pointerColor: '#333',
              radius: 5,
              pointerLabelWidth: 90,
              pointerLabelHeight: 52,
              autoAdjustPointerLabelPosition: true,
              pointerLabelComponent: (items: any[]) => (
                <Tooltip date={formatDate(items[0].date)} value={String(items[0].value)} />
              ),
            }}
          />
        ) : (
          <Text style={styles.noData}>Open the dashboard for a few days to populate this chart</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dateRange: { fontSize: 13, color: '#999', marginBottom: 28 },
  section: { marginBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111', marginBottom: 2 },
  sectionUnit: { fontSize: 12, color: '#999', marginBottom: 14 },
  noData: { fontSize: 13, color: '#aaa', fontStyle: 'italic' },
  axisText: { fontSize: 10, color: '#999' },
  tooltip: {
    backgroundColor: '#111',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    marginBottom: 4,
  },
  tooltipDate: { fontSize: 11, color: '#aaa', marginBottom: 1 },
  tooltipValue: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
