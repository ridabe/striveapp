import { useEffect, useRef } from 'react';
import { Text, Animated, StyleSheet, TextStyle } from 'react-native';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

interface MaxStreamingTextProps {
  text: string;
  style?: TextStyle;
}

export function MaxStreamingText({ text, style }: MaxStreamingTextProps) {
  const cursorOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(cursorOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    blink.start();
    return () => blink.stop();
  }, []);

  // Remove plan_id line from displayed text
  const displayText = text.replace(/\nplan_id:[a-f0-9-]{36}/g, '').trimEnd();

  return (
    <Text style={[styles.text, style]}>
      {displayText}
      <Animated.Text style={[styles.cursor, { opacity: cursorOpacity }]}>▌</Animated.Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  cursor: {
    color: '#7C3AED',
    fontSize: 14,
  },
});
