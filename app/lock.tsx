import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Vibration,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { verifyPin } from '@/src/services/lockService';
import { LinearGradient } from 'expo-linear-gradient';

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
  const shakeAnim = useSharedValue(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnim.value }],
  }));

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
    shakeAnim.value = withSequence(
      withTiming(10,  { duration: 60 }),
      withTiming(-10, { duration: 60 }),
      withTiming(10,  { duration: 60 }),
      withTiming(0,   { duration: 60 }),
    );
    setTimeout(() => { setPin(''); setError(false); }, 250);
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
  const mins      = Math.floor(countdown / 60);
  const secs      = countdown % 60;
  const attemptsLeft = MAX_ATTEMPTS - attempts;

  return (
    <LinearGradient
      colors={theme.background === '#0D1117' ? ['#059669', '#022C22'] : ['#059669', '#047857']}
      style={styles.wrap}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.logoCircle}>
        <Ionicons name="wallet" size={32} color="#FFF" />
      </View>
      <Text style={[styles.title, { color: '#FFF' }]}>
        {isLocked ? 'Too many attempts' : 'Enter PIN'}
      </Text>

      {isLocked ? (
        <View style={styles.lockoutBox}>
          <Text style={[styles.lockoutTimer, { color: '#FFF' }]}>
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </Text>
          <Text style={[styles.lockoutSub, { color: 'rgba(255, 255, 255, 0.7)' }]}>
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
          <Animated.View style={[styles.dotsRow, shakeStyle]}>
            {Array.from({ length: DOTS }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i < pin.length
                    ? { backgroundColor: '#FFF', borderColor: '#FFF' }
                    : { borderColor: '#FFF', backgroundColor: 'transparent' },
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
                  style={[styles.padKey, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
                  onPress={() => key === '⌫' ? del() : press(key)}
                  activeOpacity={0.6}
                >
                  {key === '⌫' ? (
                    <Ionicons name="backspace-outline" size={24} color="#FFF" />
                  ) : (
                    <Text style={[styles.padText, { color: '#FFF' }]}>{key}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  logoCircle:   { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title:        { fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
  dotsRow:      { flexDirection: 'row', gap: 16, marginVertical: 8 },
  dot:          { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  pad:          { width: 280, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginTop: 16 },
  padKey:       { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  padText:      { fontSize: 24, fontWeight: '700' },
  attemptsWarn: { fontSize: 13, color: '#FFF', fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 2, textShadowOffset: { width: 0, height: 1 } },
  lockoutBox:   { alignItems: 'center', gap: 8 },
  lockoutTimer: { fontSize: 48, fontWeight: '800', fontVariant: ['tabular-nums'] },
  lockoutSub:   { fontSize: 14 },
});
