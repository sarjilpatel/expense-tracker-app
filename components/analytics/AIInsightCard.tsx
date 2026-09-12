import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { space, radius, type, icon as iconSize } from '@/constants/tokens';
import { Sheet, Button, Card, SectionHeader, type SheetHandle } from '@/components/ui';
import { getInsights } from '@/src/services/dataService';
import { getCachedInsights, setCachedInsights } from '@/src/cache/transactionCache';
import { updateAiConsent } from '@/src/services/authApi';

const AI_CONSENT_KEY = '@ai_consent_given'; // fallback for guests

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
  const { user, isGuest, updateUser } = useAuth();
  const consentSheet = useRef<SheetHandle>(null);

  const [loading,       setLoading]       = useState(false);
  const [insights,      setInsights]      = useState<Insight[]>([]);
  const [revealed,      setRevealed]      = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [consentGiven,  setConsentGiven]  = useState<boolean | null>(null);

  useEffect(() => {
    if (!isGuest && user) {
      // Logged-in: use server-side consent as source of truth
      setConsentGiven(!!user.aiConsentGiven);
    } else {
      // Guest: fall back to AsyncStorage
      AsyncStorage.getItem(AI_CONSENT_KEY).then(val => setConsentGiven(val === 'true'));
    }
  }, [user, isGuest]);

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

  const acceptConsent = async () => {
    setConsentGiven(true);
    consentSheet.current?.dismiss();
    if (!isGuest) {
      updateAiConsent(true).catch(() => {});
      updateUser({ aiConsentGiven: true });
    } else {
      await AsyncStorage.setItem(AI_CONSENT_KEY, 'true');
    }
    fetchInsights();
  };

  if (!hasData) return null;

  return (
    <View style={S.root}>
      <SectionHeader title="AI insights" style={{ marginTop: 0 }} />

      {/* One-time consent, on the shared Sheet (W2-11). */}
      <Sheet ref={consentSheet} title="Before we analyze" keyboard="none">
        <View style={S.consent}>
          <View style={[S.consentIcon, { backgroundColor: theme.tint + '1F' }]}>
            <Ionicons name="shield-checkmark-outline" size={iconSize.xl} color={theme.tint} />
          </View>
          <Text style={[type.body, S.center, { color: theme.secondaryText }]}>
            To generate insights, your monthly spending totals and category percentages are sent to Anthropic AI (Claude).{'\n\n'}
            No individual transaction details, notes, or personal information are included.{'\n\n'}
            Anthropic may retain inputs for up to 30 days per their privacy policy.
          </Text>
          <View style={S.actions}>
            <Button label="I understand — continue" icon="sparkles-outline" onPress={acceptConsent} />
            <Button label="No thanks" variant="ghost" size="sm" onPress={() => consentSheet.current?.dismiss()} />
          </View>
        </View>
      </Sheet>

      {!revealed && !loading && !error && (
        <Button
          label="Analyze my spending"
          icon="sparkles-outline"
          onPress={() => consentGiven ? fetchInsights() : consentSheet.current?.present()}
        />
      )}

      {loading && (
        <Card style={S.inline}>
          <ActivityIndicator size="small" color={theme.tint} />
          <Text style={[type.body, { flex: 1, color: theme.text }]}>Analyzing your spending patterns…</Text>
        </Card>
      )}

      {error && !loading && (
        <Card style={S.inline}>
          <Ionicons name="alert-circle-outline" size={iconSize.md} color={theme.expense} />
          <Text style={[type.body, { flex: 1, color: theme.text }]}>{error}</Text>
          <Button label="Retry" variant="ghost" size="sm" onPress={() => fetchInsights(true)} />
        </Card>
      )}

      {revealed && insights.length > 0 && (
        <>
          {insights.map((insight, i) => {
            const cfg   = TYPE_CONFIG[insight.type] || TYPE_CONFIG.neutral;
            const color = theme[cfg.colorKey];
            return (
              <Animated.View key={i} entering={FadeInDown.delay(i * 90).duration(280)}>
                <Card style={S.insight}>
                  <View style={[S.iconCircle, { backgroundColor: color + '22' }]}>
                    <Ionicons name={cfg.icon} size={iconSize.md} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.overline, { color, marginBottom: space.xs }]}>{insight.title}</Text>
                    <Text style={[type.body, { color: theme.text }]}>{insight.body}</Text>
                  </View>
                </Card>
              </Animated.View>
            );
          })}

          <Button label="Regenerate" icon="refresh-outline" variant="ghost" size="sm" onPress={() => fetchInsights(true)} disabled={loading} />
        </>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root:        { marginTop: space.md, gap: space.sm },
  inline:      { flexDirection: 'row', alignItems: 'center', gap: space.md },
  insight:     { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  iconCircle:  { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  consent:     { alignItems: 'center', gap: space.md, paddingTop: space.sm },
  consentIcon: { width: 56, height: 56, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' },
  center:      { textAlign: 'center' },
  actions:     { alignSelf: 'stretch', gap: space.sm, marginTop: space.sm },
});
