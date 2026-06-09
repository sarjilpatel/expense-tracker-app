import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { getSyncSummary, syncLocalToServer, discardLocalData, SyncSummary } from '@/src/services/syncService';

interface Props {
  visible: boolean;
  onDone: () => void;
}

type Step = 'confirm' | 'syncing' | 'done' | 'error';

export function SyncModal({ visible, onDone }: Props) {
  const { theme } = useTheme();
  const [summary,   setSummary]   = useState<SyncSummary | null>(null);
  const [step,      setStep]      = useState<Step>('confirm');
  const [progress,  setProgress]  = useState({ label: '', done: 0, total: 0 });
  const [errorMsg,  setErrorMsg]  = useState('');
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
    if (result.success) {
      setStep('done');
    } else {
      setErrorMsg(result.error || 'Something went wrong');
      setStep('error');
    }
  };

  const handleDiscard = async () => {
    await discardLocalData();
    onDone();
  };


  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.card }]}>

          {step === 'confirm' && (
            <>
              <View style={[styles.iconWrap, { backgroundColor: theme.tint }]}>
                <Ionicons name="cloud-upload-outline" size={32} color={theme.tintText} />
              </View>
              <Text style={[styles.title, { color: theme.text }]}>Sync Local Data</Text>
              <Text style={[styles.sub, { color: theme.secondaryText }]}>
                You have local data from guest mode. Sync it to your account?
              </Text>

              {summary && (
                <View style={[styles.summaryBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  {summary.transactions > 0 && (
                    <SummaryRow icon="receipt-outline" label="Transactions" count={summary.transactions} color={theme.tint} />
                  )}
                  {summary.categories > 0 && (
                    <SummaryRow icon="grid-outline" label="Custom categories" count={summary.categories} color={theme.income} />
                  )}
                  {summary.budgets > 0 && (
                    <SummaryRow icon="wallet-outline" label="Budgets" count={summary.budgets} color={theme.warning} />
                  )}
                </View>
              )}

              <TouchableOpacity style={[styles.btn, { backgroundColor: theme.tint }]} onPress={handleSync}>
                <Ionicons name="cloud-upload-outline" size={18} color={theme.tintText} />
                <Text style={[styles.btnText, { color: theme.tintText }]}>Sync Now</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnSecondary, { borderColor: theme.border }]} onPress={handleDiscard}>
                <Text style={[styles.btnSecondaryText, { color: theme.secondaryText }]}>Start Fresh — discard local data</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onDone} style={styles.skipBtn}>
                <Text style={[styles.skipText, { color: theme.secondaryText }]}>Skip for now</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'syncing' && (
            <>
              <ActivityIndicator size="large" color={theme.tint} style={{ marginBottom: 20 }} />
              <Text style={[styles.title, { color: theme.text }]}>Syncing…</Text>
              <Text style={[styles.sub, { color: theme.secondaryText }]}>
                {progress.label ? `Uploading ${progress.label}` : 'Preparing…'}
              </Text>
              <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                <Animated.View style={[styles.progressFill, { backgroundColor: theme.tint }, progressStyle]} />
              </View>
              {progress.total > 0 && (
                <Text style={[styles.progressLabel, { color: theme.secondaryText }]}>
                  {progress.done} / {progress.total}
                </Text>
              )}
            </>
          )}

          {step === 'done' && (
            <>
              <View style={[styles.iconWrap, { backgroundColor: theme.tint }]}>
                <Ionicons name="checkmark-circle-outline" size={32} color={theme.tintText} />
              </View>
              <Text style={[styles.title, { color: theme.text }]}>All Synced!</Text>
              <Text style={[styles.sub, { color: theme.secondaryText }]}>
                Your data has been uploaded to your account.
              </Text>
              <TouchableOpacity style={[styles.btn, { backgroundColor: theme.income }]} onPress={onDone}>
                <Text style={styles.btnText}>Continue</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'error' && (
            <>
              <View style={[styles.iconWrap, { backgroundColor: theme.tint }]}>
                <Ionicons name="alert-circle-outline" size={32} color={theme.tintText} />
              </View>
              <Text style={[styles.title, { color: theme.text }]}>Sync Failed</Text>
              <Text style={[styles.sub, { color: theme.secondaryText }]}>{errorMsg}</Text>
              <TouchableOpacity style={[styles.btn, { backgroundColor: theme.tint }]} onPress={handleSync}>
                <Text style={[styles.btnText, { color: theme.tintText }]}>Retry</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnSecondary, { borderColor: theme.border }]} onPress={onDone}>
                <Text style={[styles.btnSecondaryText, { color: theme.secondaryText }]}>Skip for now</Text>
              </TouchableOpacity>
            </>
          )}

        </View>
      </View>
    </Modal>
  );
}

function SummaryRow({ icon, label, count, color }: { icon: any; label: string; count: number; color: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.summaryRow}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.summaryLabel, { color: theme.text }]}>{label}</Text>
      <View style={[styles.countBadge, { backgroundColor: theme.cardAlt ?? theme.border }]}>
        <Text style={[styles.countText, { color }]}>{count}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  card: {
    width: '100%', borderRadius: 24,
    padding: 28, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15, shadowRadius: 30, elevation: 20,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  sub:   { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  summaryBox: {
    width: '100%', borderRadius: 12, borderWidth: 1,
    padding: 14, marginBottom: 20, gap: 10,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
  countBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  countText:  { fontSize: 12, fontWeight: '800' },
  btn: {
    width: '100%', height: 52, borderRadius: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 8, marginBottom: 10,
  },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  btnSecondary: {
    width: '100%', height: 48, borderRadius: 14, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  btnSecondaryText: { fontSize: 14, fontWeight: '600' },
  skipBtn: { paddingVertical: 8 },
  skipText: { fontSize: 13 },
  progressTrack: { width: '100%', height: 6, borderRadius: 3, marginBottom: 8, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 3 },
  progressLabel: { fontSize: 12 },
});
