import { Tabs, router, usePathname } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Touchable } from '@/components/ui';

import { HapticTab } from '@/components/haptic-tab';
import { useTheme } from '@/src/context/ThemeContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { space, type, radius } from '@/constants/tokens';

const TabBarBackground = ({ theme }: { theme: any }) => {
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: theme.card,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.border,
        }
      ]}
    >
      <View style={{ flex: 1, backgroundColor: theme.card }} />
    </View>
  );
};

const CustomAddButton = ({ theme }: { theme: any }) => {
  return (
    <Touchable
      style={[styles.floatingAddBtn, { backgroundColor: theme.tint, shadowColor: theme.tint }]}
      onPress={() => router.push('/add-transaction')}
      haptic="medium"
      rippleColor="rgba(255,255,255,0.3)"
      accessibilityLabel="Add transaction"
    >
      <Ionicons name="add" size={28} color={theme.tintText} />
    </Touchable>
  );
};

export default function TabLayout() {
  const { theme } = useTheme();
  const pathname = usePathname();
  const isAddScreen = pathname === '/add' || pathname === '/add-transaction';

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Tabs
        screenOptions={{
          // A tab behind the visible one stops rendering (W2-14): five screens of lists and
          // charts otherwise re-render on every store change whether or not they are on screen.
          freezeOnBlur: true,
          tabBarActiveTintColor:   theme.tint,
          tabBarInactiveTintColor: theme.secondaryText,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarStyle: {
            backgroundColor: 'transparent',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            borderTopWidth: 0,
            elevation: 0,
            height: Platform.OS === 'ios' ? 82 : 70,
            paddingBottom: Platform.OS === 'ios' ? 24 : 10,
            paddingTop: space.sm,
          },
          tabBarBackground: () => <TabBarBackground theme={theme} />,
          tabBarLabelStyle: { ...type.label },
          tabBarItemStyle: { paddingTop: 2 },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons size={24} name={focused ? 'home' : 'home-outline'} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Insights',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons size={24} name={focused ? 'analytics' : 'analytics-outline'} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="add"
          options={{
            title: '',
            tabBarLabel: () => null,
            tabBarButton: () => <View style={{ flex: 1 }} />, // Empty placeholder to keep symmetry
            tabBarStyle: { display: 'none' },
          }}
        />
        <Tabs.Screen
          name="plan"
          options={{
            title: 'Plan',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons size={24} name={focused ? 'flag' : 'flag-outline'} color={color} />
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
      {!isAddScreen && <CustomAddButton theme={theme} />}
    </View>
  );
}

const styles = StyleSheet.create({
  floatingAddBtn: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    left: '50%',
    marginLeft: -28,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    // eslint-disable-next-line local/design-tokens -- a shadow is black by definition; this one floats over content
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 99,
  },
});
