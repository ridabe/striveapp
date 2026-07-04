import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/theme/colors';
import { FontFamily, FontSize } from '@/theme/typography';

export interface TrainerNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  student_id: string | null;
  created_at: string;
}

interface Props {
  tenantId: string | null | undefined;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function TrainerNotificationBell({ tenantId }: Props) {
  const [notifications, setNotifications] = useState<TrainerNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  async function load() {
    if (!tenantId) return;
    const { data } = await supabase
      .from('trainer_notifications')
      .select('id, type, title, message, student_id, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    setNotifications((data ?? []) as TrainerNotification[]);
  }

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    load().finally(() => setLoading(false));

    // Nome único por execução do effect — evita conflito de canal duplicado.
    const channel = supabase
      .channel(`trainer-notifications:${tenantId}:${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trainer_notifications', filter: `tenant_id=eq.${tenantId}` },
        () => { void load(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  async function handleDismiss(id: string) {
    setDismissingId(id);
    const previous = notifications;
    setNotifications(prev => prev.filter(n => n.id !== id));
    const { error } = await supabase.from('trainer_notifications').delete().eq('id', id);
    if (error) setNotifications(previous);
    setDismissingId(null);
  }

  function handlePressItem(item: TrainerNotification) {
    setVisible(false);
    if (item.student_id) {
      router.push(`/(admin)/alunos/${item.student_id}` as any);
    }
  }

  return (
    <>
      <TouchableOpacity
        style={s.bellBtn}
        onPress={() => setVisible(true)}
        activeOpacity={0.75}
      >
        <Ionicons name="notifications-outline" size={20} color={Colors.textPrimary} />
        {notifications.length > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{notifications.length > 9 ? '9+' : notifications.length}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={s.panel} onPress={() => {}}>
            <View style={s.panelHeader}>
              <Text style={s.panelTitle}>Notificações</Text>
              <TouchableOpacity onPress={() => setVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 24 }} />
            ) : notifications.length === 0 ? (
              <Text style={s.empty}>Nenhuma notificação por aqui.</Text>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 360 }}
                ItemSeparatorComponent={() => <View style={s.separator} />}
                renderItem={({ item }) => (
                  <TouchableOpacity style={s.item} onPress={() => handlePressItem(item)} activeOpacity={0.8}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemTitle}>{item.title}</Text>
                      <Text style={s.itemMessage}>{item.message}</Text>
                      <Text style={s.itemDate}>{fmtDate(item.created_at)}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDismiss(item.id)}
                      disabled={dismissingId === item.id}
                      style={s.deleteBtn}
                      hitSlop={8}
                    >
                      <Ionicons name="close-circle-outline" size={18} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
              />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  bellBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: `${Colors.border}80` },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { fontFamily: FontFamily.bodyBold, fontSize: 10, color: '#000' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', paddingTop: 70, paddingHorizontal: 16, alignItems: 'flex-end' },
  panel: { width: '100%', maxWidth: 340, backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  panelTitle: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  empty: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', paddingVertical: 24, paddingHorizontal: 16 },

  separator: { height: 1, backgroundColor: Colors.border },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  itemTitle: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textPrimary },
  itemMessage: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  itemDate: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSecondary, opacity: 0.6, marginTop: 4 },
  deleteBtn: { padding: 2 },
});
