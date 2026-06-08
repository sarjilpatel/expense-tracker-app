import { Tabs, router } from 'expo-router';
import React, { useState } from 'react';
import { Platform, StyleSheet, View, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { HapticTab } from '@/components/haptic-tab';
import { useTheme } from '@/src/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

const TabBarBackground = ({ theme }: { theme: any }) => {
  const [width, setWidth] = useState(Dimensions.get('window').width);

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        setWidth(e.nativeEvent.layout.width);
      }}
    >
      <Svg width={width} height={Platform.OS === 'ios' ? 98 : 78} viewBox={`0 0 ${width} ${Platform.OS === 'ios' ? 98 : 78}`}>
        {/* Filled background with a wide, sweeping U-shaped wave */}
        <Path
          d={`M 0,0 
              L ${width / 2 - 60},0 
              C ${width / 2 - 40},0 ${width / 2 - 32},44 ${width / 2},44 
              C ${width / 2 + 32},44 ${width / 2 + 40},0 ${width / 2 + 60},0 
              L ${width},0 
              L ${width},98 
              L 0,98 
              Z`}
          fill={theme.card}
        />
        {/* Thin top border matching the smooth curve */}
        <Path
          d={`M 0,0 
              L ${width / 2 - 60},0 
              C ${width / 2 - 40},0 ${width / 2 - 32},44 ${width / 2},44 
              C ${width / 2 + 32},44 ${width / 2 + 40},0 ${width / 2 + 60},0 
              L ${width},0`}
          fill="none"
          stroke={theme.border}
          strokeWidth={StyleSheet.hairlineWidth}
        />
      </Svg>
    </View>
  );
};

const CustomAddButton = ({ theme }: { theme: any }) => {
  return (
    <TouchableOpacity
      style={[styles.floatingAddBtn, { backgroundColor: theme.tint, shadowColor: theme.tint }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push('/(tabs)/add');
      }}
      activeOpacity={0.85}
    >
      <Ionicons name="add" size={28} color="#FFF" />
    </TouchableOpacity>
  );
};

export default function TabLayout() {
  const { theme } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Tabs
        screenOptions={{
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
            height: Platform.OS === 'ios' ? 88 : 68,
            paddingBottom: Platform.OS === 'ios' ? 28 : 8,
            paddingTop: 8,
          },
          tabBarBackground: () => <TabBarBackground theme={theme} />,
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
            title: 'Records',
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
            title: '',
            tabBarLabel: () => null,
            tabBarButton: () => <View style={{ flex: 1 }} />, // Empty placeholder to keep symmetry
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
      <CustomAddButton theme={theme} />
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
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 99,
  },
});
