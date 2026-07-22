import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useStudent } from '@/hooks/useStudent';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

/**
 * Lembrete global de cobrança em aberto para o aluno (montado uma vez no root
 * layout, igual ao AgendaAlertBanner). Diferente daquele, o "X" só esconde o
 * aviso até o app voltar de segundo plano — o pedido é que o aluno seja
 * avisado TODA VEZ que acessar o app enquanto a cobrança continuar
 * pendente/atrasada, até o personal dar baixa.
 */
export function StudentBillingAlertBanner() {
  const { profile } = useAuthStore();
  const { selectedStudent } = useStudent();
  const insets = useSafeAreaInsets();

  const isStudent = profile?.role === 'student';
  const studentId = selectedStudent?.id;

  const [pendingCount, setPendingCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [totalOpen, setTotalOpen] = useState(0);
  const dismissed = useRef(false);

  async function load() {
    if (!studentId) return;
    const { data } = await supabase
      .from('financial_plans')
      .select('status, amount')
      .eq('student_id', studentId)
      .in('status', ['pending', 'overdue']);

    const rows = data ?? [];
    setPendingCount(rows.filter((r) => r.status === 'pending').length);
    setOverdueCount(rows.filter((r) => r.status === 'overdue').length);
    setTotalOpen(rows.reduce((acc, r) => acc + r.amount, 0));
  }

  useEffect(() => {
    if (!isStudent || !studentId) return;
    load();

    const channel = supabase
      .channel(`billing-alert-student:${studentId}:${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'financial_plans', filter: `student_id=eq.${studentId}` },
        () => { void load(); },
      )
      .subscribe();

    // "Sempre que ele acessar o app" — volta a mostrar quando o app volta de
    // segundo plano, mesmo que o aluno tenha fechado o aviso antes de sair.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') dismissed.current = false;
    });

    return () => {
      supabase.removeChannel(channel);
      sub.remove();
    };
  }, [isStudent, studentId]);

  const totalCount = pendingCount + overdueCount;
  if (!isStudent || totalCount === 0 || dismissed.current) return null;

  const isOverdue = overdueCount > 0;
  const amountLabel = totalOpen.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const message = isOverdue
    ? `${overdueCount === 1 ? '1 cobrança atrasada' : `${overdueCount} cobranças atrasadas`} · ${amountLabel}`
    : `${pendingCount === 1 ? '1 mensalidade pendente' : `${pendingCount} mensalidades pendentes`} · ${amountLabel}`;

  function handleOpen() {
    router.push('/(student)/mais/financeiro' as any);
  }

  function handleDismiss() {
    dismissed.current = true;
    // Força reavaliação de `dismissed.current` sem precisar de novo state.
    setTotalOpen((v) => v);
  }

  // Desloca abaixo da faixa onde o AgendaAlertBanner apareceria, para não
  // sobrepor caso os dois avisos estejam ativos ao mesmo tempo para o aluno.
  return (
    <View style={[s.wrap, { top: insets.top + 68 }]} pointerEvents="box-none">
      <TouchableOpacity
        style={[s.banner, { borderColor: isOverdue ? '#F8717150' : '#F59E0B50' }]}
        onPress={handleOpen}
        activeOpacity={0.9}
      >
        <Ionicons name={isOverdue ? 'alert-circle' : 'wallet'} size={16} color={isOverdue ? '#F87171' : '#F59E0B'} />
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
    backgroundColor: Colors.surface, borderWidth: 1,
    borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12,
    width: '100%', maxWidth: 420,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  text: { flex: 1, fontFamily: FontFamily.bodyMedium, fontSize: FontSize.xs, color: Colors.textPrimary },
  closeBtn: { padding: 2 },
});
