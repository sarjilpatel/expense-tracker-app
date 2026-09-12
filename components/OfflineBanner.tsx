import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/context/ThemeContext';
import { type } from '@/constants/tokens';

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      setOffline(state.isConnected === false);
    });
    return unsub;
  }, []);

  const { theme } = useTheme();
  if (!offline) return null;

  return (
    <View style={[styles.banner, { backgroundColor: theme.tint }]}>
      <Ionicons name="cloud-offline-outline" size={16} color={theme.tintText} />
      <Text style={[styles.text, { color: theme.tintText }]}>You&apos;re offline — changes will sync when reconnected</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  text: { flex: 1, ...type.label },
});
