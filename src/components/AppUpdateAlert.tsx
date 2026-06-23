import { useEffect, useState } from 'react'
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, BackHandler,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAppVersion } from '@/hooks/useAppVersion'
import { Colors } from '@/theme/colors'
import { FontFamily, FontSize } from '@/theme/typography'

export function AppUpdateAlert() {
  const { status, latestVersion, releaseNotes, openStore } = useAppVersion()
  const [dismissed, setDismissed] = useState(false)

  // Bloqueia botão voltar quando obrigatório
  useEffect(() => {
    if (status !== 'required') return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true)
    return () => sub.remove()
  }, [status])

  if (status === 'up-to-date') return null
  if (status === 'optional' && dismissed) return null

  const required = status === 'required'

  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent>
      <View style={s.backdrop}>
        <View style={s.card}>
          {/* Ícone */}
          <View style={[s.iconWrap, required && s.iconWrapRequired]}>
            <Ionicons
              name={required ? 'alert-circle' : 'arrow-up-circle'}
              size={36}
              color={required ? '#EF4444' : '#E8FF47'}
            />
          </View>

          {/* Título */}
          <Text style={s.title}>
            {required ? 'Atualização necessária' : 'Nova versão disponível'}
          </Text>

          {/* Versão */}
          {latestVersion && (
            <Text style={s.version}>Versão {latestVersion}</Text>
          )}

          {/* Descrição */}
          <Text style={s.desc}>
            {required
              ? 'Esta versão do app não é mais suportada. Atualize para continuar usando o Strive.'
              : 'Uma nova versão está disponível com melhorias e correções.'}
          </Text>

          {/* Novidades */}
          {releaseNotes && (
            <View style={s.notes}>
              <Text style={s.notesTitle}>Novidades</Text>
              <Text style={s.notesText}>{releaseNotes}</Text>
            </View>
          )}

          {/* Botões */}
          <TouchableOpacity style={s.updateBtn} onPress={openStore} activeOpacity={0.85}>
            <Ionicons name="logo-google-playstore" size={16} color="#000" />
            <Text style={s.updateBtnText}>Atualizar agora</Text>
          </TouchableOpacity>

          {!required && (
            <TouchableOpacity onPress={() => setDismissed(true)} style={s.laterBtn}>
              <Text style={s.laterBtnText}>Lembrar mais tarde</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    backgroundColor: Colors.surface, borderRadius: 24, padding: 28,
    width: '100%', maxWidth: 360, alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: '#E8FF4715', alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  iconWrapRequired: { backgroundColor: '#EF444415' },
  title: {
    fontFamily: FontFamily.bodyBold, fontSize: 18,
    color: Colors.textPrimary, textAlign: 'center',
  },
  version: {
    fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  desc: {
    fontFamily: FontFamily.body, fontSize: FontSize.sm,
    color: Colors.textSecondary, textAlign: 'center', lineHeight: 20,
  },
  notes: {
    backgroundColor: Colors.bg, borderRadius: 12, padding: 14,
    width: '100%', gap: 4,
  },
  notesTitle: {
    fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs,
    color: Colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase',
  },
  notesText: {
    fontFamily: FontFamily.body, fontSize: FontSize.sm,
    color: Colors.textPrimary, lineHeight: 20,
  },
  updateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#E8FF47', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 28, width: '100%', justifyContent: 'center',
    marginTop: 4,
  },
  updateBtnText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: '#000' },
  laterBtn: { paddingVertical: 8 },
  laterBtnText: {
    fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textSecondary,
  },
})
