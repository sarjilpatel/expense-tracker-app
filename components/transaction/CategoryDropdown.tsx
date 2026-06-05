import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
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
}

export function CategoryDropdown({ data, value, onChange, loading, tintColor, textColor, cardColor, borderColor }: Props) {
  if (loading) return <ActivityIndicator size="small" color={tintColor} />;

  return (
    <Dropdown
      style={[styles.dropdown, { backgroundColor: 'rgba(150,150,150,0.05)', borderColor }]}
      placeholderStyle={styles.placeholder}
      selectedTextStyle={[styles.selected, { color: textColor }]}
      itemTextStyle={{ color: textColor }}
      containerStyle={{ backgroundColor: cardColor, borderRadius: 12 }}
      activeColor={`${tintColor}20`}
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
});
