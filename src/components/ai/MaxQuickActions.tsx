import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import type { MaxFeature } from '@/hooks/useMaxStream';
import { MAX_COLOR } from './MaxAvatar';

interface Action {
  feature: MaxFeature;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const ACTIONS: Action[] = [
  { feature: 'generate_plan',    label: 'Criar Treino',      icon: 'barbell-outline',       color: '#3B82F6' },
  { feature: 'analyze_progress', label: 'Analisar Progresso',icon: 'trending-up-outline',   color: '#8B5CF6' },
  { feature: 'suggest_load',     label: 'Sugerir Carga',     icon: 'fitness-outline',       color: '#10B981' },
  { feature: 'motivation',       label: 'Mensagem Motivacional', icon: 'heart-outline',     color: '#F43F5E' },
  { feature: 'chat',             label: 'Conversar com Max', icon: 'chatbubble-ellipses-outline', color: MAX_COLOR },
];

interface MaxQuickActionsProps {
  onSelect: (feature: MaxFeature) => void;
  activeFeature?: MaxFeature | null;
  disabled?: boolean;
}

export function MaxQuickActions({ onSelect, activeFeature, disabled }: MaxQuickActionsProps) {
  return (
    <View style={styles.container}>
      {ACTIONS.map((action) => {
        const isActive = activeFeature === action.feature;
        return (
          <TouchableOpacity
            key={action.feature}
            style={[
              styles.btn,
              isActive && { borderColor: action.color, backgroundColor: `${action.color}18` },
            ]}
            onPress={() => onSelect(action.feature)}
            disabled={disabled}
            activeOpacity={0.72}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${action.color}22` }]}>
              {isActive && disabled ? (
                <ActivityIndicator size="small" color={action.color} />
              ) : (
                <Ionicons name={action.icon} size={20} color={action.color} />
              )}
            </View>
            <Text style={styles.label} numberOfLines={2}>{action.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flex: 1,
    minWidth: '45%',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    flex: 1,
    lineHeight: 18,
  },
});
