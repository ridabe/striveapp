import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { MAX_COLOR } from './MaxAvatar';
import { MaxStreamingText } from './MaxStreamingText';

interface MaxChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export function MaxChatMessage({ role, content, isStreaming = false }: MaxChatMessageProps) {
  const isUser = role === 'user';

  return (
    <View style={[styles.row, isUser && styles.rowUser]}>
      {!isUser && <View style={styles.assistantDot} />}
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
  assistantDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: MAX_COLOR,
    marginBottom: 6,
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
