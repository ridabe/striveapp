import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { MaxAvatar, MAX_COLOR } from '@/components/ai/MaxAvatar';
import { MaxChatMessage } from '@/components/ai/MaxChatMessage';
import { useMaxStream } from '@/hooks/useMaxStream';

interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface StudentMini {
  full_name: string;
}

export default function AssistenteIAChatScreen() {
  const { studentId, conversationId: initialConvId } = useLocalSearchParams<{
    studentId: string;
    conversationId: string;
  }>();

  const [student, setStudent] = useState<StudentMini | null>(null);
  const [history, setHistory] = useState<StoredMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const { text, isStreaming, error, conversationId, trigger, reset } = useMaxStream();

  const activeConvId = conversationId ?? (initialConvId || null);

  useEffect(() => {
    if (!studentId) return;
    supabase
      .from('students')
      .select('full_name')
      .eq('id', studentId)
      .single()
      .then(({ data }) => setStudent(data));
  }, [studentId]);

  useEffect(() => {
    if (!activeConvId) {
      setLoadingHistory(false);
      return;
    }
    supabase
      .from('ai_messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', activeConvId)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setHistory((data ?? []) as StoredMessage[]);
        setLoadingHistory(false);
      });
  }, [activeConvId]);

  useEffect(() => {
    if ((text || isStreaming) && scrollRef.current) {
      scrollRef.current.scrollToEnd({ animated: true });
    }
  }, [text, isStreaming]);

  // After streaming ends, reload history to include new messages
  useEffect(() => {
    if (!isStreaming && text && activeConvId) {
      supabase
        .from('ai_messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', activeConvId)
        .in('role', ['user', 'assistant'])
        .order('created_at', { ascending: true })
        .then(({ data }) => {
          setHistory((data ?? []) as StoredMessage[]);
          reset();
        });
    }
  }, [isStreaming]);

  async function handleSend() {
    const msg = inputText.trim();
    if (!msg || !studentId || isStreaming) return;
    setInputText('');

    // Optimistically add user message
    const tempMsg: StoredMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: msg,
      created_at: new Date().toISOString(),
    };
    setHistory((prev) => [...prev, tempMsg]);

    await trigger({
      feature: 'chat',
      studentId,
      message: msg,
      conversationId: activeConvId ?? undefined,
    });
  }

  const firstName = student?.full_name.split(' ')[0] ?? 'aluno';
  const isEmpty = history.length === 0 && !isStreaming && !text;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <MaxAvatar variant={isStreaming ? 'thinking' : 'default'} size="sm" />
          <View style={s.headerTextWrap}>
            <Text style={s.headerTitle}>Max Strive</Text>
            {student && (
              <Text style={s.headerSub} numberOfLines={1}>Chat sobre {firstName}</Text>
            )}
          </View>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={s.messages}
          contentContainerStyle={s.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {loadingHistory ? (
            <ActivityIndicator color={MAX_COLOR} style={{ marginTop: 32 }} />
          ) : isEmpty ? (
            <View style={s.emptyState}>
              <View style={s.emptyAvatarWrap}>
                <View style={s.emptyGlow1} />
                <View style={s.emptyGlow2} />
                <MaxAvatar variant="default" size="lg" />
              </View>
              <Text style={s.emptyTitle}>Chat com Max</Text>
              <Text style={s.emptySub}>
                Tire dúvidas sobre {firstName}, peça ajustes no treino ou explore alternativas de exercícios.
              </Text>
            </View>
          ) : (
            <>
              {history.map((msg) => (
                <MaxChatMessage
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                />
              ))}
              {isStreaming && (
                <MaxChatMessage
                  role="assistant"
                  content={text}
                  isStreaming
                />
              )}
            </>
          )}

          {error && (
            <View style={s.errorCard}>
              <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        {/* Input */}
        <View style={s.inputArea}>
          <TextInput
            style={s.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder={`Pergunte sobre ${firstName}...`}
            placeholderTextColor={Colors.textSecondary}
            multiline
            maxLength={1000}
            editable={!isStreaming}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[s.sendBtn, (!inputText.trim() || isStreaming) && s.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || isStreaming}
            activeOpacity={0.8}
          >
            {isStreaming ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={18} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  headerTextWrap: { gap: 1 },
  headerTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  headerSub: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary },

  messages: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 8 },

  emptyState: { alignItems: 'center', gap: 12, paddingTop: 40, paddingHorizontal: 24 },
  emptyAvatarWrap: { position: 'relative', width: 96, height: 96, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyGlow1: {
    position: 'absolute', width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#7C3AED10', borderWidth: 1, borderColor: '#7C3AED20',
  },
  emptyGlow2: {
    position: 'absolute', width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#7C3AED14',
  },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptySub: {
    fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 22,
  },

  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${Colors.error}18`, borderRadius: 10,
    borderWidth: 1, borderColor: `${Colors.error}44`,
    padding: 10, marginTop: 8,
  },
  errorText: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.error, flex: 1 },

  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 10,
    fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary,
    maxHeight: 100, lineHeight: 20,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: MAX_COLOR, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
