import { useState } from 'react';
import { StyleSheet, Text, View, Button, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { getDetailInsightData } from '../services/storage';
import { generateDetailInsight } from '../services/gemini';

type Props = NativeStackScreenProps<RootStackParamList, 'DetailInsight'>;

export default function DetailInsightScreen({}: Props) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onGenerate = async () => {
    setLoading(true);
    try {
      const data = await getDetailInsightData();
      const text = await generateDetailInsight(data);
      setInsight(text);
    } catch (err) {
      Alert.alert('Failed', err instanceof Error ? err.message : 'Could not generate insight.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Detail Insight</Text>
      <Text style={styles.subtitle}>Full analysis of your last 14 days</Text>

      {!insight && !loading && (
        <Button title="Generate" onPress={onGenerate} />
      )}

      {loading && (
        <View style={styles.loadingBlock}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Analysing your data…</Text>
        </View>
      )}

      {insight && (
        <>
          <Text style={styles.insight}>{insight}</Text>
          <Button title="Regenerate" onPress={onGenerate} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '600', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24 },
  loadingBlock: { alignItems: 'center', marginTop: 40, gap: 16 },
  loadingText: { fontSize: 14, color: '#666' },
  insight: { fontSize: 15, lineHeight: 24, color: '#111', marginBottom: 24 },
});
