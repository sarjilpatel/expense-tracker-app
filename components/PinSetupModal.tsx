import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Vibration } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/context/ThemeContext';
import { space, radius, type, tabular, icon as iconSize } from '@/constants/tokens';
import { Sheet, Touchable, Button, type SheetHandle } from '@/components/ui';
import { setPin } from '@/src/services/lockService';

const DOTS = 4;

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Set-a-PIN flow on the shared `Sheet` (W2-11). Unlike the lock screen this follows the theme —
 * it is a settings step, not the locked state. Same keypad geometry as `app/lock.tsx`.
 */
export function PinSetupModal({ visible, onClose, onSuccess }: Props) {
  const { theme } = useTheme();
  const sheet = useRef<SheetHandle>(null);
  const [step, setStep]         = useState<'enter' | 'confirm'>('enter');
  const [firstPin, setFirstPin] = useState('');
  const [pin, setPin_]          = useState('');
  const [error, setError]       = useState(false);
  const shakeAnim = useSharedValue(0);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnim.value }],
  }));

  useEffect(() => {
    if (visible) sheet.current?.present();
    else sheet.current?.dismiss();
  }, [visible]);

  const shake = useCallback(() => {
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

  const handleDismiss = () => { reset(); onClose(); };

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
    <Sheet ref={sheet} title={step === 'enter' ? 'Set a PIN' : 'Confirm PIN'} keyboard="none" onDismiss={handleDismiss}>
      <View style={S.body}>
        <View style={[S.logoCircle, { backgroundColor: theme.tint + '1F' }]}>
          <Ionicons name="lock-closed" size={iconSize.xl} color={theme.tint} />
        </View>

        <Text style={[type.body, { color: theme.secondaryText, textAlign: 'center' }]}>
          {step === 'enter' ? 'Choose a 4-digit PIN to secure your app' : 'Re-enter your PIN to confirm'}
        </Text>

        {error && (
          <Text style={[type.label, { color: theme.expense }]}>PINs don&apos;t match — try again</Text>
        )}

        <Animated.View style={[S.dotsRow, shakeStyle]}>
          {Array.from({ length: DOTS }).map((_, i) => (
            <View
              key={i}
              style={[
                S.dot,
                i < pin.length
                  ? { backgroundColor: theme.tint, borderColor: theme.tint }
                  : { borderColor: theme.border, backgroundColor: 'transparent' },
              ]}
            />
          ))}
        </Animated.View>

        <View style={S.pad}>
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, i) => {
            if (!key) return <View key={i} style={S.padKey} />;
            return (
              <Touchable
                key={i}
                style={[S.padKey, { backgroundColor: theme.cardAlt }]}
                onPress={() => key === '⌫' ? del() : press(key)}
                haptic="selection"
                accessibilityLabel={key === '⌫' ? 'Delete' : key}
              >
                {key === '⌫'
                  ? <Ionicons name="backspace-outline" size={iconSize.lg} color={theme.text} />
                  : <Text style={[S.padText, { color: theme.text }]}>{key}</Text>
                }
              </Touchable>
            );
          })}
        </View>

        {step === 'confirm' && (
          <Button variant="ghost" size="sm" icon="arrow-back" label="Start over" onPress={() => { setPin_(''); setStep('enter'); }} />
        )}
      </View>
    </Sheet>
  );
}

const S = StyleSheet.create({
  body:       { alignItems: 'center', gap: space.md, paddingTop: space.sm },
  logoCircle: { width: 64, height: 64, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center' },
  dotsRow:    { flexDirection: 'row', gap: space.lg, marginVertical: space.sm },
  dot:        { width: 16, height: 16, borderRadius: radius.full, borderWidth: 2 },
  pad:        { width: 280, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.lg },
  padKey:     { width: 72, height: 72, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  padText:    { ...type.title, ...tabular },
});
