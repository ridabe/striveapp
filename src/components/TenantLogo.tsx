import { Image, View, Text, StyleSheet } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { FontFamily } from '@/theme/typography';

interface TenantLogoProps {
  size?: number;
  radius?: number;
}

export function TenantLogo({ size = 44, radius }: TenantLogoProps) {
  const { tenantLogoUrl, tenantName, primaryColor } = useThemeStore();
  const br = radius ?? Math.round(size * 0.2);
  const fontSize = Math.round(size * 0.38);

  if (tenantLogoUrl) {
    return (
      <Image
        source={{ uri: tenantLogoUrl }}
        style={[styles.image, { width: size, height: size, borderRadius: br }]}
        resizeMode="contain"
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: br, backgroundColor: primaryColor },
      ]}
    >
      <Text style={[styles.initial, { fontSize, color: '#000' }]}>
        {tenantName.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: 'transparent',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontFamily: FontFamily.display,
  },
});
