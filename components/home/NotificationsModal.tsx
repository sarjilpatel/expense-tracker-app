import React from 'react';
import { View, Modal, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';

export interface Notification {
  id: string;
  type: 'income' | 'expense';
  title: string;
  message: string;
  time: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  notifications: Notification[];
  theme: any;
}

export function NotificationsModal({ visible, onClose, notifications, theme }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={styles.overlay}>
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.card }]}
        />
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <Animated.View entering={FadeInDown} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderBottomWidth: 0 }]}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Notifications</ThemedText>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={theme.text} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {notifications.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="notifications-off-outline" size={52} color={theme.secondaryText} />
                <ThemedText style={styles.emptyText}>Everything caught up!</ThemedText>
              </View>
            ) : (
              notifications.map(notif => (
                <TouchableOpacity key={notif.id} style={[styles.item, { borderBottomColor: theme.border }]}>
                  <View style={[styles.iconWrap, {
                    backgroundColor: theme.tint,
                  }]}>
                    <Ionicons
                      name={notif.type === 'income' ? 'arrow-down' : 'arrow-up'}
                      size={16}
                      color="#FFF"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="defaultSemiBold" style={styles.title}>{notif.title}</ThemedText>
                    <ThemedText style={styles.message}>{notif.message}</ThemedText>
                    <ThemedText style={styles.time}>{notif.time}</ThemedText>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  card: {
    height: '72%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 22,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  closeBtn: {
    padding: 4,
  },
  empty: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 90,
  },
  emptyText: {
    marginTop: 14,
    fontSize: 13,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 13,
  },
  message: {
    fontSize: 12,
    marginTop: 2,
  },
  time: {
    fontSize: 10,
    marginTop: 3,
    fontWeight: '600',
  },
});
