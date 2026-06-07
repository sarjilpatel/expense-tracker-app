import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Alert, Switch, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

import { useTheme } from '@/src/context/ThemeContext';
import { useLanguage } from '@/src/i18n/LanguageContext';
import { useAuth } from '@/src/context/AuthContext';
import { usePreferences } from '@/src/context/PreferencesContext';
import { ThemedView } from '@/components/themed-view';
import { getProfile } from '@/src/services/authApi';
import {
  getBudgets, getTransactions,
  getCurrentGroup as getCategoryData,
} from '@/src/services/dataService';
import {
  CURRENCY_META, CurrencyCode, ordinalSuffix,
} from '@/src/services/preferencesService';
import { requestNotificationPermissions } from '@/src/services/notificationService';
import { discardLocalData, getLastSyncTime } from '@/src/services/syncService';
import apiClient from '@/src/services/apiClient';

// ── Language options ─────────────────────────────────────────────────────────
const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'gu', label: 'ગુ' },
  { code: 'hi', label: 'हि' },
] as const;

type ModalType = 'currency' | 'monthlyStart' | null;

function formatSyncTime(iso: string | null): string {
  if (!iso) return 'Never synced';
  const d = new Date(iso);
  const now = new Date();
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `Today ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (hrs < 48)  return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ── Shared row component ──────────────────────────────────────────────────────
function Row({
  icon, iconBg, iconColor = '#FFF', title, sub, right, onPress, danger,
}: {
  icon: string; iconBg: string; iconColor?: string;
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
        <Text style={[S.rowTitle, { color: danger ? theme.danger : theme.text }]}>{title}</Text>
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

// ── Hairline separator ────────────────────────────────────────────────────────
function Sep() {
  const { theme } = useTheme();
  return <View style={[S.sep, { backgroundColor: theme.separator }]} />;
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={[S.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {children}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const { theme, overrides }           = useTheme();
  const { language, setLanguage }      = useLanguage();
  const { user: authUser, isGuest, logout } = useAuth();
  const { prefs, updatePrefs }         = usePreferences();

  const [user,         setUser]         = useState<any>(null);
  const [group,        setGroup]        = useState<any>(null);
  const [budget,       setBudget]       = useState<any>(null);
  const [incomeCount,  setIncomeCount]  = useState(0);
  const [expenseCount, setExpenseCount] = useState(0);
  const [lastSync,     setLastSync]     = useState<string | null>(null);
  const [exporting,    setExporting]    = useState(false);
  const [wiping,       setWiping]       = useState(false);
  const [loading,      setLoading]      = useState(!isGuest);
  const [activeModal,  setActiveModal]  = useState<ModalType>(null);

  const fetchData = useCallback(async () => {
    try {
      const now = new Date();
      const calls: Promise<any>[] = [
        getBudgets(now.getMonth() + 1, now.getFullYear()),
        getCategoryData(),
      ];
      if (!isGuest) calls.push(getProfile());
      const [budgets, groupData, profileData] = await Promise.all(calls);

      const main = (budgets as any[])?.find((b: any) => !b.category) ?? null;
      setBudget(main);

      if (!isGuest) {
        // groupData is the full group object (name, members, categories, etc.)
        setGroup(groupData);
        setUser(profileData ?? null);
        getLastSyncTime().then(setLastSync).catch(() => {});
      }

      const cats = (groupData as any)?.categories ?? [];
      setIncomeCount((cats as any[]).filter((c: any) => c.type === 'income').length);
      setExpenseCount((cats as any[]).filter((c: any) => c.type === 'expense' || !c.type).length);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [isGuest]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleLogout = () =>
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { await logout(); router.replace('/(tabs)'); } },
    ]);

  const handleDeleteAccount = () =>
    Alert.alert('Delete Account', 'Permanently delete your account and all data?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await apiClient.delete('/auth/account'); await logout(); router.replace('/(tabs)'); }
          catch { Alert.alert('Error', 'Failed to delete account.'); }
        },
      },
    ]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const now = new Date();
      const txs = await getTransactions(now.getMonth() + 1, now.getFullYear()) as any[];
      const rows = [
        ['Date', 'Type', 'Category', 'Amount', 'Note'],
        ...txs.map(tx => [
          new Date(tx.date || tx.createdAt).toLocaleDateString(),
          tx.type, tx.category, tx.amount.toString(),
          tx.note ? `"${tx.note.replace(/"/g, '""')}"` : '',
        ]),
      ];
      const csv = rows.map(r => r.join(',')).join('\n');
      const name = `transactions_${now.toLocaleString('default', { month: 'long' })}_${now.getFullYear()}.csv`;
      const path = `${(FileSystem as any).documentDirectory}${name}`;
      await (FileSystem as any).writeAsStringAsync(path, csv, { encoding: 'utf8' });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export Transactions' });
      } else {
        Alert.alert('Exported', `Saved to: ${path}`);
      }
    } catch {
      Alert.alert('Error', 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleWipe = () =>
    Alert.alert('Wipe Local Data', 'Permanently delete all offline data?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Wipe', style: 'destructive', onPress: async () => {
          setWiping(true);
          try { await discardLocalData(); Alert.alert('Done', 'Local data wiped.'); }
          catch { Alert.alert('Error', 'Failed to wipe.'); }
          finally { setWiping(false); }
        },
      },
    ]);

  const accentColor  = overrides.tint    ?? theme.tint;
  const currencyMeta = CURRENCY_META[prefs.currency as CurrencyCode];

  if (loading) {
    return (
      <ThemedView style={[S.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={theme.tint} size="large" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={S.container}>
      <View style={S.header}>
        <Text style={[S.headerTitle, { color: theme.text }]}>More</Text>
      </View>

      <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>

        {/* ── 1. Account / Guest ── */}
        {isGuest ? (
          <TouchableOpacity
            style={[S.guestBanner, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => router.push('/login')}
            activeOpacity={0.8}
          >
            <View style={[S.guestIcon, { backgroundColor: accentColor }]}>
              <Ionicons name="cloud-outline" size={20} color={accentColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[S.guestTitle, { color: theme.text }]}>Sign in to unlock cloud features</Text>
              <Text style={[S.guestSub, { color: theme.secondaryText }]}>Backup, sync & group expenses</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={accentColor} />
          </TouchableOpacity>
        ) : (
          <Card>
            {/* Profile row */}
            <View style={S.profileRow}>
              <View style={[S.avatar, { backgroundColor: accentColor }]}>
                {user?.profilePhoto
                  ? <Image source={{ uri: user.profilePhoto }} style={S.avatarImg} />
                  : <Text style={S.avatarLetter}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
                }
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[S.profileName, { color: theme.text }]}>{user?.name || 'User'}</Text>
                <Text style={[S.profileEmail, { color: theme.secondaryText }]}>{user?.email || ''}</Text>
              </View>
              <TouchableOpacity
                style={[S.editBtn, { backgroundColor: accentColor }]}
                onPress={() => router.push('/edit-profile')}
              >
                <Ionicons name="pencil" size={16} color='#FFF' />
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* ── 2. Customize ── */}
        <Text style={[S.groupLabel, { color: theme.secondaryText }]}>CUSTOMIZE</Text>
        <Card>
          {/* Appearance */}
          <Row
            icon="color-palette-outline" iconBg={accentColor} iconColor='#FFF'
            title="Theme & Colors" sub="Accent, income & expense palette"
            onPress={() => router.push('/settings/customization')}
          />
          <Sep />

          {/* Currency */}
          <Row
            icon="card-outline" iconBg={accentColor} iconColor='#FFF'
            title="Currency" sub={currencyMeta?.name}
            onPress={() => setActiveModal('currency')}
            right={
              <View style={S.rowRight}>
                <Text style={[S.rowValue, { color: accentColor }]}>{prefs.currency}</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.secondaryText} />
              </View>
            }
          />
          <Sep />

          {/* Monthly Start */}
          <Row
            icon="calendar-outline" iconBg={accentColor} iconColor='#FFF'
            title="Month Starts On" sub="Period reset date"
            onPress={() => setActiveModal('monthlyStart')}
            right={
              <View style={S.rowRight}>
                <Text style={[S.rowValue, { color: accentColor }]}>{ordinalSuffix(prefs.monthlyStart)}</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.secondaryText} />
              </View>
            }
          />
          <Sep />

          {/* Week Start — inline toggle */}
          <View style={S.row}>
            <View style={[S.iconBox, { backgroundColor: accentColor }]}>
              <Ionicons name="today-outline" size={18} color='#FFF' />
            </View>
            <Text style={[S.rowTitle, { color: theme.text, flex: 1 }]}>Week Starts On</Text>
            <View style={[S.segmentWrap, { backgroundColor: theme.cardAlt ?? theme.border }]}>
              {(['Sun', 'Mon'] as const).map(day => (
                <TouchableOpacity
                  key={day}
                  style={[S.segBtn, prefs.weekStart === day && { backgroundColor: accentColor }]}
                  onPress={() => updatePrefs({ weekStart: day })}
                >
                  <Text style={[S.segBtnText, { color: prefs.weekStart === day ? '#FFF' : theme.secondaryText }]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Sep />

          {/* Language — inline chips */}
          <View style={S.row}>
            <View style={[S.iconBox, { backgroundColor: accentColor }]}>
              <Ionicons name="language-outline" size={18} color='#FFF' />
            </View>
            <Text style={[S.rowTitle, { color: theme.text, flex: 1 }]}>Language</Text>
            <View style={S.langRow}>
              {LANGS.map(l => {
                const active = language === l.code;
                return (
                  <TouchableOpacity
                    key={l.code}
                    style={[S.langChip, { borderColor: active ? accentColor : theme.border },
                      active && { backgroundColor: accentColor }]}
                    onPress={() => setLanguage(l.code as any)}
                  >
                    <Text style={[S.langChipText, { color: active ? '#FFF' : theme.secondaryText }]}>
                      {l.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <Sep />

          {/* Notifications */}
          <View style={S.row}>
            <View style={[S.iconBox, { backgroundColor: theme.warning ?? '#FF9500' }]}>
              <Ionicons name="notifications-outline" size={18} color='#FFF' />
            </View>
            <View style={S.rowMid}>
              <Text style={[S.rowTitle, { color: theme.text }]}>Notifications</Text>
              <Text style={[S.rowSub, { color: theme.secondaryText }]}>Budget alerts & reminders</Text>
            </View>
            <Switch
              value={prefs.notifications}
              onValueChange={async val => {
                if (val) {
                  const ok = await requestNotificationPermissions();
                  if (!ok) { Alert.alert('Permission Required', 'Enable notifications in device settings.'); return; }
                }
                updatePrefs({ notifications: val });
              }}
              trackColor={{ false: theme.border, true: accentColor }}
              thumbColor={prefs.notifications ? accentColor : theme.secondaryText}
            />
          </View>
        </Card>

        {/* ── 3. Money ── */}
        <Text style={[S.groupLabel, { color: theme.secondaryText }]}>MONEY</Text>
        <Card>
          <Row
            icon="wallet-outline" iconBg={accentColor} iconColor='#FFF'
            title="Monthly Budget"
            sub={budget ? `${currencyMeta?.symbol ?? '₹'} ${budget.amount.toLocaleString('en-IN')}/month` : 'Not set'}
            onPress={() => router.push('/budget')}
          />
          <Sep />
          {/* Categories — 2-column grid */}
          <View style={S.catGrid}>
            <TouchableOpacity
              style={[S.catCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => router.push({ pathname: '/manage-categories', params: { type: 'income' } })}
              activeOpacity={0.7}
            >
              <View style={[S.catIcon, { backgroundColor: theme.income }]}>
                <Ionicons name="arrow-down-outline" size={18} color='#FFF' />
              </View>
              <Text style={[S.catTitle, { color: theme.income }]}>Income</Text>
              <Text style={[S.catCount, { color: theme.secondaryText }]}>
                {incomeCount} {incomeCount === 1 ? 'category' : 'categories'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[S.catCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => router.push({ pathname: '/manage-categories', params: { type: 'expense' } })}
              activeOpacity={0.7}
            >
              <View style={[S.catIcon, { backgroundColor: theme.expense }]}>
                <Ionicons name="arrow-up-outline" size={18} color='#FFF' />
              </View>
              <Text style={[S.catTitle, { color: theme.expense }]}>Expenses</Text>
              <Text style={[S.catCount, { color: theme.secondaryText }]}>
                {expenseCount} {expenseCount === 1 ? 'category' : 'categories'}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* ── 4. Data ── */}
        <Text style={[S.groupLabel, { color: theme.secondaryText }]}>DATA</Text>
        <Card>
          {!isGuest && (
            <>
              <View style={S.row}>
                <View style={[S.iconBox, { backgroundColor: accentColor }]}>
                  <Ionicons name="cloud-done-outline" size={18} color='#FFF' />
                </View>
                <View style={S.rowMid}>
                  <Text style={[S.rowTitle, { color: theme.text }]}>Cloud Backup</Text>
                  <Text style={[S.rowSub, { color: theme.secondaryText }]}>{formatSyncTime(lastSync)}</Text>
                </View>
                <View style={[S.syncDot, { backgroundColor: lastSync ? '#34C759' : theme.secondaryText }]} />
              </View>
              <Sep />
            </>
          )}
          <Row
            icon="download-outline" iconBg={theme.income} iconColor='#FFF'
            title="Export CSV" sub="Current month transactions"
            onPress={handleExport}
            right={exporting ? <ActivityIndicator size="small" color={theme.income} /> : undefined}
          />
          {isGuest && (
            <>
              <Sep />
              <Row
                icon="trash-outline" iconBg={theme.danger} iconColor='#FFF'
                title="Wipe Local Data" sub="Delete all offline data permanently"
                onPress={handleWipe} danger
                right={wiping ? <ActivityIndicator size="small" color={theme.danger} /> : undefined}
              />
            </>
          )}
        </Card>

        {/* ── 5. Account (logged-in) ── */}
        {!isGuest && (
          <>
            <Text style={[S.groupLabel, { color: theme.secondaryText }]}>ACCOUNT</Text>
            <Card>
              {group ? (
                <Row
                  icon="people-outline" iconBg={accentColor} iconColor='#FFF'
                  title={group.name}
                  sub={`${group.members?.length || 0} member${(group.members?.length || 0) !== 1 ? 's' : ''}`}
                  onPress={() => router.push('/manage-group')}
                />
              ) : (
                <Row
                  icon="people-outline" iconBg={accentColor} iconColor='#FFF'
                  title="Create or Join Group"
                  sub="Share expenses with family or team"
                  onPress={() => router.push('/group-setup')}
                />
              )}
              <Sep />
              <Row
                icon="person-remove-outline" iconBg={theme.danger} iconColor='#FFF'
                title="Delete Account" sub="Permanently remove your account"
                onPress={handleDeleteAccount} danger
              />
            </Card>

            <TouchableOpacity
              style={[S.logoutBtn, { borderColor: theme.border }]}
              onPress={handleLogout}
              activeOpacity={0.75}
            >
              <Ionicons name="log-out-outline" size={18} color={theme.danger} />
              <Text style={[S.logoutText, { color: theme.danger }]}>Log Out</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Currency Picker Modal ── */}
      <Modal visible={activeModal === 'currency'} transparent animationType="slide">
        <View style={S.modalOverlay}>
          <View style={[S.modalSheet, { backgroundColor: theme.card }]}>
            <View style={S.modalHandle} />
            <Text style={[S.modalTitle, { color: theme.text }]}>Select Currency</Text>
            <FlatList
              data={Object.entries(CURRENCY_META) as [CurrencyCode, typeof CURRENCY_META[CurrencyCode]][]}
              keyExtractor={([code]) => code}
              renderItem={({ item: [code, meta] }) => {
                const selected = prefs.currency === code;
                return (
                  <TouchableOpacity
                    style={[S.pickerRow, selected && { backgroundColor: theme.cardAlt ?? theme.border }]}
                    onPress={() => { updatePrefs({ currency: code }); setActiveModal(null); }}
                  >
                    <View style={[S.symbolBox, { backgroundColor: accentColor }]}>
                      <Text style={[S.symbolText, { color: '#FFF' }]}>{meta.symbol}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[S.pickerRowTitle, { color: theme.text }]}>{code}</Text>
                      <Text style={[S.pickerRowSub, { color: theme.secondaryText }]}>{meta.name}</Text>
                    </View>
                    {selected && <Ionicons name="checkmark-circle" size={20} color={accentColor} />}
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity style={[S.modalClose, { borderColor: theme.border }]} onPress={() => setActiveModal(null)}>
              <Text style={[S.modalCloseText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Monthly Start Picker Modal ── */}
      <Modal visible={activeModal === 'monthlyStart'} transparent animationType="slide">
        <View style={S.modalOverlay}>
          <View style={[S.modalSheet, { backgroundColor: theme.card }]}>
            <View style={S.modalHandle} />
            <Text style={[S.modalTitle, { color: theme.text }]}>Month Starts On</Text>
            <Text style={[S.modalSub, { color: theme.secondaryText }]}>Summaries reset on this day</Text>
            <View style={S.dayGrid}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map(day => {
                const sel = prefs.monthlyStart === day;
                return (
                  <TouchableOpacity
                    key={day}
                    style={[S.dayBtn, { borderColor: sel ? accentColor : theme.border }, sel && { backgroundColor: accentColor }]}
                    onPress={() => { updatePrefs({ monthlyStart: day }); setActiveModal(null); }}
                  >
                    <Text style={[S.dayBtnText, { color: sel ? '#FFF' : theme.text }]}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={[S.modalClose, { borderColor: theme.border }]} onPress={() => setActiveModal(null)}>
              <Text style={[S.modalCloseText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  container:   { flex: 1, paddingTop: 56 },
  header:      { paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 26, fontWeight: '800' },
  scroll:      { paddingHorizontal: 16, paddingBottom: 40 },

  groupLabel: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.8,
    marginBottom: 8, marginTop: 20, paddingLeft: 4,
  },

  card: {
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden',
    marginBottom: 0,
  },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 62 },

  row:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  iconBox: { width: 34, height: 34, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  rowMid:  { flex: 1 },
  rowTitle:{ fontSize: 15, fontWeight: '600' },
  rowSub:  { fontSize: 12, marginTop: 1 },
  rowRight:{ flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowValue:{ fontSize: 14, fontWeight: '700' },

  // Guest banner
  guestBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
    padding: 14, marginBottom: 0,
  },
  guestIcon:  { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  guestTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  guestSub:   { fontSize: 12 },

  // Profile card
  profileRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  avatar:       { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg:    { width: '100%', height: '100%' },
  avatarLetter: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  profileName:  { fontSize: 15, fontWeight: '700' },
  profileEmail: { fontSize: 12, marginTop: 2 },
  editBtn:      { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  // Inline controls
  segmentWrap: { flexDirection: 'row', borderRadius: 9, padding: 2, gap: 2 },
  segBtn:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 7 },
  segBtnText:  { fontSize: 13, fontWeight: '700' },

  langRow:     { flexDirection: 'row', gap: 6 },
  langChip:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  langChipText:{ fontSize: 12, fontWeight: '700' },

  syncDot: { width: 8, height: 8, borderRadius: 4 },

  // 2-column category grid
  catGrid: { flexDirection: 'row', gap: 10, padding: 12 },
  catCard: {
    flex: 1, borderRadius: 12, borderWidth: 1,
    padding: 14, gap: 6,
  },
  catIcon:  { width: 34, height: 34, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  catTitle: { fontSize: 13, fontWeight: '800' },
  catCount: { fontSize: 11 },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 14,
    paddingVertical: 14, marginTop: 16,
  },
  logoutText: { fontSize: 15, fontWeight: '700' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: '#8E8E93', alignSelf: 'center', marginBottom: 16 },
  modalTitle:   { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  modalSub:     { fontSize: 13, marginBottom: 14 },
  modalClose:   { borderWidth: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 10 },
  modalCloseText: { fontSize: 15, fontWeight: '700' },

  pickerRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 4, borderRadius: 10 },
  symbolBox:      { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  symbolText:     { fontSize: 17, fontWeight: '700' },
  pickerRowTitle: { fontSize: 15, fontWeight: '700' },
  pickerRowSub:   { fontSize: 12, marginTop: 1 },

  dayGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  dayBtn:     { width: 46, height: 46, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  dayBtnText: { fontSize: 14, fontWeight: '700' },
});
