import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  style?: ViewStyle;
}

export function PrimaryButton({ label, onPress, loading = false, disabled = false, icon, style }: Props) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.btn, { backgroundColor: theme.tint }, (loading || disabled) && styles.dimmed, style]}
      onPress={onPress}
      disabled={loading || disabled}
      activeOpacity={0.82}
    >
      {loading ? (
        <ActivityIndicator color="#FFF" />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={20} color="#FFF" style={styles.icon} />}
          <Text style={styles.label}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  dimmed: { opacity: 0.65 },
  icon:   { marginRight: 8 },
  label:  { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
