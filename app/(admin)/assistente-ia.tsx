import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Share, Image, Linking, Alert,
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
  phone: string | null;
}

const FEATURE_LABELS: Record<MaxFeature, string> = {
  generate_plan:    'Criando plano de treino...',
  analyze_progress: 'Analisando progresso...',
  suggest_load:     'Calculando carga ideal...',
  motivation:       'Gerando mensagem motivacional...',
  chat:             'Processando...',
};

const PLAN_STEPS = [
  {
    icon: 'barbell-outline' as const,
    color: '#3B82F6',
    title: 'Crie o treino',
    desc: 'Toque em "Criar Treino" nas ações acima. O Max gerará um plano completo baseado no perfil do aluno.',
  },
  {
    icon: 'eye-outline' as const,
    color: MAX_COLOR,
    title: 'Visualize o plano',
    desc: 'Após a geração, toque em "Ver plano criado". Você será levado direto ao plano com todas as rotinas e exercícios.',
  },
  {
    icon: 'people-outline' as const,
    color: '#10B981',
    title: 'Atribua os alunos',
    desc: 'Na tela do plano, toque em "Atribuir Alunos" e selecione quem irá receber este treino. O aluno de origem já vem pré-selecionado.',
  },
  {
    icon: 'checkmark-circle-outline' as const,
    color: '#22C55E',
    title: 'Ative o plano',
    desc: 'Toque no botão "Ativar Plano" para liberar o treino ao aluno. Ele aparecerá imediatamente no app.',
  },
];

