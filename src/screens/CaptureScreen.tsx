// src/screens/CaptureScreen.tsx
import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Button,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../types';
import { parseScreenTime } from '../services/gemini';
import { saveDailyLog } from '../services/sync';

type Props = NativeStackScreenProps<RootStackParamList, 'Capture'>;

export default function CaptureScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runShortcut = () => {
    Linking.openURL('shortcuts://run-shortcut?name=LumenCapture');
  };

  const pickAndParse = async () => {
    setError(null);

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo library permission denied.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 0,
      base64: true,
      quality: 1,
    });
    if (result.canceled) return;

    const assets = result.assets.filter(a => a.base64);
    if (assets.length === 0) {
      setError('No base64 data from picker.');
      return;
    }

    setLoading(true);
    let success = 0;
    let failed = 0;

    for (let i = 0; i < assets.length; i++) {
      setProgress(`Processing ${i + 1} of ${assets.length}…`);
      try {
        const parsed = await parseScreenTime(
          assets[i].base64!,
          assets[i].mimeType ?? 'image/jpeg'
        );
        const date = parsed.date ?? new Date().toISOString().slice(0, 10);
        await saveDailyLog({
          date,
          screenTimeTotalMin: parsed.total_minutes,
          screenTimeApps: parsed.apps,
          screenTimeHourly: parsed.hourly,
        });
        success++;
      } catch (e) {
        console.warn(`Failed on image ${i + 1}:`, e);
        failed++;
      }
    }

    setLoading(false);
    setProgress(null);

    Alert.alert(
      'Done',
      `Saved ${success}.${failed > 0 ? ` Failed: ${failed}.` : ''}`
    );
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Capture Screen Time</Text>
      <Text style={styles.subtitle}>
        Take a Screen Time screenshot (via the LumenCapture shortcut or manually),
        then pick it from your photos.
      </Text>

      {loading ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator size="large" />
          {progress && <Text style={styles.progress}>{progress}</Text>}
        </View>
      ) : (
        <View style={styles.buttons}>
          <Button title="1. Run LumenCapture Shortcut" onPress={runShortcut} />
          <Button title="2. Pick Screenshot & Parse" onPress={pickAndParse} />
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24, textAlign: 'center' },
  buttons: { gap: 12, width: '100%' },
  spinner: { marginVertical: 24 },
  loadingBlock: { alignItems: 'center', marginVertical: 24 },
  progress: { marginTop: 12, fontSize: 14, color: '#555' },
  error: { color: '#c00', marginTop: 24, textAlign: 'center' },
});
