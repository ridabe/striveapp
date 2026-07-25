// Relatório de Evolução — revisão do personal, no app.
//
// Esta tela faltava: eu tinha portado só a LEITURA do aluno
// (app/(student)/mais/relatorios.tsx) e deixado a revisão exclusiva do web.
//
// Desenho central, igual ao do web: o editor abre com o texto JÁ PREENCHIDO. O
// caminho de menor esforço é ler, ajustar uma palavra e publicar. Se publicar
// exigisse escrever do zero, ninguém publicaria — e relatório que fica em
// rascunho para sempre não retém ninguém.

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
  TextInput, Alert, Modal, KeyboardAvoidingView, Platform,
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
import { periodLabel, type ReportMetrics } from '@/lib/evolutionReport';
import {
  loadReports, loadStudents, generateReport, publishReport, archiveReport,
  recentPeriods, studentNameOf,
  type ReportRow, type StudentOption,
} from '@/lib/evolutionReportsAdmin';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

// ─── Prévia do que o aluno vai ver ────────────────────────────────────────────

function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <View style={s.stat}>
      <Text style={[s.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function MetricsPreview({ metrics, color }: { metrics: ReportMetrics; color: string }) {
  const { workouts, volume, records, topProgress, body } = metrics;
  const tempo = workouts.totalMinutes >= 60
    ? `${Math.floor(workouts.totalMinutes / 60)}h${String(workouts.totalMinutes % 60).padStart(2, '0')}`
    : `${workouts.totalMinutes}min`;

  return (
    <View style={{ gap: 12 }}>
      <View style={s.statsRow}>
        <Stat value={String(workouts.completed)} label="TREINOS" color={color} />
        <Stat value={tempo} label="TEMPO" color={color} />
        {workouts.longestStreakDays >= 2
          ? <Stat value={`${workouts.longestStreakDays}d`} label="SEQUÊNCIA" color={color} />
          : volume.totalKg != null
            ? <Stat value={volume.totalKg >= 1000 ? `${(volume.totalKg/1000).toFixed(1)}t` : `${volume.totalKg}kg`} label="VOLUME" color={color} />
            : null}
      </View>

      {records.length > 0 && (
        <View style={{ gap: 6 }}>
          <Text style={s.miniTitle}>RECORDES</Text>
          {records.slice(0, 3).map(r => (
            <View key={r.exerciseId} style={s.recordRow}>
              <Ionicons name="trophy-outline" size={13} color={color} />
              <Text style={s.recordName} numberOfLines={1}>{r.exerciseName}</Text>
              <Text style={[s.recordKg, { color }]}>{r.loadKg}kg</Text>
            </View>
          ))}
        </View>
      )}

      {records.length === 0 && topProgress.length > 0 && (
        <View style={{ gap: 6 }}>
          <Text style={s.miniTitle}>MAIORES EVOLUÇÕES</Text>
          {topProgress.slice(0, 3).map(p => (
            <View key={p.exerciseId} style={s.recordRow}>
              <Text style={s.recordName} numberOfLines={1}>{p.exerciseName}</Text>
              <Text style={s.recordKg}>{p.firstLoadKg} → {p.lastLoadKg}kg</Text>
            </View>
          ))}
        </View>
      )}

      {body.weightDelta != null && (
        <Text style={s.bodyLine}>
          Peso: {body.weightEnd}kg ({body.weightDelta > 0 ? '+' : ''}{body.weightDelta}kg no período)
        </Text>
      )}

      {!!metrics.attentionPoint && (
        <View style={s.attention}>
          <Ionicons name="alert-circle-outline" size={14} color={Colors.warning} />
          <Text style={s.attentionText}>{metrics.attentionPoint}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Editor ───────────────────────────────────────────────────────────────────

function Editor({
  report, tenantId, trainerId, color, onClose, onSaved,
}: {
  report: ReportRow; tenantId: string; trainerId: string | null; color: string;
  onClose: () => void; onSaved: () => void;
}) {
  const name = studentNameOf(report);
  // Publicado: o texto final é a fonte. Rascunho: parte do texto gerado.
  const [headline, setHeadline] = useState(report.final_headline ?? report.ai_headline ?? '');
  const [narrative, setNarrative] = useState(report.final_narrative ?? report.ai_narrative ?? '');
  const [busy, setBusy] = useState(false);

  const dirty = headline !== (report.ai_headline ?? '') || narrative !== (report.ai_narrative ?? '');

  async function handlePublish() {
    setBusy(true);
    const r = await publishReport({
      tenantId, reportId: report.id, trainerId,
      finalHeadline: headline, finalNarrative: narrative,
      aiHeadline: report.ai_headline, aiNarrative: report.ai_narrative,
    });
    setBusy(false);
    if (r.error) { Alert.alert('Não foi possível publicar', r.error); return; }
    onSaved();
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.safe}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={s.header}>
              <TouchableOpacity onPress={onClose} style={s.iconBtn}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={s.headerTitle} numberOfLines={1}>{name}</Text>
                <Text style={s.headerSub}>{periodLabel(report.period_start)}</Text>
              </View>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
              <View style={s.rowBetween}>
                <Text style={s.sectionTitle}>TEXTO QUE O ALUNO VAI LER</Text>
                {dirty && (
                  <TouchableOpacity onPress={() => {
                    setHeadline(report.ai_headline ?? '');
                    setNarrative(report.ai_narrative ?? '');
                  }}>
                    <Text style={[s.link, { color }]}>Restaurar original</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TextInput
                value={headline}
                onChangeText={setHeadline}
                maxLength={80}
                placeholder="Título do relatório"
                placeholderTextColor={Colors.textSecondary}
                style={[s.input, s.inputTitle]}
              />
              <TextInput
                value={narrative}
                onChangeText={setNarrative}
                multiline
                placeholder="Texto do relatório"
                placeholderTextColor={Colors.textSecondary}
                style={[s.input, s.textarea]}
              />
              <Text style={s.hint}>
                Os números abaixo vêm dos registros do aluno e não podem ser editados.
                Só o texto é seu — e é o seu nome que aparece embaixo.
              </Text>

              <View style={s.previewBox}>
                <Text style={s.miniTitle}>PRÉVIA DO ALUNO</Text>
                {!!headline && <Text style={s.previewHeadline}>{headline}</Text>}
                {!!narrative && <Text style={s.previewNarrative}>{narrative}</Text>}
                <MetricsPreview metrics={report.metrics} color={color} />
              </View>
            </ScrollView>

            <View style={s.footerBar}>
              <TouchableOpacity onPress={onClose} style={s.ghostBtn}>
                <Text style={s.ghostText}>Fechar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePublish}
                disabled={busy || !narrative.trim()}
                style={[s.cta, { backgroundColor: color }, (busy || !narrative.trim()) && s.off]}
              >
                {busy
                  ? <ActivityIndicator color={Colors.bg} />
                  : <Text style={s.ctaText}>
                      {report.status === 'published' ? 'REPUBLICAR' : 'PUBLICAR PARA O ALUNO'}
                    </Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ─── Gerar agora ──────────────────────────────────────────────────────────────

function GenerateSheet({
  students, tenantId, color, onClose, onDone,
}: {
  students: StudentOption[]; tenantId: string; color: string;
  onClose: () => void; onDone: () => void;
}) {
  const periods = recentPeriods();
  const [studentId, setStudentId] = useState<string>('');
  const [period, setPeriod] = useState(periods[0]);
  const [busy, setBusy] = useState(false);

  async function handleGenerate() {
    const st = students.find(x => x.id === studentId);
    if (!st) return;
    setBusy(true);
    const r = await generateReport({
      tenantId, studentId: st.id, studentName: st.full_name,
      periodStart: period.start, periodEnd: period.end,
    });
    setBusy(false);
    if (r.error) { Alert.alert('Não foi possível gerar', r.error); return; }
    if (r.skipped) { Alert.alert('Relatório já publicado', r.skipped); return; }
    onDone();
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.safe}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={s.header}>
            <TouchableOpacity onPress={onClose} style={s.iconBtn}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Gerar relatório</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={s.scroll}>
            <Text style={s.sectionTitle}>PERÍODO</Text>
            <View style={s.chips}>
              {periods.map(p => {
                const on = p.start === period.start;
                return (
                  <TouchableOpacity
                    key={p.start}
                    onPress={() => setPeriod(p)}
                    style={[s.chip, on && { borderColor: color, backgroundColor: `${color}1A` }]}
                  >
                    <Text style={[s.chipText, on && { color }]}>{p.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.sectionTitle}>ALUNO</Text>
            {students.map(st => {
              const on = st.id === studentId;
              return (
                <TouchableOpacity
                  key={st.id}
                  onPress={() => setStudentId(st.id)}
                  style={[s.pickRow, on && { borderColor: color }]}
                >
                  <Ionicons
                    name={on ? 'radio-button-on' : 'radio-button-off'}
                    size={17}
                    color={on ? color : Colors.textSecondary}
                  />
                  <Text style={s.pickName}>{st.full_name}</Text>
                </TouchableOpacity>
              );
            })}

            <Text style={s.hint}>
              Regerar o mesmo mês substitui o rascunho existente. Relatório já publicado não é
              sobrescrito.
            </Text>
          </ScrollView>

          <View style={s.footerBar}>
            <TouchableOpacity
              onPress={handleGenerate}
              disabled={!studentId || busy}
              style={[s.cta, { flex: 1, backgroundColor: color }, (!studentId || busy) && s.off]}
            >
              {busy
                ? <ActivityIndicator color={Colors.bg} />
                : <Text style={s.ctaText}>GERAR RASCUNHO</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ─── Tela ─────────────────────────────────────────────────────────────────────

export default function RelatoriosAdminScreen() {
  const { profile } = useAuthStore();
  const { primaryColor } = useThemeStore();
  const tenantId = profile?.tenant_id ?? null;

  // Abre sozinho na primeira visita; "Nao mostrar mais" persiste por usuario
  // (SecureStore). O link no cabecalho reabre quando ele precisar.
  const guide = useGuide('relatorio_evolucao', profile?.id);

  const [reports, setReports] = useState<ReportRow[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ReportRow | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const [r, st] = await Promise.all([loadReports(tenantId), loadStudents(tenantId)]);
    setReports(r); setStudents(st); setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const drafts = reports.filter(r => r.status === 'draft');
  const published = reports.filter(r => r.status === 'published');

  async function handleArchive(r: ReportRow) {
    if (!tenantId) return;
    const res = await archiveReport(tenantId, r.id);
    if (res.error) { Alert.alert('Não foi possível arquivar', res.error); return; }
    await load();
  }

  function card(r: ReportRow) {
    const m = r.metrics;
    const resumo = [
      `${m?.workouts?.completed ?? 0} treinos`,
      (m?.records?.length ?? 0) > 0 ? `${m.records.length} recordes` : null,
    ].filter(Boolean).join(' · ');

    return (
      <View key={r.id} style={s.card}>
        <View style={{ flex: 1 }}>
          <View style={s.rowGap}>
            <Text style={s.cardName} numberOfLines={1}>{studentNameOf(r)}</Text>
            {r.status === 'published' && (
              <View style={[s.badge, { borderColor: `${primaryColor}66`, backgroundColor: `${primaryColor}1A` }]}>
                <Text style={[s.badgeText, { color: primaryColor }]}>PUBLICADO</Text>
              </View>
            )}
          </View>
          <Text style={s.cardMeta}>
            {periodLabel(r.period_start)} · {resumo}
            {r.status === 'published' && (r.viewed_by_student_at ? ' · visto' : ' · não visto')}
          </Text>
        </View>

        <TouchableOpacity onPress={() => setEditing(r)} style={s.reviewBtn}>
          <Text style={s.reviewText}>{r.status === 'draft' ? 'Revisar' : 'Ver'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => Alert.alert('Arquivar relatório', 'Ele sai da lista, sem apagar o histórico.',
            [{ text: 'Cancelar', style: 'cancel' }, { text: 'Arquivar', style: 'destructive', onPress: () => handleArchive(r) }])}
          style={s.iconBtnSm}
        >
          <Ionicons name="archive-outline" size={16} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ModuleGuard slug={MODULE.RELATORIO_EVOLUCAO}>
      <View style={s.safe}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={s.header}>
            <View style={{ width: 80 }} />
            <Text style={s.headerTitle}>Relatórios</Text>
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
              <Text style={s.intro}>
                Todo dia 1º o sistema fecha o mês de cada aluno e deixa o rascunho pronto aqui.
                Nada chega ao aluno antes de você revisar e publicar.
              </Text>

              <TouchableOpacity
                onPress={() => setGenerating(true)}
                style={[s.generateBtn, { borderColor: `${primaryColor}66` }]}
              >
                <Ionicons name="add-circle-outline" size={17} color={primaryColor} />
                <Text style={[s.generateText, { color: primaryColor }]}>Gerar relatório agora</Text>
              </TouchableOpacity>

              <Text style={s.sectionTitle}>
                AGUARDANDO SUA REVISÃO{drafts.length > 0 ? ` (${drafts.length})` : ''}
              </Text>

              {drafts.length === 0 ? (
                <View style={s.empty}>
                  <Ionicons name="checkmark-circle-outline" size={22} color={primaryColor} />
                  <Text style={s.emptyText}>
                    Nenhum rascunho pendente. Os relatórios do mês aparecem aqui automaticamente
                    no dia 1º — ou use o botão acima para gerar um agora.
                  </Text>
                </View>
              ) : drafts.map(card)}

              {published.length > 0 && (
                <>
                  <Text style={s.sectionTitle}>PUBLICADOS</Text>
                  {published.map(card)}
                </>
              )}
            </ScrollView>
          )}

          {editing && tenantId && (
            <Editor
              report={editing}
              tenantId={tenantId}
              trainerId={profile?.id ?? null}
              color={primaryColor}
              onClose={() => setEditing(null)}
              onSaved={async () => { setEditing(null); await load(); }}
            />
          )}

          {generating && tenantId && (
            <GenerateSheet
              students={students}
              tenantId={tenantId}
              color={primaryColor}
              onClose={() => setGenerating(false)}
              onDone={async () => { setGenerating(false); await load(); }}
            />
          )}
        </SafeAreaView>
      </View>
      <GuideModal
        visible={guide.visible}
        content={GUIDES.relatorio_evolucao}
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
  iconBtnSm: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1, textAlign: 'center', fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.sm, color: Colors.textPrimary,
  },
  headerSub: { textAlign: 'center', fontFamily: FontFamily.body, fontSize: 10.5, color: Colors.textSecondary },

  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  intro: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 19 },
  sectionTitle: {
    fontFamily: FontFamily.bodyBold, fontSize: 10, color: Colors.textSecondary,
    letterSpacing: 1.2, marginTop: 8,
  },
  miniTitle: { fontFamily: FontFamily.bodyBold, fontSize: 9.5, color: Colors.textSecondary, letterSpacing: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  link: { fontFamily: FontFamily.body, fontSize: 11 },

  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderRadius: 12, paddingVertical: 13,
  },
  generateText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs },

  empty: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    padding: 14, backgroundColor: Colors.surface,
  },
  emptyText: { flex: 1, fontFamily: FontFamily.body, fontSize: 11.5, color: Colors.textSecondary, lineHeight: 17 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 14,
    padding: 14, backgroundColor: Colors.surface,
  },
  cardName: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textPrimary, flexShrink: 1 },
  cardMeta: { fontFamily: FontFamily.body, fontSize: 10.5, color: Colors.textSecondary, marginTop: 3 },
  badge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontFamily: FontFamily.bodyBold, fontSize: 8, letterSpacing: 0.6 },
  reviewBtn: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  reviewText: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },

  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11,
    fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary,
  },
  inputTitle: { fontFamily: FontFamily.bodyBold },
  textarea: { minHeight: 150, textAlignVertical: 'top' },
  hint: { fontFamily: FontFamily.body, fontSize: 10.5, color: Colors.textSecondary, lineHeight: 15 },

  previewBox: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 14,
    padding: 14, gap: 10, backgroundColor: Colors.surface,
  },
  previewHeadline: { fontFamily: FontFamily.display, fontSize: FontSize.md, color: Colors.textPrimary, lineHeight: 23 },
  previewNarrative: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },

  statsRow: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    backgroundColor: Colors.bg, paddingVertical: 12, alignItems: 'center', gap: 3,
  },
  statValue: { fontFamily: FontFamily.display, fontSize: FontSize.md, color: Colors.textPrimary },
  statLabel: { fontFamily: FontFamily.bodyBold, fontSize: 8.5, color: Colors.textSecondary, letterSpacing: 0.9 },

  recordRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordName: { flex: 1, fontFamily: FontFamily.body, fontSize: 11.5, color: Colors.textPrimary },
  recordKg: { fontFamily: FontFamily.bodyBold, fontSize: 11.5, color: Colors.textSecondary },
  bodyLine: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },

  attention: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    borderWidth: 1, borderColor: `${Colors.warning}40`, backgroundColor: `${Colors.warning}0D`,
    borderRadius: 10, padding: 11,
  },
  attentionText: { flex: 1, fontFamily: FontFamily.body, fontSize: 10.5, color: Colors.textSecondary, lineHeight: 15 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  chipText: { fontFamily: FontFamily.body, fontSize: 11.5, color: Colors.textSecondary, textTransform: 'capitalize' },

  pickRow: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    padding: 13, backgroundColor: Colors.surface,
  },
  pickName: { flex: 1, fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textPrimary },

  footerBar: {
    flexDirection: 'row', gap: 10, padding: 16,
    borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bg,
  },
  ghostBtn: {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  ghostText: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary },
  cta: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  ctaText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.bg, letterSpacing: 0.7 },
  off: { opacity: 0.4 },
});
