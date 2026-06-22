import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/typography';

interface StriveLogoProps {
  iconSize?: number;
  showText?: boolean;
  textAlign?: 'center' | 'left';
}

export function StriveLogo({ iconSize = 72, showText = true, textAlign = 'center' }: StriveLogoProps) {
  const barWidth = Math.round(iconSize * 0.15);
  const gap = Math.round(iconSize * 0.07);
  const borderRadius = Math.round(iconSize * 0.22);
  const borderWidth = Math.round(iconSize * 0.04);
  const padding = Math.round(iconSize * 0.18);

  return (
    <View style={[styles.wrapper, { alignItems: textAlign === 'center' ? 'center' : 'flex-start' }]}>
      <View style={[
        styles.hexContainer,
        {
          width: iconSize,
          height: iconSize,
          borderRadius,
          borderWidth,
          padding,
        }
      ]}>
        <View style={[styles.barsRow, { gap }]}>
          <View style={[styles.bar, { width: barWidth, height: '42%' }]} />
          <View style={[styles.bar, { width: barWidth, height: '68%' }]} />
          <View style={[styles.bar, { width: barWidth, height: '100%' }]} />
        </View>
      </View>

      {showText && (
        <View style={[styles.textBlock, { alignItems: textAlign === 'center' ? 'center' : 'flex-start' }]}>
          <Text style={[styles.title, { fontSize: Math.round(iconSize * 0.44) }]}>STRIVE</Text>
          <Text style={[styles.subtitle, { fontSize: Math.round(iconSize * 0.17), letterSpacing: Math.round(iconSize * 0.06) }]}>
            PERSONAL
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  hexContainer: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(232, 255, 71, 0.08)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    width: '100%',
    height: '100%',
  },
  bar: {
    backgroundColor: Colors.primary,
    borderRadius: 2,
    flex: 1,
  },
  textBlock: {
    marginTop: 14,
  },
  title: {
    fontFamily: FontFamily.display,
    color: Colors.textPrimary,
    lineHeight: undefined,
  },
  subtitle: {
    fontFamily: FontFamily.bodyBold,
    color: Colors.primary,
    marginTop: 2,
  },
});
