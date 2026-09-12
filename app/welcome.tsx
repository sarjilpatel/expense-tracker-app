/**
 * First run (W2-32). Three steps, one route, no account required:
 *
 *   1. what the app does            — three lines, not a carousel
 *   2. the device settings that used to hide in More — currency, theme, starter categories
 *   3. how to proceed               — as a guest (the default), or sign in / create an account
 *
 * Guest mode already works, so the flow ends in a usable app either way. It shows once per
 * device (`onboardingService`); the same settings stay reachable from More afterwards.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/context/ThemeContext';
import { usePreferences } from '@/src/context/PreferencesContext';
import { applyCategoryPreset } from '@/src/services/dataService';
import { markWelcomeSeen } from '@/src/services/onboardingService';
import { CATEGORY_PRESETS } from '@/constants/categoryPresets';
import { hexToRGBA } from '@/constants/theme';
import { space, radius, type, icon as iconSize } from '@/constants/tokens';
import { Screen, Button, Chip, SectionHeader } from '@/components/ui';
import { AuthHero } from '@/components/auth/AuthHero';
import { CurrencyPicker } from '@/components/transaction/CurrencyPicker';

type Step = 0 | 1 | 2;

const VALUE = [
  { icon: 'receipt-outline',   title: 'Track every rupee',   body: 'Log spending in two taps and see where the month went.' },
  { icon: 'flag-outline',      title: 'Plan ahead',          body: 'Budgets and savings goals that show progress as you go.' },
  { icon: 'people-outline',    title: 'Split bills, settle fast', body: 'Trips and shared costs worked out to the fewest payments.' },
] as const;

const MODES = [
  { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { value: 'light',  label: 'Light',  icon: 'sunny-outline' },
  { value: 'dark',   label: 'Dark',   icon: 'moon-outline' },
] as const;

export default function WelcomeScreen() {
  const { theme, overrides, setOverride } = useTheme();
  const { prefs, updatePrefs } = usePreferences();
  const [step, setStep]       = useState<Step>(0);
  const [picked, setPicked]   = useState<string[]>(['household']);
  const [finishing, setFinishing] = useState(false);

  const togglePreset = (key: string) =>
    setPicked(p => p.includes(key) ? p.filter(k => k !== key) : [...p, key]);

  // Starter categories are applied once, when the user commits — a guest keeps them on the
  // device, and a later sign-in carries them up with the rest of the local data.
  const finish = async (then: 'guest' | 'login' | 'signup') => {
    setFinishing(true);
    try {
      await Promise.all(picked.map(key => applyCategoryPreset(key).catch(() => {})));
      await markWelcomeSeen();
    } finally {
      setFinishing(false);
    }
    if (then === 'guest') router.replace('/(tabs)');
    else router.replace(then === 'login' ? '/login' : '/signup');
  };

  const dots = (
    <View style={S.dots} accessibilityLabel={`Step ${step + 1} of 3`}>
      {[0, 1, 2].map(i => (
        <View key={i} style={[S.dot, { backgroundColor: i === step ? theme.tint : theme.cardAlt }]} />
      ))}
    </View>
  );

  return (
    <Screen onBack={step === 0 ? false : () => setStep(s => (s - 1) as Step)} scroll={step === 1} contentStyle={S.content}>
      {step === 0 && (
        <Animated.View key="s0" entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)} style={S.fill}>
          <AuthHero title="Money, in order" subtitle="A clear picture of what comes in, what goes out and what is left." />
          <View style={S.list}>
            {VALUE.map(v => (
              <View key={v.title} style={S.valueRow}>
                <View style={[S.valueIcon, { backgroundColor: hexToRGBA(theme.tint, 0.12) }]}>
                  <Ionicons name={v.icon} size={iconSize.lg} color={theme.tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[type.bodyStrong, { color: theme.text }]}>{v.title}</Text>
                  <Text style={[type.label, { color: theme.secondaryText }]}>{v.body}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={S.footer}>
            {dots}
            <Button label="Get started" icon="arrow-forward" onPress={() => setStep(1)} />
          </View>
        </Animated.View>
      )}

      {step === 1 && (
        <Animated.View key="s1" entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)}>
          <AuthHero icon="options-outline" title="Make it yours" subtitle="All of this can be changed later in More." />

          <SectionHeader title="Currency" style={{ marginTop: 0 }} />
          <CurrencyPicker value={prefs.currency as any} onChange={code => updatePrefs({ currency: code })} />

          <SectionHeader title="Appearance" />
          <View style={S.chips}>
            {MODES.map(m => (
              <Chip key={m.value} icon={m.icon} label={m.label} selected={(overrides.themeMode ?? 'system') === m.value} onPress={() => setOverride('themeMode', m.value)} />
            ))}
          </View>

          <SectionHeader title="Starter categories" count={picked.length || undefined} />
          <Text style={[type.label, { color: theme.secondaryText, marginBottom: space.sm }]}>
            Pick what fits — each pack adds a ready-made set you can edit any time.
          </Text>
          <View style={S.chips}>
            {CATEGORY_PRESETS.map(p => (
              <Chip key={p.key} icon={p.icon as any} label={`${p.name} · ${p.count}`} selected={picked.includes(p.key)} onPress={() => togglePreset(p.key)} accessibilityLabel={`${p.name}, ${p.count} categories`} />
            ))}
          </View>

          <View style={S.footer}>
            {dots}
            <Button label="Continue" icon="arrow-forward" onPress={() => setStep(2)} />
          </View>
        </Animated.View>
      )}

      {step === 2 && (
        <Animated.View key="s2" entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)} style={S.fill}>
          <AuthHero icon="checkmark-circle-outline" title="You're set" subtitle="Start right away — an account is only for backup, sync and sharing with a group." />
          <View style={[S.note, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="phone-portrait-outline" size={iconSize.md} color={theme.secondaryText} />
            <Text style={[type.label, { flex: 1, color: theme.secondaryText }]}>
              Without an account everything stays on this phone. Sign in later and it comes with you.
            </Text>
          </View>
          <View style={S.footer}>
            {dots}
            <Button label="Start without an account" onPress={() => finish('guest')} loading={finishing} disabled={finishing} />
            <Button label="Sign in" variant="secondary" onPress={() => finish('login')} disabled={finishing} />
            <Button label="Create an account" variant="ghost" size="sm" onPress={() => finish('signup')} disabled={finishing} />
          </View>
        </Animated.View>
      )}
    </Screen>
  );
}

const S = StyleSheet.create({
  content:   { flexGrow: 1 },
  fill:      { flex: 1 },
  list:      { gap: space.lg, paddingHorizontal: space.xs },
  valueRow:  { flexDirection: 'row', alignItems: 'center', gap: space.md },
  valueIcon: { width: 48, height: 48, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  chips:     { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  note:      { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  footer:    { marginTop: 'auto', paddingTop: space.xl, gap: space.sm },
  dots:      { flexDirection: 'row', justifyContent: 'center', gap: space.sm, marginBottom: space.sm },
  dot:       { width: 8, height: 8, borderRadius: radius.full },
});
