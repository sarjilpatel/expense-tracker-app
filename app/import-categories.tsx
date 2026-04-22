import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getMyGroups, importCategories } from '@/src/services/groupApi';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useLanguage } from '@/src/i18n/LanguageContext';

export default function ImportCategoriesScreen() {
  const { t } = useLanguage();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme || 'light'];
  const router = useRouter();
  const params = useLocalSearchParams();
  const filterType = params.type as string;

  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const data = await getMyGroups();
      setGroups(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (groupId: string, groupName: string) => {
    Alert.alert(
      'Import Categories',
      `Import additional categories from "${groupName}"? Existing categories in your current group will be kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Import', 
          onPress: async () => {
            setLoading(true);
            try {
              await importCategories(groupId, filterType);
              Alert.alert('Success', `Imported ${filterType !== 'both' ? filterType : ''} categories successfully!`);
              router.back();
            } catch (error) {
              Alert.alert('Error', 'Failed to import categories');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <ThemedText type="subtitle">{t('import_categories')}</ThemedText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText style={styles.description}>
          {t('select_group')} to import categories from. This will add new categories to your current group without deleting existing ones.
        </ThemedText>

        {groups.length === 0 ? (
          <View style={styles.empty}>
              <ThemedText style={{ opacity: 0.5 }}>You are not part of any other groups.</ThemedText>
          </View>
        ) : (
          groups.map((group) => (
            <TouchableOpacity 
              key={group._id} 
              style={[styles.groupItem, { backgroundColor: 'rgba(150, 150, 150, 0.05)' }]}
              onPress={() => handleImport(group._id, group.name)}
            >
              <View style={styles.groupLeft}>
                <View style={[styles.groupIcon, { backgroundColor: `${theme.tint}15` }]}>
                    <Ionicons name="people" size={20} color={theme.tint} />
                </View>
                <ThemedText style={styles.groupName}>{group.name}</ThemedText>
              </View>
              <Ionicons name="download-outline" size={20} color={theme.tint} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 24,
    lineHeight: 20,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
  },
  groupLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
  },
  empty: {
    paddingTop: 60,
    alignItems: 'center',
  }
});
