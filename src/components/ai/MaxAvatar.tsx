import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet } from 'react-native';

export const MAX_COLOR = '#7C3AED';

type Variant = 'default' | 'thinking' | 'happy';

interface MaxAvatarProps {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: { container: 40, image: 32, borderRadius: 12 },
  md: { container: 56, image: 46, borderRadius: 16 },
  lg: { container: 80, image: 68, borderRadius: 22 },
};

const IMAGES = {
  default:  require('../../../assets/ai/max-avatar.png'),
  thinking: require('../../../assets/ai/max-avatar-thinking.png'),
  happy:    require('../../../assets/ai/max-avatar-happy.png'),
  small:    require('../../../assets/ai/max-avatar-small.png'),
};

export function MaxAvatar({ variant = 'default', size = 'md' }: MaxAvatarProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (variant === 'thinking') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.65, duration: 650, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 650, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }

    pulseAnim.setValue(1);

    if (variant === 'happy') {
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.14, useNativeDriver: true, friction: 4, tension: 120 }),
        Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, friction: 6, tension: 80 }),
      ]).start();
    } else {
      scaleAnim.setValue(1);
    }
  }, [variant]);

  const dim = SIZES[size];
  const source = size === 'sm' ? IMAGES.small : IMAGES[variant];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: dim.container,
          height: dim.container,
          borderRadius: dim.borderRadius,
          opacity: pulseAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Image
        source={source}
        style={{ width: dim.image, height: dim.image }}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: `${MAX_COLOR}15`,
    borderWidth: 1,
    borderColor: `${MAX_COLOR}28`,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
