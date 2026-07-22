import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useStudent } from '@/hooks/useStudent';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

/**
 * Aviso global e persistente (montado uma vez no root layout, fora dos Stacks
 * de admin/aluno) sobre agendamentos pendentes/respondidos. Como não desmonta
 * ao navegar entre telas, fica visível continuamente enquanto houver algo não
 * visto — cobre tanto o momento do login quanto qualquer troca de tela.
 */
export function AgendaAlertBanner() {
  const { profile } = useAuthStore();
  const { selectedStudent } = useStudent();
  const insets = useSafeAreaInsets();

  const isPersonal = profile?.role === 'personal';
  const isStudent = profile?.role === 'student';

  const [ids, setIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const dismissedSignature = useRef<string | null>(null);

  const tenantId = profile?.tenant_id;
  const studentId = selectedStudent?.id;

  async function loadTrainerSide() {
    if (!tenantId) return;
    const { data } = await supabase
      .from('trainer_notifications')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('type', 'agenda_pending')
      .order('created_at', { ascending: false });
    const rows = data ?? [];
    setIds(rows.map(r => r.id));
    setMessage(
      rows.length === 1
        ? '1 solicitação de agendamento pendente'
        : `${rows.length} solicitações de agendamento pendentes`
    );
  }

  async function loadStudentSide() {
    if (!studentId) return;
    const { data } = await supabase
      .from('student_notifications')
      .select('id, type')
      .eq('student_id', studentId)
      .in('type', ['agenda_confirmed', 'agenda_rejected'])
      .order('created_at', { ascending: false });
    const rows = data ?? [];
    setIds(rows.map(r => r.id));
    setMessage(
      rows.length === 1
        ? 'Seu agendamento teve uma resposta'
        : `${rows.length} agendamentos tiveram resposta`
    );
  }

  useEffect(() => {
    if (isPersonal && tenantId) {
      loadTrainerSide();
      const channel = supabase
        .channel(`agenda-alert-trainer:${tenantId}:${Date.now()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'trainer_notifications', filter: `tenant_id=eq.${tenantId}` },
          () => { void loadTrainerSide(); },
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
    if (isStudent && studentId) {
      loadStudentSide();
      const channel = supabase
        .channel(`agenda-alert-student:${studentId}:${Date.now()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'student_notifications', filter: `student_id=eq.${studentId}` },
          () => { void loadStudentSide(); },
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [isPersonal, isStudent, tenantId, studentId]);

  const signature = ids.join(',');
  const visible = ids.length > 0 && signature !== dismissedSignature.current;

  if (!visible) return null;

  function handleOpen() {
    dismissedSignature.current = signature;
    router.push((isPersonal ? '/(admin)/agenda' : '/(student)/mais/agenda') as any);
  }

  function handleDismiss() {
    dismissedSignature.current = signature;
    // Força o componente a reavaliar `visible` sem precisar de novo state.
    setIds(prev => [...prev]);
  }

  return (
    <View style={[s.wrap, { top: insets.top + 8 }]} pointerEvents="box-none">
      <TouchableOpacity style={s.banner} onPress={handleOpen} activeOpacity={0.9}>
        <Ionicons name="calendar" size={16} color="#F59E0B" />
        <Text style={s.text} numberOfLines={2}>{message}</Text>
        <TouchableOpacity onPress={handleDismiss} hitSlop={10} style={s.closeBtn}>
          <Ionicons name="close" size={16} color={Colors.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 999, alignItems: 'center' },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: '#F59E0B50',
    borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12,
    width: '100%', maxWidth: 420,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  text: { flex: 1, fontFamily: FontFamily.bodyMedium, fontSize: FontSize.xs, color: Colors.textPrimary },
  closeBtn: { padding: 2 },
});
