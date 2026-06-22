import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useStudent } from '@/hooks/useStudent';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DAYS_HEADER = ['D','S','T','Q','Q','S','S'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function FrequenciaScreen() {
  const { student } = useStudent();
  const { primaryColor } = useThemeStore();

  const [attendedDays, setAttendedDays] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [totalMonth, setTotalMonth] = useState(0);
  const [totalAll, setTotalAll] = useState(0);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const load = useCallback(async () => {
    if (!student) return;
    const { data } = await supabase
      .from('workout_sessions')
      .select('started_at')
      .eq('student_id', student.id)
      .not('finished_at', 'is', null);

    const all = data ?? [];
    const monthStart = new Date(viewYear, viewMonth, 1).toISOString();
    const monthEnd = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59).toISOString();

    const daySet = new Set<string>();
    let monthCount = 0;

    all.forEach((s: any) => {
      const d = new Date(s.started_at);
      const key = d.toDateString();
      daySet.add(key);
      if (s.started_at >= monthStart && s.started_at <= monthEnd) monthCount++;
    });

    setAttendedDays(daySet);
    setTotalMonth(monthCount);
    setTotalAll(all.length);
    setLoading(false);
  }, [student?.id, viewYear, viewMonth]);

  useEffect(() => { load(); }, [load]);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    const canNext = viewYear < now.getFullYear() || viewMonth < now.getMonth();
    if (!canNext) return;
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
  const todayStr = now.toDateString();

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Frequência</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} /> : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Stats */}
          <View style={s.statsRow}>
            <View style={[s.statCard, { borderColor: `${primaryColor}30` }]}>
              <Text style={[s.statNum, { color: primaryColor }]}>{totalMonth}</Text>
              <Text style={s.statLabel}>Este mês</Text>
            </View>
            <View style={[s.statCard, { borderColor: `${primaryColor}30` }]}>
              <Text style={[s.statNum, { color: primaryColor }]}>{totalAll}</Text>
              <Text style={s.statLabel}>Total geral</Text>
            </View>
          </View>

          {/* Calendar */}
          <View style={s.calendarCard}>
            {/* Month nav */}
            <View style={s.monthNav}>
              <TouchableOpacity onPress={prevMonth} style={s.iconBtn}>
                <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={s.monthLabel}>{MONTHS[viewMonth]} {viewYear}</Text>
              <TouchableOpacity
                onPress={nextMonth}
                style={s.iconBtn}
                disabled={viewYear >= now.getFullYear() && viewMonth >= now.getMonth()}
              >
                <Ionicons
                  name="chevron-forward" size={20}
                  color={viewYear >= now.getFullYear() && viewMonth >= now.getMonth()
                    ? Colors.border : Colors.textPrimary}
                />
              </TouchableOpacity>
            </View>

            {/* Days header */}
            <View style={s.daysHeader}>
              {DAYS_HEADER.map((d, i) => (
                <Text key={i} style={s.dayHeaderText}>{d}</Text>
              ))}
            </View>

            {/* Calendar grid */}
            <View style={s.grid}>
              {Array.from({ length: firstDay }).map((_, i) => (
                <View key={`empty-${i}`} style={s.dayCell} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayDate = new Date(viewYear, viewMonth, day);
                const dayStr = dayDate.toDateString();
                const attended = attendedDays.has(dayStr);
                const isToday = dayStr === todayStr;
                const isFuture = dayDate > now;
                return (
                  <View key={day} style={s.dayCell}>
                    <View style={[
                      s.dayInner,
                      attended && { backgroundColor: primaryColor },
                      isToday && !attended && { borderWidth: 1.5, borderColor: primaryColor },
                      isFuture && { opacity: 0.3 },
                    ]}>
                      <Text style={[
                        s.dayText,
                        attended && { color: '#fff' },
                        isToday && !attended && { color: primaryColor },
                      ]}>{day}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Legend */}
            <View style={s.legend}>
              <View style={[s.legendDot, { backgroundColor: primaryColor }]} />
              <Text style={s.legendText}>Treino realizado</Text>
              <View style={[s.legendDot, { backgroundColor: Colors.border, borderWidth: 1.5, borderColor: primaryColor }]} />
              <Text style={s.legendText}>Hoje</Text>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  scroll: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 16, gap: 14 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1.5, paddingVertical: 20, alignItems: 'center', gap: 4 },
  statNum: { fontFamily: FontFamily.bodyBold, fontSize: 32 },
  statLabel: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary },
  calendarCard: { backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, padding: 16 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  monthLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  daysHeader: { flexDirection: 'row', marginBottom: 8 },
  dayHeaderText: { flex: 1, textAlign: 'center', fontFamily: FontFamily.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 3 },
  dayInner: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.textPrimary },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, marginRight: 8 },
});
