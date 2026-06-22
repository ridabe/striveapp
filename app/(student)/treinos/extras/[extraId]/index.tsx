import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { muscleColor, extraCategoryLabel } from '@/lib/exerciseConfig';
import { MediaViewerModal } from '@/components/MediaViewerModal';

interface ExtraExercise {
  itemId: string;
  exerciseId: string;
  name: string;
  muscleGroup: string;
  prescription: string;
  videoUrl: string | null;
  sets: number;
  reps: string | null;
  load: string | null;
}

interface Extra {
  id: string;
  name: string;
  category: string;
  description: string | null;
}

const CATEGORY_COLOR: Record<string, string> = {
  aquecimento: '#F97316', hiit: '#EF4444', mobilidade: '#8B5CF6',
  cardio: '#EC4899', desafio: '#F59E0B', forca: '#3B82F6', outros: '#64748B',
};

export default function ExtraDetailScreen() {
  const { extraId } = useLocalSearchParams<{ extraId: string }>();
  const { primaryColor } = useThemeStore();

  const [extra, setExtra] = useState<Extra | null>(null);
  const [exercises, setExercises] = useState<ExtraExercise[]>([]);
  const [loading, setLoading] = useState(true);

  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState('');

  useEffect(() => {
    if (extraId) load();
  }, [extraId]);

  async function load() {
    const [extraRes, itemsRes] = await Promise.all([
      supabase.from('extra_workouts').select('id, name, category, description').eq('id', extraId).single(),
      supabase
        .from('extra_workout_items')
        .select('id, exercise_id, display_order, sets, reps, load, duration_secs, exercises(name, muscle_group, video_url)')
        .eq('extra_workout_id', extraId)
        .order('display_order'),
    ]);

    setExtra(extraRes.data as Extra);

    const items = (itemsRes.data ?? []).map((i: any) => {
      const ex = i.exercises;
      const parts: string[] = [];
      if (i.sets) parts.push(`${i.sets} séries`);
      if (i.reps) parts.push(`${i.reps} reps`);
      if (i.duration_secs) parts.push(`${i.duration_secs}s`);
      if (i.load) parts.push(i.load);
      return {
        itemId: i.id,
        exerciseId: i.exercise_id,
        name: ex?.name ?? '—',
        muscleGroup: ex?.muscle_group ?? '',
        prescription: parts.join(' · '),
        videoUrl: ex?.video_url ?? null,
        sets: i.sets ?? 1,
        reps: i.reps,
        load: i.load,
      };
    });

    setExercises(items);
    setLoading(false);
  }

  const catColor = CATEGORY_COLOR[extra?.category ?? ''] ?? primaryColor;

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
        <Text style={s.headerTitle} numberOfLines={1}>{extra?.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header card */}
        <View style={[s.infoCard, { borderColor: `${catColor}35` }]}>
          <View style={s.infoTop}>
            <View style={[s.catBadge, { backgroundColor: `${catColor}18` }]}>
              <Text style={[s.catBadgeText, { color: catColor }]}>{extraCategoryLabel(extra?.category ?? '')}</Text>
            </View>
            <View style={[s.countBadge, { backgroundColor: `${primaryColor}15` }]}>
              <Ionicons name="barbell-outline" size={13} color={primaryColor} />
              <Text style={[s.countBadgeText, { color: primaryColor }]}>{exercises.length} exercícios</Text>
            </View>
          </View>
          {extra?.description && (
            <Text style={s.description}>{extra.description}</Text>
          )}
        </View>

        {/* Exercise list */}
        {exercises.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="barbell-outline" size={48} color={Colors.border} />
            <Text style={s.emptyText}>Sem exercícios cadastrados.</Text>
          </View>
        ) : (
          <View style={s.exList}>
            {exercises.map((ex, idx) => {
              const mc = muscleColor(ex.muscleGroup);
              const hasVideo = !!ex.videoUrl;
              return (
                <View key={ex.itemId} style={[s.exRow, idx > 0 && s.exRowBorder]}>
                  {/* Video thumbnail */}
                  <TouchableOpacity
                    style={[s.videoThumb, { backgroundColor: `${mc}22` }]}
                    onPress={() => {
                      if (hasVideo) { setVideoTitle(ex.name); setVideoUri(ex.videoUrl!); }
                    }}
                    disabled={!hasVideo}
                    activeOpacity={0.75}
                  >
                    <View style={[s.playBtn, { backgroundColor: hasVideo ? mc : Colors.border }]}>
                      <Ionicons name={hasVideo ? 'play' : 'barbell-outline'} size={14} color={hasVideo ? '#fff' : Colors.textSecondary} />
                    </View>
                    {hasVideo && <Text style={[s.videoLabel, { color: mc }]}>Vídeo</Text>}
                  </TouchableOpacity>

                  <View style={{ flex: 1 }}>
                    <Text style={s.exName}>{ex.name}</Text>
                    <View style={s.exMeta}>
                      <View style={[s.musclePill, { backgroundColor: `${mc}20` }]}>
                        <View style={[s.muscleDot, { backgroundColor: mc }]} />
                        <Text style={[s.musclePillText, { color: mc }]}>{ex.muscleGroup || 'Geral'}</Text>
                      </View>
                      {ex.prescription ? <Text style={s.prescription}>{ex.prescription}</Text> : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {exercises.length > 0 && (
          <TouchableOpacity
            style={[s.startBtn, { backgroundColor: primaryColor }]}
            onPress={() => router.push(`/(student)/treinos/extras/${extraId}/executar` as any)}
            activeOpacity={0.87}
          >
            <Ionicons name="play-circle" size={22} color="#fff" />
            <Text style={s.startBtnText}>Iniciar Treino</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {videoUri && (
        <MediaViewerModal visible uri={videoUri} type="video" title={videoTitle} onClose={() => setVideoUri(null)} />
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
  infoCard: { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1.5, padding: 16, gap: 10 },
  infoTop: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  catBadgeText: { fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  countBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  countBadgeText: { fontFamily: FontFamily.bodyMedium, fontSize: 12 },
  description: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  exList: { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  exRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  exRowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  videoThumb: { width: 60, height: 60, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 4 },
  playBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  videoLabel: { fontFamily: FontFamily.bodyBold, fontSize: 10 },
  exName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  exMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  musclePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  muscleDot: { width: 7, height: 7, borderRadius: 4 },
  musclePillText: { fontFamily: FontFamily.bodyMedium, fontSize: 11 },
  prescription: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary },
  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, borderRadius: 18, marginTop: 8 },
  startBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: '#fff' },
});
