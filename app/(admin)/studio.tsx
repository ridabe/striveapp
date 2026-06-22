import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { TenantLogo } from '@/components/TenantLogo';

const PRESET_COLORS = [
  '#06B6D4', '#E8FF47', '#F59E0B', '#EF4444',
  '#8B5CF6', '#10B981', '#F97316', '#3B82F6',
  '#EC4899', '#14B8A6', '#6366F1', '#84CC16',
  '#FFFFFF', '#A1A1AA', '#71717A', '#374151',
];

function isValidHex(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

export default function StudioScreen() {
  const { profile } = useAuthStore();
  const { tenantName, tenantLogoUrl, primaryColor, setTenant, setPrimaryColor } = useThemeStore();

  const tenantId = profile?.tenant_id;

  const [businessName, setBusinessName] = useState('');
  const [appName, setAppName] = useState('');
  const [selectedColor, setSelectedColor] = useState(primaryColor);
  const [hexInput, setHexInput] = useState(primaryColor);
  const [pendingLogoUri, setPendingLogoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from('tenants')
      .select('business_name, app_name, primary_color')
      .eq('id', tenantId)
      .single()
      .then(({ data }) => {
        if (data) {
          setBusinessName(data.business_name ?? '');
          setAppName(data.app_name ?? '');
          setSelectedColor(data.primary_color ?? primaryColor);
          setHexInput(data.primary_color ?? primaryColor);
        }
      });
  }, [tenantId]);

  function handleHexChange(val: string) {
    setHexInput(val);
    if (isValidHex(val)) setSelectedColor(val);
  }

  function handleColorPress(color: string) {
    setSelectedColor(color);
    setHexInput(color);
  }

  async function pickLogo() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria para alterar o logo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPendingLogoUri(result.assets[0].uri);
    }
  }

  async function uploadLogo(uri: string): Promise<string | null> {
    setUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const fileName = `${tenantId}/logo.png`;

      const { error } = await supabase.storage
        .from('client-logos')
        .upload(fileName, blob, { contentType: 'image/png', upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('client-logos')
        .getPublicUrl(fileName);

      return `${urlData.publicUrl}?v=${Date.now()}`;
    } catch (err: any) {
      Alert.alert('Erro', `Falha ao enviar o logo: ${err.message}`);
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!tenantId) return;
    if (!businessName.trim()) {
      Alert.alert('Atenção', 'O nome do studio não pode estar em branco.');
      return;
    }

    setSaving(true);
    try {
      let logoUrl = tenantLogoUrl;

      if (pendingLogoUri) {
        logoUrl = await uploadLogo(pendingLogoUri);
        if (!logoUrl) { setSaving(false); return; }
      }

      const finalColor = isValidHex(selectedColor) ? selectedColor : primaryColor;
      const finalAppName = appName.trim() || null;
      const finalBusinessName = businessName.trim();

      const { error } = await supabase
        .from('tenants')
        .update({
          business_name: finalBusinessName,
          app_name: finalAppName,
          primary_color: finalColor,
          logo_url: logoUrl,
        })
        .eq('id', tenantId);

      if (error) throw error;

      // Atualiza store local imediatamente (realtime também dispara)
      setTenant(finalBusinessName, finalAppName ?? finalBusinessName, logoUrl);
      setPrimaryColor(finalColor);
      setPendingLogoUri(null);

      Alert.alert('Salvo!', 'As configurações do studio foram atualizadas.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Erro', err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Identidade Visual</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <Text style={styles.sectionLabel}>LOGO DO STUDIO</Text>
        <View style={styles.logoSection}>
          <View style={styles.logoPreview}>
            {pendingLogoUri ? (
              <Image source={{ uri: pendingLogoUri }} style={styles.logoImage} resizeMode="contain" />
            ) : (
              <TenantLogo size={80} radius={16} />
            )}
          </View>
          <View style={styles.logoActions}>
            <Text style={styles.logoHint}>
              Formato PNG ou JPG recomendado.{'\n'}Proporção quadrada (1:1) para melhor resultado.
            </Text>
            <TouchableOpacity style={[styles.logoBtn, { borderColor: selectedColor }]} onPress={pickLogo}>
              <Ionicons name="cloud-upload-outline" size={16} color={selectedColor} />
              <Text style={[styles.logoBtnText, { color: selectedColor }]}>
                {pendingLogoUri ? 'Trocar imagem' : 'Enviar logo'}
              </Text>
            </TouchableOpacity>
            {pendingLogoUri && (
              <TouchableOpacity onPress={() => setPendingLogoUri(null)} style={styles.removeBtn}>
                <Text style={styles.removeBtnText}>Cancelar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Studio name */}
        <Text style={styles.sectionLabel}>NOME DO STUDIO</Text>
        <TextInput
          value={businessName}
          onChangeText={setBusinessName}
          placeholder="Nome do seu studio"
          placeholderTextColor={Colors.textSecondary}
          style={styles.input}
        />

        <Text style={styles.fieldHint}>Nome exibido no app e relatórios</Text>

        <TextInput
          value={appName}
          onChangeText={setAppName}
          placeholder={businessName || 'Nome exibido no app (opcional)'}
          placeholderTextColor={Colors.textSecondary}
          style={[styles.input, { marginTop: 10 }]}
        />
        <Text style={styles.fieldHint}>Nome alternativo para exibição (deixe em branco para usar o nome do studio)</Text>

        {/* Color picker */}
        <Text style={[styles.sectionLabel, { marginTop: 28 }]}>COR PRIMÁRIA</Text>

        <View style={styles.colorGrid}>
          {PRESET_COLORS.map(color => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorSwatch,
                { backgroundColor: color },
                selectedColor === color && styles.colorSwatchSelected,
              ]}
              onPress={() => handleColorPress(color)}
              activeOpacity={0.8}
            >
              {selectedColor === color && (
                <Ionicons
                  name="checkmark"
                  size={16}
                  color={color === '#FFFFFF' || color === '#E8FF47' || color === '#84CC16' ? '#000' : '#fff'}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.hexRow}>
          <View style={[styles.hexPreview, { backgroundColor: isValidHex(hexInput) ? hexInput : Colors.border }]} />
          <TextInput
            value={hexInput}
            onChangeText={handleHexChange}
            placeholder="#000000"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="characters"
            maxLength={7}
            style={[styles.hexInput, !isValidHex(hexInput) && hexInput.length > 1 && styles.hexInputError]}
          />
          <Text style={styles.hexLabel}>Cor personalizada (hex)</Text>
        </View>

        {/* Preview */}
        <Text style={[styles.sectionLabel, { marginTop: 28 }]}>PRÉVIA</Text>
        <View style={styles.preview}>
          <View style={[styles.previewBtn, { backgroundColor: selectedColor }]}>
            <Text style={[styles.previewBtnText, {
              color: ['#FFFFFF', '#E8FF47', '#84CC16', '#F59E0B'].includes(selectedColor) ? '#000' : '#fff'
            }]}>
              Botão de ação
            </Text>
          </View>
          <View style={styles.previewTab}>
            <Ionicons name="home" size={20} color={selectedColor} />
            <Text style={[styles.previewTabText, { color: selectedColor }]}>Ativo</Text>
          </View>
          <View style={styles.previewTab}>
            <Ionicons name="people" size={20} color={Colors.textSecondary} />
            <Text style={[styles.previewTabText, { color: Colors.textSecondary }]}>Inativo</Text>
          </View>
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: selectedColor }, (saving || uploading) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving || uploading}
          activeOpacity={0.85}
        >
          {saving || uploading ? (
            <ActivityIndicator color={Colors.bg} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={18}
                color={['#FFFFFF', '#E8FF47', '#84CC16'].includes(selectedColor) ? '#000' : '#fff'}
              />
              <Text style={[styles.saveBtnText, {
                color: ['#FFFFFF', '#E8FF47', '#84CC16'].includes(selectedColor) ? '#000' : '#fff'
              }]}>
                Salvar configurações
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

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
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
  },
  sectionLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 12,
  },
  logoSection: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  logoPreview: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  logoActions: {
    flex: 1,
    gap: 8,
  },
  logoHint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  logoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  logoBtnText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.sm,
  },
  removeBtn: { paddingVertical: 4 },
  removeBtnText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: FontFamily.body,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  fieldHint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 5,
    marginLeft: 2,
    marginBottom: 4,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  colorSwatch: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: Colors.textPrimary,
    transform: [{ scale: 1.12 }],
  },
  hexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  hexPreview: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hexInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    width: 100,
  },
  hexInputError: {
    borderColor: Colors.error,
  },
  hexLabel: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    flex: 1,
  },
  preview: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 28,
  },
  previewBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  previewBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.sm,
  },
  previewTab: {
    alignItems: 'center',
    gap: 3,
  },
  previewTabText: {
    fontFamily: FontFamily.body,
    fontSize: 10,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 16,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.md,
  },
});
