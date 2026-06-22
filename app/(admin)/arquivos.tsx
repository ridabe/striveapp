import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, Modal, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

// ─── Types ───────────────────────────────────────────────────────────────────
interface SharedFile {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: FileCategory;
  file_name: string;
  file_size: number | null;
  student_id: string | null;
  created_at: string;
  student_name?: string;
}

interface Student {
  id: string;
  full_name: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Category stored in DB — must match the CHECK constraint
type FileCategory = 'pdf' | 'image' | 'video' | 'doc' | 'spreadsheet' | 'other';

function categoryFromMime(mime: string, name: string): FileCategory {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (['doc', 'docx', 'odt', 'txt', 'rtf'].includes(ext) ||
      mime.includes('word') || mime.includes('document')) return 'doc';
  if (['xls', 'xlsx', 'ods', 'csv'].includes(ext) ||
      mime.includes('excel') || mime.includes('spreadsheet')) return 'spreadsheet';
  return 'other';
}

// Extension used only for the storage file path (not saved in DB)
function extFromName(name: string, mime: string): string {
  const fromName = name.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  const map: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/zip': 'zip',
  };
  return map[mime] ?? 'bin';
}

function fileIcon(type: FileCategory): any {
  if (type === 'pdf') return 'document-text-outline';
  if (type === 'image') return 'image-outline';
  if (type === 'video') return 'videocam-outline';
  if (type === 'doc') return 'document-outline';
  if (type === 'spreadsheet') return 'grid-outline';
  return 'attach-outline';
}

