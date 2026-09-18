import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Chip } from '@/components/ui';
import { useTheme } from '@/src/context/ThemeContext';
import { space, type } from '@/constants/tokens';

type Frequency = 'daily' | 'weekly' | 'monthly';

interface Props {
  frequency: Frequency;
  onFrequencyChange: (frequency: Frequency) => void;
  tintColor: string;
}

/** The schedule selector paired with the standard Repeat switch in the transaction form. */
export function RecurringToggle({ frequency, onFrequencyChange, tintColor }: Props) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[type.bodyStrong, { color: theme.text }]}>Repeat frequency</Text>
      <Text style={[type.label, { color: theme.secondaryText }]}>Choose how often this transaction repeats</Text>
      <View style={styles.frequency} accessibilityLabel="Repeat frequency">
        {(['daily', 'weekly', 'monthly'] as Frequency[]).map(item => (
          <Chip
            key={item}
            label={item.charAt(0).toUpperCase() + item.slice(1)}
            selected={frequency === item}
            color={frequency === item ? tintColor : undefined}
            onPress={() => onFrequencyChange(item)}
            accessibilityLabel={`${item} repeat${frequency === item ? ', selected' : ''}`}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.md },
  frequency: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
