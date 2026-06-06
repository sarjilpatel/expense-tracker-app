import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';


import { useTheme } from '@/src/context/ThemeContext';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import {
  Account, AccountType, ACCOUNT_TYPE_META,
  saveAccount, deleteAccount, getAccounts,
} from '@/src/services/accountService';

const COLORS = ['#10B981', '#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899', '#6B7280', '#14B8A6', '#F97316', '#6366F1'];

export default function AddAccountScreen() {
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();

  const [name, setName]                   = useState('');
  const [type, setType]                   = useState<AccountType>('bank');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [color, setColor]                 = useState(COLORS[1]);
  const [saving, setSaving]               = useState(false);
  const isEdit = !!params.id;

  useEffect(() => {
    if (!params.id) return;
    getAccounts().then(accounts => {
      const acc = accounts.find(a => a.id === params.id);
      if (acc) {
        setName(acc.name);
        setType(acc.type);
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
        type,
        openingBalance: bal,
        color,
        icon: ACCOUNT_TYPE_META[type].icon,
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ThemedView style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <ThemedText type="subtitle">{isEdit ? 'Edit Account' : 'Add Account'}</ThemedText>
          {isEdit ? (
            <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 36 }} />
          )}
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Account type picker */}
          <ThemedText style={styles.label}>Account Type</ThemedText>
          <View style={styles.typeGrid}>
            {(Object.keys(ACCOUNT_TYPE_META) as AccountType[]).map(k => {
              const meta = ACCOUNT_TYPE_META[k];
              const active = type === k;
              return (
                <TouchableOpacity
                  key={k}
                  style={[styles.typeCard, { borderColor: active ? meta.color : theme.border, backgroundColor: active ? meta.color : theme.card }]}
                  onPress={() => { setType(k); setColor(meta.color); }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 22 }}>{meta.emoji}</Text>
                  <Text style={[styles.typeLabel, { color: active ? '#FFF' : theme.secondaryText }]}>{meta.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Account name */}
          <ThemedText style={[styles.label, { marginTop: 24 }]}>Account Name</ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
            placeholder={`e.g. ${ACCOUNT_TYPE_META[type].label}`}
            placeholderTextColor={theme.secondaryText}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          {/* Opening balance */}
          <ThemedText style={[styles.label, { marginTop: 24 }]}>
            {isEdit ? 'Opening Balance' : 'Current Balance'}
          </ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
            placeholder="0.00"
            placeholderTextColor={theme.secondaryText}
            value={openingBalance}
            onChangeText={setOpeningBalance}
            keyboardType="decimal-pad"
          />
          <Text style={[styles.hint, { color: theme.secondaryText }]}>
            Set the current balance. Future transactions linked to this account will update it automatically.
          </Text>

          {/* Color picker */}
          <ThemedText style={[styles.label, { marginTop: 24 }]}>Color</ThemedText>
          <View style={styles.colorRow}>
            {COLORS.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotActive]}
                onPress={() => setColor(c)}
                activeOpacity={0.8}
              >
                {color === c && <Ionicons name="checkmark" size={14} color="#FFF" />}
              </TouchableOpacity>
            ))}
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: color }, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-circle" size={22} color="#FFF" />
            <Text style={styles.saveBtnText}>{isEdit ? 'Update Account' : 'Add Account'}</Text>
          </TouchableOpacity>

        </ScrollView>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 20,
  },
  backBtn:   { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  scroll:    { paddingHorizontal: 20, paddingBottom: 60 },

  label: { fontSize: 13, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard: {
    width: '30%', alignItems: 'center', gap: 6, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1.5,
  },
  typeLabel: { fontSize: 11, fontWeight: '700' },

  input: {
    height: 52, borderRadius: 14, paddingHorizontal: 16,
    fontSize: 16, borderWidth: 1,
  },
  hint: { fontSize: 12, marginTop: 8, lineHeight: 18 },

  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorDot: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  colorDotActive: { borderWidth: 3, borderColor: '#FFF' },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 56, borderRadius: 18, marginTop: 32,
  },
  saveBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
});
