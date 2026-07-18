import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { useThemeStore } from '@/stores/themeStore';
import { MaxAvatar, MAX_COLOR } from '@/components/ai/MaxAvatar';
import type { GuideContent } from '@/lib/guides';

interface Props {
  visible: boolean;
  content: GuideContent;
  onClose: () => void;
  onDismissForever: () => void;
}

/**
 * Popup de instruções genérico e reutilizável, em tela cheia (mesmo padrão de
 * ExercisePickerModal.tsx: SafeAreaView flex:1 > header fixo > ScrollView
 * flex:1 > rodapé fixo). Evita a ambiguidade de card centralizado com
 * maxHeight em % + flex-shrink aninhado, que não rolava de forma confiável.
 *
 * Para usar em outra tela: adicione um novo conteúdo em src/lib/guides.ts e
 * renderize este componente controlado por useGuide('sua_chave', userId).
 */
export function GuideModal({ visible, content, onClose, onDismissForever }: Props) {
  const { primaryColor, primaryTextColor } = useThemeStore();
  const accent = primaryColor || Colors.primary;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.iconBtn}>
            <Ionicons name="close" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle} numberOfLines={1}>Guia do Max</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator>
          <View style={s.presenterRow}>
            <MaxAvatar variant="happy" size="md" />
            <View style={{ flex: 1 }}>
              <View style={[s.badge, { backgroundColor: `${MAX_COLOR}18`, borderColor: `${MAX_COLOR}30` }]}>
                <Ionicons name="sparkles" size={9} color={MAX_COLOR} />
                <Text style={[s.badgeText, { color: MAX_COLOR }]}>GUIA DO MAX</Text>
              </View>
              <Text style={s.title}>{content.title}</Text>
            </View>
          </View>

          {!!content.intro && <Text style={s.intro}>{content.intro}</Text>}

          {content.sections.map((section, i) => (
            <View key={i} style={[s.sectionBox, { borderColor: `${accent}22` }]}>
              <View style={s.sectionHeader}>
                <View style={[s.sectionIcon, { backgroundColor: `${accent}18` }]}>
                  <Ionicons name={section.icon as any} size={15} color={accent} />
                </View>
                <Text style={s.sectionTitle}>{section.title}</Text>
              </View>
              <Text style={s.sectionBody}>{section.body}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={s.actions}>
          <TouchableOpacity style={s.btnNever} onPress={onDismissForever} activeOpacity={0.75}>
            <Ionicons name="eye-off-outline" size={13} color={Colors.textSecondary} />
            <Text style={s.btnNeverText}>Não mostrar mais</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btnOk, { backgroundColor: accent }]} onPress={onClose} activeOpacity={0.85}>
            <Text style={[s.btnOkText, { color: primaryTextColor }]}>Entendi</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
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
  headerTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary },
  scroll: { flex: 1 },
  scrollContent: { padding: 18, paddingBottom: 32, gap: 10 },
  presenterRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 4 },
  badge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4,
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6,
  },
  badgeText: { fontFamily: FontFamily.bodyBold, fontSize: 9, letterSpacing: 1.2 },
  title: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textPrimary, lineHeight: 22 },
  intro: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: 4 },
  sectionBox: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, padding: 12, gap: 6 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },
  sectionBody: { fontFamily: FontFamily.body, fontSize: 12.5, color: Colors.textSecondary, lineHeight: 19 },
  actions: {
    flexDirection: 'row', gap: 10, padding: 12,
    borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bg,
  },
  btnNever: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 12, paddingHorizontal: 6, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
  },
  btnNeverText: { fontFamily: FontFamily.bodyMedium, fontSize: 11, color: Colors.textSecondary, textAlign: 'center' },
  btnOk: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12 },
  btnOkText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm },
});
