import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';
import { MediaViewerModal, MediaType } from '@/components/MediaViewerModal';
import { useStudent } from '@/hooks/useStudent';
import { useThemeStore } from '@/stores/themeStore';
import { StudentHeader } from '@/components/StudentHeader';
import { ModuleGuard } from '@/components/ModuleGuard';
import { MODULE } from '@/lib/modules';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

type FileCategory = 'pdf' | 'image' | 'video' | 'doc' | 'spreadsheet' | 'other';

interface SharedFile {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: FileCategory;
  file_name: string;
  file_size: number | null;
  created_at: string;
}

const TYPE_FILTERS: { key: FileCategory | 'all'; label: string }[] = [
  { key: 'all',         label: 'Todos' },
  { key: 'pdf',         label: 'PDF' },
  { key: 'image',       label: 'Imagens' },
  { key: 'video',       label: 'Vídeos' },
  { key: 'doc',         label: 'Docs' },
  { key: 'spreadsheet', label: 'Planilhas' },
];

function fileIcon(type: FileCategory): string {
  if (type === 'pdf')         return 'document-text-outline';
  if (type === 'image')       return 'image-outline';
  if (type === 'video')       return 'videocam-outline';
  if (type === 'doc')         return 'document-outline';
  if (type === 'spreadsheet') return 'grid-outline';
  return 'attach-outline';
}

function fileIconColor(type: FileCategory): string {
  if (type === 'pdf')         return '#EF4444';
  if (type === 'image')       return '#10B981';
  if (type === 'video')       return '#6366F1';
  if (type === 'doc')         return '#3B82F6';
  if (type === 'spreadsheet') return '#22C55E';
  return '#A1A1AA';
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ArquivosStudentScreen() {
  const { selectedStudent } = useStudent();
  const { primaryColor } = useThemeStore();

  const [files, setFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<FileCategory | 'all'>('all');

  const [mediaUri, setMediaUri] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaVisible, setMediaVisible] = useState(false);

  const load = useCallback(async () => {
    if (!selectedStudent) return;
    const { data } = await supabase
      .from('shared_files')
      .select('id, title, description, file_url, file_type, file_name, file_size, created_at')
      .eq('tenant_id', selectedStudent.tenant_id)
      .or(`student_id.is.null,student_id.eq.${selectedStudent.id}`)
      .order('created_at', { ascending: false });
    setFiles((data ?? []) as SharedFile[]);
    setLoading(false);
  }, [selectedStudent?.id]);

  useEffect(() => { load(); }, [load]);

  function openFile(file: SharedFile) {
    if (file.file_type === 'image') {
      setMediaUri(file.file_url);
      setMediaType('image');
      setMediaTitle(file.title);
      setMediaVisible(true);
    } else if (file.file_type === 'video') {
      setMediaUri(file.file_url);
      setMediaType('video');
      setMediaTitle(file.title);
      setMediaVisible(true);
    } else {
      WebBrowser.openBrowserAsync(file.file_url);
    }
  }

  const filtered = files.filter(f => {
    const matchSearch = !search ||
      f.title.toLowerCase().includes(search.toLowerCase()) ||
      f.file_name.toLowerCase().includes(search.toLowerCase()) ||
      (f.description ?? '').toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || f.file_type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StudentHeader title="Arquivos" />

      <ModuleGuard slug={MODULE.ARQUIVOS}>
      {/* Search */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={Colors.textSecondary} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar arquivos..."
          placeholderTextColor={Colors.textSecondary}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Type filter chips */}
      <FlatList
        horizontal
        data={TYPE_FILTERS}
        keyExtractor={item => item.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chipRow}
        renderItem={({ item }) => {
          const active = typeFilter === item.key;
          return (
            <TouchableOpacity
              style={[s.chip, active && { backgroundColor: primaryColor, borderColor: primaryColor }]}
              onPress={() => setTypeFilter(item.key as FileCategory | 'all')}
              activeOpacity={0.75}
            >
              <Text style={[s.chipText, active && { color: '#fff' }]}>{item.label}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {loading ? (
        <ActivityIndicator color={primaryColor} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={[s.emptyIcon, { borderColor: `${primaryColor}30`, backgroundColor: `${primaryColor}10` }]}>
                <Ionicons name="folder-open-outline" size={28} color={primaryColor} />
              </View>
              <Text style={s.emptyTitle}>
                {search || typeFilter !== 'all' ? 'Nenhum resultado' : 'Nenhum arquivo'}
              </Text>
              <Text style={s.emptyDesc}>
                {search || typeFilter !== 'all'
                  ? 'Tente outros filtros ou termos de busca.'
                  : 'Seu personal ainda não compartilhou nenhum arquivo.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const color = fileIconColor(item.file_type);
            const isMedia = item.file_type === 'image' || item.file_type === 'video';
            return (
              <TouchableOpacity
                style={s.card}
                onPress={() => openFile(item)}
                activeOpacity={0.8}
              >
                {/* Icon */}
                <View style={[s.fileIconWrap, { backgroundColor: `${color}15` }]}>
                  <Ionicons name={fileIcon(item.file_type) as any} size={26} color={color} />
                </View>

                {/* Info */}
                <View style={s.cardBody}>
                  <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>
                  {item.description && (
                    <Text style={s.cardDesc} numberOfLines={2}>{item.description}</Text>
                  )}
                  <View style={s.cardMeta}>
                    <Text style={s.cardMetaText}>{formatDate(item.created_at)}</Text>
                    {item.file_size ? (
                      <>
                        <View style={s.dot} />
                        <Text style={s.cardMetaText}>{formatSize(item.file_size)}</Text>
                      </>
                    ) : null}
                  </View>
                </View>

                {/* Action */}
                <Ionicons
                  name={isMedia ? 'eye-outline' : 'open-outline'}
                  size={18}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>
            );
          }}
        />
      )}

      <MediaViewerModal
        visible={mediaVisible}
        uri={mediaUri}
        type={mediaType}
        title={mediaTitle}
        onClose={() => setMediaVisible(false)}
      />
      </ModuleGuard>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 14, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textPrimary, padding: 0 },

  chipRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipText: { fontFamily: FontFamily.bodyMedium, fontSize: 13, color: Colors.textSecondary },

  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },

  empty: { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 40 },
  emptyIcon: { width: 56, height: 56, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  emptyDesc: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 14 },
  fileIconWrap: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardBody: { flex: 1, gap: 3 },
  cardTitle: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  cardDesc: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  cardMetaText: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSecondary },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.textSecondary },
});
