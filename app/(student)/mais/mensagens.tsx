
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useStudent } from '@/hooks/useStudent';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';
import { useThemeStore } from '@/stores/themeStore';
import { StudentHeader } from '@/components/StudentHeader';

interface StudentMessage {
  id: string;
  title: string | null;
  message: string;
  created_at: string;
  read_at: string | null;
  message_type: string;
}

export default function StudentMessages() {
  const { selectedStudent } = useStudent();
  const { primaryColor } = useThemeStore();
  const [messages, setMessages] = useState<StudentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);

  // Carrega a caixa de entrada do aluno ordenando as mensagens mais recentes primeiro.
  const load = useCallback(async () => {
    if (!selectedStudent?.id) return;
    setLoading(true);

    const { data } = await supabase
      .from('student_messages')
      .select('*')
      .eq('student_id', selectedStudent.id)
      .order('created_at', { ascending: false });

    setMessages((data ?? []) as StudentMessage[]);
    setLoading(false);
  }, [selectedStudent?.id]);

  useEffect(() => { 
    load();
    if (!selectedStudent?.id) return;
    // Subscribe to real-time updates
    const channel = supabase
      .channel('student_messages_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'student_messages',
          filter: `student_id=eq.${selectedStudent.id}`,
        },
        (payload) => {
          setMessages(prev => [payload.new as StudentMessage, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'student_messages',
          filter: `student_id=eq.${selectedStudent.id}`,
        },
        (payload) => {
          setMessages(prev => prev.map(msg => 
            msg.id === payload.new.id ? (payload.new as StudentMessage) : msg
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, selectedStudent?.id]);

  // Marca a mensagem como lida ao abrir o card expandido.
  async function handlePressMessage(msgId: string) {
    // Toggle expansion
    setExpandedMessageId(expandedMessageId === msgId ? null : msgId);
    
    // Mark as read if not already read
    const msg = messages.find(m => m.id === msgId);
    if (msg && !msg.read_at) {
      try {
        await supabase
          .from('student_messages')
          .update({ read_at: new Date().toISOString() })
          .eq('id', msgId);

        // Update the local state to mark as read
        setMessages(prev => prev.map(m =>
          m.id === msgId ? { ...m, read_at: new Date().toISOString() } : m
        ));
      } catch (e) {
        console.error('Error marking message as read:', e);
      }
    }
  }

  // Remove uma mensagem específica da caixa do aluno.
  async function deleteMessage(msgId: string) {
    if (!selectedStudent?.id) return;

    try {
      const { error } = await supabase
        .from('student_messages')
        .delete()
        .eq('id', msgId)
        .eq('student_id', selectedStudent.id);

      if (error) throw error;

      setMessages((prev) => prev.filter((msg) => msg.id !== msgId));
      if (expandedMessageId === msgId) {
        setExpandedMessageId(null);
      }
    } catch (error: any) {
      Alert.alert('Erro', error?.message ?? 'Não foi possível apagar a mensagem.');
    }
  }

  // Executa limpeza em lote para evitar acúmulo de mensagens antigas na caixa.
  async function clearMessages(mode: 'read' | 'all') {
    if (!selectedStudent?.id) return;

    try {
      let query = supabase
        .from('student_messages')
        .delete()
        .eq('student_id', selectedStudent.id);

      if (mode === 'read') {
        query = query.not('read_at', 'is', null);
      }

      const { error } = await query;
      if (error) throw error;

      setMessages((prev) => mode === 'all' ? [] : prev.filter((msg) => !msg.read_at));
      setExpandedMessageId(null);
    } catch (error: any) {
      Alert.alert('Erro', error?.message ?? 'Não foi possível limpar as mensagens.');
    }
  }

  // Exibe as ações principais de organização da caixa do aluno.
  function openManageActions() {
    const hasReadMessages = messages.some((msg) => !!msg.read_at);

    Alert.alert(
      'Gerenciar mensagens',
      'Escolha como deseja organizar sua caixa de mensagens.',
      [
        { text: 'Cancelar', style: 'cancel' },
        ...(hasReadMessages
          ? [{ text: 'Limpar lidas', onPress: () => { void clearMessages('read'); } } as const]
          : []),
        { text: 'Apagar todas', style: 'destructive', onPress: () => { void clearMessages('all'); } },
      ]
    );
  }

  // Confirma a exclusão individual antes de remover a mensagem.
  function confirmDeleteMessage(msgId: string) {
    Alert.alert(
      'Apagar mensagem',
      'Deseja remover esta mensagem da sua caixa?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apagar', style: 'destructive', onPress: () => { void deleteMessage(msgId); } },
      ]
    );
  }

  function getIcon(type: string) {
    switch (type) {
      case 'load_suggestion': return 'barbell-outline';
      case 'motivation': return 'heart-outline';
      default: return 'chatbubble-outline';
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StudentHeader
        title="Mensagens"
        rightSlot={messages.length > 0 ? (
          <TouchableOpacity onPress={openManageActions} style={s.iconBtn}>
            <Ionicons name="trash-outline" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      />

      {loading ? (
        <ActivityIndicator color={primaryColor} style={{ marginTop: 40 }} />
      ) : messages.length === 0 ? (
        <View style={s.emptyState}>
          <Ionicons name="chatbubble-outline" size={64} color={Colors.border} />
          <Text style={s.emptyText}>Nenhuma mensagem</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll}>
          {messages.map((msg) => (
            <TouchableOpacity key={msg.id} style={[s.msgCard, !msg.read_at && s.unread]} activeOpacity={0.8} onPress={() => handlePressMessage(msg.id)}>
              <View style={s.msgIconWrap}>
                <Ionicons name={getIcon(msg.message_type)} size={20} color={msg.read_at ? Colors.textSecondary : primaryColor} />
              </View>
              <View style={s.msgContent}>
                <View style={s.msgHeader}>
                  <Text style={s.msgTitle} numberOfLines={1}>{msg.title ?? 'Mensagem'}</Text>
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                    <Text style={s.msgDate}>{formatDate(msg.created_at)}</Text>
                    <Ionicons 
                      name={expandedMessageId === msg.id ? 'chevron-up' : 'chevron-down'} 
                      size={16} 
                      color={Colors.textSecondary} 
                    />
                  </View>
                </View>
                <Text 
                  style={s.msgText} 
                  numberOfLines={expandedMessageId === msg.id ? undefined : 3}
                >
                  {msg.message}
                </Text>
                {expandedMessageId === msg.id && (
                  <View style={s.msgActions}>
                    <TouchableOpacity
                      style={s.deleteBtn}
                      onPress={() => confirmDeleteMessage(msg.id)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="trash-outline" size={14} color="#EF4444" />
                      <Text style={s.deleteBtnText}>Apagar mensagem</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              {!msg.read_at && <View style={s.unreadDot} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  scroll: { padding: 16, gap: 12 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 60 },
  emptyText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary },

  msgCard: {
    backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    padding: 14, flexDirection: 'row', gap: 12,
  },
  unread: { borderColor: '#22C55E', backgroundColor: 'rgba(34, 197, 94, 0.05)' },
  msgIconWrap: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(124,58,237,0.12)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  msgContent: { flex: 1, gap: 4 },
  msgHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  msgTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  msgDate: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary },
  msgText: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  msgActions: { marginTop: 8, flexDirection: 'row' },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  deleteBtnText: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.xs, color: '#EF4444' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', marginTop: 8 },
});
