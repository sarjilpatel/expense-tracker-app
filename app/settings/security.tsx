import React, { useState, useCallback, useRef } from 'react';
import { Switch, Alert, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useTheme } from '@/src/context/ThemeContext';
import { isLockEnabled, disableLock, isBiometricAvailable, getBiometricEnabled, setBiometricEnabled } from '@/src/services/lockService';
import { requestNotificationPermissions, scheduleDailyReminder, cancelDailyReminder, getReminderTime, saveReminderTime } from '@/src/services/notificationService';
import { PinSetupModal } from '@/components/PinSetupModal';
import { Screen, Card, Row, SectionHeader, Button, Sheet, type SheetHandle } from '@/components/ui';

export default function SecurityScreen() {
  const { theme } = useTheme();

  const [lockEnabled,      setLockEnabled]          = useState(false);
  const [showPinSetup,     setShowPinSetup]          = useState(false);
  const [biometricAvail,   setBiometricAvail]        = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [reminderEnabled,  setReminderEnabled]       = useState(false);
  const [reminderTime,     setReminderTime]          = useState<{ hour: number; minute: number } | null>(null);
  const [pickerTime,       setPickerTime]            = useState(() => new Date());
  const reminderSheet = useRef<SheetHandle>(null);

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

  const updateReminderTime = async (date: Date) => {
    const hour = date.getHours();
    const minute = date.getMinutes();
    await scheduleDailyReminder(hour, minute);
    await saveReminderTime(hour, minute);
    setReminderTime({ hour, minute });
  };

  const handleToggleReminder = () => {
    if (reminderEnabled) {
      cancelDailyReminder().then(() => { setReminderEnabled(false); setReminderTime(null); });
      return;
    }
    const defaultHour = reminderTime?.hour ?? 20;
    const defaultMin  = reminderTime?.minute ?? 0;
    requestNotificationPermissions().then(async granted => {
      if (!granted) { Alert.alert('Permission Required', 'Enable notifications in device settings.'); return; }
      await scheduleDailyReminder(defaultHour, defaultMin);
      await saveReminderTime(defaultHour, defaultMin);
      setReminderEnabled(true);
      setReminderTime({ hour: defaultHour, minute: defaultMin });
    });
  };

  const openReminderTime = () => {
    const value = new Date();
    value.setHours(reminderTime?.hour ?? 20, reminderTime?.minute ?? 0, 0, 0);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'time',
        is24Hour: false,
        onChange: (_, selected) => { if (selected) updateReminderTime(selected); },
      });
      return;
    }
    setPickerTime(value);
    reminderSheet.current?.present();
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
          last={!reminderEnabled}
        />
        {reminderEnabled && (
          <Row
            icon="time-outline"
            title="Reminder time"
            subtitle="Choose when to be reminded"
            right={undefined}
            onPress={openReminderTime}
            last
          />
        )}
      </Card>

      <Sheet ref={reminderSheet} title="Reminder time" keyboard="none">
        <DateTimePicker value={pickerTime} mode="time" display="spinner" onChange={(_, date) => { if (date) setPickerTime(date); }} style={{ width: '100%' }} />
        <Button label="Save reminder time" onPress={async () => { await updateReminderTime(pickerTime); reminderSheet.current?.dismiss(); }} />
      </Sheet>

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
