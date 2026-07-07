import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useActiveOrg, type ActiveOrgOption } from '@/hooks/useActiveOrg'
import { Colors } from '@/theme/colors'
import { FontFamily, FontSize } from '@/theme/typography'

const ROLE_LABEL: Record<string, string> = {
  owner: 'Dono(a)',
  admin: 'Admin',
  personal: 'Personal',
}

export default function SelectOrganizationScreen() {
  const { activeOrgs, loading, selectOrg } = useActiveOrg()
  const [switching, setSwitching] = useState<string | null>(null)

  const handleSelect = async (org: ActiveOrgOption) => {
    setSwitching(org.tenantId)
    const result = await selectOrg(org.tenantId)
    setSwitching(null)

    if (result.error) {
      Alert.alert('Não foi possível trocar', result.error)
      return
    }

    router.replace('/(admin)')
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Escolha sua organização</Text>
        <Text style={styles.subtitle}>Você tem acesso a mais de uma organização. Escolha qual acessar agora.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeOrgs.map((org) => (
          <TouchableOpacity
            key={org.tenantId}
            style={styles.card}
            onPress={() => handleSelect(org)}
            disabled={!!switching}
            activeOpacity={0.8}
          >
            <View style={styles.iconContainer}>
              {switching === org.tenantId ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Ionicons name="business" size={26} color={Colors.primary} />
              )}
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.studioName}>{org.businessName}</Text>
              <Text style={styles.roleLabel}>{ROLE_LABEL[org.role] ?? org.role}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingHorizontal: 20,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginTop: 40,
    marginBottom: 30,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['2xl'],
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: `${Colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  studioName: {
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  roleLabel: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
})
