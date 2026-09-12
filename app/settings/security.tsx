import React, { useState, useCallback } from 'react';
import { Switch, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { isLockEnabled, disableLock, isBiometricAvailable, getBiometricEnabled, setBiometricEnabled } from '@/src/services/lockService';
import { requestNotificationPermissions, scheduleDailyReminder, cancelDailyReminder, getReminderTime, saveReminderTime } from '@/src/services/notificationService';
import { PinSetupModal } from '@/components/PinSetupModal';
import { Screen, Card, Row, SectionHeader } from '@/components/ui';

export default function SecurityScreen() {
  const { theme } = useTheme();

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
    await setBiometricEnabled(!biometricEnabled);
    setBiometricEnabledState(!biometricEnabled);
  };

  const handleToggleReminder = () => {
    if (reminderEnabled) {
      cancelDailyReminder().then(() => { setReminderEnabled(false); setReminderTime(null); });
      return;
    }
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
  };

  // The switch is the one control the platform draws itself; it takes the accent for "on" the
  // same way the active tab does (W2-29).
  const toggle = (value: boolean, onChange: () => void, label: string) => (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: theme.border, true: theme.tint }}
      thumbColor={theme.card}
      accessibilityLabel={label}
    />
  );

  const reminderLabel = reminderEnabled && reminderTime
    ? `Daily at ${reminderTime.hour % 12 || 12}:${String(reminderTime.minute).padStart(2, '0')} ${reminderTime.hour >= 12 ? 'PM' : 'AM'}`
    : 'Remind you to log expenses every day';

  return (
    <Screen title="Security">
      <SectionHeader title="App lock" />
      <Card padded={false}>
        <Row
          icon="lock-closed-outline"
          title="PIN lock"
          subtitle={lockEnabled ? 'Locks after 5 min in background' : 'Protect the app with a 4-digit PIN'}
          right={toggle(lockEnabled, handleToggleLock, 'PIN lock')}
          last={!(biometricAvail && lockEnabled)}
        />
        {biometricAvail && lockEnabled && (
          <Row
            icon="finger-print"
            title="Biometric unlock"
            subtitle={biometricEnabled ? 'Face ID / fingerprint active' : 'Use Face ID or fingerprint instead of PIN'}
            right={toggle(biometricEnabled, handleToggleBiometric, 'Biometric unlock')}
            last
          />
        )}
      </Card>

      <SectionHeader title="Notifications" />
      <Card padded={false}>
        <Row
          icon="alarm-outline"
          title="Daily reminder"
          subtitle={reminderLabel}
          right={toggle(reminderEnabled, handleToggleReminder, 'Daily reminder')}
          last
        />
      </Card>

      <PinSetupModal
        visible={showPinSetup}
        onClose={() => setShowPinSetup(false)}
        onSuccess={() => {
          setShowPinSetup(false);
          setLockEnabled(true);
          Alert.alert('PIN set', 'App will lock after 5 minutes in the background.');
        }}
      />
    </Screen>
  );
}
