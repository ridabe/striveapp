import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Modal, TextInput,
  KeyboardAvoidingView, Platform, Alert, Switch,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { backToStudentHub } from '@/lib/studentNav';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { ModuleGuard } from '@/components/ModuleGuard';
import { MODULE } from '@/lib/modules';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { GuideModal } from '@/components/guides/GuideModal';
import { useGuide } from '@/hooks/useGuide';
import { GUIDES } from '@/lib/guides';

// ─── Tipos ──────────────────────────────────────────────────────────────────
type BillingType = 'recorrente' | 'pacote';
type PaymentMethod = 'dinheiro' | 'pix_manual' | 'transferencia' | 'cartao_manual' | 'outro';
type ChargeStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

interface Student { id: string; full_name: string; status: string }

interface Subscription {
  id: string;
  student_id: string;
  plan_name: string;
  amount: number;
  due_day: number;
  active: boolean;
  billing_type: BillingType;
  total_installments: number | null;
  sync_to_agenda: boolean;
}

interface Charge {
  id: string;
  plan_name: string;
  amount: number;
  due_date: string;
  status: ChargeStatus;
  paid_at: string | null;
  subscription_id: string | null;
}

interface StudentSummary extends Student {
  subscription: Subscription | null;
  paidInPackage: number;
  openCount: number;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'pix_manual',    label: 'PIX' },
  { value: 'dinheiro',      label: 'Dinheiro' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'cartao_manual', label: 'Cartão (maquininha)' },
  { value: 'outro',         label: 'Outro' },
];

const STATUS_CONFIG: Record<ChargeStatus, { label: string; color: string; icon: string }> = {
  paid:      { label: 'Pago',      color: Colors.success,      icon: 'checkmark-circle-outline' },
  pending:   { label: 'Pendente',  color: Colors.warning,      icon: 'time-outline' },
  overdue:   { label: 'Atrasado',  color: Colors.error,        icon: 'alert-circle-outline' },
  cancelled: { label: 'Cancelado', color: Colors.textSecondary, icon: 'close-circle-outline' },
};

