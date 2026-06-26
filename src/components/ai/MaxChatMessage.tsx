import { Image, View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { MAX_COLOR } from './MaxAvatar';
import { MaxStreamingText } from './MaxStreamingText';

const SMALL_AVATAR = require('../../../assets/ai/max-avatar-small.png');

interface MaxChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export function MaxChatMessage({ role, content, isStreaming = false }: MaxChatMessageProps) {
  const isUser = role === 'user';

  return (
    <View style={[styles.row, isUser && styles.rowUser]}>
      {!isUser && (
        <View style={styles.avatarWrap}>
          <Image source={SMALL_AVATAR} style={styles.avatarImg} resizeMode="contain" />
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        {isStreaming ? (
          <MaxStreamingText text={content} style={styles.textAssistant} />
        ) : (
          <Text style={isUser ? styles.textUser : styles.textAssistant}>
            {content}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 12,
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  avatarWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: `${MAX_COLOR}15`,
    borderWidth: 1,
    borderColor: `${MAX_COLOR}28`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 2,
  },
  avatarImg: {
    width: 22,
    height: 22,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  bubbleUser: {
    backgroundColor: `${MAX_COLOR}33`,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 4,
  },
  textUser: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  textAssistant: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
});
