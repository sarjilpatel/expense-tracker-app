import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Vibration, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { verifyPin } from '@/src/services/lockService';

interface Props {
  onUnlock: () => void;
}

const DOTS          = 4;
const MAX_ATTEMPTS  = 3;
const LOCKOUT_SECS  = 5 * 60; // 5 minutes

export default function LockScreen({ onUnlock }: Props) {
  const { theme } = useTheme();
  const [pin, setPin]             = useState('');
  const [error, setError]         = useState(false);
  const [attempts, setAttempts]   = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown ticker when locked out
  useEffect(() => {
    if (lockedUntil == null) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0) {
        setLockedUntil(null);
        setAttempts(0);
        if (countdownRef.current) clearInterval(countdownRef.current);
      }
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [lockedUntil]);

  const shake = useCallback(() => {
    setError(true);
    Vibration.vibrate(400);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 60, useNativeDriver: true }),
    ]).start(() => { setPin(''); setError(false); });
  }, [shakeAnim]);

  const press = useCallback(async (digit: string) => {
    if (lockedUntil != null) return;
    if (pin.length >= DOTS) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === DOTS) {
      const ok = await verifyPin(next);
      if (ok) {
        setAttempts(0);
        onUnlock();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        shake();
        if (newAttempts >= MAX_ATTEMPTS) {
          setLockedUntil(Date.now() + LOCKOUT_SECS * 1000);
        }
      }
    }
  }, [pin, attempts, lockedUntil, shake, onUnlock]);

  const del = useCallback(() => {
    if (lockedUntil != null) return;
    setPin(p => p.slice(0, -1));
  }, [lockedUntil]);

  const isLocked  = lockedUntil != null;
  const dotColor  = error ? '#FF3B30' : theme.tint;
  const mins      = Math.floor(countdown / 60);
  const secs      = countdown % 60;
  const attemptsLeft = MAX_ATTEMPTS - attempts;

  return (
    <View style={[styles.wrap, { backgroundColor: theme.background }]}>
      <Ionicons name="lock-closed" size={40} color={theme.tint} style={{ marginBottom: 24 }} />
      <Text style={[styles.title, { color: theme.text }]}>
        {isLocked ? 'Too many attempts' : 'Enter PIN'}
      </Text>

      {isLocked ? (
        <View style={styles.lockoutBox}>
          <Text style={[styles.lockoutTimer, { color: theme.tint }]}>
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </Text>
          <Text style={[styles.lockoutSub, { color: theme.secondaryText }]}>
            Try again in {mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}
          </Text>
        </View>
      ) : (
        <>
          {attempts > 0 && attempts < MAX_ATTEMPTS && (
            <Text style={styles.attemptsWarn}>
              {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining
            </Text>
          )}

          {/* Dots */}
          <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
            {Array.from({ length: DOTS }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i < pin.length
                    ? { backgroundColor: dotColor, borderColor: dotColor }
                    : { borderColor: dotColor },
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
                  style={[styles.padKey, { backgroundColor: theme.card }]}
                  onPress={() => key === '⌫' ? del() : press(key)}
                  activeOpacity={0.6}
                >
                  <Text style={[styles.padText, { color: theme.text }]}>{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  title:        { fontSize: 20, fontWeight: '700' },
  dotsRow:      { flexDirection: 'row', gap: 16, marginVertical: 8 },
  dot:          { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  pad:          { width: 280, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 16 },
  padKey:       { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  padText:      { fontSize: 24, fontWeight: '500' },
  attemptsWarn: { fontSize: 13, color: '#FF3B30', fontWeight: '600' },
  lockoutBox:   { alignItems: 'center', gap: 8 },
  lockoutTimer: { fontSize: 48, fontWeight: '800', fontVariant: ['tabular-nums'] },
  lockoutSub:   { fontSize: 14 },
});
