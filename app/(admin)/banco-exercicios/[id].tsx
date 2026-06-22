import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Switch,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import {
  MUSCLE_GROUPS, LOAD_TYPES, COUNT_TYPES, muscleColor,
} from '@/lib/exerciseConfig';

interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  secondary_muscles: string[];
  load_type: string;
  count_type: string;
  default_sets: number | null;
  default_reps: string | null;
  default_duration_secs: number | null;
  instructions: string | null;
  video_url: string | null;
  is_global: boolean;
  tenant_id: string | null;
}

const IS_NEW = 'novo';

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuthStore();
  const { primaryColor } = useThemeStore();
  const tenantId = profile?.tenant_id ?? '';
  const isNew = id === IS_NEW;

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(isNew);

  // Form fields
  const [fName, setFName] = useState('');
  const [fMuscle, setFMuscle] = useState('Peito');
  const [fLoadType, setFLoadType] = useState('dumbbell');
  const [fCountType, setFCountType] = useState('reps');
  const [fSets, setFSets] = useState('');
  const [fReps, setFReps] = useState('');
  const [fDuration, setFDuration] = useState('');
  const [fInstructions, setFInstructions] = useState('');

  const lightText = ['#FFFFFF', '#E8FF47', '#84CC16', '#F59E0B'].includes(primaryColor);
  const isOwned = isNew || exercise?.tenant_id === tenantId;

  useEffect(() => {
    if (isNew) return;
    supabase.from('exercises')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          setExercise(data as Exercise);
          setFName(data.name);
          setFMuscle(data.muscle_group);
          setFLoadType(data.load_type);
          setFCountType(data.count_type);
          setFSets(String(data.default_sets ?? ''));
          setFReps(data.default_reps ?? '');
          setFDuration(String(data.default_duration_secs ?? ''));
          setFInstructions(data.instructions ?? '');
        }
        setLoading(false);
      });
  }, [id]);

  async function handleSave() {
    if (!fName.trim()) { Alert.alert('Atenção', 'Informe o nome do exercício.'); return; }
    setSaving(true);
    try {
      const payload = {
        name: fName.trim(),
        muscle_group: fMuscle,
        load_type: fLoadType,
        count_type: fCountType,
        default_sets: fSets ? parseInt(fSets) : null,
        default_reps: fReps.trim() || null,
        default_duration_secs: fDuration ? parseInt(fDuration) : null,
        instructions: fInstructions.trim() || null,
        tenant_id: tenantId,
        is_global: false,
      };

      if (isNew) {
        const { error } = await supabase.from('exercises').insert({ ...payload, created_by: profile?.id });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('exercises').update(payload).eq('id', id);
        if (error) throw error;
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    Alert.alert('Remover exercício', 'Tem certeza? Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive', onPress: async () => {
          await supabase.from('exercises').delete().eq('id', id);
          router.back();
        },
      },
    ]);
  }

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

  const mc = muscleColor(fMuscle);
  const isReadOnly = !isNew && !isOwned;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{isNew ? 'Novo Exercício' : (fName || 'Exercício')}</Text>
        {isReadOnly ? (
          <View style={s.lockBadge}>
            <Ionicons name="lock-closed-outline" size={14} color={Colors.textSecondary} />
            <Text style={s.lockText}>Global</Text>
          </View>
        ) : !isNew ? (
          <TouchableOpacity onPress={() => setEditMode(e => !e)} style={s.iconBtn}>
            <Ionicons name={editMode ? 'checkmark-done-outline' : 'create-outline'} size={20} color={primaryColor} />
          </TouchableOpacity>
        ) : <View style={{ width: 38 }} />}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Muscle color preview */}
        <View style={[s.musclePreview, { backgroundColor: `${mc}15`, borderColor: `${mc}40` }]}>
          <View style={[s.muscleDot, { backgroundColor: mc }]} />
          <Text style={[s.muscleText, { color: mc }]}>{fMuscle}</Text>
          {exercise?.is_global && <Text style={s.globalTag}>Exercício global</Text>}
        </View>

        {/* Name */}
        <Text style={s.label}>NOME</Text>
        {editMode && !isReadOnly ? (
          <TextInput value={fName} onChangeText={setFName} style={s.input}
            placeholder="Ex: Supino Reto" placeholderTextColor={Colors.textSecondary} />
        ) : (
          <Text style={s.value}>{fName || '—'}</Text>
        )}

        {/* Muscle group */}
        <Text style={[s.label, { marginTop: 18 }]}>GRUPO MUSCULAR</Text>
        {editMode && !isReadOnly ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 4 }}>
            {MUSCLE_GROUPS.map(m => {
              const mc2 = muscleColor(m);
              return (
                <TouchableOpacity key={m}
                  style={[s.pill, fMuscle === m && { backgroundColor: mc2, borderColor: mc2 }]}
                  onPress={() => setFMuscle(m)} activeOpacity={0.75}>
                  <Text style={[s.pillText, fMuscle === m && { color: '#fff' }]}>{m}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : (
          <Text style={s.value}>{fMuscle}</Text>
        )}

        {/* Load type */}
        <Text style={[s.label, { marginTop: 18 }]}>TIPO DE CARGA</Text>
        {editMode && !isReadOnly ? (
          <View style={s.grid}>
            {LOAD_TYPES.map(lt => (
              <TouchableOpacity key={lt.key}
                style={[s.gridItem, fLoadType === lt.key && { borderColor: primaryColor, backgroundColor: `${primaryColor}15` }]}
                onPress={() => setFLoadType(lt.key)} activeOpacity={0.75}>
                <Text style={[s.gridText, fLoadType === lt.key && { color: primaryColor }]}>{lt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={s.value}>{LOAD_TYPES.find(l => l.key === fLoadType)?.label ?? fLoadType}</Text>
        )}

        {/* Count type */}
        <Text style={[s.label, { marginTop: 18 }]}>TIPO DE CONTAGEM</Text>
        {editMode && !isReadOnly ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {COUNT_TYPES.map(ct => (
              <TouchableOpacity key={ct.key}
                style={[s.countBtn, fCountType === ct.key && { borderColor: primaryColor, backgroundColor: `${primaryColor}15` }]}
                onPress={() => setFCountType(ct.key)} activeOpacity={0.75}>
                <Text style={[s.countBtnText, fCountType === ct.key && { color: primaryColor }]}>{ct.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={s.value}>{COUNT_TYPES.find(c => c.key === fCountType)?.label ?? fCountType}</Text>
        )}

        {/* Default prescription */}
        <Text style={[s.label, { marginTop: 18 }]}>PRESCRIÇÃO PADRÃO</Text>
        {editMode && !isReadOnly ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.subLabel}>Séries</Text>
              <TextInput value={fSets} onChangeText={setFSets} style={s.input} keyboardType="numeric" placeholder="3" placeholderTextColor={Colors.textSecondary} />
            </View>
            {(fCountType === 'reps' || fCountType === 'both') && (
              <View style={{ flex: 2 }}>
                <Text style={s.subLabel}>Repetições</Text>
                <TextInput value={fReps} onChangeText={setFReps} style={s.input} placeholder="10-12" placeholderTextColor={Colors.textSecondary} />
              </View>
            )}
            {(fCountType === 'time' || fCountType === 'both') && (
              <View style={{ flex: 2 }}>
                <Text style={s.subLabel}>Duração (seg)</Text>
                <TextInput value={fDuration} onChangeText={setFDuration} style={s.input} keyboardType="numeric" placeholder="30" placeholderTextColor={Colors.textSecondary} />
              </View>
            )}
          </View>
        ) : (
          <Text style={s.value}>
            {fSets ? `${fSets} séries` : '—'}
            {fReps ? ` × ${fReps} reps` : ''}
            {fDuration ? ` × ${fDuration}s` : ''}
          </Text>
        )}

        {/* Instructions */}
        <Text style={[s.label, { marginTop: 18 }]}>INSTRUÇÕES DE EXECUÇÃO</Text>
        {editMode && !isReadOnly ? (
          <TextInput
            value={fInstructions} onChangeText={setFInstructions}
            style={[s.input, { minHeight: 100, textAlignVertical: 'top', paddingTop: 12 }]}
            multiline placeholder="Descreva como executar o exercício corretamente..."
            placeholderTextColor={Colors.textSecondary}
          />
        ) : (
          <Text style={[s.value, { lineHeight: 22 }]}>{fInstructions || '—'}</Text>
        )}

        {/* Video URL */}
        {exercise?.video_url && (
          <>
            <Text style={[s.label, { marginTop: 18 }]}>VÍDEO DE DEMONSTRAÇÃO</Text>
            <View style={s.videoBox}>
              <Ionicons name="play-circle-outline" size={24} color={primaryColor} />
              <Text style={s.videoText} numberOfLines={1}>{exercise.video_url}</Text>
            </View>
          </>
        )}

        {/* Actions */}
        {editMode && !isReadOnly && (
          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: primaryColor }, saving && { opacity: 0.6 }]}
            onPress={handleSave} disabled={saving} activeOpacity={0.85}>
            {saving
              ? <ActivityIndicator color={lightText ? '#000' : '#fff'} />
              : <Text style={[s.saveBtnText, { color: lightText ? '#000' : '#fff' }]}>
                  {isNew ? 'Criar Exercício' : 'Salvar Alterações'}
                </Text>
            }
          </TouchableOpacity>
        )}

        {!isNew && isOwned && !editMode && (
          <TouchableOpacity style={s.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={16} color={Colors.error} />
            <Text style={s.deleteBtnText}>Remover exercício</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary, flex: 1, marginHorizontal: 8 },
  lockBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  lockText: { fontFamily: FontFamily.bodyMedium, fontSize: 11, color: Colors.textSecondary },
  scroll: { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 20 },
  musclePreview: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 20,
  },
  muscleDot: { width: 10, height: 10, borderRadius: 5 },
  muscleText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, flex: 1 },
  globalTag: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },
  label: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, marginBottom: 8 },
  subLabel: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary, marginBottom: 4 },
  value: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary, marginBottom: 4 },
  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary,
  },
  pill: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  pillText: { fontFamily: FontFamily.bodyMedium, fontSize: 11, color: Colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridItem: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  gridText: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  countBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  countBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: Colors.textSecondary },
  videoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    padding: 12,
  },
  videoText: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSecondary, flex: 1 },
  saveBtn: {
    borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    marginTop: 28,
  },
  saveBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 20, padding: 14,
  },
  deleteBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.error },
});
