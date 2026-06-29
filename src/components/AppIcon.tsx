import { View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AppIconProps {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  color: string;
  containerSize?: number;
  containerRadius?: number;
  containerColor?: string;
  style?: ViewStyle;
}

export function AppIcon({
  name,
  size = 22,
  color,
  containerSize = 42,
  containerRadius = 12,
  containerColor,
  style,
}: AppIconProps) {
  return (
    <View
      style={[
        {
          width: containerSize,
          height: containerSize,
          borderRadius: containerRadius,
          backgroundColor: containerColor ?? `${color}18`,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Ionicons name={name} size={size} color={color} />
    </View>
  );
}
