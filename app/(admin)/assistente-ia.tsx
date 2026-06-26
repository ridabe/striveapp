import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Share,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { MaxAvatar, MAX_COLOR } from '@/components/ai/MaxAvatar';
import { MaxQuickActions } from '@/components/ai/MaxQuickActions';
import { MaxStreamingText } from '@/components/ai/MaxStreamingText';
import { useMaxStream, type MaxFeature } from '@/hooks/useMaxStream';

interface StudentMini {
  full_name: string;
  goal: string | null;
  status: string;
}

const FEATURE_LABELS: Record<MaxFeature, string> = {
  generate_plan:    'Criando plano de treino...',
  analyze_progress: 'Analisando progresso...',
  suggest_load:     'Calculando carga ideal...',
  motivation:       'Gerando mensagem motivacional...',
  chat:             'Processando...',
};

export default function AssistenteIAScreen() {
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const [student, setStudent] = useState<StudentMini | null>(null);
  const [loadingStudent, setLoadingStudent] = useState(true);
  const [activeFeature, setActiveFeature] = useState<MaxFeature | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const { text, isStreaming, error, conversationId, planId, trigger, reset } = useMaxStream();

  useEffect(() => {
    if (!studentId) return;
    supabase
      .from('students')
      .select('full_name, goal, status')
      .eq('id', studentId)
      .single()
      .then(({ data }) => {
        setStudent(data);
        setLoadingStudent(false);
      });
  }, [studentId]);

  useEffect(() => {
    if (text && scrollRef.current) {
      scrollRef.current.scrollToEnd({ animated: true });
    }
  }, [text]);

  useEffect(() => {
    if (!isStreaming) setActiveFeature(null);
  }, [isStreaming]);

  async function handleFeatureSelect(feature: MaxFeature) {
    if (!studentId) return;

    if (feature === 'chat') {
      router.push({
        pathname: '/(admin)/assistente-ia-chat' as any,
        params: { studentId, conversationId: conversationId ?? '' },
      });
      return;
    }

    reset();
    setActiveFeature(feature);
    await trigger({ feature, studentId });
  }

  function handleShareText() {
    const clean = text.replace(/\nplan_id:[a-f0-9-]{36}/g, '').trim();
    Share.share({ message: clean });
  }

  const avatarVariant = isStreaming ? 'thinking' : text && !error ? 'happy' : 'default';
  const firstName = student?.full_name.split(' ')[0] ?? '...';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <View style={s.maxBadge}>
            <View style={s.maxDot} />
            <Text style={s.maxLabel}>MAX STRIVE</Text>
          </View>
          {!loadingStudent && (
            <Text style={s.headerSub} numberOfLines={1}>consultando {firstName}</Text>
          )}
        </View>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar hero */}
        <View style={s.hero}>
          <MaxAvatar variant={avatarVariant} size="lg" />
          <View style={s.heroText}>
            <Text style={s.heroTitle}>Olá, sou o Max!</Text>
            <Text style={s.heroSub}>
              {isStreaming
                ? (activeFeature ? FEATURE_LABELS[activeFeature] : 'Processando...')
                : 'Selecione uma ação abaixo para começar.'}
            </Text>
          </View>
        </View>

        {/* Student context card */}
        {student && (
          <View style={s.studentCard}>
            <Ionicons name="person-outline" size={16} color={Colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={s.studentName}>{student.full_name}</Text>
              {student.goal && (
                <Text style={s.studentGoal} numberOfLines={1}>Objetivo: {student.goal}</Text>
              )}
            </View>
            <View style={[
              s.statusPill,
              { backgroundColor: student.status === 'active' ? `${Colors.success}22` : `${Colors.textSecondary}22` },
            ]}>
              <Text style={[s.statusText, { color: student.status === 'active' ? Colors.success : Colors.textSecondary }]}>
                {student.status === 'active' ? 'Ativo' : 'Inativo'}
              </Text>
            </View>
          </View>
        )}

        {/* Quick actions */}
        <Text style={s.sectionTitle}>AÇÕES RÁPIDAS</Text>
        <MaxQuickActions
          onSelect={handleFeatureSelect}
          activeFeature={activeFeature}
          disabled={isStreaming}
        />

        {/* Result area */}
        {(isStreaming || text) && (
          <View style={s.resultCard}>
            <View style={s.resultHeader}>
              <View style={s.maxTagWrap}>
                <View style={s.maxTagDot} />
                <Text style={s.maxTag}>MAX</Text>
              </View>
              {isStreaming && <ActivityIndicator size="small" color={MAX_COLOR} />}
            </View>

            {isStreaming ? (
              <MaxStreamingText text={text} />
            ) : (
              <Text style={s.resultText}>
                {text.replace(/\nplan_id:[a-f0-9-]{36}/g, '').trim()}
              </Text>
            )}

            {/* Post-stream actions */}
            {!isStreaming && text && (
              <View style={s.resultActions}>
                {planId && (
                  <TouchableOpacity
                    style={s.resultBtn}
                    onPress={() => router.push({ pathname: '/(admin)/planos' as any, params: { studentId } })}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="clipboard-outline" size={16} color={Colors.textPrimary} />
                    <Text style={s.resultBtnText}>Ver plano criado</Text>
                  </TouchableOpacity>
                )}
                {!planId && (
                  <TouchableOpacity
                    style={s.resultBtn}
                    onPress={handleShareText}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="share-social-outline" size={16} color={Colors.textPrimary} />
                    <Text style={s.resultBtnText}>Compartilhar</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[s.resultBtn, s.resultBtnSecondary]}
                  onPress={reset}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh-outline" size={16} color={Colors.textSecondary} />
                  <Text style={[s.resultBtnText, { color: Colors.textSecondary }]}>Limpar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={s.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color={Colors.error} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {/* Chat CTA */}
        <TouchableOpacity
          style={s.chatCta}
          onPress={() => router.push({
            pathname: '/(admin)/assistente-ia-chat' as any,
            params: { studentId, conversationId: conversationId ?? '' },
          })}
          activeOpacity={0.8}
          disabled={isStreaming}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={MAX_COLOR} />
          <Text style={s.chatCtaText}>Abrir chat completo</Text>
          <Ionicons name="chevron-forward" size={16} color={MAX_COLOR} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  maxBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  maxDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: MAX_COLOR },
  maxLabel: { fontFamily: FontFamily.display, fontSize: 12, color: Colors.textPrimary, letterSpacing: 1 },
  headerSub: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary },

  scroll: { paddingHorizontal: 16, paddingBottom: 40 },

  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 24 },
  heroText: { flex: 1, gap: 4 },
  heroTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.lg, color: Colors.textPrimary },
  heroSub: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  studentCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.border, padding: 12, marginBottom: 24,
  },
  studentName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  studentGoal: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },

  sectionTitle: {
    fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs,
    color: Colors.textSecondary, letterSpacing: 1.2, marginBottom: 12,
  },

  resultCard: {
    backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1,
    borderColor: `${MAX_COLOR}44`, marginTop: 24, padding: 16,
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  maxTagWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  maxTagDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: MAX_COLOR },
  maxTag: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: MAX_COLOR, letterSpacing: 1 },
  resultText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 22 },
  resultActions: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  resultBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${MAX_COLOR}22`, borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 12,
  },
  resultBtnSecondary: { backgroundColor: Colors.border },
  resultBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.xs, color: Colors.textPrimary },

  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${Colors.error}18`, borderRadius: 12,
    borderWidth: 1, borderColor: `${Colors.error}44`,
    padding: 12, marginTop: 16,
  },
  errorText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.error, flex: 1 },

  chatCta: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1,
    borderColor: `${MAX_COLOR}44`, padding: 14, marginTop: 24,
  },
  chatCtaText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: MAX_COLOR, flex: 1 },
});
