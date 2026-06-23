import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, Alert, Linking,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useStudent } from '@/hooks/useStudent';
import { useThemeStore } from '@/stores/themeStore';
import { ModuleGuard } from '@/components/ModuleGuard';
import { MODULE } from '@/lib/modules';
import { TenantLogo } from '@/components/TenantLogo';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DAY_NAMES   = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];

const TYPE_COLOR: Record<string, string> = {
  presencial:          '#3B82F6',
  virtual:             '#10B981',
  pagamento_a_fazer:   '#EF4444',
  pagamento_a_receber: '#F59E0B',
};
const TYPE_ICON: Record<string, any> = {
  presencial: 'location-outline', virtual: 'videocam-outline',
  pagamento_a_fazer: 'trending-down-outline', pagamento_a_receber: 'trending-up-outline',
};

type AgendaEvent = {
  id: string; type: string; title: string; event_date: string;
  start_time: string | null; location: string | null; meeting_url: string | null;
  amount: number | null; description: string | null; status: string;
  origin: string; rejection_reason: string | null; notes: string | null;
};

function toYMD(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

export default function StudentAgendaScreen() {
  const { student }        = useStudent();
  const { primaryColor }   = useThemeStore();

  const today = new Date();
  const [year, setYear]           = useState(today.getFullYear());
  const [month, setMonth]         = useState(today.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [events, setEvents]       = useState<AgendaEvent[]>([]);
  const [loading, setLoading]     = useState(true);
  const [trainerPhone, setTrainerPhone] = useState<string | null>(null);

  // Solicitação form
  const [showForm, setShowForm]   = useState(false);
  const [fDate, setFDate]         = useState('');
  const [fTime, setFTime]         = useState('');
  const [fCep, setFCep]           = useState('');
  const [fAddress, setFAddress]   = useState('');
  const [fNotes, setFNotes]       = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!student) return;
    setLoading(true);
    const start = toYMD(year, month, 1);
    const end   = toYMD(year, month, new Date(year, month, 0).getDate());
    const { data } = await supabase
      .from('agenda_events')
      .select('id, type, title, event_date, start_time, location, meeting_url, amount, description, status, origin, rejection_reason, notes')
      .eq('student_id', student.id)
      .gte('event_date', start)
      .lte('event_date', end)
      .order('start_time', { ascending: true });
    setEvents((data ?? []) as AgendaEvent[]);
    setLoading(false);
  }, [student?.id, year, month]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!student?.tenant_id) return;
    supabase.from('tenants').select('contact_phone').eq('id', student.tenant_id).single()
      .then(({ data }) => setTrainerPhone(data?.contact_phone ?? null));
  }, [student?.tenant_id]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1);
    setSelectedDay(1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1);
    setSelectedDay(1);
  }

  async function fetchCep(cep: string) {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setFAddress(`${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`);
      }
    } catch {}
  }

  async function handleSubmitRequest() {
    if (!student || !fDate || !fTime || !fAddress) {
      return Alert.alert('Atenção', 'Preencha data, horário e endereço.');
    }
    setSubmitting(true);
    const { data: tenantRow } = await supabase.from('students').select('tenant_id').eq('id', student.id).single();
    const tenantId = (tenantRow as any)?.tenant_id;
    await supabase.from('agenda_events').insert({
      tenant_id: tenantId,
      type: 'presencial',
      title: `Solicitação: ${student.full_name}`,
      event_date: fDate,
      start_time: fTime.length >= 4 ? fTime : null,
      student_id: student.id,
      student_name: student.full_name,
      location: fAddress,
      notes: fNotes || null,
      status: 'pending_confirmation',
      origin: 'student',
    });
    setSubmitting(false);
    setShowForm(false);
    setFDate(''); setFTime(''); setFCep(''); setFAddress(''); setFNotes('');
    load();
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
  const rejectedRecent = events.filter(e => e.status === 'rejected' && e.origin === 'student');

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Minha Agenda</Text>
        <TenantLogo size={32} radius={9} />
      </View>

      <ModuleGuard slug={MODULE.MINHA_AGENDA}>
        {/* Pending banner */}
        {pendingCount > 0 && (
          <View style={s.pendingBanner}>
            <Ionicons name="time-outline" size={16} color="#F59E0B" />
            <Text style={s.pendingText}>{pendingCount} solicitação{pendingCount > 1 ? 'ões' : ''} aguardando confirmação</Text>
          </View>
        )}
        {/* Rejected banner */}
        {rejectedRecent.length > 0 && (
          <View style={[s.pendingBanner, { backgroundColor: '#EF444410', borderBottomColor: '#EF444430' }]}>
            <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
            <Text style={[s.pendingText, { color: '#EF4444' }]}>
              {rejectedRecent.length} solicitação{rejectedRecent.length > 1 ? 'ões' : ''} não confirmada{rejectedRecent.length > 1 ? 's' : ''}
            </Text>
          </View>
        )}

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Request button */}
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
            <TouchableOpacity
              style={[s.requestBtn, { borderColor: `${primaryColor}60`, backgroundColor: showForm ? `${primaryColor}15` : Colors.surface }]}
              onPress={() => setShowForm(v => !v)}
            >
              <Ionicons name={showForm ? 'chevron-up' : 'add-circle-outline'} size={18} color={primaryColor} />
              <Text style={[s.requestBtnText, { color: primaryColor }]}>
                {showForm ? 'Fechar formulário' : 'Solicitar aula presencial'}
              </Text>
            </TouchableOpacity>

            {showForm && (
              <View style={s.requestForm}>
                <Text style={s.fieldLabel}>Data (AAAA-MM-DD) *</Text>
                <TextInput style={s.input} value={fDate} onChangeText={setFDate} placeholder="2026-06-28" placeholderTextColor={Colors.textSecondary} keyboardType="numbers-and-punctuation" />
                <Text style={s.fieldLabel}>Horário (HH:MM) *</Text>
                <TextInput style={s.input} value={fTime} onChangeText={setFTime} placeholder="08:00" placeholderTextColor={Colors.textSecondary} keyboardType="numbers-and-punctuation" />
                <Text style={s.fieldLabel}>CEP</Text>
                <TextInput
                  style={s.input} value={fCep} keyboardType="number-pad" maxLength={9}
                  placeholder="00000-000" placeholderTextColor={Colors.textSecondary}
                  onChangeText={v => {
                    const clean = v.replace(/\D/g,'');
                    const masked = clean.length > 5 ? `${clean.slice(0,5)}-${clean.slice(5,8)}` : clean;
                    setFCep(masked);
                    if (clean.length === 8) fetchCep(clean);
                  }}
                />
                <Text style={s.fieldLabel}>Endereço *</Text>
                <TextInput style={s.input} value={fAddress} onChangeText={setFAddress} placeholder="Rua, número, bairro, cidade - UF" placeholderTextColor={Colors.textSecondary} />
                <Text style={s.fieldLabel}>Observações</Text>
                <TextInput style={[s.input, { height: 64, textAlignVertical: 'top' }]} value={fNotes} onChangeText={setFNotes} placeholder="Alguma observação para o personal?" placeholderTextColor={Colors.textSecondary} multiline />
                <TouchableOpacity
                  style={[s.submitBtn, { backgroundColor: primaryColor }]}
                  onPress={handleSubmitRequest}
                  disabled={submitting}
                >
                  <Text style={s.submitBtnText}>{submitting ? 'Enviando...' : 'Enviar Solicitação'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

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
              {DAY_NAMES.map(d => (
                <View key={d} style={s.calCell}>
                  <Text style={s.dayLabel}>{d}</Text>
                </View>
              ))}
            </View>
            {rows.map((row, ri) => (
              <View key={ri} style={s.calRow}>
                {row.map((day, ci) => {
                  const dayEvs = eventsOnDay(day);
                  const isSelected = day === selectedDay;
                  const isToday = day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
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
                            <View key={i} style={[s.dot, {
                              backgroundColor: ev.status === 'pending_confirmation' ? '#F59E0B'
                                : ev.status === 'rejected' ? '#EF444480'
                                : (TYPE_COLOR[ev.type] ?? primaryColor)
                            }]} />
                          ))}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Selected day events */}
          <View style={s.daySection}>
            <Text style={s.daySectionTitle}>{selectedDay} de {MONTH_NAMES[month - 1]}</Text>

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
                  <StudentEventCard key={ev.id} ev={ev} primaryColor={primaryColor} trainerPhone={trainerPhone} />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </ModuleGuard>
    </SafeAreaView>
  );
}

function StudentEventCard({ ev, primaryColor, trainerPhone }: { ev: AgendaEvent; primaryColor: string; trainerPhone: string | null }) {
  const color = ev.status === 'pending_confirmation' ? '#F59E0B'
    : ev.status === 'rejected' ? '#EF4444'
    : (TYPE_COLOR[ev.type] ?? primaryColor);
  const icon = TYPE_ICON[ev.type] ?? 'calendar-outline';

  return (
    <View style={[ec.card, { borderLeftWidth: 3, borderLeftColor: color }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={[ec.typeIcon, { backgroundColor: `${color}20` }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          {ev.origin === 'student' && (
            <View style={ec.originBadge}>
              <Text style={[ec.originText, {
                color: ev.status === 'pending_confirmation' ? '#F59E0B'
                  : ev.status === 'rejected' ? '#EF4444' : '#10B981'
              }]}>
                {ev.status === 'pending_confirmation' ? '⏳ Aguardando confirmação'
                  : ev.status === 'rejected' ? '❌ Não confirmada'
                  : '✅ Confirmada'}
              </Text>
            </View>
          )}
          <Text style={ec.title} numberOfLines={1}>{ev.title}</Text>
          {ev.start_time && <Text style={ec.detail}>⏰ {ev.start_time.slice(0,5)}</Text>}
          {ev.location && (
            <TouchableOpacity onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(ev.location!)}`)}>
              <Text style={[ec.detail, { color: '#3B82F6' }]}>📍 {ev.location} (ver no mapa)</Text>
            </TouchableOpacity>
          )}
          {ev.meeting_url && (
            <TouchableOpacity onPress={() => Linking.openURL(ev.meeting_url!)}>
              <Text style={[ec.detail, { color: '#10B981' }]}>🔗 Abrir link do meeting</Text>
            </TouchableOpacity>
          )}
          {ev.amount != null && (
            <Text style={ec.detail}>💰 {ev.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>
          )}
          {ev.notes && <Text style={[ec.detail, { fontStyle: 'italic' }]}>{ev.notes}</Text>}

          {ev.status === 'rejected' && ev.rejection_reason && (
            <View style={ec.rejectBox}>
              <Text style={ec.rejectTitle}>Motivo:</Text>
              <Text style={ec.rejectReason}>{ev.rejection_reason}</Text>
              {trainerPhone && (
                <TouchableOpacity
                  style={ec.whatsappBtn}
                  onPress={() => {
                    const phone = `55${trainerPhone.replace(/\D/g, '')}`;
                    const msg = `Olá! Minha solicitação de aula presencial para ${ev.event_date} não foi confirmada. Podemos conversar?`;
                    Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
                  }}
                >
                  <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                  <Text style={ec.whatsappText}>Falar com personal</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  pendingBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F59E0B10', borderBottomWidth: 1, borderBottomColor: '#F59E0B30', paddingHorizontal: 16, paddingVertical: 10 },
  pendingText: { flex: 1, fontFamily: FontFamily.bodyMedium, fontSize: FontSize.xs, color: '#F59E0B' },
  requestBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12 },
  requestBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm },
  requestForm: { marginTop: 12, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 4 },
  fieldLabel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 5, marginTop: 10 },
  input: { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 11, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary },
  submitBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  submitBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: '#000' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
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
  daySection: { paddingHorizontal: 16, paddingTop: 8 },
  daySectionTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textPrimary, marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  emptyDay: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyDayText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary },
});

const ec = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, borderLeftColor: Colors.border },
  typeIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  originBadge: { marginBottom: 4 },
  originText: { fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  title: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary, marginBottom: 2 },
  detail: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  rejectBox: { marginTop: 8, backgroundColor: '#EF444412', borderRadius: 8, padding: 10, gap: 4 },
  rejectTitle: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: '#EF4444' },
  rejectReason: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textPrimary },
  whatsappBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  whatsappText: { fontFamily: FontFamily.bodyMedium, fontSize: 13, color: '#25D366' },
});