// due_date/paid_at vêm como "YYYY-MM-DD..." — formata direto da string, sem
// passar por Date/TZ (mesmo cuidado do financeiro web).
function fmtDate(dateStr: string) {
  const [year, month, day] = dateStr.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ── Geração mensal e marcação de atraso ──────────────────────────────────────
// Espelha src/lib/billing/core.ts do sistema web (generateMonthlyChargesFor /
// markOverdueChargesFor). O mobile não tem camada de server actions — tudo é
// feito direto pelo client, protegido pelas mesmas policies de RLS
// (can_manage_billing) do banco compartilhado.
async function generateMonthlyCharges(tenantId: string) {
  const { data: subs } = await supabase
    .from('student_billing_subscriptions')
    .select('id, student_id, plan_name, amount, due_day, sync_to_agenda')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .eq('billing_type', 'recorrente');

  if (!subs?.length) return;

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const pad = (n: number) => String(n).padStart(2, '0');
  const startOfMonth = `${year}-${pad(month + 1)}-01`;
  const next = new Date(Date.UTC(year, month + 1, 1));
  const startOfNextMonth = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-01`;

  const { data: existing } = await supabase
    .from('financial_plans')
    .select('subscription_id')
    .eq('tenant_id', tenantId)
    .gte('due_date', startOfMonth)
    .lt('due_date', startOfNextMonth)
    .not('subscription_id', 'is', null);

  const billed = new Set((existing ?? []).map((c) => c.subscription_id));
  const pending = subs.filter((s) => !billed.has(s.id));
  if (!pending.length) return;

  const { data: inserted } = await supabase
    .from('financial_plans')
    .insert(
      pending.map((s) => ({
        tenant_id: tenantId,
        student_id: s.student_id,
        subscription_id: s.id,
        plan_name: s.plan_name,
        amount: s.amount,
        due_date: `${year}-${pad(month + 1)}-${pad(s.due_day)}`,
        status: 'pending' as const,
      })),
    )
    .select('id, student_id, subscription_id, plan_name, amount, due_date');

  const syncIds = new Set(pending.filter((s) => s.sync_to_agenda).map((s) => s.id));
  const toSync = (inserted ?? []).filter((c) => c.subscription_id && syncIds.has(c.subscription_id));
  if (toSync.length) await createAgendaEventsForCharges(tenantId, toSync);
}

// Cria eventos de agenda (type=pagamento_a_receber) para cobranças cuja
// assinatura tem sync_to_agenda=true — espelha createAgendaEventsForCharges
// do web (src/lib/billing/core.ts). Idempotente via índice único em
// agenda_events.financial_plan_id.
async function createAgendaEventsForCharges(
  tenantId: string,
  charges: { id: string; student_id: string; plan_name: string; amount: number; due_date: string }[],
) {
  const studentIds = [...new Set(charges.map((c) => c.student_id))];
  const { data: students } = await supabase.from('students').select('id, full_name').in('id', studentIds);
  const nameById = new Map((students ?? []).map((s) => [s.id, s.full_name]));

  const events = charges.map((c) => ({
    tenant_id: tenantId,
    type: 'pagamento_a_receber',
    title: c.plan_name,
    event_date: c.due_date,
    student_id: c.student_id,
    student_name: nameById.get(c.student_id) ?? null,
    amount: c.amount,
    status: 'scheduled',
    origin: 'personal' as const,
    financial_plan_id: c.id,
  }));

  const { error } = await supabase.from('agenda_events').insert(events);
  if (error && (error as any).code !== '23505') {
    console.error('[financeiro] falha ao criar eventos de agenda:', error.message);
  }
}

async function markOverdueCharges(tenantId: string) {
  const today = new Date().toISOString().slice(0, 10);
  await supabase
    .from('financial_plans')
    .update({ status: 'overdue' })
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .lt('due_date', today);
}

// Cria (ou substitui) a assinatura e, se for pacote, gera de uma vez todas as
// N parcelas mensais — espelha createPackageSubscription do web.
async function saveSubscription(params: {
  tenantId: string;
  studentId: string;
  planName: string;
  amount: number;
  dueDay: number;
  billingType: BillingType;
  totalInstallments: number | null;
  syncToAgenda: boolean;
}) {
  const { tenantId, studentId, planName, amount, dueDay, billingType, totalInstallments, syncToAgenda } = params;

  const { data: subscription, error } = await supabase
    .from('student_billing_subscriptions')
    .upsert(
      {
        tenant_id: tenantId,
        student_id: studentId,
        plan_name: planName,
        amount,
        due_day: dueDay,
        active: true,
        billing_type: billingType,
        total_installments: billingType === 'pacote' ? totalInstallments : null,
        sync_to_agenda: syncToAgenda,
      },
      { onConflict: 'student_id' },
    )
    .select('id')
    .single();

  if (error) throw error;
  if (billingType !== 'pacote' || !totalInstallments) return;

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const pad = (n: number) => String(n).padStart(2, '0');

  const rows = Array.from({ length: totalInstallments }, (_, i) => {
    const d = new Date(Date.UTC(year, month + i, 1));
    return {
      tenant_id: tenantId,
      student_id: studentId,
      subscription_id: subscription.id,
      plan_name: planName,
      amount,
      due_date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(dueDay)}`,
      status: 'pending' as const,
    };
  });

  const { data: inserted, error: insertError } = await supabase
    .from('financial_plans')
    .insert(rows)
    .select('id, student_id, plan_name, amount, due_date');
  // 23505 = unique_violation — parcela do mês já existe (reenvio); ignora.
  if (insertError && (insertError as any).code !== '23505') throw insertError;

  if (syncToAgenda && inserted?.length) {
    await createAgendaEventsForCharges(tenantId, inserted);
  }
}

