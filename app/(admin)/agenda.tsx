import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, Alert,
  KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { ModuleGuard } from '@/components/ModuleGuard';
import { MODULE } from '@/lib/modules';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DAY_NAMES_SHORT = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  presencial:          { label: 'Presencial',      color: '#3B82F6', icon: 'location-outline' },
  virtual:             { label: 'Virtual',          color: '#10B981', icon: 'videocam-outline' },
  pagamento_a_fazer:   { label: 'Pgto. a Fazer',   color: '#EF4444', icon: 'trending-down-outline' },
  pagamento_a_receber: { label: 'Pgto. a Receber', color: '#F59E0B', icon: 'trending-up-outline' },
};
const EVENT_TYPES = ['presencial', 'virtual', 'pagamento_a_fazer', 'pagamento_a_receber'];

type AgendaEvent = {
  id: string; type: string; title: string; event_date: string;
  start_time: string | null; student_id: string | null; student_name: string | null;
  location: string | null; meeting_url: string | null; amount: number | null;
  description: string | null; status: string; origin: string;
  rejection_reason: string | null; notes: string | null;
};

function toYMD(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function fmtCurrency(v: number | null) {
  if (!v) return '';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function AdminAgendaScreen() {
  const { profile } = useAuthStore();
  const { primaryColor } = useThemeStore();
  const tenantId = profile?.tenant_id ?? '';

  const today = new Date();
  const [year, setYear]       = useState(today.getFullYear());
  const [month, setMonth]     = useState(today.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [events, setEvents]   = useState<AgendaEvent[]>([]);
  const [students, setStudents] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Create/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editEvent, setEditEvent] = useState<AgendaEvent | null>(null);
  const [fType, setFType]         = useState('presencial');
  const [fTitle, setFTitle]       = useState('');
  const [fDate, setFDate]         = useState('');
  const [fTime, setFTime]         = useState('');
  const [fStudentId, setFStudentId] = useState('');
  const [fLocation, setFLocation] = useState('');
  const [fMeetingUrl, setFMeetingUrl] = useState('');
  const [fAmount, setFAmount]     = useState('');
  const [fDescription, setFDescription] = useState('');
  const [fNotes, setFNotes]       = useState('');
  const [saving, setSaving]       = useState(false);

  // Reject modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectEventId, setRejectEventId]     = useState('');
  const [rejectReason, setRejectReason]       = useState('');

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const start = toYMD(year, month, 1);
    const end   = toYMD(year, month, new Date(year, month, 0).getDate());
    const { data } = await supabase
      .from('agenda_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('event_date', start)
      .lte('event_date', end)
      .order('start_time', { ascending: true });
    setEvents((data ?? []) as AgendaEvent[]);
    setLoading(false);
  }, [tenantId, year, month]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!tenantId) return;
    supabase.from('students')
      .select('id, full_name')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .then(({ data }) => setStudents(data ?? []));
  }, [tenantId]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1);
    setSelectedDay(1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1);
    setSelectedDay(1);
  }

  // Calendar grid
  const daysInMonth = new Date(year, month, 0).getDate();
  let startDow = new Date(year, month - 1, 1).getDay() - 1;
  if (startDow < 0) startDow = 6;
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  function eventsOnDay(day: number | null): AgendaEvent[] {
    if (!day) return [];
    const dateStr = toYMD(year, month, day);
    return events.filter(e => e.event_date === dateStr);
  }

  const selectedEvents = eventsOnDay(selectedDay);
  const pendingCount   = events.filter(e => e.status === 'pending_confirmation' && e.origin === 'student').length;

  function openCreate() {
    setEditEvent(null);
    setFType('presencial'); setFTitle(''); setFDate(toYMD(year, month, selectedDay));
    setFTime(''); setFStudentId(''); setFLocation(''); setFMeetingUrl('');
    setFAmount(''); setFDescription(''); setFNotes('');
    setShowModal(true);
  }

  function openEdit(ev: AgendaEvent) {
    setEditEvent(ev);
    setFType(ev.type); setFTitle(ev.title); setFDate(ev.event_date);
    setFTime(ev.start_time ? ev.start_time.slice(0, 5) : '');
    setFStudentId(ev.student_id ?? ''); setFLocation(ev.location ?? '');
    setFMeetingUrl(ev.meeting_url ?? ''); setFAmount(ev.amount ? String(ev.amount) : '');
    setFDescription(ev.description ?? ''); setFNotes(ev.notes ?? '');
    setShowModal(true);
  }

  async function handleSave() {
    if (!fTitle.trim() || !fDate.trim()) {
      return Alert.alert('Atenção', 'Título e data são obrigatórios.');
    }
    setSaving(true);
    const selectedStudent = students.find(s => s.id === fStudentId);
    const payload = {
      tenant_id: tenantId, type: fType, title: fTitle.trim(),
      event_date: fDate, start_time: fTime || null,
      student_id: fStudentId || null,
      student_name: selectedStudent?.full_name || null,
      location:    fType === 'presencial' ? (fLocation || null) : null,
      meeting_url: fType === 'virtual'    ? (fMeetingUrl || null) : null,
      amount:      fAmount ? parseFloat(fAmount.replace(',', '.')) : null,
      description: fDescription || null,
      notes:       fNotes || null,
      status: 'scheduled', origin: 'personal',
    };
    if (editEvent) {
      await supabase.from('agenda_events').update(payload).eq('id', editEvent.id);
    } else {
      await supabase.from('agenda_events').insert(payload);
    }
    setSaving(false);
    setShowModal(false);
    load();
  }

  async function handleDelete(id: string) {
    Alert.alert('Excluir evento', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
        await supabase.from('agenda_events').delete().eq('id', id);
        load();
      }},
    ]);
  }

  async function handleConfirm(id: string) {
    await supabase.from('agenda_events').update({ status: 'scheduled' }).eq('id', id);
    load();
  }

  function openReject(id: string) {
    setRejectEventId(id); setRejectReason(''); setShowRejectModal(true);
  }

  async function handleReject() {
    if (!rejectReason.trim()) return Alert.alert('Atenção', 'Informe o motivo da recusa.');
    await supabase.from('agenda_events')
      .update({ status: 'rejected', rejection_reason: rejectReason })
      .eq('id', rejectEventId);
    setShowRejectModal(false);
    load();
  }

  async function handleComplete(id: string) {
    await supabase.from('agenda_events').update({ status: 'completed' }).eq('id', id);
    load();
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Minha Agenda</Text>
        <TouchableOpacity onPress={openCreate} style={[s.addBtn, { backgroundColor: primaryColor }]}>
          <Ionicons name="add" size={22} color="#000" />
        </TouchableOpacity>
      </View>

      <ModuleGuard slug={MODULE.MINHA_AGENDA}>
        {pendingCount > 0 && (
          <TouchableOpacity style={s.pendingBanner}>
            <Ionicons name="time-outline" size={16} color="#F59E0B" />
            <Text style={s.pendingText}>
              {pendingCount} solicitação{pendingCount > 1 ? 'ões' : ''} pendente{pendingCount > 1 ? 's' : ''} de alunos
            </Text>
            <Ionicons name="chevron-forward" size={14} color="#F59E0B" />
          </TouchableOpacity>
        )}

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Month navigation */}
          <View style={s.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
              <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={s.monthLabel}>{MONTH_NAMES[month - 1]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} style={s.navBtn}>
              <Ionicons name="chevron-forward" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Calendar */}
          <View style={s.calendar}>
            <View style={s.calRow}>
              {DAY_NAMES_SHORT.map(d => (
                <View key={d} style={s.calCell}>
                  <Text style={s.dayLabel}>{d}</Text>
                </View>
              ))}
            </View>
            {rows.map((row, ri) => (
              <View key={ri} style={s.calRow}>
                {row.map((day, ci) => {
                  const dayEvs  = eventsOnDay(day);
                  const isSelected = day === selectedDay;
                  const isToday    = day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
                  return (
                    <TouchableOpacity key={ci} style={s.calCell} onPress={() => day && setSelectedDay(day)} disabled={!day}>
                      <View style={[s.dayCircle, isSelected && { backgroundColor: primaryColor }, isToday && !isSelected && { borderWidth: 1.5, borderColor: primaryColor }]}>
                        <Text style={[s.dayNum, !day && { opacity: 0 }, isSelected && { color: '#000', fontFamily: FontFamily.bodyBold }, isToday && !isSelected && { color: primaryColor }]}>
                          {day ?? 0}
                        </Text>
                      </View>
                      {dayEvs.length > 0 && (
                        <View style={s.dotsRow}>
                          {dayEvs.slice(0, 3).map((ev, i) => (
                            <View key={i} style={[s.dot, { backgroundColor: ev.status === 'pending_confirmation' ? '#F59E0B' : (TYPE_CONFIG[ev.type]?.color ?? primaryColor) }]} />
                          ))}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Day events */}
          <View style={s.daySection}>
            <View style={s.daySectionHeader}>
              <Text style={s.daySectionTitle}>{selectedDay} de {MONTH_NAMES[month - 1]}</Text>
              <TouchableOpacity onPress={openCreate} style={s.addDayBtn}>
                <Ionicons name="add" size={16} color={primaryColor} />
                <Text style={[s.addDayText, { color: primaryColor }]}>Adicionar</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator color={primaryColor} style={{ marginTop: 24 }} />
            ) : selectedEvents.length === 0 ? (
              <View style={s.emptyDay}>
                <Ionicons name="calendar-outline" size={36} color={Colors.border} />
                <Text style={s.emptyDayText}>Nenhum evento neste dia</Text>
              </View>
            ) : (
              <View style={{ gap: 10, paddingBottom: 32 }}>
                {selectedEvents.map(ev => (
                  <EventCard
                    key={ev.id} ev={ev} primaryColor={primaryColor}
                    onEdit={openEdit} onDelete={handleDelete}
                    onConfirm={handleConfirm} onReject={openReject} onComplete={handleComplete}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Create/Edit Modal */}
        <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={s.modal} edges={['top', 'bottom']}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={s.modalTitle}>{editEvent ? 'Editar Evento' : 'Novo Evento'}</Text>
              <TouchableOpacity onPress={handleSave} disabled={saving}>
                <Text style={[s.modalAction, { color: primaryColor }]}>{saving ? 'Salvando...' : 'Salvar'}</Text>
              </TouchableOpacity>
            </View>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
              <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false}>
                <Text style={s.fieldLabel}>Tipo</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {EVENT_TYPES.map(t => {
                      const cfg = TYPE_CONFIG[t];
                      const active = fType === t;
                      return (
                        <TouchableOpacity key={t} style={[s.typeChip, active && { backgroundColor: cfg.color, borderColor: cfg.color }]} onPress={() => setFType(t)}>
                          <Ionicons name={cfg.icon} size={13} color={active ? '#fff' : cfg.color} />
                          <Text style={[s.typeChipText, active && { color: '#fff' }]}>{cfg.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                <Text style={s.fieldLabel}>Título *</Text>
                <TextInput style={s.input} value={fTitle} onChangeText={setFTitle} placeholder="Nome do evento" placeholderTextColor={Colors.textSecondary} />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 3 }}>
                    <Text style={s.fieldLabel}>Data (AAAA-MM-DD) *</Text>
                    <TextInput style={s.input} value={fDate} onChangeText={setFDate} placeholder="2026-06-25" placeholderTextColor={Colors.textSecondary} keyboardType="numbers-and-punctuation" />
                  </View>
                  <View style={{ flex: 2 }}>
                    <Text style={s.fieldLabel}>Horário</Text>
                    <TextInput style={s.input} value={fTime} onChangeText={setFTime} placeholder="08:00" placeholderTextColor={Colors.textSecondary} keyboardType="numbers-and-punctuation" />
                  </View>
                </View>

                <Text style={s.fieldLabel}>Aluno (opcional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={[s.typeChip, !fStudentId && { borderColor: primaryColor, backgroundColor: `${primaryColor}20` }]} onPress={() => setFStudentId('')}>
                      <Text style={[s.typeChipText, !fStudentId && { color: primaryColor }]}>Nenhum</Text>
                    </TouchableOpacity>
                    {students.map(st => (
                      <TouchableOpacity key={st.id} style={[s.typeChip, fStudentId === st.id && { borderColor: primaryColor, backgroundColor: `${primaryColor}20` }]} onPress={() => setFStudentId(st.id)}>
                        <Text style={[s.typeChipText, fStudentId === st.id && { color: primaryColor }]}>{st.full_name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {fType === 'presencial' && (
                  <>
                    <Text style={s.fieldLabel}>Local / Endereço</Text>
                    <TextInput style={s.input} value={fLocation} onChangeText={setFLocation} placeholder="Rua, número, cidade" placeholderTextColor={Colors.textSecondary} />
                  </>
                )}
                {fType === 'virtual' && (
                  <>
                    <Text style={s.fieldLabel}>Link do Meeting</Text>
                    <TextInput style={s.input} value={fMeetingUrl} onChangeText={setFMeetingUrl} placeholder="https://meet.google.com/..." placeholderTextColor={Colors.textSecondary} autoCapitalize="none" keyboardType="url" />
                  </>
                )}
                {(fType === 'pagamento_a_fazer' || fType === 'pagamento_a_receber') && (
                  <>
                    <Text style={s.fieldLabel}>Descrição</Text>
                    <TextInput style={s.input} value={fDescription} onChangeText={setFDescription} placeholder="Descrição do pagamento" placeholderTextColor={Colors.textSecondary} />
                    <Text style={s.fieldLabel}>Valor (R$)</Text>
                    <TextInput style={s.input} value={fAmount} onChangeText={setFAmount} placeholder="0,00" placeholderTextColor={Colors.textSecondary} keyboardType="decimal-pad" />
                  </>
                )}
                <Text style={s.fieldLabel}>Observações</Text>
                <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]} value={fNotes} onChangeText={setFNotes} placeholder="Notas adicionais" placeholderTextColor={Colors.textSecondary} multiline />
                <View style={{ height: 40 }} />
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>

        {/* Reject Modal */}
        <Modal visible={showRejectModal} animationType="slide" presentationStyle="formSheet">
          <SafeAreaView style={s.modal} edges={['top', 'bottom']}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setShowRejectModal(false)}>
                <Text style={[s.modalAction, { color: Colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={s.modalTitle}>Recusar Solicitação</Text>
              <TouchableOpacity onPress={handleReject}>
                <Text style={[s.modalAction, { color: Colors.error }]}>Recusar</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20 }}>
              <Text style={s.fieldLabel}>Motivo da recusa *</Text>
              <TextInput
                style={[s.input, { height: 100, textAlignVertical: 'top' }]}
                value={rejectReason} onChangeText={setRejectReason}
                placeholder="Informe o motivo para o aluno..." placeholderTextColor={Colors.textSecondary}
                multiline autoFocus
              />
            </View>
          </SafeAreaView>
        </Modal>
      </ModuleGuard>
    </SafeAreaView>
  );
}

function EventCard({
  ev, primaryColor, onEdit, onDelete, onConfirm, onReject, onComplete,
}: {
  ev: AgendaEvent; primaryColor: string;
  onEdit: (ev: AgendaEvent) => void;
  onDelete: (id: string) => void;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  onComplete: (id: string) => void;
}) {
  const cfg = TYPE_CONFIG[ev.type] ?? TYPE_CONFIG.presencial;
  const isPending = ev.status === 'pending_confirmation';

  return (
    <View style={[es.card, isPending && { borderColor: '#F59E0B50' }]}>
      <View style={[es.typeIcon, { backgroundColor: `${cfg.color}20` }]}>
        <Ionicons name={cfg.icon} size={20} color={cfg.color} />
      </View>
      <View style={{ flex: 1 }}>
        {isPending && ev.origin === 'student' && (
          <View style={es.pendingBadge}>
            <Ionicons name="time-outline" size={11} color="#F59E0B" />
            <Text style={es.pendingBadgeText}>Solicitação do aluno · aguardando confirmação</Text>
          </View>
        )}
        <Text style={es.cardTitle} numberOfLines={1}>{ev.title}</Text>
        {ev.start_time && <Text style={es.cardDetail}>⏰ {ev.start_time.slice(0,5)}</Text>}
        {ev.student_name && <Text style={es.cardDetail}>👤 {ev.student_name}</Text>}
        {ev.location && (
          <TouchableOpacity onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(ev.location!)}`)}>
            <Text style={[es.cardDetail, { color: '#3B82F6' }]}>📍 {ev.location}</Text>
          </TouchableOpacity>
        )}
        {ev.meeting_url && (
          <TouchableOpacity onPress={() => Linking.openURL(ev.meeting_url!)}>
            <Text style={[es.cardDetail, { color: '#10B981' }]}>🔗 Abrir link do meeting</Text>
          </TouchableOpacity>
        )}
        {ev.amount != null && <Text style={es.cardDetail}>💰 {ev.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>}
        {ev.description && <Text style={es.cardDetail}>{ev.description}</Text>}
        {ev.notes && <Text style={[es.cardDetail, { fontStyle: 'italic' }]}>{ev.notes}</Text>}

        {isPending && ev.origin === 'student' ? (
          <View style={es.actions}>
            <TouchableOpacity style={[es.actionBtn, { backgroundColor: '#10B98118', borderColor: '#10B98140' }]} onPress={() => onConfirm(ev.id)}>
              <Ionicons name="checkmark" size={13} color="#10B981" />
              <Text style={[es.actionText, { color: '#10B981' }]}>Confirmar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[es.actionBtn, { backgroundColor: '#EF444418', borderColor: '#EF444440' }]} onPress={() => onReject(ev.id)}>
              <Ionicons name="close" size={13} color="#EF4444" />
              <Text style={[es.actionText, { color: '#EF4444' }]}>Recusar</Text>
            </TouchableOpacity>
          </View>
        ) : ev.status === 'scheduled' ? (
          <View style={es.actions}>
            <TouchableOpacity style={es.iconAction} onPress={() => onEdit(ev)}>
              <Ionicons name="pencil-outline" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={es.iconAction} onPress={() => onComplete(ev.id)}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#10B981" />
            </TouchableOpacity>
            <TouchableOpacity style={es.iconAction} onPress={() => onDelete(ev.id)}>
              <Ionicons name="trash-outline" size={16} color={Colors.error} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={es.actions}>
            <View style={[es.statusPill, { backgroundColor: ev.status === 'completed' ? '#10B98118' : '#94A3B818' }]}>
              <Text style={[es.statusText, { color: ev.status === 'completed' ? '#10B981' : '#94A3B8' }]}>
                {ev.status === 'completed' ? 'Concluído' : ev.status === 'cancelled' ? 'Cancelado' : 'Recusado'}
              </Text>
            </View>
            <TouchableOpacity style={es.iconAction} onPress={() => onDelete(ev.id)}>
              <Ionicons name="trash-outline" size={16} color={Colors.error} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  addBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pendingBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F59E0B14', borderBottomWidth: 1, borderBottomColor: '#F59E0B30', paddingHorizontal: 16, paddingVertical: 10 },
  pendingText: { flex: 1, fontFamily: FontFamily.bodyMedium, fontSize: FontSize.xs, color: '#F59E0B' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  navBtn: { padding: 8 },
  monthLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  calendar: { paddingHorizontal: 8, marginBottom: 4 },
  calRow: { flexDirection: 'row' },
  calCell: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  dayLabel: { fontFamily: FontFamily.bodyMedium, fontSize: 11, color: Colors.textSecondary, marginBottom: 4 },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary },
  dotsRow: { flexDirection: 'row', gap: 2, marginTop: 1, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  daySection: { paddingHorizontal: 16, paddingTop: 12 },
  daySectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  daySectionTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  addDayBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addDayText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm },
  emptyDay: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyDayText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary },
  // Modal
  modal: { flex: 1, backgroundColor: Colors.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  modalAction: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm },
  modalBody: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  fieldLabel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  typeChipText: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: Colors.textSecondary },
});

const es = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, flexDirection: 'row', gap: 12 },
  typeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  pendingBadgeText: { fontFamily: FontFamily.body, fontSize: 11, color: '#F59E0B' },
  cardTitle: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary, marginBottom: 2 },
  cardDetail: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  actionText: { fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  iconAction: { padding: 6 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
});
