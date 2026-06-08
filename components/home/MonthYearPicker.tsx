import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/src/i18n/LanguageContext';

interface MonthYearPickerProps {
  visible: boolean;
  onClose: () => void;
  selectedMonth: number;
  selectedYear: number;
  onSelect: (month: number, year: number) => void;
  theme: any;
  showYearOnly?: boolean;
}

const MONTHS_ENGLISH = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function MonthYearPicker({
  visible,
  onClose,
  selectedMonth,
  selectedYear,
  onSelect,
  theme,
  showYearOnly = false,
}: MonthYearPickerProps) {
  const { t } = useLanguage();
  const [tempMonth, setTempMonth] = useState(selectedMonth);
  const [tempYear, setTempYear] = useState(selectedYear);
  const slideAnim = useRef(new Animated.Value(-100)).current;

  const monthListRef = useRef<FlatList>(null);
  const yearListRef = useRef<FlatList>(null);

  const currentYearVal = new Date().getFullYear();
  const years = Array.from({ length: 9 }, (_, i) => currentYearVal - 5 + i);

  useEffect(() => {
    if (visible) {
      setTempMonth(selectedMonth);
      setTempYear(selectedYear);
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 9,
        useNativeDriver: true,
      }).start();

      // Scroll to center selected item in view
      setTimeout(() => {
        if (!showYearOnly && monthListRef.current) {
          monthListRef.current.scrollToIndex({
            index: selectedMonth - 1,
            animated: false,
            viewPosition: 0.5,
          });
        }
        if (yearListRef.current) {
          const yIdx = years.indexOf(selectedYear);
          if (yIdx !== -1) {
            yearListRef.current.scrollToIndex({
              index: yIdx,
              animated: false,
              viewPosition: 0.5,
            });
          }
        }
      }, 80);
    } else {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, selectedMonth, selectedYear]);

  if (!visible) return null;

  const ITEM_HEIGHT = 40; // paddingVertical: 8 (x2) + font line-height ~18 + border/margin
  const getItemLayout = (_: any, index: number) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  });

  const handleApply = () => {
    onSelect(tempMonth, tempYear);
    onClose();
  };

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          transform: [{ translateY: slideAnim }],
        }
      ]}
    >
      {/* Header */}
      <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
        <Text style={[styles.sheetTitle, { color: theme.text }]}>
          {showYearOnly ? 'Select Year' : 'Select Month & Year'}
        </Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color={theme.secondaryText} />
        </TouchableOpacity>
      </View>

      {/* Body Columns */}
      <View style={styles.columnsContainer}>
        {/* Months Column */}
        {!showYearOnly && (
          <View style={[styles.col, { borderRightColor: theme.border }]}>
            <Text style={[styles.columnLabel, { color: theme.secondaryText }]}>MONTH</Text>
            <FlatList
              ref={monthListRef}
              data={MONTHS_ENGLISH}
              keyExtractor={(item, idx) => String(idx + 1)}
              showsVerticalScrollIndicator={false}
              getItemLayout={getItemLayout}
              renderItem={({ item, index }) => {
                const monthVal = index + 1;
                const isSelected = tempMonth === monthVal;
                return (
                  <TouchableOpacity
                    style={[
                      styles.itemBtn,
                      isSelected && { backgroundColor: theme.tint + '15', borderColor: theme.tint, borderWidth: 1 }
                    ]}
                    onPress={() => setTempMonth(monthVal)}
                  >
                    <Text
                      style={[
                        styles.itemText,
                        { color: isSelected ? theme.tint : theme.text, fontWeight: isSelected ? '700' : '500' }
                      ]}
                    >
                      {t(item) || item}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}

        {/* Years Column */}
        <View style={styles.col}>
          <Text style={[styles.columnLabel, { color: theme.secondaryText }]}>YEAR</Text>
          <FlatList
            ref={yearListRef}
            data={years}
            keyExtractor={item => String(item)}
            showsVerticalScrollIndicator={false}
            getItemLayout={getItemLayout}
            renderItem={({ item }) => {
              const isSelected = tempYear === item;
              return (
                <TouchableOpacity
                  style={[
                    styles.itemBtn,
                    isSelected && { backgroundColor: theme.tint + '15', borderColor: theme.tint, borderWidth: 1 }
                  ]}
                  onPress={() => setTempYear(item)}
                >
                  <Text
                    style={[
                      styles.itemText,
                      { color: isSelected ? theme.tint : theme.text, fontWeight: isSelected ? '700' : '500' }
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>

      {/* Apply Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.applyBtn, { backgroundColor: theme.tint }]}
          onPress={handleApply}
        >
          <Text style={[styles.applyBtnText, { color: theme.tintText }]}>Apply Selection</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
    height: 360,
    paddingBottom: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    zIndex: 1000,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  columnsContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  col: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  columnLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    textAlign: 'center',
  },
  itemBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemText: {
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  applyBtn: {
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