// ─── Linha de cobrança (dar baixa / desfazer / cancelar) ────────────────────
function ChargeRow({ charge, primaryColor, onChanged }: {
  charge: Charge;
  primaryColor: string;
  onChanged: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const cfg = STATUS_CONFIG[charge.status];

  async function confirmPayment(method: PaymentMethod) {
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('financial_plans')
        .update({ status: 'paid', paid_at: new Date().toISOString(), paid_by: user?.id ?? null, payment_method: method })
        .eq('id', charge.id);
      if (error) throw error;
      await supabase.from('agenda_events').update({ status: 'completed' }).eq('financial_plan_id', charge.id);
      setPickerOpen(false);
      onChanged();
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível dar baixa.');
    } finally {
      setBusy(false);
    }
  }

  function handleUndo() {
    Alert.alert('Desfazer baixa', 'Voltar esta cobrança para pendente/atrasada?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desfazer', style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            const today = new Date().toISOString().slice(0, 10);
            const status: ChargeStatus = charge.due_date < today ? 'overdue' : 'pending';
            const { error } = await supabase
              .from('financial_plans')
              .update({ status, paid_at: null, paid_by: null, payment_method: null })
              .eq('id', charge.id);
            if (error) throw error;
            await supabase.from('agenda_events').update({ status: 'scheduled' }).eq('financial_plan_id', charge.id);
            onChanged();
          } catch (e: any) {
            Alert.alert('Erro', e.message ?? 'Não foi possível desfazer.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  function handleCancel() {
    Alert.alert('Cancelar cobrança', 'Esta cobrança deixa de contar como pendente/atrasada.', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Cancelar cobrança', style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            const { error } = await supabase.from('financial_plans').update({ status: 'cancelled' }).eq('id', charge.id);
            if (error) throw error;
            await supabase.from('agenda_events').update({ status: 'cancelled' }).eq('financial_plan_id', charge.id);
            onChanged();
          } catch (e: any) {
            Alert.alert('Erro', e.message ?? 'Não foi possível cancelar.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <View style={cr.card}>
      <View style={{ flex: 1 }}>
        <Text style={cr.planName} numberOfLines={1}>{charge.plan_name}</Text>
        <Text style={cr.dueDate}>
          Vencimento {fmtDate(charge.due_date)}
          {charge.paid_at ? `  ·  pago em ${fmtDate(charge.paid_at)}` : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Text style={cr.amount}>{fmtCurrency(charge.amount)}</Text>
        <View style={[cr.statusPill, { backgroundColor: `${cfg.color}18` }]}>
          <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
          <Text style={[cr.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      {charge.status === 'paid' && (
        <TouchableOpacity onPress={handleUndo} disabled={busy} style={cr.actionBtn}>
          {busy ? <ActivityIndicator size="small" color={Colors.textSecondary} /> : (
            <Ionicons name="arrow-undo-outline" size={18} color={Colors.textSecondary} />
          )}
        </TouchableOpacity>
      )}

      {(charge.status === 'pending' || charge.status === 'overdue') && !pickerOpen && (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity onPress={() => setPickerOpen(true)} disabled={busy} style={[cr.actionBtn, { backgroundColor: `${Colors.success}18` }]}>
            <Ionicons name="checkmark-outline" size={18} color={Colors.success} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCancel} disabled={busy} style={cr.actionBtn}>
            <Ionicons name="close-outline" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {pickerOpen && (
        <Modal transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
          <TouchableOpacity style={cr.overlay} activeOpacity={1} onPress={() => setPickerOpen(false)}>
            <View style={cr.sheet}>
              <Text style={cr.sheetTitle}>Como o aluno pagou?</Text>
              {PAYMENT_METHODS.map((m) => (
                <TouchableOpacity key={m.value} style={cr.sheetItem} onPress={() => confirmPayment(m.value)} disabled={busy}>
                  <Text style={cr.sheetItemText}>{m.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

// ─── Lista de alunos ─────────────────────────────────────────────────────────
function StudentListView({ students, loading, primaryColor, onSelect, onOpenGuide }: {
  students: StudentSummary[];
  loading: boolean;
  primaryColor: string;
  onSelect: (s: StudentSummary) => void;
  onOpenGuide: () => void;
}) {
  if (loading) return <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />;

  return (
    <FlatList
      data={students}
      keyExtractor={(s) => s.id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 12 }}
      ListHeaderComponent={
        <TouchableOpacity onPress={onOpenGuide} style={sl.guideLink} activeOpacity={0.7}>
          <Ionicons name="help-circle-outline" size={14} color={primaryColor} />
          <Text style={[sl.guideLinkText, { color: primaryColor }]}>Como funciona a cobrança?</Text>
        </TouchableOpacity>
      }
      renderItem={({ item }) => {
        const initials = item.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
        const sub = item.subscription;
        return (
          <TouchableOpacity style={sl.card} onPress={() => onSelect(item)} activeOpacity={0.75}>
            <View style={[sl.avatar, { backgroundColor: `${primaryColor}20` }]}>
              <Text style={[sl.avatarLetter, { color: primaryColor }]}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={sl.name}>{item.full_name}</Text>
              {sub ? (
                <Text style={sl.sub}>
                  {fmtCurrency(sub.amount)}/mês · dia {sub.due_day}
                  {sub.billing_type === 'pacote' ? `  ·  pacote ${item.paidInPackage}/${sub.total_installments}` : ''}
                </Text>
              ) : (
                <Text style={sl.sub}>Sem cobrança configurada</Text>
              )}
            </View>
            {item.openCount > 0 && (
              <View style={[sl.badge, { backgroundColor: `${Colors.warning}18` }]}>
                <Text style={[sl.badgeText, { color: Colors.warning }]}>{item.openCount} em aberto</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={
        <View style={sl.empty}>
          <Ionicons name="card-outline" size={52} color={Colors.border} />
          <Text style={sl.emptyTitle}>Nenhum aluno</Text>
          <Text style={sl.emptyText}>Cadastre alunos para configurar cobranças.</Text>
        </View>
      }
    />
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function FinanceiroScreen() {
  const { profile } = useAuthStore();
  const { primaryColor, primaryTextColor } = useThemeStore();
  const { studentId } = useLocalSearchParams<{ studentId?: string }>();
  const tenantId = profile?.tenant_id;
  const guide = useGuide('faturas_cobranca', profile?.id);

  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StudentSummary | null>(null);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fPlanName, setFPlanName] = useState('Mensalidade');
  const [fAmount, setFAmount] = useState('');
  const [fDueDay, setFDueDay] = useState('');
  const [fBillingType, setFBillingType] = useState<BillingType>('recorrente');
  const [fTotalInstallments, setFTotalInstallments] = useState('');
  const [fSyncToAgenda, setFSyncToAgenda] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    await generateMonthlyCharges(tenantId);
    await markOverdueCharges(tenantId);

    const [stRes, subRes, chargesRes] = await Promise.all([
      supabase.from('students').select('id, full_name, status').eq('tenant_id', tenantId).eq('status', 'active').order('full_name'),
      supabase.from('student_billing_subscriptions')
        .select('id, student_id, plan_name, amount, due_day, active, billing_type, total_installments, sync_to_agenda')
        .eq('tenant_id', tenantId).eq('active', true),
      supabase.from('financial_plans')
        .select('id, student_id, subscription_id, status')
        .eq('tenant_id', tenantId),
    ]);

    const subsByStudent = new Map((subRes.data ?? []).map((s) => [s.student_id, s as Subscription]));
    const allCharges = chargesRes.data ?? [];

    const summary: StudentSummary[] = (stRes.data ?? []).map((s: Student) => {
      const sub = subsByStudent.get(s.id) ?? null;
      const studentCharges = allCharges.filter((c) => c.student_id === s.id);
      const paidInPackage = sub?.billing_type === 'pacote'
        ? studentCharges.filter((c) => c.subscription_id === sub.id && c.status === 'paid').length
        : 0;
      const openCount = studentCharges.filter((c) => c.status === 'pending' || c.status === 'overdue').length;
      return { ...s, subscription: sub, paidInPackage, openCount };
    });

    setStudents(summary);

    if (studentId) {
      const match = summary.find((s) => s.id === studentId);
      if (match) await handleSelect(match);
    }
  }, [tenantId, studentId]);

  const loadDetail = useCallback(async (sid: string) => {
    setLoadingDetail(true);
    const { data } = await supabase
      .from('financial_plans')
      .select('id, plan_name, amount, due_date, status, paid_at, subscription_id')
      .eq('student_id', sid)
      .order('due_date', { ascending: false });
    setCharges(data ?? []);
    setLoadingDetail(false);
  }, []);

  // Tela vive dentro de um Tabs navigator (fica montada em segundo plano após a
  // primeira visita) e também é aberta via studentId a partir do hub do aluno —
  // useFocusEffect garante que os dados fiquem em dia sempre que a tela volta a
  // ficar em foco (ex.: depois de dar baixa e voltar de outra aba).
  useFocusEffect(useCallback(() => { load().finally(() => setLoading(false)); }, [load]));

  async function handleSelect(s: StudentSummary) {
    setSelected(s);
    await loadDetail(s.id);
  }

  function openModalFor(s: StudentSummary) {
    const sub = s.subscription;
    setFPlanName(sub?.plan_name ?? 'Mensalidade');
    setFAmount(sub ? String(sub.amount) : '');
    setFDueDay(sub ? String(sub.due_day) : '');
    setFBillingType(sub?.billing_type ?? 'recorrente');
    setFTotalInstallments(sub?.total_installments ? String(sub.total_installments) : '');
    setFSyncToAgenda(sub?.sync_to_agenda ?? false);
    setModalVisible(true);
  }

  function openModal() {
    if (!selected) return;
    openModalFor(selected);
  }

  // Botão "+" da lista: escolher o aluno e já abrir o formulário de cobrança,
  // sem precisar entrar no detalhe do aluno primeiro (era o principal motivo
  // do botão de criar cobrança ser difícil de encontrar).
  async function handlePickAndCreate(s: StudentSummary) {
    setPickerVisible(false);
    await handleSelect(s);
    openModalFor(s);
  }

  async function handleSave() {
    if (!selected || !tenantId) return;
    const amount = parseFloat(fAmount.replace(',', '.'));
    const dueDay = parseInt(fDueDay, 10);
    const totalInstallments = fBillingType === 'pacote' ? parseInt(fTotalInstallments, 10) : null;

    if (!Number.isFinite(amount) || amount <= 0) { Alert.alert('Valor inválido', 'Informe um valor mensal válido.'); return; }
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) { Alert.alert('Dia inválido', 'O dia de vencimento deve ser entre 1 e 28.'); return; }
    if (fBillingType === 'pacote' && (!totalInstallments || totalInstallments < 1 || totalInstallments > 24)) {
      Alert.alert('Número de meses inválido', 'Informe entre 1 e 24 meses para o pacote.');
      return;
    }

    setSaving(true);
    try {
      await saveSubscription({
        tenantId,
        studentId: selected.id,
        planName: fPlanName.trim() || 'Mensalidade',
        amount,
        dueDay,
        billingType: fBillingType,
        totalInstallments,
        syncToAgenda: fSyncToAgenda,
      });
      setModalVisible(false);
      await load();
      await loadDetail(selected.id);
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível salvar a cobrança.');
    } finally {
      setSaving(false);
    }
  }

  const sub = selected?.subscription ?? null;
  const isPacote = sub?.billing_type === 'pacote';
  const total = sub?.total_installments ?? 0;
  const paidInPackage = selected?.paidInPackage ?? 0;
  const packageDone = isPacote && total > 0 && paidInPackage >= total;

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <View style={st.header}>
        <TouchableOpacity
          onPress={() => {
            if (studentId) { backToStudentHub(studentId); return; }
            selected ? setSelected(null) : router.back();
          }}
          style={st.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={st.title} numberOfLines={1}>
          {selected ? selected.full_name.split(' ')[0] : 'Faturas'}
        </Text>
        {selected ? (
          <TouchableOpacity style={[st.addBtn, { backgroundColor: primaryColor }]} onPress={openModal} activeOpacity={0.85}>
            <Ionicons name={sub ? 'create-outline' : 'add'} size={20} color={primaryTextColor} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[st.addBtn, { backgroundColor: primaryColor }]} onPress={() => setPickerVisible(true)} activeOpacity={0.85}>
            <Ionicons name="add" size={22} color={primaryTextColor} />
          </TouchableOpacity>
        )}
      </View>

      <ModuleGuard slug={MODULE.FATURAS}>
        {selected ? (
          loadingDetail ? <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} /> : (
            <FlatList
              data={charges}
              keyExtractor={(c) => c.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 12 }}
              ListHeaderComponent={
                <>
                  {sub ? (
                    <View style={det.subCard}>
                      <Text style={det.subLabel}>{isPacote ? 'PACOTE ATUAL' : 'MENSALIDADE'}</Text>
                      <Text style={det.subName}>{sub.plan_name}</Text>
                      <Text style={det.subInfo}>{fmtCurrency(sub.amount)} / mês · vencimento dia {sub.due_day}</Text>
                      {isPacote && (
                        <View style={[det.progressPill, packageDone && { backgroundColor: `${Colors.warning}18` }]}>
                          <Text style={[det.progressText, packageDone && { color: Colors.warning }]}>
                            {paidInPackage} de {total} meses pagos{packageDone ? ' · renovar' : ''}
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <TouchableOpacity style={[det.emptySubCard, { borderColor: primaryColor }]} onPress={openModal} activeOpacity={0.8}>
                      <Ionicons name="add-circle-outline" size={18} color={primaryColor} />
                      <Text style={[det.emptySubText, { color: primaryColor }]}>Configurar cobrança deste aluno</Text>
                    </TouchableOpacity>
                  )}
                  {charges.length > 0 && <Text style={det.sectionLabel}>COBRANÇAS</Text>}
                </>
              }
              renderItem={({ item }) => (
                <ChargeRow charge={item} primaryColor={primaryColor} onChanged={() => { load(); loadDetail(selected.id); }} />
              )}
              ListEmptyComponent={
                <View style={det.empty}>
                  <Ionicons name="receipt-outline" size={48} color={Colors.border} />
                  <Text style={det.emptyTitle}>Nenhuma cobrança ainda</Text>
                </View>
              }
            />
          )
        ) : (
          <StudentListView students={students} loading={loading} primaryColor={primaryColor} onSelect={handleSelect} onOpenGuide={guide.open} />
        )}
      </ModuleGuard>

      {/* Modal: criar/editar cobrança */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => !saving && setModalVisible(false)}>
        <KeyboardAvoidingView style={st.modalSafe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={st.modalHeader}>
            <TouchableOpacity onPress={() => !saving && setModalVisible(false)} style={st.backBtn}>
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={st.title}>Cobrança de {selected?.full_name.split(' ')[0]}</Text>
            <View style={{ width: 38 }} />
          </View>
          <ScrollView contentContainerStyle={st.modalContent} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              {(['recorrente', 'pacote'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[st.typeOption, fBillingType === type && { borderColor: primaryColor, backgroundColor: `${primaryColor}15` }]}
                  onPress={() => setFBillingType(type)}
                  activeOpacity={0.8}
                >
                  <Text style={[st.typeOptionText, { color: fBillingType === type ? primaryColor : Colors.textSecondary }]}>
                    {type === 'recorrente' ? 'Mensalidade recorrente' : 'Pacote de meses'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={st.modalLabel}>NOME DO PLANO</Text>
            <TextInput value={fPlanName} onChangeText={setFPlanName} placeholder="Ex: Mensalidade"
              placeholderTextColor={Colors.textSecondary} style={st.modalInput} />

            <View style={[st.inputRow, { marginTop: 16 }]}>
              <View style={{ flex: 1 }}>
                <Text style={st.modalLabel}>{fBillingType === 'pacote' ? 'VALOR/MÊS (R$)' : 'VALOR (R$)'}</Text>
                <TextInput value={fAmount} onChangeText={setFAmount} placeholder="Ex: 150,00"
                  placeholderTextColor={Colors.textSecondary} keyboardType="decimal-pad" style={st.modalInput} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.modalLabel}>DIA DO VENCIMENTO</Text>
                <TextInput value={fDueDay} onChangeText={setFDueDay} placeholder="1-28"
                  placeholderTextColor={Colors.textSecondary} keyboardType="number-pad" style={st.modalInput} />
              </View>
            </View>

            {fBillingType === 'pacote' && (
              <>
                <Text style={[st.modalLabel, { marginTop: 16 }]}>NÚMERO DE MESES</Text>
                <TextInput value={fTotalInstallments} onChangeText={setFTotalInstallments} placeholder="Ex: 6"
                  placeholderTextColor={Colors.textSecondary} keyboardType="number-pad" style={st.modalInput} />
                <Text style={st.helperText}>
                  Gera todas as parcelas de uma vez. Cada mês é dado baixa individualmente; você é avisado
                  para renovar só quando o pacote inteiro for quitado.
                </Text>
              </>
            )}

            <View style={st.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={st.modalLabel}>ADICIONAR NA AGENDA</Text>
                <Text style={st.helperText}>Vencimentos aparecem na agenda do personal e do aluno.</Text>
              </View>
              <Switch
                value={fSyncToAgenda}
                onValueChange={setFSyncToAgenda}
                trackColor={{ false: Colors.border, true: `${primaryColor}80` }}
                thumbColor={fSyncToAgenda ? primaryColor : Colors.textSecondary}
              />
            </View>

            <TouchableOpacity
              style={[st.saveBtn, { backgroundColor: primaryColor }, saving && { opacity: 0.6 }]}
              onPress={handleSave} disabled={saving} activeOpacity={0.85}
            >
              {saving ? <ActivityIndicator color={primaryTextColor} /> : (
                <Text style={[st.saveBtnText, { color: primaryTextColor }]}>Salvar</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Picker: escolher o aluno ao tocar em "+" na lista */}
      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <TouchableOpacity style={cr.overlay} activeOpacity={1} onPress={() => setPickerVisible(false)}>
          <View style={[cr.sheet, { maxHeight: '70%' }]}>
            <Text style={cr.sheetTitle}>Para qual aluno?</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {students.map((item) => (
                <TouchableOpacity key={item.id} style={cr.sheetItem} onPress={() => handlePickAndCreate(item)}>
                  <Text style={cr.sheetItemText}>{item.full_name}</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
              ))}
              {students.length === 0 && (
                <Text style={{ fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, paddingVertical: 14 }}>
                  Nenhum aluno ativo cadastrado.
                </Text>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <GuideModal
        visible={guide.visible}
        content={GUIDES.faturas_cobranca}
        onClose={guide.close}
        onDismissForever={guide.dismissForever}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const cr = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 10, gap: 10 },
  planName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  dueDate: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 3 },
  amount: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  actionBtn: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 36 },
  sheetTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 12 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.border },
  sheetItemText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
});

const sl = StyleSheet.create({
  guideLink: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginBottom: 12 },
  guideLinkText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.xs },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontFamily: FontFamily.bodyBold, fontSize: 16 },
  name: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  sub: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 3 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontFamily: FontFamily.bodyMedium, fontSize: 10 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});

const det = StyleSheet.create({
  subCard: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, marginTop: 4, marginBottom: 16 },
  subLabel: { fontFamily: FontFamily.bodyBold, fontSize: 10, color: Colors.textSecondary, letterSpacing: 1 },
  subName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.md, color: Colors.textPrimary, marginTop: 4 },
  subInfo: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  progressPill: { alignSelf: 'flex-start', backgroundColor: Colors.bg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, marginTop: 10 },
  progressText: { fontFamily: FontFamily.bodyMedium, fontSize: 11, color: Colors.textSecondary },
  emptySubCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderRadius: 14, padding: 16, marginTop: 4, marginBottom: 16 },
  emptySubText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm },
  sectionLabel: { fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.textSecondary, letterSpacing: 0.8, marginBottom: 10 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.md, color: Colors.textSecondary },
});

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary, flex: 1, textAlign: 'center' },
  addBtn: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalSafe: { flex: 1, backgroundColor: Colors.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 52 },
  modalLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 8 },
  modalInput: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary },
  inputRow: { flexDirection: 'row', gap: 10 },
  typeOption: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  typeOptionText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.xs, textAlign: 'center' },
  helperText: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 8, lineHeight: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, paddingVertical: 4 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 16, marginTop: 28 },
  saveBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md },
});
