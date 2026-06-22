import { useRef, useEffect } from 'react';
import {
  Modal, View, Image, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontFamily } from '@/theme/typography';
import { Colors } from '@/theme/colors';

const { width: W, height: H } = Dimensions.get('window');

export type MediaType = 'image' | 'video';

interface Props {
  visible: boolean;
  uri: string;
  type: MediaType;
  title?: string;
  onClose: () => void;
}

export function MediaViewerModal({ visible, uri, type, title, onClose }: Props) {
  const videoRef = useRef<Video>(null);
  const insets = useSafeAreaInsets();

  // Stop video when modal closes
  useEffect(() => {
    if (!visible && videoRef.current) {
      videoRef.current.stopAsync().catch(() => {});
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.overlay}>
        <StatusBar hidden />

        {/* Header */}
        <View style={[s.bar, { paddingTop: insets.top + 8 }]}>
          {title ? (
            <Text style={s.title} numberOfLines={1}>{title}</Text>
          ) : <View style={{ flex: 1 }} />}
          <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.8}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Media */}
        <View style={s.mediaArea}>
          {type === 'image' ? (
            <Image
              source={{ uri }}
              style={s.image}
              resizeMode="contain"
            />
          ) : (
            <Video
              ref={videoRef}
              source={{ uri }}
              style={s.video}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              shouldPlay
              isLooping={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.97)',
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  title: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
    color: '#fff',
    paddingRight: 12,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: W,
    height: H * 0.85,
  },
  video: {
    width: W,
    height: W * (9 / 16),
  },
});