export default function AssistenteIAScreen() {
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const [student, setStudent]           = useState<StudentMini & { tenant_id: string } | null>(null);
  const [loadingStudent, setLoadingStudent] = useState(true);
  const [activeFeature, setActiveFeature]   = useState<MaxFeature | null>(null);
  const [guideOpen, setGuideOpen]           = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const { text, isStreaming, error, conversationId, planId, trigger, reset } = useMaxStream();

  useEffect(() => {
    // Reset when switching to a different student
    reset();
  }, [studentId, reset]);

  useEffect(() => {
    if (!studentId) return;
    supabase
      .from('students')
      .select('full_name, goal, status, phone, tenant_id')
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

  // Remove prefácios da IA para que o aluno receba apenas a mensagem final.
  function sanitizeStudentFacingText(rawText: string) {
    return rawText
      .replace(/\nplan_id:[a-f0-9-]{36}/g, '')
      .replace(/^(?:aqui\s+est[aá].*?|segue\s+(?:abaixo\s+)?(?:uma\s+)?(?:mensagem|sugest[aã]o).*?|prontinho.*?|mensagem\s+pronta.*?|você\s+pode\s+enviar.*?|para\s+o\s+[^\n:.-]+[:,-]?\s*)[\s:,-]*/i, '')
      .replace(/^(?:oi[,!.\s]+)?personal[,!.\s]*/i, '')
      .trim();
  }

  function handleShareText() {
    const clean = sanitizeStudentFacingText(text);
    Share.share({ message: clean });
  }

  async function handleSendMessage() {
    const clean = sanitizeStudentFacingText(text);
    if (!studentId || !student?.tenant_id) return;

    try {
      setLoadingStudent(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from('student_messages').insert({
        tenant_id: student.tenant_id,
        student_id: studentId,
        trainer_id: user?.id,
        message: clean,
        message_type: activeFeature === 'suggest_load' ? 'load_suggestion' : activeFeature === 'motivation' ? 'motivation' : 'general',
        title: activeFeature === 'suggest_load' ? 'Sugestão de carga' : activeFeature === 'motivation' ? 'Mensagem motivacional' : 'Mensagem do personal',
      });

      Alert.alert('Sucesso', 'Mensagem enviada ao aluno!');
    } catch (e) {
      console.error('Error sending message:', e);
      Alert.alert('Erro', 'Não foi possível enviar a mensagem.');
    } finally {
      setLoadingStudent(false);
    }
  }

  const avatarVariant = isStreaming ? 'thinking' : text && !error ? 'happy' : 'default';
  const firstName     = student?.full_name.split(' ')[0] ?? '...';

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
          <View style={s.avatarGlowWrap}>
            <View style={s.glowRing1} />
            <View style={s.glowRing2} />
            <MaxAvatar variant={avatarVariant} size="lg" />
          </View>
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

        {/* Guia de fluxo — colapsável */}
        {!isStreaming && (
          <View style={s.guideCard}>
            <TouchableOpacity
              style={s.guideHeader}
              onPress={() => setGuideOpen(v => !v)}
              activeOpacity={0.75}
            >
              <View style={s.guideTitleRow}>
                <View style={s.guideIconWrap}>
                  <Ionicons name="map-outline" size={15} color={MAX_COLOR} />
                </View>
                <Text style={s.guideTitle}>Como criar e ativar um treino</Text>
              </View>
              <Ionicons
                name={guideOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={Colors.textSecondary}
              />
            </TouchableOpacity>

            {guideOpen && (
              <View style={s.guideBody}>
                {PLAN_STEPS.map((step, idx) => (
                  <View key={idx} style={s.guideStep}>
                    {/* Linha vertical conectora */}
                    <View style={s.guideStepLeft}>
                      <View style={[s.guideStepBadge, { backgroundColor: `${step.color}20`, borderColor: `${step.color}40` }]}>
                        <Ionicons name={step.icon} size={14} color={step.color} />
                      </View>
                      {idx < PLAN_STEPS.length - 1 && (
                        <View style={[s.guideConnector, { backgroundColor: `${step.color}30` }]} />
                      )}
                    </View>
                    <View style={s.guideStepContent}>
                      <View style={s.guideStepTitleRow}>
                        <Text style={[s.guideStepNum, { color: step.color }]}>{idx + 1}</Text>
                        <Text style={s.guideStepTitle}>{step.title}</Text>
                      </View>
                      <Text style={s.guideStepDesc}>{step.desc}</Text>
                    </View>
                  </View>
                ))}

                {/* Dica final */}
                <View style={s.guideTip}>
                  <Ionicons name="information-circle-outline" size={15} color={Colors.textSecondary} />
                  <Text style={s.guideTipText}>
                    Se o treino não aparecer de imediato para o aluno, basta ele atualizar o app puxando a tela para baixo.
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Result area */}
        {(isStreaming || text) && (
          <View style={s.resultCard}>
            <View style={s.resultHeader}>
              <View style={s.maxTagWrap}>
                <View style={s.maxTagAvatar}>
                  <Image
                    source={require('../../assets/ai/max-avatar-small.png')}
                    style={s.maxTagAvatarImg}
                    resizeMode="contain"
                  />
                </View>
                <Text style={s.maxTag}>MAX STRIVE</Text>
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
                    style={[s.resultBtn, s.resultBtnPrimary]}
                    onPress={() => router.push({
                      pathname: '/(admin)/planos/[id]' as any,
                      params: { id: planId!, studentId },
                    })}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="clipboard-outline" size={16} color="#fff" />
                    <Text style={[s.resultBtnText, { color: '#fff' }]}>Ver plano criado</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[s.resultBtn, { backgroundColor: `${MAX_COLOR}18` }]}
                  onPress={handleSendMessage}
                  activeOpacity={0.8}
                >
                  <Ionicons name="send-outline" size={16} color={MAX_COLOR} />
                  <Text style={[s.resultBtnText, { color: MAX_COLOR }]}>Enviar para aluno</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.resultBtn}
                  onPress={handleShareText}
                  activeOpacity={0.8}
                >
                  <Ionicons name="share-social-outline" size={16} color={Colors.textPrimary} />
                  <Text style={s.resultBtnText}>Compartilhar</Text>
                </TouchableOpacity>
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
  avatarGlowWrap: { position: 'relative', width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  glowRing1: {
    position: 'absolute', width: 96, height: 96, borderRadius: 48,
    backgroundColor: `${MAX_COLOR}10`, borderWidth: 1, borderColor: `${MAX_COLOR}20`,
  },
  glowRing2: {
    position: 'absolute', width: 80, height: 80, borderRadius: 40,
    backgroundColor: `${MAX_COLOR}14`,
  },
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

  // ── Guia de fluxo ────────────────────────────────────────────────────────────
  guideCard: {
    backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1,
    borderColor: Colors.border, marginTop: 20, overflow: 'hidden',
  },
  guideHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 13,
  },
  guideTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  guideIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: `${MAX_COLOR}15`, borderWidth: 1, borderColor: `${MAX_COLOR}28`,
    alignItems: 'center', justifyContent: 'center',
  },
  guideTitle: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  guideBody: {
    paddingHorizontal: 14, paddingBottom: 16,
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingTop: 14,
  },
  guideStep: { flexDirection: 'row', gap: 12, marginBottom: 0 },
  guideStepLeft: { alignItems: 'center', width: 32 },
  guideStepBadge: {
    width: 32, height: 32, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  guideConnector: { width: 2, flex: 1, minHeight: 12, marginVertical: 4, borderRadius: 1 },
  guideStepContent: { flex: 1, paddingBottom: 16 },
  guideStepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  guideStepNum: { fontFamily: FontFamily.bodyBold, fontSize: 11 },
  guideStepTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  guideStepDesc: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
  guideTip: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: `${Colors.textSecondary}10`, borderRadius: 10,
    padding: 10, marginTop: 4,
  },
  guideTipText: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1, lineHeight: 17 },

  // ── Result card ──────────────────────────────────────────────────────────────
  resultCard: {
    backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1,
    borderColor: `${MAX_COLOR}44`, marginTop: 24, padding: 16,
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  maxTagWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  maxTagAvatar: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: `${MAX_COLOR}15`, borderWidth: 1, borderColor: `${MAX_COLOR}28`,
    alignItems: 'center', justifyContent: 'center',
  },
  maxTagAvatarImg: { width: 18, height: 18 },
  maxTag: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: MAX_COLOR, letterSpacing: 1 },
  resultText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 22 },
  resultActions: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  resultBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${MAX_COLOR}18`, borderRadius: 10,
    paddingVertical: 9, paddingHorizontal: 14,
  },
  resultBtnPrimary: { backgroundColor: MAX_COLOR },
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
