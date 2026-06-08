import React from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  const press = (key: string) => {
    if (key === '⌫') {
      onChange(value.slice(0, -1));
      return;
    }
    // Prevent multiple dots
    if (key === '.' && value.includes('.')) return;
    // Prevent leading zero before digits (except "0.")
    if (value === '0' && key !== '.') {
      onChange(key);
      return;
    }
    // Limit to 2 decimal places
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
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.card }]} onPress={e => e.stopPropagation()}>
          {/* Keypad title row */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.text }]}>Amount</Text>
            <View style={styles.headerRight}>
              <Ionicons name="globe-outline" size={20} color={theme.secondaryText} style={{ marginRight: 16 }} />
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={22} color={theme.secondaryText} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Keys */}
          {keys.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.row}>
              {row.map((key, colIdx) => {
                if (key === null) {
                  return <View key={colIdx} style={styles.emptyKey} />;
                }
                if (key === 'done') {
                  return (
                    <TouchableOpacity
                      key={colIdx}
                      style={[styles.doneKey, { backgroundColor: accentColor }]}
                      onPress={onDone}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.doneText}>Done</Text>
                    </TouchableOpacity>
                  );
                }
                if (key === 'calc') {
                  return (
                    <TouchableOpacity
                      key={colIdx}
                      style={[styles.key, { borderColor: theme.border }]}
                      activeOpacity={0.6}
                    >
                      <Ionicons name="calculator-outline" size={22} color={theme.secondaryText} />
                    </TouchableOpacity>
                  );
                }
                if (key === '⌫') {
                  return (
                    <TouchableOpacity
                      key={colIdx}
                      style={[styles.key, { borderColor: theme.border }]}
                      onPress={() => press(key)}
                      activeOpacity={0.6}
                    >
                      <Ionicons name="backspace-outline" size={22} color={theme.text} />
                    </TouchableOpacity>
                  );
                }
                return (
                  <TouchableOpacity
                    key={colIdx}
                    style={[styles.key, { borderColor: theme.border }]}
                    onPress={() => press(key)}
                    activeOpacity={0.6}
                  >
                    <Text style={[styles.keyText, { color: theme.text }]}>{key}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const KEY_HEIGHT = 56;

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet:   { borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingBottom: 8 },
  header:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title:      { fontSize: 15, fontWeight: '600' },
  headerRight:{ flexDirection: 'row', alignItems: 'center' },
  row:        { flexDirection: 'row' },
  key: {
    flex: 1, height: KEY_HEIGHT,
    justifyContent: 'center', alignItems: 'center',
    // no border — clean flat grid
  },
  keyText:  { fontSize: 20, fontWeight: '400' },
  emptyKey: { flex: 1, height: KEY_HEIGHT },
  doneKey:  { flex: 1, height: KEY_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  doneText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
