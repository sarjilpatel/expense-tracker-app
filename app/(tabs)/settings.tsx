import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Clipboard,
} from 'react-native';
import { Image } from 'expo-image';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLanguage } from '@/src/i18n/LanguageContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { getBudgets, setBudget, deleteBudget } from '@/src/services/budgetApi';
import { getProfile } from '@/src/services/authApi';
import { getCurrentGroup } from '@/src/services/groupApi';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
  const { language, setLanguage, t } = useLanguage();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme || 'light'];

  const [user, setUser] = useState<any>(null);
  const [group, setGroup] = useState<any>(null);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [currentBudget, setCurrentBudget] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [budgetLoading, setBudgetLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [profileData, groupData] = await Promise.all([
        getProfile(),
        getCurrentGroup()
      ]);
      setUser(profileData);
      setGroup(groupData);

      const now = new Date();
      const budgets = await getBudgets(now.getMonth() + 1, now.getFullYear());
      if (budgets && budgets.length > 0) {
        const mainBudget = budgets.find((b: any) => !b.category);
        setCurrentBudget(mainBudget);
        if (mainBudget) setBudgetAmount(mainBudget.amount.toString());
      } else {
        setCurrentBudget(null);
        setBudgetAmount('');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleUpdateBudget = async () => {
    if (!budgetAmount || budgetLoading) return;
    setBudgetLoading(true);
    try {
      const now = new Date();
      await setBudget({
        amount: parseFloat(budgetAmount),
        month: now.getMonth() + 1,
        year: now.getFullYear()
      });
      Alert.alert('Success', 'Budget updated successfully');
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to update budget');
    } finally {
      setBudgetLoading(false);
    }
  };

  const handleRemoveBudget = async () => {
    if (!currentBudget?._id) return;
    Alert.alert(
      'Remove Budget',
      'Are you sure you want to remove the monthly budget?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setBudgetLoading(true);
            try {
              await deleteBudget(currentBudget._id);
              setCurrentBudget(null);
              setBudgetAmount('');
              Alert.alert('Success', 'Budget removed');
            } catch (error) {
              Alert.alert('Error', 'Failed to remove budget');
            } finally {
              setBudgetLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleCopyCode = async () => {
    if (!group?.joinCode) return;
    Clipboard.setString(group.joinCode);
    Alert.alert('Copied', 'Group code copied to clipboard');
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('user');
          router.replace('/login');
        }
      }
    ]);
  };

  if (loading && !group) {
      return (
          <ThemedView style={[styles.container, styles.center]}>
              <ActivityIndicator color={theme.tint} size="large" />
          </ThemedView>
      )
  }

  const languages = [
    { code: 'en', label: 'English', icon: '🇺🇸' },
    { code: 'gu', label: 'ગુજરાતી', icon: '🇮🇳' },
    { code: 'hi', label: 'हिन्दी', icon: '🇮🇳' }
  ];

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">{t('settings')}</ThemedText>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
            <View style={[styles.avatar, { backgroundColor: theme.tint }]}>
                {user?.profilePhoto ? (
                    <Image source={{ uri: user.profilePhoto }} style={styles.avatarImage} />
                ) : (
                    <ThemedText style={styles.avatarText}>{user?.name?.charAt(0) || 'U'}</ThemedText>
                )}
            </View>
            <View style={{ flex: 1 }}>
                <ThemedText type="subtitle">{user?.name || 'User'}</ThemedText>
                <ThemedText style={styles.userEmail}>{user?.email || ''}</ThemedText>
            </View>
            <TouchableOpacity 
                style={[styles.editProfileBtn, { backgroundColor: `${theme.tint}10` }]}
                onPress={() => router.push('/edit-profile')}
            >
                <Ionicons name="pencil" size={18} color={theme.tint} />
            </TouchableOpacity>
        </View>

        {/* Group Section */}
        <View style={styles.section}>
            <ThemedText style={styles.sectionLabel}>Group Settings</ThemedText>
            <TouchableOpacity 
                style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, padding: 16 }]}
                onPress={() => router.push('/manage-group')}
            >
                <View style={styles.rowBetween}>
                    <View style={styles.row}>
                        <View style={[styles.iconBox, { backgroundColor: `${theme.tint}15` }]}>
                            <Ionicons name="people-outline" size={20} color={theme.tint} />
                        </View>
                        <View>
                            <ThemedText type="defaultSemiBold">{group?.name}</ThemedText>
                            <Text style={[styles.joinCodeLabel, { color: theme.secondaryText }]}>Manage Groups</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.icon} />
                </View>
            </TouchableOpacity>

            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, padding: 16, marginTop: 12 }]}>
                <View style={styles.rowBetween}>
                    <View>
                        <Text style={[styles.tinyLabel, { color: theme.secondaryText }]}>JOIN CODE</Text>
                        <ThemedText type="subtitle" style={{ letterSpacing: 2 }}>{group?.joinCode || 'N/A'}</ThemedText>
                    </View>
                    {group?.joinCode && (
                        <TouchableOpacity onPress={handleCopyCode} style={[styles.copyBtn, { backgroundColor: `${theme.tint}15` }]}>
                            <Ionicons name="copy-outline" size={18} color={theme.tint} />
                            <Text style={{ color: theme.tint, fontWeight: '700', fontSize: 12 }}>Copy</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>

        {/* ... Rest of the scroll content remains the same ... */}
        {/* Language Section */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>{t('language')}</ThemedText>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {languages.map((lang, index) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.languageItem,
                  index !== languages.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }
                ]}
                onPress={() => setLanguage(lang.code as any)}
              >
                <View style={styles.row}>
                  <Text style={styles.langIcon}>{lang.icon}</Text>
                  <ThemedText style={styles.langLabel}>{lang.label}</ThemedText>
                </View>
                {language === lang.code && (
                  <Ionicons name="checkmark-circle" size={24} color={theme.tint} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Budget Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <ThemedText style={styles.sectionLabel}>{t('monthly_budget')}</ThemedText>
            {currentBudget && (
                <TouchableOpacity onPress={handleRemoveBudget}>
                    <Ionicons name="trash-outline" size={18} color={theme.danger} />
                </TouchableOpacity>
            )}
          </View>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, padding: 16 }]}>
            <View style={styles.budgetInputRow}>
              <View style={[styles.inputWrapper, { backgroundColor: 'rgba(150, 150, 150, 0.1)' }]}>
                  <Text style={{ color: theme.text, fontSize: 18, marginRight: 8, fontWeight: '600' }}>₹</Text>
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="Enter amount"
                    placeholderTextColor="#A0A0A0"
                    keyboardType="numeric"
                    value={budgetAmount}
                    onChangeText={setBudgetAmount}
                  />
              </View>
              <TouchableOpacity 
                style={[styles.updateBtn, { backgroundColor: theme.tint }]}
                onPress={handleUpdateBudget}
                disabled={budgetLoading}
              >
                {budgetLoading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.updateBtnText}>{t('save')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>{t('category_management')}</ThemedText>
          <TouchableOpacity 
            style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, padding: 16 }]}
            onPress={() => router.push('/manage-categories')}
          >
            <View style={styles.rowBetween}>
              <View style={styles.row}>
                <View style={[styles.iconBox, { backgroundColor: `${theme.tint}15` }]}>
                    <Ionicons name="grid-outline" size={20} color={theme.tint} />
                </View>
                <ThemedText style={{ fontWeight: '600' }}>{t('category_management')}</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.icon} />
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <View style={[styles.logoutIconBox, { backgroundColor: `${theme.danger}15` }]}>
            <Ionicons name="log-out-outline" size={20} color={theme.danger} />
          </View>
          <Text style={[styles.logoutText, { color: theme.danger }]}>{t('logout')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  center: {
      justifyContent: 'center',
      alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 32,
    backgroundColor: 'rgba(150,150,150,0.05)',
    padding: 24,
    borderRadius: 24,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
  },
  editProfileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userEmail: {
    fontSize: 13,
    opacity: 0.5,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    paddingLeft: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tinyLabel: {
      fontSize: 10,
      fontWeight: '800',
      marginBottom: 4,
  },
  joinCodeLabel: {
      fontSize: 12,
      marginTop: 2,
      opacity: 0.6,
  },
  copyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  langIcon: {
    fontSize: 24,
  },
  langLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  budgetInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputWrapper: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  updateBtn: {
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateBtnText: {
    color: '#FFF',
    fontWeight: '800',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 12,
    marginTop: 20,
  },
  logoutIconBox: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
