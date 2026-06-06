import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

export type HomeViewMode = 'daily' | 'calendar' | 'monthly' | 'total' | 'note';

const TABS: { key: HomeViewMode; label: string }[] = [
  { key: 'daily',    label: 'Daily'    },
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
              style={[styles.pill, isActive && { backgroundColor: tintColor }]}
              onPress={() => onPress(tab.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.label, { color: isActive ? '#FFF' : secondaryText }]}>
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
    marginHorizontal: 20,
    borderRadius: 14,
    padding: 3,
    marginBottom: 14,
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
