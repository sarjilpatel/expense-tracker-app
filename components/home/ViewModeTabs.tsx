import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type HomeViewMode = 'daily' | 'calendar' | 'monthly';

const TABS: { key: HomeViewMode; icon: string; label: string }[] = [
  { key: 'daily',    icon: 'list-outline',      label: 'Daily'    },
  { key: 'calendar', icon: 'calendar-outline',  label: 'Calendar' },
  { key: 'monthly',  icon: 'bar-chart-outline', label: 'Monthly'  },
];

interface Props {
  active: HomeViewMode;
  onPress: (m: HomeViewMode) => void;
  tintColor: string;
  secondaryText: string;
}

export function ViewModeTabs({ active, onPress, tintColor, secondaryText }: Props) {
  return (
    <View style={[styles.wrap, { backgroundColor: 'rgba(150,150,150,0.08)' }]}>
      {TABS.map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tab, active === tab.key && { backgroundColor: tintColor }]}
          onPress={() => onPress(tab.key)}
          activeOpacity={0.75}
        >
          <Ionicons
            name={tab.icon as any}
            size={13}
            color={active === tab.key ? '#FFF' : secondaryText}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.label, { color: active === tab.key ? '#FFF' : secondaryText }]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    marginHorizontal: 20,
    borderRadius: 13,
    padding: 3,
    marginBottom: 10,
    gap: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});
