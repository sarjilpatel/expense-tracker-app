import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
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
            <TouchableOpacity
              key={tab.key}
              style={[styles.pill, isActive && { backgroundColor: theme.tint }]}
              onPress={() => onPress(tab.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.label, { color: isActive ? theme.tintText : secondaryText }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    marginHorizontal: 8,
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
