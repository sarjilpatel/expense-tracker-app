import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLanguage } from '@/src/i18n/LanguageContext';
import { getProfile } from '@/src/services/authApi';
import { getCurrentGroup } from '@/src/services/groupApi';
import { getBudgets } from '@/src/services/budgetApi';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

import { ProfileSection } from '@/components/settings/ProfileSection';
import { GroupSection } from '@/components/settings/GroupSection';
import { BudgetSection } from '@/components/settings/BudgetSection';
import { LanguageSection } from '@/components/settings/LanguageSection';
import { DataSection } from '@/components/settings/DataSection';

export default function SettingsScreen() {
  const { t } = useLanguage();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme || 'light'];

  const [user, setUser]           = useState<any>(null);
  const [group, setGroup]         = useState<any>(null);
  const [currentBudget, setCurrentBudget] = useState<any>(null);
  const [loading, setLoading]     = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [profileData, groupData] = await Promise.all([getProfile(), getCurrentGroup()]);
      setUser(profileData);
      setGroup(groupData);
      const now = new Date();
      const budgets = await getBudgets(now.getMonth() + 1, now.getFullYear());
      if (budgets?.length > 0) {
        const main = budgets.find((b: any) => !b.category);
        setCurrentBudget(main || null);
      } else {
        setCurrentBudget(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('user');
          router.replace('/login');
        },
      },
    ]);
  };

  if (loading && !group) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <ActivityIndicator color={theme.tint} size="large" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">{t('settings')}</ThemedText>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ProfileSection user={user} tintColor={theme.tint} />

        <GroupSection group={group} theme={theme} />

        <LanguageSection theme={theme} />

        <BudgetSection
          currentBudget={currentBudget}
          theme={theme}
          onUpdated={fetchData}
        />

        <DataSection theme={theme} />

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <View style={[styles.logoutIcon, { backgroundColor: `${theme.danger}15` }]}>
            <Ionicons name="log-out-outline" size={20} color={theme.danger} />
          </View>
          <Text style={[styles.logoutText, { color: theme.danger }]}>{t('logout')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  center:    { justifyContent: 'center', alignItems: 'center' },
  header:    { paddingHorizontal: 20, marginBottom: 24 },
  content:   { paddingHorizontal: 20, paddingBottom: 60 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, gap: 12, marginTop: 20 },
  logoutIcon:{ width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  logoutText:{ fontSize: 16, fontWeight: '700' },
});
