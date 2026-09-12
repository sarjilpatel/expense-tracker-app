import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Vibration } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/context/ThemeContext';
import { space, radius, type, tabular, icon as iconSize } from '@/constants/tokens';
import { Touchable } from '@/components/ui';
import { verifyPin, getBiometricEnabled, authenticateWithBiometric } from '@/src/services/lockService';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  onUnlock: () => void;
}

const DOTS         = 4;
const MAX_ATTEMPTS = 3;
const LOCKOUT_SECS = 5 * 60;

export default function LockScreen({ onUnlock }: Props) {
  const { theme } = useTheme();
  const [pin, setPin]               = useState('');
  const [error, setError]           = useState(false);
  const [attempts, setAttempts]     = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [countdown, setCountdown]   = useState(0);
  const [biometricReady, setBiometricReady] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shakeAnim = useSharedValue(0);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnim.value }],
  }));

  // Check biometric availability on mount and auto-prompt
  useEffect(() => {
    getBiometricEnabled().then(enabled => {
      if (enabled) {
        setBiometricReady(true);
        promptBiometric();
      }
    });
  }, []);

  const promptBiometric = useCallback(async () => {
    const ok = await authenticateWithBiometric();
    if (ok) onUnlock();
  }, [onUnlock]);

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

  const isLocked     = lockedUntil != null;
  const mins         = Math.floor(countdown / 60);
  const secs         = countdown % 60;
  const attemptsLeft = MAX_ATTEMPTS - attempts;

  return (
    <LinearGradient
      colors={theme.background === '#09090B' ? ['#18181B', '#09090B'] : ['#18181B', '#3F3F46']}
      style={styles.wrap}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.logoCircle}>
        <Ionicons name="wallet" size={32} color="#FFF" />
      </View>
      <Text style={styles.title}>
        {isLocked ? 'Too many attempts' : 'Enter PIN'}
      </Text>

      {isLocked ? (
        <View style={styles.lockoutBox}>
          <Text style={styles.lockoutTimer}>
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </Text>
          <Text style={styles.lockoutSub}>
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

          <View style={styles.pad}>
            {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, i) => {
              if (!key) return <View key={i} style={styles.padKey} />;
              return (
                <Touchable
                  key={i}
                  style={[styles.padKey, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
                  onPress={() => key === '⌫' ? del() : press(key)}
                  haptic="selection"
                  rippleColor="rgba(255,255,255,0.25)"
                  accessibilityLabel={key === '⌫' ? 'Delete' : key}
                >
                  {key === '⌫' ? (
                    <Ionicons name="backspace-outline" size={iconSize.lg} color="#FFF" />
                  ) : (
                    <Text style={styles.padText}>{key}</Text>
                  )}
                </Touchable>
              );
            })}
          </View>

          {biometricReady && (
            <Touchable style={styles.bioBtn} onPress={promptBiometric} accessibilityLabel="Use biometric" rippleBorderless>
              <Ionicons name="finger-print" size={iconSize.xl} color="rgba(255,255,255,0.85)" />
              <Text style={styles.bioText}>Use biometric</Text>
            </Touchable>
          )}
        </>
      )}
    </LinearGradient>
  );
}

// A fixed dark surface by design — the lock screen is the one place the app deliberately does not
// follow the theme, so the whites here are correct. Sizes and radii still come from the tokens.
const styles = StyleSheet.create({
  wrap:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg },
  logoCircle:   { width: 72, height: 72, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: space.lg },
  title:        { ...type.title, color: '#FFF' },
  dotsRow:      { flexDirection: 'row', gap: space.lg, marginVertical: space.sm },
  dot:          { width: 16, height: 16, borderRadius: radius.full, borderWidth: 2 },
  pad:          { width: 280, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.lg, marginTop: space.lg },
  padKey:       { width: 72, height: 72, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  padText:      { ...type.title, ...tabular, color: '#FFF' },
  attemptsWarn: { ...type.label, color: '#FFF' },
  lockoutBox:   { alignItems: 'center', gap: space.sm },
  lockoutTimer: { ...type.display, color: '#FFF' },
  lockoutSub:   { ...type.label, color: 'rgba(255,255,255,0.7)' },
  bioBtn:       { alignItems: 'center', gap: space.xs, marginTop: space.sm, padding: space.md },
  bioText:      { ...type.label, color: 'rgba(255,255,255,0.7)' },
});
