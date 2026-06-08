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
    marginHorizontal: 12,
    borderRadius: 14,
    padding: 3,
    marginBottom: 12,
  },
  scrollContent: {
    flexDirection: 'row',
    gap: 3,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
});
