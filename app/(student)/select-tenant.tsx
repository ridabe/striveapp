import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useStudent } from '@/hooks/useStudent'
import { useThemeStore } from '@/stores/themeStore'
import { Colors } from '@/theme/colors'
import { FontFamily, FontSize } from '@/theme/typography'

export default function SelectTenantScreen() {
  const { allStudents, loading, setSelectedStudent } = useStudent()
  const { setTenant, setPrimaryColor } = useThemeStore()

  const handleSelect = async (student: any) => {
    setSelectedStudent(student)
    // Load tenant config
    const tenant = student.tenants
    if (tenant) {
      const displayName = tenant.business_name ?? 'Strive Personal'
      const displayApp = tenant.app_name ?? displayName
      setTenant(displayName, displayApp, tenant.logo_url ?? null, (tenant as any).cref ?? null)
      if (tenant.primary_color) setPrimaryColor(tenant.primary_color)
    }
    // Navigate to home
    router.replace('/(student)')
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
        <Text style={styles.title}>Selecione seu Personal/Estúdio</Text>
        <Text style={styles.subtitle}>Escolha qual conta acessar</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {allStudents.map((student: any) => (
          <TouchableOpacity
            key={student.id}
            style={styles.card}
            onPress={() => handleSelect(student)}
            activeOpacity={0.8}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="people" size={28} color={Colors.primary} />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.studioName}>{student.tenants?.business_name ?? 'Studio'}</Text>
              <Text style={styles.studentName}>{student.full_name}</Text>
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
    fontSize: FontSize.xxl,
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
  studentName: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
})
