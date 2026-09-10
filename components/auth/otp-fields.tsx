import React, { useEffect, useState } from 'react';
import { TextInput, TouchableOpacity, Text, StyleSheet, StyleProp, TextStyle } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';

/** Seconds the resend button stays disabled. The server enforces the same window (W1-32) — this
 *  only saves the user a round-trip to be told so. */
export const RESEND_COOLDOWN_SECONDS = 60;

interface OtpInputProps {
  value: string;
  onChange: (code: string) => void;
  onSubmitEditing?: () => void;
  invalid?: boolean;
  style?: StyleProp<TextStyle>;
}

/**
 * One field, six digits, widely spaced. Six separate boxes look tidier and behave worse: the OS
 * fills a one-time code into a single field, and splitting it costs backspace handling, focus
 * juggling and paste for nothing the user can see.
 */
export function OtpInput({ value, onChange, onSubmitEditing, invalid, style }: OtpInputProps) {
  const { theme } = useTheme();
  return (
    <TextInput
      style={[
        styles.otp,
        { color: theme.text, borderColor: invalid ? '#F55345' : theme.border, backgroundColor: theme.card },
        style,
      ]}
      value={value}
      // Digits only, so a pasted "Your code: 123456" cannot arrive with its label attached.
      onChangeText={t => onChange(t.replace(/\D/g, '').slice(0, 6))}
      onSubmitEditing={onSubmitEditing}
      placeholder="––––––"
      placeholderTextColor={theme.secondaryText}
      keyboardType="number-pad"
      // The pair that lets iOS and Android offer the code straight from the notification.
      autoComplete="one-time-code"
      textContentType="oneTimeCode"
      inputMode="numeric"
      maxLength={6}
      autoFocus
      returnKeyType="done"
    />
  );
}

interface ResendButtonProps {
  onPress: () => void | Promise<void>;
  /** Bumped by the parent after a successful send to restart the countdown. */
  restartKey?: number;
  disabled?: boolean;
}

export function ResendButton({ onPress, restartKey = 0, disabled }: ResendButtonProps) {
  const { theme } = useTheme();
  const [left, setLeft] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    setLeft(RESEND_COOLDOWN_SECONDS);
    const id = setInterval(() => setLeft(s => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, [restartKey]);

  const waiting = left > 0;

  return (
    <TouchableOpacity onPress={() => onPress()} disabled={waiting || disabled} style={styles.resend}>
      <Text style={[styles.resendText, { color: waiting || disabled ? theme.secondaryText : theme.tint }]}>
        {waiting ? `Resend code in ${left}s` : 'Resend code'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  otp: {
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 12,
    textAlign: 'center',
  },
  resend:     { alignItems: 'center', marginTop: 20, paddingVertical: 8 },
  resendText: { fontSize: 15, fontWeight: '600' },
});
