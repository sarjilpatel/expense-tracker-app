import React from 'react';
import { View, ActivityIndicator, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import { Ionicons } from '@expo/vector-icons';

interface DropdownItem {
  label: string;
  value: string;
  icon?: string;
}

interface Props {
  data: DropdownItem[];
  value: string | null;
  onChange: (value: string) => void;
  loading?: boolean;
  tintColor: string;
  textColor: string;
  cardColor: string;
  borderColor: string;
  onRetry?: () => void;
}

export function CategoryDropdown({ data, value, onChange, loading, tintColor, textColor, cardColor, borderColor, onRetry }: Props) {
  if (loading) return <ActivityIndicator size="small" color={tintColor} />;

  if (!loading && data.length === 0) {
    return (
      <TouchableOpacity
        style={[styles.emptyState, { backgroundColor: cardColor, borderColor }]}
        onPress={onRetry}
        activeOpacity={0.7}
      >
        <Ionicons name="alert-circle-outline" size={20} color={tintColor} />
        <Text style={[styles.emptyText, { color: textColor }]}>
          Could not load categories — tap to retry
        </Text>
        <Ionicons name="refresh-outline" size={18} color={tintColor} />
      </TouchableOpacity>
    );
  }

  return (
    <Dropdown
      style={[styles.dropdown, { backgroundColor: cardColor, borderColor }]}
      placeholderStyle={styles.placeholder}
      selectedTextStyle={[styles.selected, { color: textColor }]}
      itemTextStyle={{ color: textColor }}
      containerStyle={{ backgroundColor: cardColor, borderRadius: 12 }}
      activeColor={cardColor}
      data={data}
      maxHeight={300}
      labelField="label"
      valueField="value"
      placeholder="Select Category"
      search
      searchPlaceholder="Search..."
      value={value}
      onChange={item => onChange(item.value)}
      renderLeftIcon={() => (
        <View style={styles.icon}>
          <Ionicons name="grid-outline" size={20} color={tintColor} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  dropdown: {
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  placeholder: {
    fontSize: 16,
    color: '#A0A0A0',
  },
  selected: {
    fontSize: 16,
    fontWeight: '500',
  },
  icon: {
    marginRight: 12,
  },
  emptyState: {
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    flex: 1,
    fontSize: 14,
  },
});
