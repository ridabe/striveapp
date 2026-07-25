// Relatórios de Evolução — versão nativa.
//
// Só leitura: quem gera é o cron mensal, quem publica é o personal no web.
// O app é onde o aluno lê o resultado do mês — e é aqui que ele passa a
// enxergar o trabalho que o personal fez com ele.
//
// Os números vêm prontos do `metrics` (jsonb) gravado no fechamento do mês.
// O app NÃO recalcula nada: se recalculasse, o relatório de março mudaria
// quando o aluno corrigisse o peso em abril, e o documento deixaria de ser
// histórico. Por isso `evolutionReport.ts` (cópia idêntica à do web) entra
// aqui só pelos tipos e pelo `periodLabel`.

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useStudent } from '@/hooks/useStudent';
import { useThemeStore } from '@/stores/themeStore';
import { StudentHeader } from '@/components/StudentHeader';
import { ModuleGuard } from '@/components/ModuleGuard';
import { MODULE } from '@/lib/modules';
import { periodLabel, type ReportMetrics } from '@/lib/evolutionReport';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

type ReportRow = {
  id: string;
  period_start: string;
  final_headline: string | null;
  final_narrative: string | null;
  metrics: ReportMetrics;
  viewed_by_student_at: string | null;
};

// ─── Blocos ───────────────────────────────────────────────────────────────────

