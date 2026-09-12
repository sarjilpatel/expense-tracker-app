import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/context/ThemeContext';
import { space, radius, type, tabular, icon as iconSize } from '@/constants/tokens';
import { Sheet, Button, Card, Row, type SheetHandle } from '@/components/ui';
import { getSyncSummary, syncLocalToServer, discardLocalData, SyncSummary } from '@/src/services/syncService';

interface Props {
  visible: boolean;
  onDone: () => void;
}

type Step = 'confirm' | 'syncing' | 'done' | 'partial' | 'error';

/**
 * First-login upload of guest data, on the shared `Sheet` (W2-11). The sheet is locked while an
 * upload is in flight — dismissing it mid-write would leave the user unsure what landed.
 */
export function SyncModal({ visible, onDone }: Props) {
  const { theme } = useTheme();
  const sheet = useRef<SheetHandle>(null);
  const [summary,   setSummary]   = useState<SyncSummary | null>(null);
  const [step,      setStep]      = useState<Step>('confirm');
  const [progress,  setProgress]  = useState({ label: '', done: 0, total: 0 });
  const [errorMsg,  setErrorMsg]  = useState('');
  const [outcome,   setOutcome]   = useState({ synced: 0, failed: 0 });
  const progressAnim = useSharedValue(0);
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressAnim.value * 100}%` as any,
  }));

  useEffect(() => {
    if (visible) {
      setStep('confirm');
      setProgress({ label: '', done: 0, total: 0 });
      progressAnim.value = 0;
      getSyncSummary().then(setSummary).catch(() => setSummary(null));
      sheet.current?.present();
    } else {
      sheet.current?.dismiss();
    }
  }, [visible]);

  useEffect(() => {
    if (progress.total > 0) {
      progressAnim.value = withTiming(progress.done / progress.total, { duration: 200 });
    }
  }, [progress]);

  const handleSync = async () => {
    setStep('syncing');
    progressAnim.value = 0;
    const result = await syncLocalToServer((label, done, total) => {
      setProgress({ label, done, total });
    });
    setOutcome({ synced: result.synced, failed: Math.max(0, result.failed) });
    if (result.success) {
      setStep('done');
    } else if (result.failed > 0 && result.synced > 0) {
      // Some of it landed. Whatever did not is still on the device — say so rather than
      // presenting this as a clean failure.
      setErrorMsg(result.error || 'Some items could not be uploaded.');
      setStep('partial');
    } else {
      setErrorMsg(result.error || 'Something went wrong');
      setStep('error');
    }
  };

  const handleDiscard = async () => {
    await discardLocalData();
    sheet.current?.dismiss();
  };

  const close = () => sheet.current?.dismiss();

  const hero = (icon: React.ComponentProps<typeof Ionicons>['name'], color: string, title: string, body: string) => (
    <>
      <View style={[S.iconWrap, { backgroundColor: color + '1F' }]}>
        <Ionicons name={icon} size={iconSize.xl} color={color} />
      </View>
      <Text style={[type.title, S.center, { color: theme.text }]}>{title}</Text>
      <Text style={[type.body, S.center, { color: theme.secondaryText }]}>{body}</Text>
    </>
  );

  return (
    <Sheet ref={sheet} keyboard="none" dismissable={step !== 'syncing'} onDismiss={onDone}>
      <View style={S.body}>
        {step === 'confirm' && (
          <>
            {hero('cloud-upload-outline', theme.tint, 'Sync local data', 'You have data from guest mode. Upload it to your account?')}

            {summary && (summary.transactions + summary.categories + summary.accounts + summary.budgets > 0) && (
              <Card padded={false} style={S.summary}>
                {summary.transactions > 0 && <Row icon="receipt-outline" iconColor={theme.tint}    title="Transactions"      right={<Count n={summary.transactions} />} />}
                {summary.categories   > 0 && <Row icon="grid-outline"    iconColor={theme.income}  title="Custom categories" right={<Count n={summary.categories} />} />}
                {summary.accounts     > 0 && <Row icon="card-outline"    iconColor={theme.expense} title="Accounts"          right={<Count n={summary.accounts} />} />}
                {summary.budgets      > 0 && <Row icon="wallet-outline"  iconColor={theme.warning} title="Budgets"           right={<Count n={summary.budgets} />} last />}
              </Card>
            )}

            <View style={S.actions}>
              <Button label="Sync now" icon="cloud-upload-outline" onPress={handleSync} />
              <Button label="Start fresh — discard local data" variant="secondary" onPress={handleDiscard} />
              <Button label="Skip for now" variant="ghost" size="sm" onPress={close} />
            </View>
          </>
        )}

        {step === 'syncing' && (
          <>
            <ActivityIndicator size="large" color={theme.tint} />
            <Text style={[type.title, S.center, { color: theme.text }]}>Syncing…</Text>
            <Text style={[type.body, S.center, { color: theme.secondaryText }]}>
              {progress.label ? `Uploading ${progress.label}` : 'Preparing…'}
            </Text>
            <View style={[S.track, { backgroundColor: theme.border }]}>
              <Animated.View style={[S.fill, { backgroundColor: theme.tint }, progressStyle]} />
            </View>
            {progress.total > 0 && (
              <Text style={[type.label, tabular, { color: theme.secondaryText }]}>{progress.done} / {progress.total}</Text>
            )}
          </>
        )}

        {step === 'done' && (
          <>
            {hero('checkmark-circle-outline', theme.income, 'All synced', 'Your data has been uploaded to your account.')}
            <View style={S.actions}>
              <Button label="Continue" onPress={close} />
            </View>
          </>
        )}

        {step === 'partial' && (
          <>
            {hero('cloud-offline-outline', theme.warning, 'Partly synced',
              `${outcome.synced} item${outcome.synced === 1 ? '' : 's'} uploaded.\n${outcome.failed} still on this device — nothing was lost. Retry to finish.`)}
            <View style={S.actions}>
              <Button label="Retry remaining" icon="refresh-outline" onPress={handleSync} />
              <Button label="Later" variant="secondary" onPress={close} />
            </View>
          </>
        )}

        {step === 'error' && (
          <>
            {hero('alert-circle-outline', theme.expense, 'Sync failed', `${errorMsg}\nYour local data is still on this device.`)}
            <View style={S.actions}>
              <Button label="Retry" icon="refresh-outline" onPress={handleSync} />
              <Button label="Skip for now" variant="secondary" onPress={close} />
            </View>
          </>
        )}
      </View>
    </Sheet>
  );
}

function Count({ n }: { n: number }) {
  const { theme } = useTheme();
  return (
    <View style={[S.badge, { backgroundColor: theme.cardAlt }]}>
      <Text style={[type.label, tabular, { color: theme.text }]}>{n}</Text>
    </View>
  );
}

const S = StyleSheet.create({
  body:     { alignItems: 'center', gap: space.md, paddingTop: space.sm },
  center:   { textAlign: 'center' },
  iconWrap: { width: 64, height: 64, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' },
  summary:  { alignSelf: 'stretch' },
  actions:  { alignSelf: 'stretch', gap: space.sm, marginTop: space.sm },
  badge:    { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.sm },
  track:    { alignSelf: 'stretch', height: 6, borderRadius: radius.full, overflow: 'hidden' },
  fill:     { height: '100%', borderRadius: radius.full },
});