function fileIconColor(type: FileCategory): string {
  if (type === 'pdf') return '#EF4444';
  if (type === 'image') return '#10B981';
  if (type === 'video') return '#6366F1';
  if (type === 'doc') return '#3B82F6';
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

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function ArquivosScreen() {
  const { profile } = useAuthStore();
  const { primaryColor } = useThemeStore();
  const tenantId = profile?.tenant_id;

  const [files, setFiles] = useState<SharedFile[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStudentId, setFilterStudentId] = useState<string | null | 'all'>('all');

  // Upload modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadAudience, setUploadAudience] = useState<'all' | 'student'>('all');
  const [uploadStudentId, setUploadStudentId] = useState<string>('');
  const [pickedFile, setPickedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [uploading, setUploading] = useState(false);

  const lightText = ['#FFFFFF', '#E8FF47', '#84CC16', '#F59E0B'].includes(primaryColor);

  // ─── Load ─────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!tenantId) return;
    const [filesRes, studentsRes] = await Promise.all([
      supabase
        .from('shared_files')
        .select('id, title, description, file_url, file_type, file_name, file_size, student_id, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }),
      supabase
        .from('students')
        .select('id, full_name')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .order('full_name'),
    ]);

    const studentMap: Record<string, string> = {};
    (studentsRes.data ?? []).forEach((s: Student) => { studentMap[s.id] = s.full_name; });

    const enriched: SharedFile[] = (filesRes.data ?? []).map(f => ({
      ...f,
      file_type: (f.file_type ?? 'other') as FileCategory,
      student_name: f.student_id ? studentMap[f.student_id] : undefined,
    }));

    setFiles(enriched);
    setStudents(studentsRes.data ?? []);
  }, [tenantId]);

  useEffect(() => {
    loadAll().finally(() => setLoading(false));
  }, [loadAll]);

  // ─── Filter ───────────────────────────────────────────────────────────────
  const filtered = files.filter(f => {
    const matchSearch = !search || f.title.toLowerCase().includes(search.toLowerCase())
      || f.file_name.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filterStudentId === 'all' ||
      (filterStudentId === null && f.student_id === null) ||
      f.student_id === filterStudentId;
    return matchSearch && matchFilter;
  });

  // ─── Pick file ────────────────────────────────────────────────────────────
  async function handlePickFile() {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPickedFile(asset);
    if (!uploadTitle) {
      const nameWithoutExt = asset.name.replace(/\.[^/.]+$/, '');
      setUploadTitle(nameWithoutExt);
    }
  }

  // ─── Upload ───────────────────────────────────────────────────────────────
  async function handleUpload() {
    if (!tenantId) return;
    if (!pickedFile) { Alert.alert('Atenção', 'Selecione um arquivo.'); return; }
    if (!uploadTitle.trim()) { Alert.alert('Atenção', 'Informe o título do arquivo.'); return; }
    if (uploadAudience === 'student' && !uploadStudentId) {
      Alert.alert('Atenção', 'Selecione o aluno.'); return;
    }

    setUploading(true);
    try {
      const ext = extFromName(pickedFile.name, pickedFile.mimeType ?? '');
      const category = categoryFromMime(pickedFile.mimeType ?? '', pickedFile.name);
      const uuid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const storagePath = `${tenantId}/${uuid}.${ext}`;

      // FileSystem.uploadAsync is the reliable way to upload local URIs on Android
      // (content:// URIs) and iOS (file:// URIs) — fetch() fails silently on Android.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada. Faça login novamente.');

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

      const uploadResult = await FileSystem.uploadAsync(
        `${supabaseUrl}/storage/v1/object/shared-files/${storagePath}`,
        pickedFile.uri,
        {
          httpMethod: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: supabaseKey,
            'Content-Type': pickedFile.mimeType ?? 'application/octet-stream',
          },
        },
      );

      if (uploadResult.status !== 200) {
        const body = JSON.parse(uploadResult.body ?? '{}');
        throw new Error(body.error ?? `Upload falhou (${uploadResult.status})`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('shared-files')
        .getPublicUrl(storagePath);

      // Insert record
      const { error: dbError } = await supabase.from('shared_files').insert({
        tenant_id: tenantId,
        student_id: uploadAudience === 'student' ? uploadStudentId : null,
        title: uploadTitle.trim(),
        description: uploadDesc.trim() || null,
        file_url: urlData.publicUrl,
        file_type: category,
        file_name: pickedFile.name,
        file_size: pickedFile.size ?? null,
      });
      if (dbError) throw dbError;

      resetModal();
      setModalVisible(false);
      await loadAll();
    } catch (err: any) {
      Alert.alert('Erro ao enviar', err.message);
    } finally {
      setUploading(false);
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────────
  async function handleDelete(file: SharedFile) {
    Alert.alert(
      'Excluir arquivo',
      `Tem certeza que deseja excluir "${file.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir', style: 'destructive',
          onPress: async () => {
            try {
              // Extract storage path from URL
              const url = new URL(file.file_url);
              const pathStart = url.pathname.indexOf('/shared-files/') + '/shared-files/'.length;
              const storagePath = url.pathname.slice(pathStart);

              await supabase.storage.from('shared-files').remove([storagePath]);
              await supabase.from('shared_files').delete().eq('id', file.id);
              setFiles(prev => prev.filter(f => f.id !== file.id));
            } catch (err: any) {
              Alert.alert('Erro', err.message);
            }
          },
        },
      ],
    );
  }

  function resetModal() {
    setUploadTitle('');
    setUploadDesc('');
    setUploadAudience('all');
    setUploadStudentId('');
    setPickedFile(null);
  }

  // ─── Filter chips data ────────────────────────────────────────────────────
  // Show student chips only for students that have files
  const studentsWithFiles = students.filter(s => files.some(f => f.student_id === s.id));
  const hasGeneralFiles = files.some(f => f.student_id === null);

  // ─── Render file card ─────────────────────────────────────────────────────
  function renderFile({ item }: { item: SharedFile }) {
    const iconName = fileIcon(item.file_type);
    const iconColor = fileIconColor(item.file_type);

    return (
      <TouchableOpacity
        style={styles.fileCard}
        onPress={() => WebBrowser.openBrowserAsync(item.file_url)}
        onLongPress={() => handleDelete(item)}
        activeOpacity={0.75}
        delayLongPress={500}
      >
        <View style={[styles.fileIconBox, { backgroundColor: `${iconColor}18` }]}>
          <Ionicons name={iconName} size={26} color={iconColor} />
        </View>

        <View style={styles.fileInfo}>
          <Text style={styles.fileTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.fileName} numberOfLines={1}>{item.file_name}</Text>
          <View style={styles.fileMeta}>
            {item.file_size ? (
              <Text style={styles.fileMetaText}>{formatSize(item.file_size)}</Text>
            ) : null}
            <Text style={styles.fileMetaText}>·</Text>
            <Text style={styles.fileMetaText}>{formatDate(item.created_at)}</Text>
          </View>
        </View>

        <View style={styles.fileRight}>
          <View style={[
            styles.audienceBadge,
            { backgroundColor: item.student_id ? `${primaryColor}18` : 'rgba(99,102,241,0.12)' },
          ]}>
            <Ionicons
              name={item.student_id ? 'person' : 'people'}
              size={11}
              color={item.student_id ? primaryColor : '#6366F1'}
            />
            <Text style={[styles.audienceText, { color: item.student_id ? primaryColor : '#6366F1' }]}>
              {item.student_id ? (item.student_name ?? 'Aluno') : 'Geral'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Arquivos</Text>
        <TouchableOpacity
          style={[styles.uploadBtn, { backgroundColor: primaryColor }]}
          onPress={() => { resetModal(); setModalVisible(true); }}
          activeOpacity={0.85}
        >
          <Ionicons name="cloud-upload-outline" size={18} color={lightText ? '#000' : '#fff'} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={Colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar arquivos..."
          placeholderTextColor={Colors.textSecondary}
          style={styles.searchInput}
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsContent}
      >
        <Chip
          label="Todos"
          active={filterStudentId === 'all'}
          primaryColor={primaryColor}
          onPress={() => setFilterStudentId('all')}
        />
        {hasGeneralFiles && (
          <Chip
            label="Geral"
            icon="people"
            active={filterStudentId === null}
            primaryColor={primaryColor}
            onPress={() => setFilterStudentId(null)}
          />
        )}
        {studentsWithFiles.map(s => (
          <Chip
            key={s.id}
            label={s.full_name.split(' ')[0]}
            icon="person"
            active={filterStudentId === s.id}
            primaryColor={primaryColor}
            onPress={() => setFilterStudentId(s.id)}
          />
        ))}
      </ScrollView>

      {/* List */}
      {loading ? (
        <ActivityIndicator color={primaryColor} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderFile}
          contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="folder-open-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyTitle}>Nenhum arquivo</Text>
              <Text style={styles.emptyText}>
                {search ? 'Nenhum resultado para sua busca.' : 'Envie arquivos para disponibilizar aos seus alunos.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Upload Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => !uploading && setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalSafe}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Modal header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => !uploading && setModalVisible(false)} style={styles.backBtn}>
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Enviar arquivo</Text>
            <View style={{ width: 38 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* File picker */}
            <Text style={styles.modalLabel}>ARQUIVO</Text>
            <TouchableOpacity style={styles.filePicker} onPress={handlePickFile} activeOpacity={0.8}>
              {pickedFile ? (
                <View style={styles.filePickedRow}>
                  <Ionicons name={fileIcon(categoryFromMime(pickedFile.mimeType ?? '', pickedFile.name))} size={24} color={primaryColor} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.filePickedName} numberOfLines={1}>{pickedFile.name}</Text>
                    {pickedFile.size ? (
                      <Text style={styles.filePickedSize}>{formatSize(pickedFile.size)}</Text>
                    ) : null}
                  </View>
                  <Ionicons name="swap-horizontal-outline" size={18} color={Colors.textSecondary} />
                </View>
              ) : (
                <View style={styles.filePickerPlaceholder}>
                  <Ionicons name="cloud-upload-outline" size={32} color={Colors.textSecondary} />
                  <Text style={styles.filePickerText}>Toque para selecionar um arquivo</Text>
                  <Text style={styles.filePickerHint}>PDF, DOC, imagens, vídeos e outros</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Title */}
            <Text style={[styles.modalLabel, { marginTop: 20 }]}>TÍTULO</Text>
            <TextInput
              value={uploadTitle}
              onChangeText={setUploadTitle}
              placeholder="Nome do arquivo para os alunos"
              placeholderTextColor={Colors.textSecondary}
              style={styles.modalInput}
            />

            {/* Description */}
            <Text style={[styles.modalLabel, { marginTop: 16 }]}>DESCRIÇÃO (opcional)</Text>
            <TextInput
              value={uploadDesc}
              onChangeText={setUploadDesc}
              placeholder="Breve descrição do conteúdo"
              placeholderTextColor={Colors.textSecondary}
              multiline
              numberOfLines={3}
              style={[styles.modalInput, styles.textArea]}
            />

            {/* Audience */}
            <Text style={[styles.modalLabel, { marginTop: 16 }]}>DISPONIBILIZAR PARA</Text>
            <View style={styles.audienceRow}>
              <TouchableOpacity
                style={[styles.audienceOption, uploadAudience === 'all' && { borderColor: primaryColor, backgroundColor: `${primaryColor}12` }]}
                onPress={() => setUploadAudience('all')}
                activeOpacity={0.8}
              >
                <Ionicons name="people-outline" size={20} color={uploadAudience === 'all' ? primaryColor : Colors.textSecondary} />
                <Text style={[styles.audienceOptionText, { color: uploadAudience === 'all' ? primaryColor : Colors.textSecondary }]}>
                  Todos os alunos
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.audienceOption, uploadAudience === 'student' && { borderColor: primaryColor, backgroundColor: `${primaryColor}12` }]}
                onPress={() => setUploadAudience('student')}
                activeOpacity={0.8}
              >
                <Ionicons name="person-outline" size={20} color={uploadAudience === 'student' ? primaryColor : Colors.textSecondary} />
                <Text style={[styles.audienceOptionText, { color: uploadAudience === 'student' ? primaryColor : Colors.textSecondary }]}>
                  Aluno específico
                </Text>
              </TouchableOpacity>
            </View>

            {/* Student selector */}
            {uploadAudience === 'student' && (
              <>
                <Text style={[styles.modalLabel, { marginTop: 16 }]}>SELECIONAR ALUNO</Text>
                <View style={styles.studentList}>
                  {students.length === 0 ? (
                    <Text style={styles.noStudentsText}>Nenhum aluno ativo encontrado.</Text>
                  ) : (
                    students.map((s, idx) => (
                      <TouchableOpacity
                        key={s.id}
                        style={[
                          styles.studentOption,
                          idx < students.length - 1 && styles.studentOptionBorder,
                          uploadStudentId === s.id && { backgroundColor: `${primaryColor}10` },
                        ]}
                        onPress={() => setUploadStudentId(s.id)}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.studentAvatar, { backgroundColor: `${primaryColor}20` }]}>
                          <Text style={[styles.studentInitial, { color: primaryColor }]}>
                            {s.full_name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.studentName}>{s.full_name}</Text>
                        {uploadStudentId === s.id && (
                          <Ionicons name="checkmark-circle" size={20} color={primaryColor} />
                        )}
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              </>
            )}

            {/* Upload button */}
            <TouchableOpacity
              style={[styles.uploadActionBtn, { backgroundColor: primaryColor }, uploading && styles.btnDisabled]}
              onPress={handleUpload}
              disabled={uploading}
              activeOpacity={0.85}
            >
              {uploading ? (
                <ActivityIndicator color={lightText ? '#000' : '#fff'} />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={18} color={lightText ? '#000' : '#fff'} />
                  <Text style={[styles.uploadActionText, { color: lightText ? '#000' : '#fff' }]}>
                    Enviar arquivo
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Chip component ───────────────────────────────────────────────────────────
function Chip({ label, icon, active, primaryColor, onPress }: {
  label: string; icon?: any; active: boolean; primaryColor: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && { backgroundColor: primaryColor, borderColor: primaryColor }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {icon && (
        <Ionicons name={icon} size={12} color={active ? '#fff' : Colors.textSecondary} />
      )}
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 38, height: 38,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  uploadBtn: {
    width: 38, height: 38,
    borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 2,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  clearBtn: { padding: 4 },

  chipsScroll: { marginTop: 6, marginBottom: 2 },
  chipsContent: { paddingHorizontal: 16, gap: 6, paddingVertical: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    color: Colors.textSecondary,
  },

  listContent: { padding: 16, gap: 10 },
  emptyContainer: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  emptyText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // File card
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  fileIconBox: {
    width: 48, height: 48,
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  fileInfo: { flex: 1, gap: 3 },
  fileTitle: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  fileName: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  fileMeta: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  fileMetaText: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  fileRight: { alignItems: 'flex-end', gap: 8 },
  audienceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  audienceText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
  },
  deleteBtn: {
    width: 28, height: 28,
    alignItems: 'center', justifyContent: 'center',
  },

  // Modal
  modalSafe: { flex: 1, backgroundColor: Colors.bg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 52,
  },
  modalLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 10,
  },
  modalInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },

  filePicker: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  filePickerPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 8,
  },
  filePickerText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  filePickerHint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    opacity: 0.7,
  },
  filePickedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  filePickedName: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  filePickedSize: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  audienceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  audienceOption: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  audienceOptionText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.xs,
    textAlign: 'center',
  },

  studentList: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  studentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  studentOptionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  studentAvatar: {
    width: 34, height: 34,
    borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  studentInitial: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.sm,
  },
  studentName: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  noStudentsText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    padding: 16,
    textAlign: 'center',
  },

  uploadActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 24,
  },
  btnDisabled: { opacity: 0.6 },
  uploadActionText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.md,
  },
});
