import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/src/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { theme } = useTheme();

  const tabBarBg = isDark ? '#0E0E12' : '#FFFFFF';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   theme.tint,
        tabBarInactiveTintColor: isDark ? '#475569' : '#94A3B8',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: tabBarBg,
          borderTopWidth:  StyleSheet.hairlineWidth,
          borderTopColor:  theme.border,
          elevation:       0,
          shadowColor:     isDark ? '#000' : theme.tint,
          shadowOffset:    { width: 0, height: -2 },
          shadowOpacity:   isDark ? 0.12 : 0.04,
          shadowRadius:    8,
          height:          Platform.OS === 'ios' ? 80 : 58,
          paddingBottom:   Platform.OS === 'ios' ? 24 : 8,
          paddingTop:      6,
        },
        tabBarLabelStyle: {
          fontSize:      11,
          fontWeight:    '600',
          letterSpacing: 0.2,
        },
        tabBarItemStyle: { paddingTop: 2 },
      }}>
 
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trans.',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={24} name={focused ? 'book' : 'book-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={24} name={focused ? 'bar-chart' : 'bar-chart-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          href: null,
          title: 'Add',
          tabBarIcon: ({ color, focused }) => (
            <View style={[
              styles.addIconWrap,
              { backgroundColor: theme.tint },
              focused && {
                backgroundColor: theme.tint,
                shadowColor:     theme.tint,
                shadowOffset:    { width: 0, height: 4 },
                shadowOpacity:   0.4,
                shadowRadius:    8,
                elevation:       6,
              },
            ]}>
              <Ionicons name="add" size={26} color="#FFF" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: 'Accounts',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={24} name={focused ? 'wallet' : 'wallet-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'More',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons size={24} name={focused ? 'ellipsis-horizontal' : 'ellipsis-horizontal-outline'} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  addIconWrap: {
    width: 40, height: 40, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
});
