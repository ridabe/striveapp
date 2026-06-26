import { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/typography';

export const MAX_COLOR = '#7C3AED';

type Variant = 'default' | 'thinking' | 'happy';

interface MaxAvatarProps {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: { container: 40, icon: 18, text: 14 },
  md: { container: 56, icon: 24, text: 20 },
  lg: { container: 80, icon: 36, text: 28 },
};

export function MaxAvatar({ variant = 'default', size = 'md' }: MaxAvatarProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (variant === 'thinking') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.6, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [variant]);

  const dim = SIZES[size];
  const borderRadius = dim.container * 0.3;

  const iconName =
    variant === 'thinking' ? 'sync-outline' :
    variant === 'happy'    ? 'checkmark-circle-outline' :
                             'flash-outline';

  const iconColor =
    variant === 'happy' ? Colors.success :
                          '#FFFFFF';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: dim.container,
          height: dim.container,
          borderRadius,
          opacity: pulseAnim,
        },
      ]}
    >
      <View style={[styles.inner, { borderRadius: borderRadius - 2 }]}>
        <Ionicons name={iconName} size={dim.icon} color={iconColor} />
        <Text style={[styles.label, { fontSize: dim.text - 10 }]}>MAX</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: MAX_COLOR,
    padding: 2,
  },
  inner: {
    flex: 1,
    backgroundColor: `${MAX_COLOR}CC`,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  label: {
    fontFamily: FontFamily.bodyBold,
    color: '#FFFFFF',
    letterSpacing: 1,
    lineHeight: 10,
  },
});
