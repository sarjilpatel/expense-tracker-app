import React, { useState, useCallback } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Vibration,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { setPin } from '@/src/services/lockService';

const DOTS = 4;

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PinSetupModal({ visible, onClose, onSuccess }: Props) {
  const [step, setStep]       = useState<'enter' | 'confirm'>('enter');
  const [firstPin, setFirstPin] = useState('');
  const [pin, setPin_]        = useState('');
  const [error, setError]     = useState(false);
  const shakeAnim = useSharedValue(0);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnim.value }],
  }));

  const shake = useCallback((msg?: string) => {
    Vibration.vibrate(300);
    shakeAnim.value = withSequence(
      withTiming(10,  { duration: 55 }),
      withTiming(-10, { duration: 55 }),
      withTiming(10,  { duration: 55 }),
      withTiming(0,   { duration: 55 }),
    );
    setError(true);
    setTimeout(() => { setPin_(''); setError(false); }, 260);
  }, [shakeAnim]);

  const reset = () => {
    setStep('enter');
    setFirstPin('');
    setPin_('');
    setError(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const press = useCallback(async (digit: string) => {
    if (pin.length >= DOTS) return;
    const next = pin + digit;
    setPin_(next);

    if (next.length === DOTS) {
      if (step === 'enter') {
        setFirstPin(next);
        setTimeout(() => { setPin_(''); setStep('confirm'); }, 120);
      } else {
        if (next === firstPin) {
          await setPin(next);
          reset();
          onSuccess();
        } else {
          shake();
          setTimeout(() => setStep('enter'), 320);
        }
      }
    }
  }, [pin, step, firstPin, shake, onSuccess]);

  const del = useCallback(() => {
    setPin_(p => p.slice(0, -1));
  }, []);

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
      <LinearGradient colors={['#18181B', '#09090B']} style={styles.wrap} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>

        <TouchableOpacity style={styles.closeBtn} onPress={handleClose} hitSlop={12}>
          <Ionicons name="close" size={24} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        <View style={styles.logoCircle}>
          <Ionicons name="lock-closed" size={28} color="#FFF" />
        </View>

        <Text style={styles.title}>
          {step === 'enter' ? 'Set a PIN' : 'Confirm PIN'}
        </Text>
        <Text style={styles.sub}>
          {step === 'enter' ? 'Choose a 4-digit PIN to secure your app' : 'Re-enter your PIN to confirm'}
        </Text>

        {error && (
          <Text style={styles.errText}>PINs don't match — try again</Text>
        )}

        <Animated.View style={[styles.dotsRow, shakeStyle]}>
          {Array.from({ length: DOTS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < pin.length
                  ? { backgroundColor: '#FFF', borderColor: '#FFF' }
                  : { borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'transparent' },
              ]}
            />
          ))}
        </Animated.View>

        <View style={styles.pad}>
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, i) => {
            if (!key) return <View key={i} style={styles.padKey} />;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.padKey, { backgroundColor: 'rgba(255,255,255,0.12)' }]}
                onPress={() => key === '⌫' ? del() : press(key)}
                activeOpacity={0.6}
              >
                {key === '⌫'
                  ? <Ionicons name="backspace-outline" size={24} color="#FFF" />
                  : <Text style={styles.padText}>{key}</Text>
                }
              </TouchableOpacity>
            );
          })}
        </View>

        {step === 'confirm' && (
          <TouchableOpacity onPress={() => { setPin_(''); setStep('enter'); }} style={styles.backLink}>
            <Text style={styles.backLinkText}>← Back</Text>
          </TouchableOpacity>
        )}

      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  closeBtn:   { position: 'absolute', top: 56, right: 24 },
  logoCircle: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  title:      { fontSize: 22, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },
  sub:        { fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center', paddingHorizontal: 40 },
  errText:    { fontSize: 13, color: '#FF6B6B', fontWeight: '600' },
  dotsRow:    { flexDirection: 'row', gap: 16, marginVertical: 8 },
  dot:        { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  pad:        { width: 280, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginTop: 8 },
  padKey:     { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  padText:    { fontSize: 24, fontWeight: '700', color: '#FFF' },
  backLink:   { marginTop: 8 },
  backLinkText: { color: 'rgba(255,255,255,0.55)', fontSize: 14 },
});
