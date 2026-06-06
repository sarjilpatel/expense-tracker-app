import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Switch, Modal,
  StyleSheet, FlatList, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/src/context/ThemeContext';
import { usePreferences } from '@/src/context/PreferencesContext';
import { ordinalSuffix, CurrencyCode, WeekStart, CURRENCY_META } from '@/src/services/preferencesService';
import { requestNotificationPermissions } from '@/src/services/notificationService';

const MONTH_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

type ModalType = 'currency' | 'monthlyStart' | null;

export function PreferencesSection() {
  const { theme } = useTheme();
  const { prefs, updatePrefs } = usePreferences();
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const update = (partial: Parameters<typeof updatePrefs>[0]) => updatePrefs(partial);

  const handleNotificationToggle = async (val: boolean) => {
    if (val) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Enable notifications in your device settings to receive reminders.',
        );
        return;
      }
    }
    update({ notifications: val });
  };

  const currencyMeta = CURRENCY_META[prefs.currency];

  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionLabel}>Preferences</ThemedText>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>

        {/* Currency */}
        <TouchableOpacity style={styles.row} onPress={() => setActiveModal('currency')} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconBox, { backgroundColor: theme.tint }]}>
              <Text style={{ fontSize: 18, color: '#FFF' }}>{currencyMeta.symbol}</Text>
            </View>
            <View>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Currency</Text>
              <Text style={[styles.rowSub, { color: theme.secondaryText }]}>{currencyMeta.name}</Text>
            </View>
          </View>
          <View style={styles.rowRight}>
            <Text style={[styles.rowValue, { color: theme.tint }]}>{prefs.currency}</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.secondaryText} />
          </View>
        </TouchableOpacity>

        <View style={[styles.separator, { backgroundColor: theme.separator }]} />

        {/* Monthly start date */}
        <TouchableOpacity style={styles.row} onPress={() => setActiveModal('monthlyStart')} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconBox, { backgroundColor: theme.tint }]}>
              <Ionicons name="calendar-outline" size={20} color="#FFF" />
            </View>
            <View>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Monthly Start Date</Text>
              <Text style={[styles.rowSub, { color: theme.secondaryText }]}>When each month resets</Text>
            </View>
          </View>
          <View style={styles.rowRight}>
            <Text style={[styles.rowValue, { color: theme.tint }]}>{ordinalSuffix(prefs.monthlyStart)}</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.secondaryText} />
          </View>
        </TouchableOpacity>

        <View style={[styles.separator, { backgroundColor: theme.separator }]} />

        {/* Week start day */}
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconBox, { backgroundColor: theme.tint }]}>
              <Ionicons name="today-outline" size={20} color="#FFF" />
            </View>
            <View>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Week Starts On</Text>
              <Text style={[styles.rowSub, { color: theme.secondaryText }]}>First day of your week</Text>
            </View>
          </View>
          <View style={[styles.weekToggle, { backgroundColor: theme.cardAlt ?? theme.border }]}>
            {(['Sun', 'Mon'] as WeekStart[]).map(day => (
              <TouchableOpacity
                key={day}
                style={[styles.weekBtn, prefs.weekStart === day && { backgroundColor: theme.tint }]}
                onPress={() => update({ weekStart: day })}
              >
                <Text style={[styles.weekBtnText, { color: prefs.weekStart === day ? '#FFF' : theme.secondaryText }]}>
                  {day}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.separator, { backgroundColor: theme.separator }]} />

        {/* Notifications */}
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconBox, { backgroundColor: theme.warning }]}>
              <Ionicons name="notifications-outline" size={20} color="#FFF" />
            </View>
            <View>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Notifications</Text>
              <Text style={[styles.rowSub, { color: theme.secondaryText }]}>Budget alerts & reminders</Text>
            </View>
          </View>
          <Switch
            value={prefs.notifications}
            onValueChange={handleNotificationToggle}
            trackColor={{ false: theme.border, true: theme.tint }}
            thumbColor={prefs.notifications ? theme.tint : theme.secondaryText}
          />
        </View>
      </View>

      {/* Currency Picker Modal */}
      <Modal visible={activeModal === 'currency'} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Select Currency</Text>
            <FlatList
              data={Object.entries(CURRENCY_META) as [CurrencyCode, typeof CURRENCY_META[CurrencyCode]][]}
              keyExtractor={([code]) => code}
              renderItem={({ item: [code, meta] }) => {
                const isSelected = prefs.currency === code;
                return (
                  <TouchableOpacity
                    style={[styles.currencyRow, isSelected && { backgroundColor: theme.cardAlt ?? theme.border }]}
                    onPress={() => { update({ currency: code }); setActiveModal(null); }}
                  >
                    <View style={[styles.symbolBox, { backgroundColor: theme.tint }]}>
                      <Text style={[styles.symbolText, { color: '#FFF' }]}>{meta.symbol}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.currencyCode, { color: theme.text }]}>{code}</Text>
                      <Text style={[styles.currencyName, { color: theme.secondaryText }]}>{meta.name}</Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={theme.tint} />}
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity style={[styles.closeBtn, { borderColor: theme.border }]} onPress={() => setActiveModal(null)}>
              <Text style={[styles.closeBtnText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Monthly Start Date Picker Modal */}
      <Modal visible={activeModal === 'monthlyStart'} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Monthly Start Date</Text>
            <Text style={[styles.modalSub, { color: theme.secondaryText }]}>
              Summaries reset on this day each month
            </Text>
            <View style={styles.dayGrid}>
              {MONTH_DAYS.map(day => {
                const isSelected = prefs.monthlyStart === day;
                return (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayBtn,
                      { borderColor: isSelected ? theme.tint : theme.border },
                      isSelected && { backgroundColor: theme.tint },
                    ]}
                    onPress={() => { update({ monthlyStart: day }); setActiveModal(null); }}
                  >
                    <Text style={[styles.dayBtnText, { color: isSelected ? '#FFF' : theme.text }]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={[styles.closeBtn, { borderColor: theme.border }]} onPress={() => setActiveModal(null)}>
              <Text style={[styles.closeBtnText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section:      { marginBottom: 24 },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: '#8E8E93',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, paddingLeft: 4,
  },
  card:      { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  rowLeft:   { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rowRight:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBox:   { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rowTitle:  { fontSize: 15, fontWeight: '600' },
  rowSub:    { fontSize: 12, marginTop: 1 },
  rowValue:  { fontSize: 14, fontWeight: '700' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 66 },
  weekToggle: { flexDirection: 'row', borderRadius: 10, padding: 2, gap: 2 },
  weekBtn:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  weekBtnText:{ fontSize: 13, fontWeight: '700' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '75%' },
  modalHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: '#8E8E93', alignSelf: 'center', marginBottom: 16 },
  modalTitle:   { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  modalSub:     { fontSize: 13, marginBottom: 16 },

  currencyRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 10 },
  symbolBox:    { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  symbolText:   { fontSize: 18, fontWeight: '700' },
  currencyCode: { fontSize: 15, fontWeight: '700' },
  currencyName: { fontSize: 12, marginTop: 1 },

  dayGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  dayBtn:     { width: 46, height: 46, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  dayBtnText: { fontSize: 14, fontWeight: '700' },

  closeBtn:     { borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  closeBtnText: { fontSize: 15, fontWeight: '700' },
});
