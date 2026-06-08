import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';

interface Props {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
  cta?: { label: string; onPress: () => void };
}

export function EmptyState({ icon, title, body, cta }: Props) {
  const { theme } = useTheme();
  return (
    <View style={S.wrap}>
      <View style={[S.iconWrap, { backgroundColor: theme.surface }]}>
        <Ionicons name={icon} size={40} color={theme.tint} />
      </View>
      <Text style={[S.title, { color: theme.text }]}>{title}</Text>
      <Text style={[S.body, { color: theme.secondaryText }]}>{body}</Text>
      {cta && (
        <TouchableOpacity
          style={[S.btn, { backgroundColor: theme.tint }]}
          onPress={cta.onPress}
          activeOpacity={0.82}
        >
          <Ionicons name="add-circle-outline" size={18} color={theme.tintText} />
          <Text style={[S.btnText, { color: theme.tintText }]}>{cta.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  wrap:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  iconWrap: { width: 80, height: 80, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  title:    { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  body:     { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, marginTop: 8,
  },
  btnText:  { fontWeight: '700', fontSize: 15 },
});
