import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/context/ThemeContext';
import { ThemedView } from '@/components/themed-view';
import { isLockEnabled, disableLock, isBiometricAvailable, getBiometricEnabled, setBiometricEnabled } from '@/src/services/lockService';
import { requestNotificationPermissions, scheduleDailyReminder, cancelDailyReminder, getReminderTime, saveReminderTime } from '@/src/services/notificationService';
import { PinSetupModal } from '@/components/PinSetupModal';

function Row({
  icon, iconBg, iconColor, title, sub, right, onPress, danger,
}: {
  icon: string; iconBg: string; iconColor: string;
  title: string; sub?: string;
  right?: React.ReactNode; onPress?: () => void; danger?: boolean;
}) {
  const { theme } = useTheme();
  const content = (
    <View style={S.row}>
      <View style={[S.iconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={S.rowMid}>
        <Text style={[S.rowTitle, { color: danger ? (theme.danger ?? '#F55345') : theme.text }]}>{title}</Text>
        {sub ? <Text style={[S.rowSub, { color: theme.secondaryText }]}>{sub}</Text> : null}
      </View>
      {right !== undefined
        ? right
        : onPress
          ? <Ionicons name="chevron-forward" size={16} color={theme.secondaryText} />
          : null}
    </View>
  );
  if (!onPress) return content;
  return <TouchableOpacity onPress={onPress} activeOpacity={0.65}>{content}</TouchableOpacity>;
}

function Sep() {
  const { theme } = useTheme();
  return <View style={[S.sep, { backgroundColor: theme.separator }]} />;
}

function Card({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={[S.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {children}
    </View>
  );
}

export default function SecurityScreen() {
  const { theme } = useTheme();
  const { top }   = useSafeAreaInsets();

  const [lockEnabled,      setLockEnabled]          = useState(false);
  const [showPinSetup,     setShowPinSetup]          = useState(false);
  const [biometricAvail,   setBiometricAvail]        = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [reminderEnabled,  setReminderEnabled]       = useState(false);
  const [reminderTime,     setReminderTime]          = useState<{ hour: number; minute: number } | null>(null);

  useFocusEffect(useCallback(() => {
    isLockEnabled().then(setLockEnabled).catch(() => {});
    isBiometricAvailable().then(setBiometricAvail).catch(() => {});
    getBiometricEnabled().then(setBiometricEnabledState).catch(() => {});
    getReminderTime().then(t => {
      if (t) { setReminderEnabled(true); setReminderTime(t); }
      else    { setReminderEnabled(false); setReminderTime(null); }
    }).catch(() => {});
  }, []));

  const handleToggleLock = () => {
    if (lockEnabled) {
      Alert.alert('Disable PIN Lock', 'Remove the app lock?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable', style: 'destructive', onPress: async () => {
            await disableLock();
            setLockEnabled(false);
            setBiometricEnabledState(false);
          },
        },
      ]);
    } else {
      setShowPinSetup(true);
    }
  };

  const handleToggleBiometric = async () => {
    if (biometricEnabled) {
      await setBiometricEnabled(false);
      setBiometricEnabledState(false);
    } else {
      await setBiometricEnabled(true);
      setBiometricEnabledState(true);
    }
  };

  const handleToggleReminder = () => {
    if (reminderEnabled) {
      cancelDailyReminder().then(() => { setReminderEnabled(false); setReminderTime(null); });
    } else {
      const defaultHour = 20;
      const defaultMin  = 0;
      requestNotificationPermissions().then(granted => {
        if (!granted) { Alert.alert('Permission Required', 'Enable notifications in device settings.'); return; }
        scheduleDailyReminder(defaultHour, defaultMin);
        saveReminderTime(defaultHour, defaultMin);
        setReminderEnabled(true);
        setReminderTime({ hour: defaultHour, minute: defaultMin });
        Alert.alert('Reminder set', 'You\'ll get a daily check-in at 8:00 PM.');
      });
    }
  };

  return (
    <ThemedView style={[S.container, { paddingTop: top + 8 }]}>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn} hitSlop={16}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[S.headerTitle, { color: theme.text }]}>Security</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>

        <Text style={[S.groupLabel, { color: theme.secondaryText }]}>APP LOCK</Text>
        <Card>
          {/* PIN Lock */}
          <View style={S.row}>
            <View style={[S.iconBox, { backgroundColor: '#3B82F6' }]}>
              <Ionicons name="lock-closed-outline" size={18} color="#FFF" />
            </View>
            <View style={S.rowMid}>
              <Text style={[S.rowTitle, { color: theme.text }]}>PIN Lock</Text>
              <Text style={[S.rowSub, { color: theme.secondaryText }]}>
                {lockEnabled ? 'Locks after 5 min in background' : 'Protect the app with a 4-digit PIN'}
              </Text>
            </View>
            <Switch
              value={lockEnabled}
              onValueChange={handleToggleLock}
              trackColor={{ false: theme.border, true: '#3B82F6' }}
              thumbColor={lockEnabled ? '#3B82F6' : theme.secondaryText}
            />
          </View>

          {biometricAvail && lockEnabled && (
            <>
              <Sep />
              <View style={S.row}>
                <View style={[S.iconBox, { backgroundColor: '#6366F1' }]}>
                  <Ionicons name="finger-print" size={18} color="#FFF" />
                </View>
                <View style={S.rowMid}>
                  <Text style={[S.rowTitle, { color: theme.text }]}>Biometric Unlock</Text>
                  <Text style={[S.rowSub, { color: theme.secondaryText }]}>
                    {biometricEnabled ? 'Face ID / fingerprint active' : 'Use Face ID or fingerprint instead of PIN'}
                  </Text>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleToggleBiometric}
                  trackColor={{ false: theme.border, true: '#6366F1' }}
                  thumbColor={biometricEnabled ? '#6366F1' : theme.secondaryText}
                />
              </View>
            </>
          )}
        </Card>

        <Text style={[S.groupLabel, { color: theme.secondaryText }]}>NOTIFICATIONS</Text>
        <Card>
          <View style={S.row}>
            <View style={[S.iconBox, { backgroundColor: theme.warning ?? '#F59E0B' }]}>
              <Ionicons name="alarm-outline" size={18} color="#FFF" />
            </View>
            <View style={S.rowMid}>
              <Text style={[S.rowTitle, { color: theme.text }]}>Daily Reminder</Text>
              <Text style={[S.rowSub, { color: theme.secondaryText }]}>
                {reminderEnabled && reminderTime
                  ? `Daily at ${reminderTime.hour % 12 || 12}:${String(reminderTime.minute).padStart(2, '0')} ${reminderTime.hour >= 12 ? 'PM' : 'AM'}`
                  : 'Remind you to log expenses every day'}
              </Text>
            </View>
            <Switch
              value={reminderEnabled}
              onValueChange={handleToggleReminder}
              trackColor={{ false: theme.border, true: theme.warning ?? '#F59E0B' }}
              thumbColor={reminderEnabled ? (theme.warning ?? '#F59E0B') : theme.secondaryText}
            />
          </View>
        </Card>

        <View style={{ height: 32 }} />
      </ScrollView>

      <PinSetupModal
        visible={showPinSetup}
        onClose={() => setShowPinSetup(false)}
        onSuccess={() => {
          setShowPinSetup(false);
          setLockEnabled(true);
          Alert.alert('PIN set', 'App will lock after 5 minutes in the background.');
        }}
      />
    </ThemedView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 8, height: 44,
  },
  backBtn:     { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  scroll:      { paddingHorizontal: 12, paddingBottom: 40 },

  groupLabel: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.8,
    marginBottom: 8, marginTop: 20, paddingLeft: 4,
  },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: 0 },
  sep:  { height: StyleSheet.hairlineWidth, marginLeft: 62, backgroundColor: 'transparent' },

  row:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  iconBox: { width: 34, height: 34, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  rowMid:  { flex: 1 },
  rowTitle:{ fontSize: 15, fontWeight: '600' },
  rowSub:  { fontSize: 12, marginTop: 1 },
});
