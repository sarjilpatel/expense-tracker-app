import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { getInsights } from '@/src/services/dataService';
import { getCachedInsights, setCachedInsights } from '@/src/cache/transactionCache';

const AI_CONSENT_KEY = '@ai_consent_given';

type Insight = {
  title: string;
  body: string;
  type: 'positive' | 'warning' | 'neutral';
};

type Props = {
  month: number;
  year: number;
  hasData: boolean;
};

const TYPE_CONFIG = {
  positive: { icon: 'trending-up'                  as const, colorKey: 'income'  as const },
  warning:  { icon: 'warning-outline'               as const, colorKey: 'expense' as const },
  neutral:  { icon: 'information-circle-outline'    as const, colorKey: 'tint'    as const },
};

export function AIInsightCard({ month, year, hasData }: Props) {
  const { theme } = useTheme();

  const [loading,       setLoading]       = useState(false);
  const [insights,      setInsights]      = useState<Insight[]>([]);
  const [revealed,      setRevealed]      = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [showConsent,   setShowConsent]   = useState(false);
  const [consentGiven,  setConsentGiven]  = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(AI_CONSENT_KEY).then(val => setConsentGiven(val === 'true'));
  }, []);

  const reset = useCallback(() => {
    setInsights([]);
    setRevealed(false);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    reset();
    let active = true;
    (async () => {
      const cached = await getCachedInsights(month, year);
      if (active && cached && cached.length > 0) {
        setInsights(cached);
        setRevealed(true);
      }
    })();
    return () => { active = false; };
  }, [month, year]);

  const fetchInsights = async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = await getCachedInsights(month, year);
      if (cached && cached.length > 0) {
        setInsights(cached);
        setRevealed(true);
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getInsights(month, year);
      if (result.noData || result.insights.length === 0) {
        setError('Not enough data for insights this month.');
        setRevealed(false);
        return;
      }
      setInsights(result.insights as Insight[]);
      setRevealed(true);
      await setCachedInsights(result.insights, month, year);
    } catch (e: any) {
      setError(e?.msg || 'Could not generate insights. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!hasData) return null;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <ThemedText type="subtitle">AI Insights</ThemedText>
        <View style={styles.badgeRow}>
          <Ionicons name="sparkles-outline" size={13} color={theme.tint} />
          <ThemedText style={[styles.badge, { color: theme.secondaryText }]}>Claude</ThemedText>
        </View>
      </View>

      {/* One-time consent modal */}
      <Modal visible={showConsent} transparent animationType="fade">
        <View style={styles.consentOverlay}>
          <View style={[styles.consentCard, { backgroundColor: theme.card }]}>
            <View style={[styles.consentIcon, { backgroundColor: theme.tint + '22' }]}>
              <Ionicons name="shield-checkmark-outline" size={28} color={theme.tint} />
            </View>
            <Text style={[styles.consentTitle, { color: theme.text }]}>AI Insights — Data Notice</Text>
            <Text style={[styles.consentBody, { color: theme.secondaryText }]}>
              To generate insights, your monthly spending totals and category percentages are sent to Anthropic AI (Claude).{'\n\n'}
              No individual transaction details, notes, or personal information are included.{'\n\n'}
              Anthropic may retain inputs for up to 30 days per their privacy policy.
            </Text>
            <TouchableOpacity
              style={[styles.consentAccept, { backgroundColor: theme.tint }]}
              onPress={async () => {
                await AsyncStorage.setItem(AI_CONSENT_KEY, 'true');
                setConsentGiven(true);
                setShowConsent(false);
                fetchInsights();
              }}
            >
              <Text style={[styles.consentAcceptText, { color: theme.tintText }]}>I understand — Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.consentDecline} onPress={() => setShowConsent(false)}>
              <Text style={[styles.consentDeclineText, { color: theme.secondaryText }]}>No thanks</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {!revealed && !loading && !error && (
        <TouchableOpacity
          style={[styles.revealBtn, { backgroundColor: theme.tint }]}
          onPress={() => consentGiven ? fetchInsights() : setShowConsent(true)}
          activeOpacity={0.82}
        >
          <Ionicons name="sparkles-outline" size={17} color="#fff" />
          <Text style={styles.revealText}>Analyze My Spending</Text>
        </TouchableOpacity>
      )}

      {loading && (
        <View style={[styles.loadingCard, { backgroundColor: theme.card }]}>
          <ActivityIndicator size="small" color={theme.tint} />
          <ThemedText style={styles.loadingText}>Analyzing your spending patterns…</ThemedText>
        </View>
      )}

      {error && !loading && (
        <View style={[styles.errorCard, { backgroundColor: theme.card }]}>
          <Ionicons name="alert-circle-outline" size={18} color={theme.expense} />
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <TouchableOpacity onPress={() => fetchInsights(true)} style={styles.retryBtn}>
            <Text style={[styles.retryText, { color: theme.tint }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {revealed && insights.length > 0 && (
        <>
          {insights.map((insight, i) => {
            const cfg   = TYPE_CONFIG[insight.type] || TYPE_CONFIG.neutral;
            const color = theme[cfg.colorKey];
            return (
              <Animated.View
                key={i}
                entering={FadeInDown.delay(i * 90).duration(280)}
                style={[styles.insightItem, { backgroundColor: theme.card }]}
              >
                <View style={[styles.iconCircle, { backgroundColor: color + '22' }]}>
                  <Ionicons name={cfg.icon} size={17} color={color} />
                </View>
                <View style={styles.insightContent}>
                  <Text style={[styles.insightTitle, { color }]}>{insight.title}</Text>
                  <ThemedText style={styles.insightBody}>{insight.body}</ThemedText>
                </View>
              </Animated.View>
            );
          })}

          <TouchableOpacity
            style={styles.regenRow}
            onPress={() => fetchInsights(true)}
            disabled={loading}
          >
            <Ionicons name="refresh-outline" size={13} color={theme.secondaryText} />
            <ThemedText style={[styles.regenText, { color: theme.secondaryText }]}>Regenerate</ThemedText>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 12 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badge: { fontSize: 11, fontWeight: '600' },

  revealBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 16,
  },
  revealText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  loadingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 18, borderRadius: 20,
  },
  loadingText: { fontSize: 13, flex: 1 },

  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 16, borderRadius: 20,
  },
  errorText: { fontSize: 13, flex: 1 },
  retryBtn: { paddingHorizontal: 8 },
  retryText: { fontSize: 13, fontWeight: '700' },

  insightItem: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: 16, borderRadius: 20, marginBottom: 10,
  },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  insightContent: { flex: 1, marginLeft: 12 },
  insightTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  insightBody: { fontSize: 13, lineHeight: 19 },

  regenRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 8,
  },
  regenText: { fontSize: 12, fontWeight: '600' },

  consentOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  consentCard: {
    width: '100%', borderRadius: 24, padding: 24, alignItems: 'center',
  },
  consentIcon: {
    width: 56, height: 56, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  consentTitle: { fontSize: 17, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  consentBody: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 20 },
  consentAccept: {
    width: '100%', paddingVertical: 14, borderRadius: 14,
    alignItems: 'center', marginBottom: 10,
  },
  consentAcceptText: { fontSize: 15, fontWeight: '700' },
  consentDecline: { paddingVertical: 8 },
  consentDeclineText: { fontSize: 13 },
});
