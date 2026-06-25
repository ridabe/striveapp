import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, LayoutAnimation,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { GOAL_COLORS, muscleColor } from '@/lib/exerciseConfig';
import { MediaViewerModal } from '@/components/MediaViewerModal';

const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface Exercise {
  itemId: string;
  name: string;
  muscleGroup: string;
  prescription: string;
  videoUrl: string | null;
  instructions: string | null;
}

interface Section {
  routineId: string;
  name: string;
  dayOfWeek: number | null;
  exercises: Exercise[];
}

interface Plan {
  id: string;
  name: string;
  goal: string | null;
  description: string | null;
}

export default function PlanDetailScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const { primaryColor } = useThemeStore();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);

  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((itemId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!planId) return;
    load();
  }, [planId]);

  async function load() {
    const [planRes, routinesRes] = await Promise.all([
      supabase.from('workout_plans').select('id, name, goal, description').eq('id', planId).single(),
      supabase.from('workout_routines').select('id, name, day_of_week, display_order').eq('workout_plan_id', planId).order('display_order'),
    ]);

    setPlan(planRes.data as Plan);

    const rIds = (routinesRes.data ?? []).map((r: any) => r.id);
    const itemsRes = rIds.length > 0
      ? await supabase
          .from('workout_items')
          .select('id, routine_id, display_order, sets, reps, load, duration_secs, exercises(name, muscle_group, video_url, instructions)')
          .in('routine_id', rIds)
          .order('display_order')
      : { data: [] };

    const allItems: any[] = itemsRes.data ?? [];

    const mapped: Section[] = (routinesRes.data ?? []).map((r: any) => ({
      routineId: r.id,
      name: r.name,
      dayOfWeek: r.day_of_week,
      exercises: allItems
        .filter(i => i.routine_id === r.id)
        .map(i => {
          const ex = i.exercises;
          const parts: string[] = [];
          if (i.sets) parts.push(`${i.sets} séries`);
          if (i.reps) parts.push(`${i.reps} reps`);
          if (i.duration_secs) parts.push(`${i.duration_secs}s`);
          if (i.load) parts.push(i.load);
          return {
            itemId: i.id,
            name: ex?.name ?? '—',
            muscleGroup: ex?.muscle_group ?? '',
            prescription: parts.join(' · '),
            videoUrl: ex?.video_url ?? null,
            instructions: ex?.instructions ?? null,
          };
        }),
    }));

    setSections(mapped);
    setLoading(false);
  }

  const totalExercises = sections.reduce((a, s) => a + s.exercises.length, 0);
  const todayIdx = new Date().getDay();
  const goalColor = GOAL_COLORS[plan?.goal ?? ''] ?? primaryColor;

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{plan?.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Plan header card */}
        <View style={[s.planCard, { borderColor: `${goalColor}35` }]}>
          <View style={s.planCardTop}>
            {plan?.goal && (
              <View style={[s.goalBadge, { backgroundColor: `${goalColor}18` }]}>
                <Text style={[s.goalText, { color: goalColor }]}>{plan.goal}</Text>
              </View>
            )}
            <View style={[s.countBadge, { backgroundColor: `${primaryColor}15` }]}>
              <Ionicons name="barbell-outline" size={13} color={primaryColor} />
              <Text style={[s.countBadgeText, { color: primaryColor }]}>{totalExercises} exercícios</Text>
            </View>
          </View>
          {plan?.description && (
            <Text style={s.planDesc}>{plan.description}</Text>
          )}
          {/* Day dots */}
          <View style={s.dayRow}>
            {DAY_SHORT.map((label, idx) => {
              const has = sections.some(sec => sec.dayOfWeek === idx);
              const isToday = idx === todayIdx;
              return (
                <View key={idx} style={[s.dayDot, has && { backgroundColor: isToday ? primaryColor : `${primaryColor}45` }]}>
                  <Text style={[s.dayDotText, has && { color: isToday ? '#fff' : primaryColor }]}>{label[0]}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Exercise list grouped by routine section */}
        {sections.map(section => (
          <View key={section.routineId} style={s.section}>
            <View style={s.sectionHeader}>
              {section.dayOfWeek != null && (
                <View style={[
                  s.dayPill,
                  section.dayOfWeek === todayIdx
                    ? { backgroundColor: primaryColor }
                    : { backgroundColor: Colors.border }
                ]}>
                  <Text style={[s.dayPillText, section.dayOfWeek === todayIdx && { color: '#fff' }]}>
                    {DAY_SHORT[section.dayOfWeek]}
                  </Text>
                </View>
              )}
              <Text style={s.sectionName}>{section.name}</Text>
              <Text style={s.sectionCount}>{section.exercises.length} exerc.</Text>
            </View>

            {section.exercises.length === 0 ? (
              <Text style={s.emptySection}>Sem exercícios cadastrados.</Text>
            ) : (
              section.exercises.map((ex, idx) => {
                const mc = muscleColor(ex.muscleGroup);
                const hasVideo = !!ex.videoUrl;
                const isGif = ex.videoUrl?.toLowerCase().includes('.gif');
                const isExpanded = expanded.has(ex.itemId);
                const hasInstructions = !!ex.instructions;

                return (
                  <View key={ex.itemId} style={[s.exCard, idx > 0 && s.exCardBorder]}>
                    {/* ── Main row ── */}
                    <View style={s.exRow}>
                      {/* Thumbnail — clicável se tiver vídeo */}
                      <TouchableOpacity
                        style={[s.thumbWrap, { backgroundColor: `${mc}18` }]}
                        onPress={() => { if (hasVideo) { setVideoTitle(ex.name); setVideoUri(ex.videoUrl!); } }}
                        disabled={!hasVideo}
                        activeOpacity={hasVideo ? 0.75 : 1}
                      >
                        {hasVideo && isGif ? (
                          <Image source={{ uri: ex.videoUrl! }} style={s.thumbImg} resizeMode="cover" />
                        ) : hasVideo ? (
                          <>
                            <Video
                              source={{ uri: ex.videoUrl! }}
                              style={s.thumbImg}
                              shouldPlay={false}
                              isMuted
                              resizeMode={ResizeMode.COVER}
                            />
                            <View style={s.thumbPlayOverlay}>
                              <Ionicons name="play-circle" size={22} color="#fff" />
                            </View>
                          </>
                        ) : (
                          <Ionicons name="barbell-outline" size={20} color={mc} />
                        )}
                      </TouchableOpacity>

                      {/* Info */}
                      <View style={s.exInfo}>
                        <Text style={s.exName} numberOfLines={2}>{ex.name}</Text>
                        <View style={s.exMeta}>
                          <View style={[s.musclePill, { backgroundColor: `${mc}20` }]}>
                            <View style={[s.muscleDot, { backgroundColor: mc }]} />
                            <Text style={[s.musclePillText, { color: mc }]}>
                              {ex.muscleGroup || 'Geral'}
                            </Text>
                          </View>
                          {ex.prescription ? (
                            <Text style={s.prescription}>{ex.prescription}</Text>
                          ) : null}
                        </View>
                      </View>

                      {/* Video pill button — visível sempre que tiver vídeo */}
                      {hasVideo && (
                        <TouchableOpacity
                          style={[s.videoPill, { backgroundColor: `${mc}18`, borderColor: `${mc}35` }]}
                          onPress={() => { setVideoTitle(ex.name); setVideoUri(ex.videoUrl!); }}
                          activeOpacity={0.75}
                        >
                          <Ionicons name={isGif ? 'image-outline' : 'play-circle-outline'} size={15} color={mc} />
                          <Text style={[s.videoPillText, { color: mc }]}>{isGif ? 'GIF' : 'Vídeo'}</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* ── Accordion toggle ── */}
                    {hasInstructions && (
                      <TouchableOpacity
                        style={s.accordionToggle}
                        onPress={() => toggleExpand(ex.itemId)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={13}
                          color={Colors.textSecondary}
                        />
                        <Text style={s.accordionLabel}>
                          {isExpanded ? 'Fechar instruções' : 'Como executar'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* ── Accordion content ── */}
                    {isExpanded && hasInstructions && (
                      <View style={s.accordionBody}>
                        <Text style={s.accordionText}>{ex.instructions}</Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        ))}

        {/* Iniciar Treino button */}
        {totalExercises > 0 && (
          <TouchableOpacity
            style={[s.startBtn, { backgroundColor: primaryColor }]}
            onPress={() => router.push(`/(student)/treinos/${planId}/executar` as any)}
            activeOpacity={0.87}
          >
            <Ionicons name="play-circle" size={22} color="#fff" />
            <Text style={s.startBtnText}>Iniciar Treino</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Video viewer modal */}
      {videoUri && (
        <MediaViewerModal
          visible
          uri={videoUri}
          type={videoUri.toLowerCase().includes('.gif') ? 'image' : 'video'}
          title={videoTitle}
          onClose={() => setVideoUri(null)}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary, marginHorizontal: 8 },
  scroll: { paddingHorizontal: 16, paddingBottom: 48, paddingTop: 16, gap: 12 },
  planCard: { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1.5, padding: 16, gap: 10 },
  planCardTop: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goalBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  goalText: { fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  countBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  countBadgeText: { fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  planDesc: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  dayRow: { flexDirection: 'row', gap: 5 },
  dayDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  dayDotText: { fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.textSecondary },
  section: { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dayPill: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayPillText: { fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.textSecondary },
  sectionName: { flex: 1, fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  sectionCount: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },
  emptySection: { padding: 16, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  // Exercise accordion card
  exCard: { paddingHorizontal: 14, paddingVertical: 0 },
  exCardBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  thumbWrap: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  thumbImg: { width: 52, height: 52 },
  thumbPlayOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.32)', alignItems: 'center', justifyContent: 'center' },
  exInfo: { flex: 1 },
  exName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 18 },
  exMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  musclePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  muscleDot: { width: 6, height: 6, borderRadius: 3 },
  musclePillText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  prescription: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },
  // Video pill button
  videoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, flexShrink: 0,
  },
  videoPillText: { fontFamily: FontFamily.bodyBold, fontSize: 11 },
  // Accordion
  accordionToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  accordionLabel: { fontFamily: FontFamily.bodyMedium, fontSize: 11, color: Colors.textSecondary },
  accordionBody: { paddingBottom: 12 },
  accordionText: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  // Start button
  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, borderRadius: 18, marginTop: 8 },
  startBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: '#fff' },
});
