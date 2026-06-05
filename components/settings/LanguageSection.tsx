import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/src/i18n/LanguageContext';

const LANGUAGES = [
  { code: 'en', label: 'English',   icon: '🇺🇸' },
  { code: 'gu', label: 'ગુજરાતી', icon: '🇮🇳' },
  { code: 'hi', label: 'हिन्दी',   icon: '🇮🇳' },
];

interface Props {
  theme: any;
}

export function LanguageSection({ theme }: Props) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <View style={styles.section}>
      <ThemedText style={styles.label}>{t('language')}</ThemedText>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {LANGUAGES.map((lang, i) => (
          <TouchableOpacity
            key={lang.code}
            style={[
              styles.item,
              i !== LANGUAGES.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
            ]}
            onPress={() => setLanguage(lang.code as any)}
          >
            <View style={styles.row}>
              <Text style={styles.icon}>{lang.icon}</Text>
              <ThemedText style={styles.langLabel}>{lang.label}</ThemedText>
            </View>
            {language === lang.code && <Ionicons name="checkmark-circle" size={24} color={theme.tint} />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    paddingLeft: 4,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: { fontSize: 24 },
  langLabel: { fontSize: 16, fontWeight: '600' },
});
