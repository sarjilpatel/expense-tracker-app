import React, { useState, useEffect } from 'react';
import { Text, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/i18n/LanguageContext';
import { getMyGroups, importCategories } from '@/src/services/groupApi';
import { space, type, icon as iconSize } from '@/constants/tokens';
import { Screen, Card, Row, EmptyState, Skeleton } from '@/components/ui';

import { reportError } from '@/src/utils/log';
export default function ImportCategoriesScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const filterType = params.type as string;

  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getMyGroups();
        // The active group is the one being imported *into*; offering it as a source is a no-op
        // the server refuses anyway.
        setGroups((data || []).filter((g: any) => g._id !== user?.groupId));
      } catch (error) {
        reportError(error);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.groupId]);

  const handleImport = async (groupId: string, groupName: string) => {
    Alert.alert(
      'Import Categories',
      `Import additional categories from "${groupName}"? Existing categories in your current group will be kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async () => {
            setWorking(true);
            try {
              await importCategories(groupId, filterType);
              Alert.alert('Success', `Imported ${filterType && filterType !== 'both' ? `${filterType} ` : ''}categories successfully!`);
              router.back();
            } catch {
              Alert.alert('Error', 'Failed to import categories');
            } finally {
              setWorking(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <Screen title={t('import_categories')}>
        <Skeleton.Group style={{ paddingTop: space.lg }}><Skeleton.Row /><Skeleton.Row /></Skeleton.Group>
      </Screen>
    );
  }

  return (
    <Screen title={t('import_categories')}>
      <Text style={[type.label, { color: theme.secondaryText, marginTop: space.md, marginBottom: space.lg }]}>
        {t('select_group')} to import categories from. New categories are added to your current group; existing ones are kept.
      </Text>

      {groups.length === 0 ? (
        <EmptyState icon="people-outline" title="No other groups" body="You are not part of any other groups to import from." />
      ) : (
        <Card padded={false}>
          {groups.map((group, i) => (
            <Row
              key={group._id}
              icon={group.isPersonal ? 'person' : 'people'}
              title={group.name}
              subtitle={group.isPersonal ? 'Your personal categories' : `${group.members?.length || 0} members`}
              right={<Ionicons name="download-outline" size={iconSize.md} color={theme.tint} />}
              onPress={() => handleImport(group._id, group.name)}
              disabled={working}
              last={i === groups.length - 1}
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}
