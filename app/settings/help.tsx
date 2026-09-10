import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/context/ThemeContext';
import { ThemedView } from '@/components/themed-view';

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

function LinkRow({
  icon, iconBg, iconColor, title, sub, onPress,
}: {
  icon: string; iconBg: string; iconColor: string;
  title: string; sub?: string; onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity style={S.row} onPress={onPress} activeOpacity={0.65}>
      <View style={[S.iconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={S.rowMid}>
        <Text style={[S.rowTitle, { color: theme.text }]}>{title}</Text>
        {sub ? <Text style={[S.rowSub, { color: theme.secondaryText }]}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.secondaryText} />
    </TouchableOpacity>
  );
}

function InfoRow({
  icon, iconBg, iconColor, title, value,
}: {
  icon: string; iconBg: string; iconColor: string;
  title: string; value: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={S.row}>
      <View style={[S.iconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={S.rowMid}>
        <Text style={[S.rowTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[S.rowSub, { color: theme.secondaryText }]}>{value}</Text>
      </View>
    </View>
  );
}

export default function HelpScreen() {
  const { theme } = useTheme();
  const { top }   = useSafeAreaInsets();

  return (
    <ThemedView style={[S.container, { paddingTop: top + 8 }]}>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()} style={S.backBtn} hitSlop={16}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[S.headerTitle, { color: theme.text }]}>Help</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>

        <Text style={[S.groupLabel, { color: theme.secondaryText }]}>LEGAL</Text>
        <Card>
          <LinkRow
            icon="shield-checkmark-outline" iconBg="#71717A" iconColor="#FFF"
            title="Privacy Policy"
            sub="How we collect and use your data"
            onPress={() => Linking.openURL('https://sarjilpatel.github.io/expense-tracker/privacy')}
          />
          <Sep />
          <LinkRow
            icon="document-text-outline" iconBg="#71717A18" iconColor="#71717A"
            title="Terms of Service"
            sub="Rules and conditions of use"
            onPress={() => Linking.openURL('https://sarjilpatel.github.io/expense-tracker/terms')}
          />
        </Card>

        <Text style={[S.groupLabel, { color: theme.secondaryText }]}>SUPPORT</Text>
        <Card>
          <LinkRow
            icon="mail-outline" iconBg="#71717A" iconColor="#FFF"
            title="Contact Support"
            sub="Get help with the app"
            onPress={() => Linking.openURL('mailto:sarjilpatel2903@gmail.com?subject=Expense%20Tracker%20Support')}
          />
        </Card>

        <Text style={[S.groupLabel, { color: theme.secondaryText }]}>ABOUT</Text>
        <Card>
          <InfoRow
            icon="information-circle-outline"
            iconBg={theme.cardAlt ?? theme.border}
            iconColor={theme.secondaryText}
            title="Version"
            value="1.0.0"
          />
        </Card>

        <View style={{ height: 32 }} />
      </ScrollView>
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
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  sep:  { height: StyleSheet.hairlineWidth, marginLeft: 62 },

  row:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  iconBox: { width: 34, height: 34, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  rowMid:  { flex: 1 },
  rowTitle:{ fontSize: 15, fontWeight: '600' },
  rowSub:  { fontSize: 12, marginTop: 1 },
});
