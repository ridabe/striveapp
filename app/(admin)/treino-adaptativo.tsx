// Treino Adaptativo — configuração dos limites, lado do personal, no app.
//
// Esta tela faltava: eu tinha portado só o lado do ALUNO (check-in e RPE na
// execução) e deixado a configuração exclusiva do web. Resultado: quem seguia
// o "como usar" pelo celular não encontrava nada.
//
// Painel de responsabilidade profissional: nada que o motor faz com o aluno
// está fora do que foi definido aqui. Por isso cada controle tem uma explicação
// do efeito prático, e não só um número.

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
  TextInput, Alert, Modal,
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
  loadRules, loadStudents, loadExercises, loadReadinessAlerts,
  saveRule, deleteRule, toForm,
  type RuleRow, type RuleForm, type StudentOption, type ExerciseOption, type AdaptiveAlert,
} from '@/lib/adaptiveRules';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

// ─── Controles ────────────────────────────────────────────────────────────────

function Stepper({
  label, hint, value, onChange, min, max, step = 1, suffix = '', color,
}: {
  label: string; hint?: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number; suffix?: string; color: string;
}) {
  const dec = () => onChange(Math.max(min, Math.round((value - step) * 10) / 10));
  const inc = () => onChange(Math.min(max, Math.round((value + step) * 10) / 10));

  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      {!!hint && <Text style={s.fieldHint}>{hint}</Text>}
      <View style={s.stepper}>
        <TouchableOpacity onPress={dec} disabled={value <= min} style={[s.stepBtn, value <= min && s.stepOff]}>
          <Ionicons name="remove" size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.stepValue, { color }]}>{value}{suffix}</Text>
        <TouchableOpacity onPress={inc} disabled={value >= max} style={[s.stepBtn, value >= max && s.stepOff]}>
          <Ionicons name="add" size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Toggle({
  label, hint, value, onChange, color,
}: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; color: string }) {
  return (
    <TouchableOpacity onPress={() => onChange(!value)} style={s.toggleRow} activeOpacity={0.7}>
      <View style={{ flex: 1 }}>
        <Text style={s.fieldLabel}>{label}</Text>
        {!!hint && <Text style={s.fieldHint}>{hint}</Text>}
      </View>
      <View style={[s.track, value && { backgroundColor: color }]}>
        <View style={[s.knob, value && { transform: [{ translateX: 18 }] }]} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Seletor de exercícios travados ───────────────────────────────────────────

function LockedPicker({
  visible, exercises, selected, onClose, onChange, color,
}: {
  visible: boolean; exercises: ExerciseOption[]; selected: string[];
  onClose: () => void; onChange: (ids: string[]) => void; color: string;
}) {
  const [q, setQ] = useState('');
  const filtered = q.trim()
    ? exercises.filter(e => e.name.toLowerCase().includes(q.trim().toLowerCase()))
    : exercises.slice(0, 60);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.safe}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={s.header}>
            <TouchableOpacity onPress={onClose} style={s.iconBtn}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Exercícios travados</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={{ padding: 16, gap: 12, flex: 1 }}>
            <Text style={s.fieldHint}>
              Exercícios travados nunca são alterados nem trocados, em nenhuma condição.
              Use para reabilitação, aprendizado técnico ou movimento que exija carga exata.
            </Text>

            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Buscar exercício..."
              placeholderTextColor={Colors.textSecondary}
              style={s.input}
            />

            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
              {filtered.length === 0 && (
                <Text style={s.fieldHint}>Nenhum exercício encontrado.</Text>
              )}
              {filtered.map(ex => {
                const on = selected.includes(ex.id);
                return (
                  <TouchableOpacity
                    key={ex.id}
                    onPress={() => onChange(on ? selected.filter(i => i !== ex.id) : [...selected, ex.id])}
                    style={s.exRow}
                  >
                    <Ionicons
                      name={on ? 'lock-closed' : 'ellipse-outline'}
                      size={17}
                      color={on ? color : Colors.textSecondary}
                    />
                    <Text style={[s.exName, on && { color }]} numberOfLines={1}>{ex.name}</Text>
                    {!!ex.muscle_group && <Text style={s.exMuscle}>{ex.muscle_group}</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ─── Editor de uma regra ──────────────────────────────────────────────────────

function RuleEditor({
  title, subtitle, initial, exercises, tenantId, color, onSaved, onDelete,
}: {
  title: string; subtitle: string; initial: RuleForm; exercises: ExerciseOption[];
  tenantId: string; color: string; onSaved: () => void; onDelete?: () => void;
}) {
  const [form, setForm] = useState<RuleForm>(initial);
  const [open, setOpen] = useState(false);
  const [picker, setPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { setForm(initial); }, [initial.id, initial.studentId]);

  const set = <K extends keyof RuleForm>(k: K, v: RuleForm[K]) => {
    setForm(f => ({ ...f, [k]: v })); setMsg(null);
  };

  const invalid = form.maxReadinessForDecrease >= form.minReadinessForIncrease;

  async function handleSave() {
    setSaving(true);
    const r = await saveRule(tenantId, form);
    setSaving(false);
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    setMsg({ ok: true, text: 'Limites salvos.' });
    onSaved();
  }

  return (
    <View style={[s.card, { borderColor: form.enabled ? `${color}55` : Colors.border }]}>
      <TouchableOpacity onPress={() => setOpen(o => !o)} style={s.cardHead} activeOpacity={0.7}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>{title}</Text>
          <Text style={s.cardSub}>{subtitle}</Text>
        </View>
        <View style={[s.pill, form.enabled ? { backgroundColor: `${color}22`, borderColor: `${color}66` } : null]}>
          <Text style={[s.pillText, form.enabled && { color }]}>
            {form.enabled ? 'ATIVO' : 'DESLIGADO'}
          </Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={17} color={Colors.textSecondary} />
      </TouchableOpacity>

      {open && (
        <View style={s.cardBody}>
          <Toggle
            label="Ajuste automático ativo"
            hint="Desligado, o aluno ainda faz o check-in e marca o esforço — mas nada é alterado sozinho."
            value={form.enabled}
            onChange={v => set('enabled', v)}
            color={color}
          />

          <View style={s.divider} />

          <Stepper
            label="Aumento máximo de carga" suffix="%"
            hint="Teto absoluto. Nem no melhor dia o treino passa disso."
            value={form.maxLoadIncreasePct} onChange={v => set('maxLoadIncreasePct', v)}
            min={0} max={25} step={0.5} color={color}
          />
          <Stepper
            label="Redução máxima de carga" suffix="%"
            hint="Quanto o treino pode aliviar num dia ruim."
            value={form.maxLoadDecreasePct} onChange={v => set('maxLoadDecreasePct', v)}
            min={0} max={40} step={0.5} color={color}
          />
          <Stepper
            label="Prontidão mínima para avançar"
            hint="Abaixo disso, o treino nunca sobe a carga."
            value={form.minReadinessForIncrease} onChange={v => set('minReadinessForIncrease', v)}
            min={0} max={100} step={5} color={color}
          />
          <Stepper
            label="Prontidão máxima para aliviar"
            hint="Abaixo disso, o treino alivia automaticamente."
            value={form.maxReadinessForDecrease} onChange={v => set('maxReadinessForDecrease', v)}
            min={0} max={100} step={5} color={color}
          />

          {invalid && (
            <View style={s.warn}>
              <Ionicons name="alert-circle-outline" size={15} color={Colors.warning} />
              <Text style={s.warnText}>
                O limite para aliviar precisa ser menor que o de avançar. Do jeito que está,
                existe uma faixa que dispararia os dois ao mesmo tempo.
              </Text>
            </View>
          )}

          <View style={s.divider} />

          <Stepper
            label="Esforço alvo por série"
            hint="8 significa: sobrariam 2 repetições no tanque."
            value={form.defaultTargetRpe} onChange={v => set('defaultTargetRpe', v)}
            min={5} max={10} step={0.5} color={color}
          />

          <View style={s.divider} />

          <Toggle
            label="Permitir ajuste de volume"
            hint="Tirar ou acrescentar série no exercício principal da rotina."
            value={form.allowVolumeAdjust} onChange={v => set('allowVolumeAdjust', v)} color={color}
          />
          {form.allowVolumeAdjust && (
            <>
              <Stepper label="Séries que pode acrescentar" value={form.maxSetsAdded}
                onChange={v => set('maxSetsAdded', v)} min={0} max={3} color={color} />
              <Stepper label="Séries que pode remover" value={form.maxSetsRemoved}
                onChange={v => set('maxSetsRemoved', v)} min={0} max={3} color={color} />
            </>
          )}
          <Toggle
            label="Permitir troca por dor reportada"
            hint="Sugere outro exercício do mesmo grupo quando o aluno marca dor na região."
            value={form.allowExerciseSwap} onChange={v => set('allowExerciseSwap', v)} color={color}
          />

          <View style={s.divider} />

          <TouchableOpacity onPress={() => setPicker(true)} style={s.lockRow}>
            <Ionicons name="lock-closed-outline" size={16} color={color} />
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Exercícios travados</Text>
              <Text style={s.fieldHint}>
                {form.lockedExerciseIds.length === 0
                  ? 'Nenhum — todos podem ser ajustados'
                  : `${form.lockedExerciseIds.length} exercício${form.lockedExerciseIds.length > 1 ? 's' : ''} nunca será alterado`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>

          {msg && (
            <Text style={[s.msg, { color: msg.ok ? Colors.success : Colors.error }]}>{msg.text}</Text>
          )}

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving || invalid}
            style={[s.saveBtn, { backgroundColor: color }, (saving || invalid) && s.stepOff]}
          >
            {saving
              ? <ActivityIndicator color={Colors.bg} />
              : <Text style={s.saveText}>SALVAR LIMITES</Text>}
          </TouchableOpacity>

          {!!onDelete && (
            <TouchableOpacity
              onPress={() => Alert.alert(
                'Remover exceção',
                'Este aluno volta a seguir os limites padrão.',
                [{ text: 'Cancelar', style: 'cancel' }, { text: 'Remover', style: 'destructive', onPress: onDelete }],
              )}
              style={s.removeBtn}
            >
              <Text style={s.removeText}>Remover exceção</Text>
            </TouchableOpacity>
          )}

          <LockedPicker
            visible={picker}
            exercises={exercises}
            selected={form.lockedExerciseIds}
            onClose={() => setPicker(false)}
            onChange={ids => set('lockedExerciseIds', ids)}
            color={color}
          />
        </View>
      )}
    </View>
  );
}

// ─── Tela ─────────────────────────────────────────────────────────────────────

export default function TreinoAdaptativoScreen() {
  const { profile } = useAuthStore();
  const { primaryColor } = useThemeStore();
  const tenantId = profile?.tenant_id ?? null;

  // Abre sozinho na primeira visita; "Nao mostrar mais" persiste por usuario
  // (SecureStore). O link no cabecalho reabre quando ele precisar.
  const guide = useGuide('treino_adaptativo', profile?.id);

  const [rules, setRules] = useState<RuleRow[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [exercises, setExercises] = useState<ExerciseOption[]>([]);
  const [alerts, setAlerts] = useState<AdaptiveAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const [r, st, ex, al] = await Promise.all([
      loadRules(tenantId), loadStudents(tenantId), loadExercises(tenantId), loadReadinessAlerts(tenantId),
    ]);
    setRules(r); setStudents(st); setExercises(ex); setAlerts(al);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const defaultRule = rules.find(r => r.student_id === null && r.workout_plan_id === null) ?? null;
  const studentRules = rules.filter(r => r.student_id !== null);
  const available = students.filter(st => !studentRules.some(r => r.student_id === st.id));

  async function handleDelete(ruleId: string) {
    if (!tenantId) return;
    const r = await deleteRule(tenantId, ruleId);
    if (r.error) { Alert.alert('Não foi possível remover', r.error); return; }
    await load();
  }

  return (
    <ModuleGuard slug={MODULE.TREINO_ADAPTATIVO}>
      <View style={s.safe}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={s.header}>
            <View style={{ width: 80 }} />
            <Text style={s.headerTitle}>Treino Adaptativo</Text>
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
                Seu aluno faz um check-in de 15 segundos antes de treinar e marca o esforço de cada
                série. O treino ajusta carga e volume dentro dos limites que{' '}
                <Text style={{ color: Colors.textPrimary }}>você</Text> define aqui — nunca fora deles.
              </Text>

              {alerts.length > 0 && (
                <View style={{ gap: 8 }}>
                  <Text style={s.sectionTitle}>PRECISA DE VOCÊ</Text>
                  {alerts.map(a => (
                    <View key={a.studentId} style={s.alert}>
                      <Ionicons name="alert-circle-outline" size={16} color={Colors.warning} />
                      <Text style={s.alertText}>{a.message}</Text>
                    </View>
                  ))}
                </View>
              )}

              <Text style={s.sectionTitle}>LIMITES PADRÃO DO SEU NEGÓCIO</Text>
              <RuleEditor
                title="Todos os alunos"
                subtitle="Vale para quem não tiver exceção própria"
                initial={toForm(defaultRule)}
                exercises={exercises}
                tenantId={tenantId ?? ''}
                color={primaryColor}
                onSaved={load}
              />

              <Text style={s.sectionTitle}>EXCEÇÕES POR ALUNO</Text>
              <Text style={s.fieldHint}>
                Pós-lesão, iniciante, atleta — quem precisa de limite diferente do padrão.
              </Text>

              {studentRules.map(rule => {
                const st = students.find(x => x.id === rule.student_id);
                return (
                  <RuleEditor
                    key={rule.id}
                    title={st?.full_name ?? 'Aluno'}
                    subtitle="Estes limites substituem o padrão"
                    initial={toForm(rule)}
                    exercises={exercises}
                    tenantId={tenantId ?? ''}
                    color={primaryColor}
                    onSaved={load}
                    onDelete={() => handleDelete(rule.id)}
                  />
                );
              })}

              {addingFor && (
                <RuleEditor
                  title={students.find(x => x.id === addingFor)?.full_name ?? 'Aluno'}
                  subtitle="Salve para criar a exceção"
                  initial={{ ...toForm(null), studentId: addingFor }}
                  exercises={exercises}
                  tenantId={tenantId ?? ''}
                  color={primaryColor}
                  onSaved={async () => { setAddingFor(null); await load(); }}
                  onDelete={() => setAddingFor(null)}
                />
              )}

              {available.length > 0 && !addingFor && (
                <TouchableOpacity onPress={() => setShowPicker(true)} style={s.addBtn}>
                  <Ionicons name="add" size={17} color={Colors.textSecondary} />
                  <Text style={s.addText}>Adicionar exceção para um aluno</Text>
                </TouchableOpacity>
              )}

              <Modal visible={showPicker} animationType="slide" presentationStyle="pageSheet"
                onRequestClose={() => setShowPicker(false)}>
                <View style={s.safe}>
                  <SafeAreaView edges={['top']} style={{ flex: 1 }}>
                    <View style={s.header}>
                      <TouchableOpacity onPress={() => setShowPicker(false)} style={s.iconBtn}>
                        <Ionicons name="close" size={22} color={Colors.textSecondary} />
                      </TouchableOpacity>
                      <Text style={s.headerTitle}>Escolher aluno</Text>
                      <View style={{ width: 40 }} />
                    </View>
                    <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
                      {available.map(st => (
                        <TouchableOpacity
                          key={st.id}
                          onPress={() => { setAddingFor(st.id); setShowPicker(false); }}
                          style={s.exRow}
                        >
                          <Ionicons name="person-outline" size={16} color={Colors.textSecondary} />
                          <Text style={s.exName}>{st.full_name}</Text>
                          <Ionicons name="chevron-forward" size={15} color={Colors.textSecondary} />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </SafeAreaView>
                </View>
              </Modal>
            </ScrollView>
          )}
        </SafeAreaView>
      </View>
      <GuideModal
        visible={guide.visible}
        content={GUIDES.treino_adaptativo}
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
  scroll: { padding: 16, gap: 14, paddingBottom: 48 },
  intro: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 19 },
  sectionTitle: {
    fontFamily: FontFamily.bodyBold, fontSize: 10, color: Colors.textSecondary,
    letterSpacing: 1.2, marginTop: 6,
  },

  alert: {
    flexDirection: 'row', gap: 9, alignItems: 'flex-start',
    borderWidth: 1, borderColor: `${Colors.warning}40`, backgroundColor: `${Colors.warning}0D`,
    borderRadius: 12, padding: 13,
  },
  alertText: { flex: 1, fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },

  card: { borderWidth: 1, borderRadius: 16, backgroundColor: Colors.surface, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  cardTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  cardSub: { fontFamily: FontFamily.body, fontSize: 10.5, color: Colors.textSecondary, marginTop: 2 },
  pill: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  pillText: { fontFamily: FontFamily.bodyBold, fontSize: 8.5, color: Colors.textSecondary, letterSpacing: 0.8 },
  cardBody: { borderTopWidth: 1, borderTopColor: Colors.border, padding: 14, gap: 16 },
  divider: { height: 1, backgroundColor: Colors.border },

  field: { gap: 6 },
  fieldLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textPrimary },
  fieldHint: { fontFamily: FontFamily.body, fontSize: 10.5, color: Colors.textSecondary, lineHeight: 15 },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  stepBtn: {
    width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg,
  },
  stepOff: { opacity: 0.35 },
  stepValue: { flex: 1, textAlign: 'center', fontFamily: FontFamily.display, fontSize: FontSize.md },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  track: { width: 42, height: 24, borderRadius: 12, backgroundColor: Colors.border, justifyContent: 'center' },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.bg, marginLeft: 3 },

  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  warn: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    borderWidth: 1, borderColor: `${Colors.warning}40`, backgroundColor: `${Colors.warning}0D`,
    borderRadius: 10, padding: 11,
  },
  warnText: { flex: 1, fontFamily: FontFamily.body, fontSize: 10.5, color: Colors.textSecondary, lineHeight: 15 },

  msg: { fontFamily: FontFamily.body, fontSize: 11 },
  saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.bg, letterSpacing: 0.8 },
  removeBtn: { alignItems: 'center', paddingVertical: 8 },
  removeText: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.error },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed',
    borderRadius: 12, paddingVertical: 14,
  },
  addText: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary },

  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11,
    fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary,
  },
  exRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingVertical: 13, paddingHorizontal: 13, backgroundColor: Colors.surface, marginBottom: 8,
  },
  exName: { flex: 1, fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textPrimary },
  exMuscle: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary },
});
