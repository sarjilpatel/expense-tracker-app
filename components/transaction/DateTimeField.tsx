import React, { useState } from 'react';
import { View, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';

interface Props {
  value: Date;
  onChange: (date: Date) => void;
  tintColor: string;
  borderColor: string;
}

export function DateTimeField({ value, onChange, tintColor, borderColor }: Props) {
  const [showIosPicker, setShowIosPicker] = useState(false);

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        is24Hour: true,
        onChange: (_, date) => {
          if (!date) return;
          DateTimePickerAndroid.open({
            value: date,
            mode: 'time',
            is24Hour: true,
            onChange: (__, time) => { if (time) onChange(time); },
          });
        },
      });
    } else {
      setShowIosPicker(true);
    }
  };

  return (
    <View>
      <TouchableOpacity
        style={[styles.btn, { borderColor, backgroundColor: 'rgba(150,150,150,0.05)' }]}
        onPress={open}
      >
        <Ionicons name="calendar-outline" size={20} color={tintColor} />
        <ThemedText style={styles.text}>
          {value.toLocaleDateString()} {value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </ThemedText>
      </TouchableOpacity>
      {Platform.OS === 'ios' && showIosPicker && (
        <DateTimePicker
          value={value}
          mode="datetime"
          is24Hour
          onChange={(_, d) => { setShowIosPicker(false); if (d) onChange(d); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    gap: 12,
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
  },
});
