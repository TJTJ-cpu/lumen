import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getRecentDailyLogs, get21DayAverages } from '../services/storage';
import { generateCoachReply } from '../services/ai';
import type { DailyLog } from '../types';

type Message = { role: 'user' | 'assistant'; content: string };

const WELCOME = "Hey TJ! I've loaded your last 14 days of health data. Ask me anything — sleep patterns, screen time habits, stress levels, or what to change.";

export default function CoachScreen() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: WELCOME },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [avg21, setAvg21] = useState<{ hrv: number | null; respiratoryRate: number | null }>({ hrv: null, respiratoryRate: null });
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    Promise.all([getRecentDailyLogs(14), get21DayAverages()]).then(([l, a]) => {
      setLogs(l);
      setAvg21(a);
    });
  }, []);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Message = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const reply = await generateCoachReply(next, logs, avg21);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I couldn't connect to LM Studio. Make sure the server is running and try again.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={120}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.messages}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((msg, i) => (
          <View
            key={i}
            style={[styles.row, msg.role === 'user' ? styles.rowUser : styles.rowAI]}
          >
            <View style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleAI]}>
              <Text style={[styles.text, msg.role === 'user' ? styles.textUser : styles.textAI]}>
                {msg.content}
              </Text>
            </View>
          </View>
        ))}
        {loading && (
          <View style={[styles.row, styles.rowAI]}>
            <View style={[styles.bubble, styles.bubbleAI]}>
              <Text style={styles.textAI}>Thinking…</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask about your health data…"
          placeholderTextColor="#aaa"
          returnKeyType="send"
          onSubmitEditing={send}
          blurOnSubmit={false}
          editable={!loading}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={send}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendIcon}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  messages: { padding: 16, paddingBottom: 8, gap: 10 },
  row: { flexDirection: 'row' },
  rowAI: { justifyContent: 'flex-start' },
  rowUser: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleAI: { backgroundColor: '#f0f0f0', borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: '#222', borderBottomRightRadius: 4 },
  text: { fontSize: 15, lineHeight: 22 },
  textAI: { color: '#111' },
  textUser: { color: '#fff' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#ccc' },
  sendIcon: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
