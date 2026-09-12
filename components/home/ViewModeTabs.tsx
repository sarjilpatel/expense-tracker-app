import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Touchable } from '@/components/ui';
import { useTheme } from '@/src/context/ThemeContext';

export type HomeViewMode = 'daily' | 'weekly' | 'calendar' | 'monthly' | 'total' | 'note';

const TABS: { key: HomeViewMode; label: string }[] = [
  { key: 'daily',    label: 'Daily'    },
  { key: 'weekly',   label: 'Weekly'   },
  { key: 'calendar', label: 'Calendar' },
  { key: 'monthly',  label: 'Monthly'  },
  { key: 'total',    label: 'Total'    },
  { key: 'note',     label: 'Note'     },
];

interface Props {
  active: HomeViewMode;
  onPress: (m: HomeViewMode) => void;
  tintColor: string;
  secondaryText: string;
}

export function ViewModeTabs({ active, onPress, tintColor, secondaryText }: Props) {
  const { theme } = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: `${secondaryText}14` }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {TABS.map(tab => {
          const isActive = active === tab.key;
          return (
            <Touchable
              key={tab.key}
              style={[styles.pill, isActive && { backgroundColor: theme.tint }]}
              onPress={() => onPress(tab.key)}
            >
              <Text style={[styles.label, { color: isActive ? theme.tintText : secondaryText }]}>
                {tab.label}
              </Text>
            </Touchable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    marginHorizontal: 0,
    borderRadius: 12,
    padding: 2,
    marginBottom: 6,
  },
  scrollContent: {
    flexDirection: 'row',
    gap: 2,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
