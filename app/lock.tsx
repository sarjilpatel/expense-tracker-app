import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Vibration, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { verifyPin } from '@/src/services/lockService';

interface Props {
  onUnlock: () => void;
}

const DOTS = 4;

export default function LockScreen({ onUnlock }: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    setError(true);
    Vibration.vibrate(400);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 60, useNativeDriver: true }),
    ]).start(() => {
      setPin('');
      setError(false);
    });
  };

  const press = async (digit: string) => {
    if (pin.length >= DOTS) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === DOTS) {
      const ok = await verifyPin(next);
      if (ok) {
        onUnlock();
      } else {
        shake();
      }
    }
  };

  const del = () => setPin(p => p.slice(0, -1));

  const dotColor = error ? '#FF3B30' : Colors.light.primary;

  return (
    <View style={styles.wrap}>
      <Ionicons name="lock-closed" size={40} color={Colors.light.primary} style={{ marginBottom: 24 }} />
      <Text style={styles.title}>Enter PIN</Text>

      {/* Dots */}
      <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
        {Array.from({ length: DOTS }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < pin.length ? { backgroundColor: dotColor, borderColor: dotColor } : { borderColor: dotColor },
            ]}
          />
        ))}
      </Animated.View>

      {/* Numpad */}
      <View style={styles.pad}>
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, i) => {
          if (!key) return <View key={i} style={styles.padKey} />;
          return (
            <TouchableOpacity
              key={i}
              style={styles.padKey}
              onPress={() => key === '⌫' ? del() : press(key)}
              activeOpacity={0.6}
            >
              <Text style={styles.padText}>{key}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: Colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  title: {
    fontSize: 20, fontWeight: '700',
    color: Colors.light.text,
  },
  dotsRow: { flexDirection: 'row', gap: 16, marginVertical: 8 },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2,
  },
  pad: {
    width: 280,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  padKey: {
    width: 80, height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  padText: { fontSize: 24, fontWeight: '500', color: Colors.light.text },
});
