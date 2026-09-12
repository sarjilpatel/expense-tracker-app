import React, { useState, useEffect } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/src/context/ThemeContext';
import { AccountType, ACCOUNT_TYPE_META } from '@/src/services/accountService';
import { saveAccount, deleteAccount, getAccounts } from '@/src/services/dataService';
import { getContrastText, Currency } from '@/constants/theme';
import { space, radius, type, icon as iconSize } from '@/constants/tokens';
import { Screen, Button, Field, Touchable, Chip } from '@/components/ui';

const COLORS = [
  '#18181B', // graphite
  '#1E3A5F', // navy
  '#134E4A', // teal
  '#14532D', // forest
  '#4C1D95', // plum
  '#7C2D12', // rust
  '#92400E', // amber
  '#881337', // rose
  '#374151', // slate
  '#6B7280', // grey
  '#0F4C75', // deep blue
  '#3B4F6B', // denim
];

export default function AddAccountScreen() {
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();

  const [name, setName]                     = useState('');
  const [acctType, setAcctType]             = useState<AccountType>('bank');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [color, setColor]                   = useState(COLORS[1]);
  const [saving, setSaving]                 = useState(false);

  const isEdit = !!params.id;

  useEffect(() => {
    if (!params.id) return;
    getAccounts().then(accounts => {
      const acc = accounts.find(a => a.id === params.id);
      if (acc) {
        setName(acc.name);
        setAcctType(acc.type);
        setOpeningBalance(String(acc.openingBalance));
        setColor(acc.color);
      }
    });
  }, [params.id]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter an account name.'); return;
    }
    const bal = parseFloat(openingBalance) || 0;
    setSaving(true);
    try {
      await saveAccount({
        id: params.id || undefined,
        name: name.trim(),
        type: acctType,
        openingBalance: bal,
        color,
        icon: ACCOUNT_TYPE_META[acctType].icon,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save account.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!params.id) return;
    Alert.alert('Delete Account', 'All transaction links to this account will be removed. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteAccount(params.id!);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen
      title={isEdit ? 'Edit account' : 'Add account'}
      keyboard
      right={isEdit ? (
        <Touchable onPress={handleDelete} size={36} style={S.headerBtn} accessibilityLabel="Delete account" rippleBorderless haptic="medium">
          <Ionicons name="trash-outline" size={iconSize.md} color={theme.danger} />
        </Touchable>
      ) : undefined}
    >
      <Text style={[type.label, S.label, { color: theme.secondaryText }]}>Account type</Text>
      <View style={S.chips}>
        {(Object.keys(ACCOUNT_TYPE_META) as AccountType[]).map(k => {
          const meta = ACCOUNT_TYPE_META[k];
          return (
            <Chip key={k} emoji={meta.emoji} label={meta.label} selected={acctType === k} onPress={() => { setAcctType(k); setColor(meta.color); }} />
          );
        })}
      </View>

      <Field
        label="Account name"
        placeholder={`e.g. ${ACCOUNT_TYPE_META[acctType].label}`}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        style={{ marginTop: space.lg }}
      />

      <Field
        label={isEdit ? 'Opening balance' : 'Current balance'}
        placeholder="0.00"
        value={openingBalance}
        onChangeText={setOpeningBalance}
        keyboardType="decimal-pad"
        right={<Text style={[type.bodyStrong, { color: theme.secondaryText }]}>{Currency.symbol}</Text>}
        help="Set the current balance. Transactions linked to this account update it automatically."
        style={{ marginTop: space.lg }}
      />

      {/* The account colour is the one place a raw colour is picked on purpose — it is how the user
          tells accounts apart, so the wells paint the colour itself. */}
      <Text style={[type.label, S.label, { color: theme.secondaryText, marginTop: space.lg }]}>Colour</Text>
      <View style={S.colors}>
        {COLORS.map(c => (
          <Touchable
            key={c}
            onPress={() => setColor(c)}
            haptic="selection"
            size={36}
            style={[S.colorDot, { backgroundColor: c }, color === c && { borderColor: theme.text, borderWidth: 2 }]}
            accessibilityLabel={`Colour ${c}`}
            accessibilityState={{ selected: color === c }}
            rippleBorderless
          >
            {color === c && <Ionicons name="checkmark" size={iconSize.sm} color={getContrastText(c)} />}
          </Touchable>
        ))}
      </View>

      <Button label={isEdit ? 'Save changes' : 'Add account'} onPress={handleSave} loading={saving} style={{ marginTop: space.xl }} />
    </Screen>
  );
}

const S = StyleSheet.create({
  headerBtn: { width: 36, height: 36, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center' },
  label:     { marginTop: space.md, marginBottom: space.sm, marginLeft: space.xs },
  chips:     { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  colors:    { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  colorDot:  { width: 36, height: 36, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center' },
});
