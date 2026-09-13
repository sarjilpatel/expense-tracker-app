import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';
import { space, radius, type } from '@/constants/tokens';
import { Card, Row, Chip, Button, SectionHeader } from '@/components/ui';
import { runSync, subscribeSync, getSyncStatus, type SyncStatus } from '@/src/sync/engine';
import { getSyncMeta, type BackupSchedule } from '@/src/sync/meta';
import { setBackupSchedule, setWifiOnly, setAttachmentsOnCellular } from '@/src/sync/scheduler';
import { updateBackupSchedule } from '@/src/services/authApi';

/**
 * More → Data → Cloud backup (W3-20). The schedule is a ceiling on staleness, not a clock — the
 * copy says "around" for a reason — and the honest measure is the outbox: when "waiting" reads 0,
 * everything on this device is on the server.
 */
const SCHEDULES: { value: BackupSchedule; label: string; hint: string }[] = [
  { value: 'instant', label: 'Instantly',     hint: 'A few seconds after each change, while the app is open' },
  { value: 'hourly',  label: 'Every hour',    hint: 'At most an hour behind' },
  { value: 'every4h', label: 'Every 4 hours', hint: 'At most four hours behind' },
  { value: 'every8h', label: 'Every 8 hours', hint: 'At most eight hours behind' },
  { value: 'daily',   label: 'Once a day',    hint: 'Around midnight, or when you next open the app' },
  { value: 'manual',  label: 'Only manually', hint: 'Only when you tap Back up now' },
];

function ago(iso: string | null): string {
  if (!iso) return 'Never backed up';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)  return 'Backed up just now';
  if (mins < 60) return `Backed up ${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `Backed up ${hrs} h ago`;
  return `Backed up ${new Date(iso).toLocaleDateString()}`;
}

export function BackupSection() {
  const { theme } = useTheme();
  const [status, setStatus]     = useState<SyncStatus>({ running: false, lastSyncAt: null, lastError: null, pending: 0 });
  const [schedule, setSchedule] = useState<BackupSchedule>('instant');
  const [wifi, setWifi]         = useState(false);
  const [cellReceipts, setCellReceipts] = useState(false);

  useEffect(() => {
    getSyncMeta().then(m => { setSchedule(m.schedule); setWifi(m.wifiOnly); setCellReceipts(m.attachmentsOnCellular); });
    getSyncStatus().then(setStatus);
    return subscribeSync(setStatus);
  }, []);

  const pickSchedule = async (value: BackupSchedule) => {
    setSchedule(value);
    await setBackupSchedule(value);
    updateBackupSchedule(value).catch(() => {});   // the server's copy, so a reinstall keeps it
  };

  const behind = status.pending > 0 && status.lastSyncAt !== null
    && Date.now() - new Date(status.lastSyncAt).getTime() > 24 * 60 * 60 * 1000;

  const stateChip = status.running
    ? <Chip size="sm" label="Backing up…" />
    : status.lastError
      ? <Chip size="sm" tone="expense" label="Failed" />
      : status.pending > 0
        ? <Chip size="sm" tone="warning" label={`${status.pending} waiting`} />
        : <Chip size="sm" tone="income" label="Up to date" />;

  return (
    <>
      <SectionHeader title="Cloud backup" />
      <Card padded={false}>
        <Row
          icon={status.pending > 0 ? 'cloud-upload-outline' : 'cloud-done-outline'}
          title={ago(status.lastSyncAt)}
          subtitle={status.lastError ? status.lastError : status.pending > 0 ? `${status.pending} change${status.pending === 1 ? '' : 's'} not yet on the server` : 'Everything on this device is on the server'}
          right={stateChip}
        />
        <Row
          icon="wifi-outline"
          title="Wi-Fi only"
          subtitle="Scheduled backups wait for Wi-Fi; Back up now always goes"
          right={<Switch value={wifi} onValueChange={v => { setWifi(v); setWifiOnly(v); }} trackColor={{ false: theme.border, true: theme.tint }} thumbColor={theme.card} accessibilityLabel="Wi-Fi only" />}
        />
        <Row
          icon="image-outline"
          title="Receipts on mobile data"
          subtitle="Off: receipt photos wait for Wi-Fi; the transactions themselves still back up"
          right={<Switch value={cellReceipts} onValueChange={v => { setCellReceipts(v); setAttachmentsOnCellular(v); }} trackColor={{ false: theme.border, true: theme.tint }} thumbColor={theme.card} accessibilityLabel="Receipts on mobile data" />}
          last
        />
      </Card>
      {behind && (
        <Text style={[type.label, { color: theme.expense, marginTop: space.sm }]}>
          Changes have been waiting for more than a day — the backup is not happening. Check the connection and tap Back up now.
        </Text>
      )}
      <Button label="Back up now" icon="cloud-upload-outline" variant="secondary" loading={status.running} disabled={status.running} onPress={() => runSync('manual')} style={{ marginTop: space.md }} />

      <SectionHeader title="Schedule" />
      <Card padded={false}>
        {SCHEDULES.map((s, i) => (
          <Row
            key={s.value}
            title={s.label}
            subtitle={s.hint}
            onPress={() => pickSchedule(s.value)}
            chevron={false}
            right={schedule === s.value ? <View style={[S.dot, { backgroundColor: theme.tint }]} /> : <View style={[S.dot, { borderColor: theme.border, borderWidth: 1.5 }]} />}
            last={i === SCHEDULES.length - 1}
          />
        ))}
      </Card>
      <Text style={[type.label, { color: theme.secondaryText, marginTop: space.sm }]}>
        The phone runs background work when it chooses — never more often than every 15 minutes, and later on low battery. Opening the app always catches up if a backup is due.
      </Text>
    </>
  );
}

const S = StyleSheet.create({
  dot: { width: 20, height: 20, borderRadius: radius.full },
});
