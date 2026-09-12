import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Touchable } from '@/components/ui';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, interpolateColor } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/src/context/ThemeContext';
import { getContrastText } from '@/constants/theme';
import { type, radius, space } from '@/constants/tokens';

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
        <Touchable onPress={handleToggle}>
          <Animated.View style={[styles.track, bgStyle]}>
            <Animated.View style={[styles.knob, knobStyle]} />
          </Animated.View>
        </Touchable>
      </View>

      {enabled && (
        <View style={[styles.freqRow, { backgroundColor: theme.card, borderColor }]}>
          {(['daily', 'weekly', 'monthly'] as Frequency[]).map(f => (
            <Touchable
              key={f}
              style={[styles.freqBtn, frequency === f && { backgroundColor: tintColor }]}
              onPress={() => onFrequencyChange(f)}
            >
              <Text style={[styles.freqText, { color: frequency === f ? getContrastText(tintColor) : textColor }]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </Touchable>
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
  label: { ...type.label },
  hint: {
    ...type.label,
    marginTop: 2,
  },
  track: {
    width: 44,
    height: 26,
    borderRadius: radius.md,
    justifyContent: 'center',
  },
  knob: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    // eslint-disable-next-line local/design-tokens -- a shadow is black by definition; this one floats over content
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  freqRow: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    gap: 4,
  },
  freqBtn: {
    flex: 1,
    paddingVertical: space.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  freqText: { ...type.label },
});
