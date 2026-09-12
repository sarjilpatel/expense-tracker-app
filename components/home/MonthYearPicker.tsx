import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useLanguage } from '@/src/i18n/LanguageContext';
import { useTheme } from '@/src/context/ThemeContext';
import { space, type } from '@/constants/tokens';
import { Sheet, Chip, Button, type SheetHandle } from '@/components/ui';

interface MonthYearPickerProps {
  visible: boolean;
  onClose: () => void;
  selectedMonth: number;
  selectedYear: number;
  onSelect: (month: number, year: number) => void;
  theme?: any;
  showYearOnly?: boolean;
}

const MONTHS_ENGLISH = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Month + year chooser on the shared `Sheet` (W2-11). It used to be an absolutely positioned
 * popover that each caller wrapped in its own scrim; the caller now just toggles `visible`.
 */
export function MonthYearPicker({
  visible, onClose, selectedMonth, selectedYear, onSelect, showYearOnly = false,
}: MonthYearPickerProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const sheet = useRef<SheetHandle>(null);
  const [tempMonth, setTempMonth] = useState(selectedMonth);
  const [tempYear, setTempYear]   = useState(selectedYear);

  const currentYearVal = new Date().getFullYear();
  const years = Array.from({ length: 9 }, (_, i) => currentYearVal - 5 + i);

  useEffect(() => {
    if (visible) {
      setTempMonth(selectedMonth);
      setTempYear(selectedYear);
      sheet.current?.present();
    } else {
      sheet.current?.dismiss();
    }
  }, [visible, selectedMonth, selectedYear]);

  const handleApply = () => {
    onSelect(tempMonth, tempYear);
    sheet.current?.dismiss();
  };

  return (
    <Sheet ref={sheet} title={showYearOnly ? 'Select year' : 'Select month'} keyboard="none" onDismiss={onClose}>
      <Text style={[type.overline, S.label, { color: theme.secondaryText }]}>Year</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.years}>
        {years.map(y => (
          <Chip key={y} label={String(y)} selected={tempYear === y} onPress={() => setTempYear(y)} />
        ))}
      </ScrollView>

      {!showYearOnly && (
        <>
          <Text style={[type.overline, S.label, { color: theme.secondaryText }]}>Month</Text>
          <View style={S.months}>
            {MONTHS_ENGLISH.map((m, i) => {
              const val = i + 1;
              return (
                <Chip
                  key={m}
                  label={(t(m) || m).slice(0, 3)}
                  selected={tempMonth === val}
                  onPress={() => setTempMonth(val)}
                  style={S.month}
                />
              );
            })}
          </View>
        </>
      )}

      <Button label="Apply" icon="checkmark-circle-outline" onPress={handleApply} style={{ marginTop: space.xl }} />
    </Sheet>
  );
}

const S = StyleSheet.create({
  label:  { marginBottom: space.sm, marginTop: space.md },
  years:  { flexDirection: 'row', gap: space.sm },
  months: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  month:  { width: '22%', flexGrow: 1, justifyContent: 'center' },
});
