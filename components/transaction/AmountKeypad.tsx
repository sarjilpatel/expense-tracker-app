import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Pressable,
  StyleSheet,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface Props {
  visible: boolean;
  value: string;
  onClose: () => void;
  onDone: () => void;
  onChange: (v: string) => void;
  accentColor: string;
  theme: any;
}

export function AmountKeypad({ visible, value, onClose, onDone, onChange, accentColor, theme }: Props) {
  const [mounted, setMounted] = useState(false);
  const slide = useSharedValue(600);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slide.value }],
    opacity: 1 - slide.value / 600,
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: 1 - slide.value / 600,
  }));

  useEffect(() => {
    if (visible) {
      setMounted(true);
      slide.value = 600;
      slide.value = withTiming(0, { duration: 120, easing: Easing.out(Easing.cubic) });
    } else {
      slide.value = withTiming(600, { duration: 100, easing: Easing.in(Easing.cubic) }, (finished) => {
        'worklet';
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [visible]);

  const press = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (key === '⌫') { onChange(value.slice(0, -1)); return; }
    if (key === '.' && value.includes('.')) return;
    if (value === '0' && key !== '.') { onChange(key); return; }
    const dotIdx = value.indexOf('.');
    if (dotIdx !== -1 && value.length - dotIdx > 2) return;
    onChange(value + key);
  };

  const keys: (string | null)[][] = [
    ['1', '2', '3', '⌫'],
    ['4', '5', '6', null],
    ['7', '8', '9', 'calc'],
    [null, '0', '.', 'done'],
  ];

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.container}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} pointerEvents="none" />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={sheetStyle}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.card }]} onPress={e => e.stopPropagation()}>

            <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />

            <View style={[styles.header, { borderBottomColor: theme.border }]}>
              <Text style={[styles.title, { color: theme.text }]}>Amount</Text>
              <View style={styles.headerRight}>
                <Ionicons name="globe-outline" size={20} color={theme.secondaryText} style={{ marginRight: 16 }} />
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={22} color={theme.secondaryText} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.keypadBg}>
              {keys.map((row, rowIdx) => (
                <View key={rowIdx} style={styles.row}>
                  {row.map((key, colIdx) => {
                    if (key === null) return <View key={colIdx} style={styles.emptyKey} />;
                    if (key === 'done') return (
                      <TouchableOpacity key={colIdx} style={[styles.doneKey, { backgroundColor: accentColor }]} onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onDone(); }} activeOpacity={0.8}>
                        <Text style={styles.doneText}>Done</Text>
                      </TouchableOpacity>
                    );
                    if (key === 'calc') return (
                      <TouchableOpacity key={colIdx} style={[styles.key, { borderColor: theme.border }]} activeOpacity={0.6}>
                        <Ionicons name="calculator-outline" size={22} color={theme.secondaryText} />
                      </TouchableOpacity>
                    );
                    if (key === '⌫') return (
                      <TouchableOpacity key={colIdx} style={[styles.key, { borderColor: theme.border }]} onPress={() => press(key)} activeOpacity={0.6}>
                        <Ionicons name="backspace-outline" size={22} color={theme.text} />
                      </TouchableOpacity>
                    );
                    return (
                      <TouchableOpacity key={colIdx} style={[styles.key, { borderColor: theme.border }]} onPress={() => press(key)} activeOpacity={0.6}>
                        <Text style={[styles.keyText, { color: theme.text }]}>{key}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const KEY_HEIGHT = 58;

const styles = StyleSheet.create({
  container:  { flex: 1, justifyContent: 'flex-end' },
  backdrop:   { backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:      { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24 },
  dragHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 8, opacity: 0.5 },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  title:      { fontSize: 16, fontWeight: '700' },
  headerRight:{ flexDirection: 'row', alignItems: 'center' },
  keypadBg:   { paddingHorizontal: 8 },
  row:        { flexDirection: 'row', gap: 6, marginBottom: 6 },
  key:        { flex: 1, height: KEY_HEIGHT, justifyContent: 'center', alignItems: 'center', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  keyText:    { fontSize: 22, fontWeight: '500' },
  emptyKey:   { flex: 1, height: KEY_HEIGHT },
  doneKey:    { flex: 1, height: KEY_HEIGHT, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  doneText:   { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