function StatBox({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <View style={s.stat}>
      <Text style={[s.statValue, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value == null || value === 0) return null;
  const positive = value > 0;
  const good = invert ? !positive : positive;
  return (
    <Text style={[s.delta, { color: good ? Colors.success : Colors.warning }]}>
      {positive ? '▲' : '▼'} {Math.abs(value)}%
    </Text>
  );
}

function ReportContent({ metrics, headline, narrative, primaryColor }: {
  metrics: ReportMetrics;
  headline: string | null;
  narrative: string | null;
  primaryColor: string;
}) {
  const { workouts, volume, records, topProgress, body, readiness } = metrics;
  const hasBody = body.weightDelta != null || body.bodyFatDelta != null || body.waistDelta != null;

  const totalTime = workouts.totalMinutes >= 60
    ? `${Math.floor(workouts.totalMinutes / 60)}h${String(workouts.totalMinutes % 60).padStart(2, '0')}`
    : `${workouts.totalMinutes}min`;

  return (
    <View style={{ gap: 20 }}>
      {!!headline && <Text style={s.headline}>{headline}</Text>}
      {!!narrative && <Text style={s.narrative}>{narrative}</Text>}

      <View style={s.statsRow}>
        <StatBox value={String(workouts.completed)} label="TREINOS" accent={primaryColor} />
        <StatBox value={totalTime} label="TEMPO" accent={primaryColor} />
        {workouts.longestStreakDays >= 2 && (
          <StatBox value={`${workouts.longestStreakDays}d`} label="SEQUÊNCIA" accent={primaryColor} />
        )}
      </View>

      {(workouts.deltaPct != null || volume.deltaPct != null) && (
        <View style={s.deltaRow}>
          {workouts.deltaPct != null && (
            <View style={s.deltaItem}>
              <Text style={s.deltaLabel}>Frequência vs. mês anterior</Text>
              <Delta value={workouts.deltaPct} />
            </View>
          )}
          {volume.deltaPct != null && (
            <View style={s.deltaItem}>
              <Text style={s.deltaLabel}>Volume vs. mês anterior</Text>
              <Delta value={volume.deltaPct} />
            </View>
          )}
        </View>
      )}

      {records.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={s.sectionTitle}>RECORDES PESSOAIS</Text>
          {records.map((r) => (
            <View key={r.exerciseId} style={[s.recordRow, { borderColor: `${primaryColor}40` }]}>
              <View style={s.recordLeft}>
                <Ionicons name="trophy" size={14} color={primaryColor} />
                <Text style={s.recordName} numberOfLines={1}>{r.exerciseName}</Text>
              </View>
              <View style={s.recordRight}>
                {r.previousBestKg != null && (
                  <Text style={s.recordOld}>{r.previousBestKg}kg</Text>
                )}
                <Text style={[s.recordNew, { color: primaryColor }]}>{r.loadKg}kg</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {topProgress.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={s.sectionTitle}>MAIORES EVOLUÇÕES</Text>
          {topProgress.map((p) => (
            <View key={p.exerciseId} style={s.progressRow}>
              <Text style={s.recordName} numberOfLines={1}>{p.exerciseName}</Text>
              <View style={s.recordRight}>
                <Text style={s.recordOld}>{p.firstLoadKg}kg</Text>
                <Text style={s.arrow}>→</Text>
                <Text style={s.recordNewPlain}>{p.lastLoadKg}kg</Text>
                <Delta value={p.deltaPct} />
              </View>
            </View>
          ))}
        </View>
      )}

      {hasBody && (
        <View style={{ gap: 8 }}>
          <Text style={s.sectionTitle}>COMPOSIÇÃO CORPORAL</Text>
          <View style={s.statsRow}>
            {body.weightDelta != null && (
              <StatBox
                value={body.weightEnd != null ? `${body.weightEnd}kg` : '—'}
                label={`${body.weightDelta > 0 ? '+' : ''}${body.weightDelta}kg`}
              />
            )}
            {body.bodyFatDelta != null && (
              <StatBox
                value={body.bodyFatEnd != null ? `${body.bodyFatEnd}%` : '—'}
                label={`${body.bodyFatDelta > 0 ? '+' : ''}${body.bodyFatDelta}% gordura`}
              />
            )}
            {body.waistDelta != null && (
              <StatBox
                value={`${body.waistDelta > 0 ? '+' : ''}${body.waistDelta}cm`}
                label="CINTURA"
              />
            )}
          </View>
        </View>
      )}

      {readiness.avgScore != null && (
        <View style={s.readinessRow}>
          <Ionicons name="speedometer-outline" size={14} color={Colors.textSecondary} />
          <Text style={s.readinessText}>
            Prontidão média {readiness.avgScore}/100 em {readiness.checkins} check-in
            {readiness.checkins === 1 ? '' : 's'}
          </Text>
        </View>
      )}

      {/* Ponto de atenção sempre por último — depois das conquistas, nunca antes. */}
      {!!metrics.attentionPoint && (
        <View style={s.attention}>
          <Ionicons name="alert-circle-outline" size={15} color={Colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={s.attentionTitle}>FOCO PARA O PRÓXIMO MÊS</Text>
            <Text style={s.attentionText}>{metrics.attentionPoint}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Tela ─────────────────────────────────────────────────────────────────────

export default function RelatoriosScreen() {
  const { selectedStudent } = useStudent();
  const { primaryColor } = useThemeStore();

  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedStudent) return;
    setLoading(true);

    // A RLS já limita a 'published'; o filtro é clareza, não segurança.
    const { data } = await supabase
      .from('evolution_reports')
      .select('id, period_start, final_headline, final_narrative, metrics, viewed_by_student_at')
      .eq('student_id', selectedStudent.id)
      .eq('status', 'published')
      .order('period_start', { ascending: false });

    const rows = (data ?? []) as unknown as ReportRow[];
    setReports(rows);
    setOpenId(rows[0]?.id ?? null);
    setLoading(false);
  }, [selectedStudent?.id]);

  useEffect(() => { load(); }, [load]);

  // Marca visualização do relatório aberto. Best-effort: falhar aqui só
  // significa que o personal continua vendo "ainda não visto".
  useEffect(() => {
    if (!openId) return;
    const report = reports.find((r) => r.id === openId);
    if (!report || report.viewed_by_student_at) return;

    supabase
      .from('evolution_reports')
      .update({ viewed_by_student_at: new Date().toISOString() } as any)
      .eq('id', openId)
      .is('viewed_by_student_at', null)
      .then(() => {}, () => {});
  }, [openId, reports]);

  return (
    <ModuleGuard slug={MODULE.RELATORIO_EVOLUCAO}>
      <View style={s.safe}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <StudentHeader title="Meus Relatórios" />

          {loading ? (
            <ActivityIndicator color={primaryColor} style={{ marginTop: 48 }} />
          ) : reports.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="bar-chart-outline" size={34} color={Colors.textSecondary} />
              <Text style={s.emptyText}>
                Seu primeiro relatório mensal aparece aqui assim que seu personal publicar.
                Ele reúne tudo que você fez no mês.
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
              {reports.map((report) => {
                const open = openId === report.id;
                return (
                  <View key={report.id} style={s.card}>
                    <TouchableOpacity
                      onPress={() => setOpenId(open ? null : report.id)}
                      style={s.cardHeader}
                      accessibilityRole="button"
                    >
                      <View style={{ flex: 1 }}>
                        <View style={s.cardTitleRow}>
                          <Text style={s.cardTitle}>{periodLabel(report.period_start)}</Text>
                          {!report.viewed_by_student_at && (
                            <View style={[s.badge, { backgroundColor: primaryColor }]}>
                              <Text style={s.badgeText}>NOVO</Text>
                            </View>
                          )}
                        </View>
                        {!!report.final_headline && (
                          <Text style={s.cardSubtitle} numberOfLines={1}>
                            {report.final_headline}
                          </Text>
                        )}
                      </View>
                      <Ionicons
                        name={open ? 'chevron-up' : 'chevron-down'}
                        size={17}
                        color={Colors.textSecondary}
                      />
                    </TouchableOpacity>

                    {open && (
                      <View style={s.cardBody}>
                        <ReportContent
                          metrics={report.metrics}
                          headline={report.final_headline}
                          narrative={report.final_narrative}
                          primaryColor={primaryColor}
                        />
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </SafeAreaView>
      </View>
    </ModuleGuard>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  empty: { alignItems: 'center', gap: 14, padding: 40, marginTop: 40 },
  emptyText: {
    fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 21,
  },

  card: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 16,
    backgroundColor: Colors.surface, overflow: 'hidden',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: {
    fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textPrimary,
    textTransform: 'capitalize',
  },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontFamily: FontFamily.bodyBold, fontSize: 9, color: Colors.bg, letterSpacing: 0.5 },
  cardSubtitle: {
    fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 2,
  },
  cardBody: { borderTopWidth: 1, borderTopColor: Colors.border, padding: 16 },

  headline: {
    fontFamily: FontFamily.display, fontSize: FontSize.lg, color: Colors.textPrimary, lineHeight: 26,
  },
  narrative: {
    fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 21,
  },

  statsRow: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    backgroundColor: Colors.bg, paddingVertical: 14, alignItems: 'center', gap: 4,
  },
  statValue: { fontFamily: FontFamily.display, fontSize: FontSize.lg, color: Colors.textPrimary },
  statLabel: {
    fontFamily: FontFamily.bodyBold, fontSize: 9, color: Colors.textSecondary,
    letterSpacing: 1, textAlign: 'center',
  },

  deltaRow: { gap: 8 },
  deltaItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deltaLabel: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },
  delta: { fontFamily: FontFamily.bodyBold, fontSize: 11 },

  sectionTitle: {
    fontFamily: FontFamily.bodyBold, fontSize: 10, color: Colors.textSecondary, letterSpacing: 1.2,
  },
  recordRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 13, gap: 10,
  },
  recordLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  recordName: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textPrimary, flex: 1 },
  recordRight: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  recordOld: {
    fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  recordNew: { fontFamily: FontFamily.display, fontSize: FontSize.sm },
  recordNewPlain: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textPrimary },
  arrow: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },
  progressRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingVertical: 11, paddingHorizontal: 13, gap: 10,
  },

  readinessRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  readinessText: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },

  attention: {
    flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: `${Colors.warning}40`,
    backgroundColor: `${Colors.warning}0D`, borderRadius: 12, padding: 13,
  },
  attentionTitle: {
    fontFamily: FontFamily.bodyBold, fontSize: 9, color: Colors.warning, letterSpacing: 1,
  },
  attentionText: {
    fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary,
    lineHeight: 16, marginTop: 3,
  },
});
