import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

interface StriveLoaderProps {
  color: string;
  size?: number;
}

export function StriveLoader({ color, size = 36 }: StriveLoaderProps) {
  const anim0 = useRef(new Animated.Value(0.25)).current;
  const anim1 = useRef(new Animated.Value(0.25)).current;
  const anim2 = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const pulse = (anim: Animated.Value) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.25, duration: 280, useNativeDriver: true }),
          Animated.delay(280),
        ])
      );

    const a0 = Animated.sequence([Animated.delay(0),   pulse(anim0)]);
    const a1 = Animated.sequence([Animated.delay(190), pulse(anim1)]);
    const a2 = Animated.sequence([Animated.delay(380), pulse(anim2)]);

    a0.start(); a1.start(); a2.start();
    return () => { a0.stop(); a1.stop(); a2.stop(); };
  }, []);

  const barW = Math.max(4, Math.round(size * 0.18));
  const gap  = Math.round(barW * 0.75);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap }}>
      {([anim0, anim1, anim2] as Animated.Value[]).map((opacity, i) => (
        <Animated.View
          key={i}
          style={{
            width: barW,
            height: size,
            borderRadius: barW / 2,
            backgroundColor: color,
            opacity,
          }}
        />
      ))}
    </View>
  );
}
