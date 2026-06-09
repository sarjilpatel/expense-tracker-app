import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList,
  StyleSheet, Pressable,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CURRENCY_META, CurrencyCode } from '@/src/services/preferencesService';
import { useTheme } from '@/src/context/ThemeContext';

const CURRENCIES = Object.entries(CURRENCY_META) as [CurrencyCode, { symbol: string; name: string; locale: string }][];

interface Props {
  value: CurrencyCode;
  onChange: (code: CurrencyCode) => void;
  visible?: boolean;
  onClose?: () => void;
}

export function CurrencyPicker({ value, onChange, visible: externalVisible, onClose }: Props) {
  const { theme } = useTheme();
  const [internalOpen, setInternalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const slide = useSharedValue(600);
  const meta  = CURRENCY_META[value];

  const isControlled = externalVisible !== undefined;
  const isOpen = isControlled ? externalVisible! : internalOpen;
  const close  = onClose ?? (() => setInternalOpen(false));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slide.value }],
    opacity: 1 - slide.value / 600,
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: 1 - slide.value / 600,
  }));

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      slide.value = 600;
      slide.value = withTiming(0, { duration: 120, easing: Easing.out(Easing.cubic) });
    } else {
      slide.value = withTiming(600, { duration: 100, easing: Easing.in(Easing.cubic) }, (finished) => {
        'worklet';
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [isOpen]);

  const handleSelect = (code: CurrencyCode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(code);
    close();
  };

  return (
    <>
      {!isControlled && (
        <TouchableOpacity
          style={[styles.trigger, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => setInternalOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.symbol, { color: theme.tint }]}>{meta.symbol}</Text>
          <Text style={[styles.code, { color: theme.text }]}>{value}</Text>
          <Ionicons name="chevron-down" size={14} color={theme.secondaryText} />
        </TouchableOpacity>
      )}

      <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={close}>
        <View style={styles.container}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} pointerEvents="none" />
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          <Animated.View style={sheetStyle}>
            <Pressable style={[styles.sheet, { backgroundColor: theme.card }]} onPress={e => e.stopPropagation()}>

              <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />

              <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>Select Currency</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={close}>
                  <Ionicons name="close" size={20} color={theme.secondaryText} />
                </TouchableOpacity>
              </View>

              <FlatList
                data={CURRENCIES}
                keyExtractor={([code]) => code}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.list}
                renderItem={({ item: [code, info] }) => {
                  const sel = code === value;
                  return (
                    <TouchableOpacity
                      style={[styles.item, { borderBottomColor: theme.border }, sel && { backgroundColor: theme.tint + '12' }]}
                      onPress={() => handleSelect(code)}
                      activeOpacity={0.65}
                    >
                      <Text style={[styles.itemSymbol, { color: theme.tint }]}>{info.symbol}</Text>
                      <View style={styles.itemMid}>
                        <Text style={[styles.itemCode, { color: theme.text }]}>{code}</Text>
                        <Text style={[styles.itemName, { color: theme.secondaryText }]}>{info.name}</Text>
                      </View>
                      {sel && <Ionicons name="checkmark-circle" size={20} color={theme.tint} />}
                    </TouchableOpacity>
                  );
                }}
              />
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignSelf: 'flex-start' },
  symbol:    { fontSize: 18, fontWeight: '700' },
  code:      { fontSize: 14, fontWeight: '600' },

  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop:  { backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:     { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24 },
  dragHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 8, opacity: 0.5 },

  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  sheetTitle:  { fontSize: 16, fontWeight: '700', flex: 1 },
  closeBtn:    { padding: 6 },
  list:        { paddingBottom: 16 },
  item:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  itemSymbol:  { fontSize: 20, width: 32, textAlign: 'center', fontWeight: '700' },
  itemMid:     { flex: 1 },
  itemCode:    { fontSize: 15, fontWeight: '600' },
  itemName:    { fontSize: 12, marginTop: 1 },
});
