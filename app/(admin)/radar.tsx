// Radar de Retenção — versão nativa (lado do personal).
//
// É provavelmente onde o módulo é MAIS útil: o personal checa entre um
// atendimento e outro, resolve um caso ali mesmo, e segue. No desktop ele só
// abre à noite, quando já não vai escrever mensagem para ninguém.
//
// A mensagem usa o rascunho determinístico do motor (ver nota em
// `retentionRadar.ts` sobre por que a IA não roda no app).

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
  TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { ModuleGuard } from '@/components/ModuleGuard';
import { GuideModal } from '@/components/guides/GuideModal';
import { useGuide } from '@/hooks/useGuide';
import { GUIDES } from '@/lib/guides';
import { MODULE } from '@/lib/modules';
import {
  loadRadar, draftMessage, sendMessage, listActiveChallenges,
  inviteToChallenge, parkCase,
  type RadarCase, type ActiveChallenge,
} from '@/lib/retentionRadar';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

const BAND: Record<RadarCase['riskBand'], { color: string; label: string }> = {
  red:    { color: Colors.error,   label: 'Risco alto' },
  yellow: { color: Colors.warning, label: 'Atenção' },
  green:  { color: Colors.success, label: 'Em dia' },
};

export default function RadarScreen() {
  const { profile } = useAuthStore();
  const { primaryColor } = useThemeStore();

  const [queue, setQueue] = useState<RadarCase[]>([]);
  const [remaining, setRemaining] = useState<RadarCase[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<ActiveChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRest, setShowRest] = useState(false);

  const [openCase, setOpenCase] = useState<RadarCase | null>(null);
  const [mode, setMode] = useState<'idle' | 'message' | 'challenge'>('idle');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [busy, setBusy] = useState(false);

  const tenantId = profile?.tenant_id ?? null;

  // Abre sozinho na primeira visita; "Nao mostrar mais" persiste por usuario
  // (SecureStore). O link no cabecalho reabre quando ele precisar.
  const guide = useGuide('radar_retencao', profile?.id);
  const personalFirstName = profile?.full_name?.split(' ')[0] ?? 'Seu personal';

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const [radar, chal] = await Promise.all([
      loadRadar(tenantId),
      listActiveChallenges(tenantId),
    ]);
    setQueue(radar.queue);
    setRemaining(radar.remaining);
    setLastUpdated(radar.lastUpdated);
    setChallenges(chal);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  function openMessage(c: RadarCase) {
    const draft = draftMessage(c, personalFirstName);
    setOpenCase(c);
    setTitle(draft.title);
    setBody(draft.body);
    setDraftBody(draft.body);
    setMode('message');
  }

  async function handleSend() {
    if (!openCase || !tenantId || !body.trim()) return;
    setBusy(true);
    const result = await sendMessage({
      tenantId,
      studentId: openCase.studentId,
      snapshotId: openCase.snapshotId,
      trainerId: profile?.id ?? null,
      title,
      body,
      riskScore: openCase.riskScore,
      edited: body.trim() !== draftBody.trim(),
    });
    setBusy(false);

    if (result.error) { Alert.alert('Não foi possível enviar', result.error); return; }
    setMode('idle'); setOpenCase(null);
    await load();
  }

  async function handleInvite(challenge: ActiveChallenge) {
    if (!openCase || !tenantId) return;
    setBusy(true);
    const result = await inviteToChallenge({
      tenantId,
      studentId: openCase.studentId,
      snapshotId: openCase.snapshotId,
      trainerId: profile?.id ?? null,
      challengeId: challenge.id,
      challengeName: challenge.name,
      riskScore: openCase.riskScore,
    });
    setBusy(false);

    if (result.error) { Alert.alert('Não foi possível convidar', result.error); return; }
    setMode('idle'); setOpenCase(null);
    await load();
  }

  async function handlePark(c: RadarCase, mode: 'dismissed' | 'snoozed') {
    if (!tenantId) return;
    await parkCase({
      tenantId,
      studentId: c.studentId,
      snapshotId: c.snapshotId,
      trainerId: profile?.id ?? null,
      mode,
      days: mode === 'snoozed' ? 14 : undefined,
    });
    await load();
  }

  // ── Composer ──────────────────────────────────────────────────────────────
  if (mode === 'message' && openCase) {
    return (
      <View style={s.safe}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <View style={s.header}>
              <TouchableOpacity onPress={() => { setMode('idle'); setOpenCase(null); }} style={s.iconBtn}>
                <Ionicons name="arrow-back" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
              <Text style={s.headerTitle} numberOfLines={1}>
                Mensagem para {openCase.studentName.split(' ')[0]}
              </Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
              <Text style={s.label}>ASSUNTO</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                maxLength={60}
                style={s.input}
                placeholderTextColor={Colors.textSecondary}
              />

              <Text style={s.label}>MENSAGEM</Text>
              <TextInput
                value={body}
                onChangeText={setBody}
                multiline
                numberOfLines={8}
                style={[s.input, s.textarea]}
                placeholderTextColor={Colors.textSecondary}
              />

              <Text style={s.note}>
                Leia antes de enviar. O aluno recebe isso como uma mensagem sua, no app dele —
                não vê nada sobre risco ou classificação.
              </Text>

              <TouchableOpacity
                onPress={handleSend}
                disabled={busy || !body.trim()}
                style={[s.cta, { backgroundColor: primaryColor }, (busy || !body.trim()) && s.ctaOff]}
              >
                {busy
                  ? <ActivityIndicator color={Colors.bg} />
                  : <Text style={s.ctaText}>ENVIAR MENSAGEM</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  // ── Seletor de desafio ────────────────────────────────────────────────────
  if (mode === 'challenge' && openCase) {
    return (
      <View style={s.safe}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={s.header}>
            <TouchableOpacity onPress={() => { setMode('idle'); setOpenCase(null); }} style={s.iconBtn}>
              <Ionicons name="arrow-back" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={s.headerTitle} numberOfLines={1}>
              Convidar {openCase.studentName.split(' ')[0]}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={s.scroll}>
            {challenges.length === 0 ? (
              <Text style={s.note}>
                Não há desafio ativo no momento. Crie um em Desafios, ou envie uma mensagem
                para este aluno.
              </Text>
            ) : (
              <>
                <Text style={s.note}>
                  O aluno é inscrito e recebe um aviso seu no app contando do convite.
                </Text>
                {challenges.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => handleInvite(c)}
                    disabled={busy}
                    style={[s.challengeRow, { borderColor: `${primaryColor}40` }]}
                  >
                    <Ionicons name="trophy-outline" size={17} color={primaryColor} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.challengeName}>{c.name}</Text>
                      {!!c.duration_days && (
                        <Text style={s.challengeMeta}>{c.duration_days} dias</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  // ── Fila ──────────────────────────────────────────────────────────────────
  return (
    <ModuleGuard slug={MODULE.RADAR_RETENCAO}>
      <View style={s.safe}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={s.header}>
            <View style={{ width: 80 }} />
            <Text style={s.headerTitle}>Radar de Retenção</Text>
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity onPress={guide.open} style={s.iconBtn}>
                <Ionicons name="help-circle-outline" size={20} color={primaryColor} />
              </TouchableOpacity>
              <TouchableOpacity onPress={load} style={s.iconBtn}>
                <Ionicons name="refresh" size={19} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator color={primaryColor} style={{ marginTop: 48 }} />
          ) : (
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
              <Text style={s.updated}>
                {lastUpdated
                  ? `Leitura de ${new Date(`${lastUpdated}T12:00:00`).toLocaleDateString('pt-BR')}`
                  : 'Ainda sem leitura'}
              </Text>

              {queue.length === 0 ? (
                <View style={s.empty}>
                  <Ionicons name="shield-checkmark-outline" size={34} color={primaryColor} />
                  <Text style={s.emptyTitle}>
                    {lastUpdated ? 'Ninguém precisa de você hoje' : 'Radar ainda sem dados'}
                  </Text>
                  <Text style={s.emptyText}>
                    {lastUpdated
                      ? 'Nenhum aluno com sinal de afastamento fora do ritmo dele.'
                      : 'A primeira leitura acontece automaticamente amanhã de manhã.'}
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={s.sectionTitle}>
                    {queue.length === 1 ? 'SEU CASO DE HOJE' : `SEUS ${queue.length} CASOS DE HOJE`}
                  </Text>

                  {queue.map((c) => {
                    const band = BAND[c.riskBand];
                    return (
                      <View key={c.studentId} style={[s.card, { borderColor: `${band.color}55` }]}>
                        <View style={s.cardHead}>
                          <View style={[s.dot, { backgroundColor: band.color }]} />
                          <Text style={s.cardName} numberOfLines={1}>{c.studentName}</Text>
                          <Text style={s.cardScore}>{band.label} · {c.riskScore}</Text>
                        </View>

                        <Text style={s.cardHeadline}>{c.headline}</Text>

                        {c.signals.length > 0 && (
                          <View style={s.signals}>
                            {c.signals.map((sig, i) => (
                              <View key={`${sig.key}-${i}`} style={s.signalRow}>
                                <Ionicons name="alert-circle-outline" size={12} color={Colors.textSecondary} />
                                <Text style={s.signalText}>{sig.label}</Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* A ação sugerida vem primeiro e cheia; a outra fica discreta. */}
                        {c.suggested === 'challenge' ? (
                          <>
                            <TouchableOpacity onPress={() => { setOpenCase(c); setMode('challenge'); }}
                              style={[s.actionPrimary, { backgroundColor: primaryColor }]}>
                              <Text style={s.actionPrimaryText}>CONVIDAR PARA UM DESAFIO</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => openMessage(c)} style={s.actionSecondary}>
                              <Text style={s.actionSecondaryText}>Escrever mensagem</Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <>
                            <TouchableOpacity onPress={() => openMessage(c)}
                              style={[s.actionPrimary, { backgroundColor: primaryColor }]}>
                              <Text style={s.actionPrimaryText}>ESCREVER MENSAGEM</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => { setOpenCase(c); setMode('challenge'); }} style={s.actionSecondary}>
                              <Text style={s.actionSecondaryText}>Convidar para um desafio</Text>
                            </TouchableOpacity>
                          </>
                        )}

                        <View style={s.parkRow}>
                          <TouchableOpacity onPress={() => handlePark(c, 'snoozed')} style={s.parkBtn}>
                            <Text style={s.parkText}>Adiar 14 dias</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handlePark(c, 'dismissed')} style={s.parkBtn}>
                            <Text style={s.parkText}>Já resolvi por fora</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </>
              )}

              {remaining.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <TouchableOpacity onPress={() => setShowRest((v) => !v)} style={s.restToggle}>
                    <Text style={s.sectionTitle}>MAIS {remaining.length} EM OBSERVAÇÃO</Text>
                    <Ionicons
                      name={showRest ? 'chevron-up' : 'chevron-down'}
                      size={15}
                      color={Colors.textSecondary}
                    />
                  </TouchableOpacity>

                  {showRest && (
                    <View style={{ gap: 8 }}>
                      {remaining.map((c) => (
                        <View key={c.studentId} style={s.restRow}>
                          <View style={[s.dot, { backgroundColor: BAND[c.riskBand].color }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={s.restName} numberOfLines={1}>{c.studentName}</Text>
                            <Text style={s.restHeadline} numberOfLines={1}>{c.headline}</Text>
                          </View>
                          <Text style={s.cardScore}>{c.riskScore}</Text>
                        </View>
                      ))}
                      <Text style={s.note}>
                        Estes entram na fila conforme os de cima forem resolvidos. Três por dia
                        é o que dá para fazer bem feito.
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </View>
      <GuideModal
        visible={guide.visible}
        content={GUIDES.radar_retencao}
        onClose={guide.close}
        onDismissForever={guide.dismissForever}
      />
    </ModuleGuard>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1, textAlign: 'center', fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.sm, color: Colors.textPrimary,
  },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  updated: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },

  empty: { alignItems: 'center', gap: 12, paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary, textAlign: 'center' },
  emptyText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },

  sectionTitle: { fontFamily: FontFamily.bodyBold, fontSize: 10, color: Colors.textSecondary, letterSpacing: 1.2 },

  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12, backgroundColor: Colors.surface },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cardName: { flex: 1, fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  cardScore: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary },
  cardHeadline: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },

  signals: { gap: 6, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  signalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  signalText: { flex: 1, fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },

  actionPrimary: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  actionPrimaryText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.bg, letterSpacing: 0.8 },
  actionSecondary: {
    borderRadius: 12, paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  actionSecondaryText: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary },

  parkRow: { flexDirection: 'row', gap: 8 },
  parkBtn: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  parkText: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },

  restToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  restRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingVertical: 11, paddingHorizontal: 13, backgroundColor: Colors.surface,
  },
  restName: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textPrimary },
  restHeadline: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary, marginTop: 1 },

  label: { fontFamily: FontFamily.bodyBold, fontSize: 10, color: Colors.textSecondary, letterSpacing: 1 },
  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11,
    fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary,
  },
  textarea: { minHeight: 160, textAlignVertical: 'top' },
  note: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },
  cta: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  ctaOff: { opacity: 0.4 },
  ctaText: { fontFamily: FontFamily.display, fontSize: FontSize.xs, color: Colors.bg, letterSpacing: 1.2 },

  challengeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: 12, padding: 14, backgroundColor: Colors.surface,
  },
  challengeName: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textPrimary },
  challengeMeta: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary, marginTop: 2 },
});
