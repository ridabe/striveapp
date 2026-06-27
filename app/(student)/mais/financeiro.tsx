import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useStudent } from '@/hooks/useStudent';
import { useThemeStore } from '@/stores/themeStore';
import { TenantLogo } from '@/components/TenantLogo';
import { ModuleGuard } from '@/components/ModuleGuard';
import { MODULE } from '@/lib/modules';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending:   { label: 'Pendente',  color: '#F59E0B', icon: 'time-outline' },
  paid:      { label: 'Pago',      color: '#4ADE80', icon: 'checkmark-circle-outline' },
  overdue:   { label: 'Vencido',   color: '#EF4444', icon: 'alert-circle-outline' },
  cancelled: { label: 'Cancelado', color: '#94A3B8', icon: 'close-circle-outline' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function FinanceiroScreen() {
  const { selectedStudent } = useStudent();
  const { primaryColor } = useThemeStore();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!selectedStudent) return;
    const { data } = await supabase
      .from('financial_plans')
      .select('id, plan_name, amount, due_date, status, paid_at, notes')
      .eq('student_id', selectedStudent.id)
      .order('due_date', { ascending: false });
    setPlans(data ?? []);
    setLoading(false);
  }, [selectedStudent?.id]);

  useEffect(() => { load(); }, [load]);

  const pending = plans.filter(p => p.status === 'pending' || p.status === 'overdue');
  const totalPending = pending.reduce((a, p) => a + (p.amount ?? 0), 0);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Financeiro</Text>
        <TenantLogo size={32} radius={9} />
      </View>

      <ModuleGuard slug={MODULE.FATURAS}>
      {loading ? <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} /> : (
        <FlatList
          data={plans}
          keyExtractor={p => p.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            pending.length > 0 ? (
              <View style={[s.alertCard, { borderColor: '#F59E0B40', backgroundColor: '#F59E0B08' }]}>
                <Ionicons name="wallet-outline" size={24} color="#F59E0B" />
                <View style={{ flex: 1 }}>
                  <Text style={s.alertTitle}>Total em aberto</Text>
                  <Text style={[s.alertAmount, { color: '#F59E0B' }]}>{fmtCurrency(totalPending)}</Text>
                </View>
              </View>
            ) : plans.length > 0 ? (
              <View style={[s.alertCard, { borderColor: '#4ADE8040', backgroundColor: '#4ADE8008' }]}>
                <Ionicons name="checkmark-circle" size={24} color="#4ADE80" />
                <Text style={[s.alertTitle, { color: '#4ADE80' }]}>Tudo em dia! 🎉</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="card-outline" size={48} color={Colors.border} />
              <Text style={s.emptyTitle}>Nenhuma fatura</Text>
              <Text style={s.emptyDesc}>Suas faturas aparecerão aqui.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
            return (
              <View style={s.card}>
                <View style={s.cardLeft}>
                  <View style={[s.statusIcon, { backgroundColor: `${cfg.color}18` }]}>
                    <Ionicons name={cfg.icon as any} size={22} color={cfg.color} />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.planName} numberOfLines={1}>{item.plan_name}</Text>
                  <Text style={s.dueDate}>
                    Vencimento: {fmtDate(item.due_date)}
                    {item.paid_at ? `  ·  Pago em ${fmtDate(item.paid_at)}` : ''}
                  </Text>
                  {item.notes ? <Text style={s.notes} numberOfLines={1}>{item.notes}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 5 }}>
                  <Text style={s.amount}>{fmtCurrency(item.amount ?? 0)}</Text>
                  <View style={[s.statusPill, { backgroundColor: `${cfg.color}18` }]}>
                    <Text style={[s.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
      </ModuleGuard>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40, gap: 10 },
  alertCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1.5, padding: 18, marginBottom: 6 },
  alertTitle: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textSecondary },
  alertAmount: { fontFamily: FontFamily.bodyBold, fontSize: 22, marginTop: 2 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 12 },
  cardLeft: {},
  statusIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  planName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  dueDate: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginTop: 3 },
  notes: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, fontStyle: 'italic', marginTop: 2 },
  amount: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  empty: { alignItems: 'center', paddingTop: 64, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyDesc: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
