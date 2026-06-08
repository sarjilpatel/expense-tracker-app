import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, interpolateColor } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/src/context/ThemeContext';

type Frequency = 'daily' | 'weekly' | 'monthly';

interface Props {
  enabled: boolean;
  frequency: Frequency;
  onToggle: () => void;
  onFrequencyChange: (f: Frequency) => void;
  tintColor: string;
  textColor: string;
  borderColor: string;
}

export function RecurringToggle({ enabled, frequency, onToggle, onFrequencyChange, tintColor, textColor, borderColor }: Props) {
  const { theme } = useTheme();
  const knob = useSharedValue(enabled ? 1 : 0);

  const handleToggle = () => {
    knob.value = enabled ? 0 : 1;
    onToggle();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(knob.value * 18 + 2, { damping: 15, stiffness: 200 }) }],
  }));

  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(knob.value, [0, 1], [theme.card, tintColor]),
  }));

  return (
    <View>
      <View style={styles.row}>
        <View>
          <ThemedText style={styles.label}>Recurring</ThemedText>
          <ThemedText style={styles.hint}>Auto-repeat this transaction</ThemedText>
        </View>
        <TouchableOpacity onPress={handleToggle} activeOpacity={0.9}>
          <Animated.View style={[styles.track, bgStyle]}>
            <Animated.View style={[styles.knob, knobStyle]} />
          </Animated.View>
        </TouchableOpacity>
      </View>

      {enabled && (
        <View style={[styles.freqRow, { backgroundColor: theme.card, borderColor }]}>
          {(['daily', 'weekly', 'monthly'] as Frequency[]).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.freqBtn, frequency === f && { backgroundColor: tintColor }]}
              onPress={() => onFrequencyChange(f)}
            >
              <Text style={[styles.freqText, { color: frequency === f ? '#FFF' : textColor }]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    marginTop: 2,
  },
  track: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
  },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  freqRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    gap: 4,
  },
  freqBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  freqText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
