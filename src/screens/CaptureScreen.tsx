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
      base64: true,
      quality: 1,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset.base64) {
      setError('No base64 data from picker.');
      return;
    }

    setLoading(true);
    try {
      const parsed = await parseScreenTime(
        asset.base64,
        asset.mimeType ?? 'image/jpeg'
      );

      const date = parsed.date ?? new Date().toISOString().slice(0, 10);

      await saveDailyLog({
        date,
        screenTimeTotalMin: parsed.total_minutes,
        screenTimeApps: parsed.apps,
        screenTimeHourly: parsed.hourly,
      });

      Alert.alert(
        'Saved',
        `Screen time for ${date} saved. Total: ${parsed.total_minutes} min`
      );
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Capture Screen Time</Text>
      <Text style={styles.subtitle}>
        Take a Screen Time screenshot (via the LumenCapture shortcut or manually),
        then pick it from your photos.
      </Text>

      {loading ? (
        <ActivityIndicator size="large" style={styles.spinner} />
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
  error: { color: '#c00', marginTop: 24, textAlign: 'center' },
});
