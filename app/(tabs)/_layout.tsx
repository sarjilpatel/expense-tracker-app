import { Tabs, router } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Touchable } from '@/components/ui';

import { HapticTab } from '@/components/haptic-tab';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Dimensions } from 'react-native';
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CustomAddButton = ({ theme }: { theme: any }) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = startX.value + e.translationX;
      translateY.value = startY.value + e.translationY;
    })
    .onEnd(() => {
      const maxLeft = -(SCREEN_WIDTH - 76);
      const maxRight = 10; // Allow a bit of leeway
      const maxUp = -(SCREEN_HEIGHT - 200);
      const maxDown = 10;
      
      let targetX = translateX.value;
      if (translateX.value > maxRight) targetX = 0;
      if (translateX.value < maxLeft) targetX = maxLeft + 10;

      let targetY = translateY.value;
      if (translateY.value > maxDown) targetY = 0;
      if (translateY.value < maxUp) targetY = maxUp + 10;

      translateX.value = withSpring(targetX, { damping: 20, stiffness: 200 });
      translateY.value = withSpring(targetY, { damping: 20, stiffness: 200 });
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.floatingAddBtn, { backgroundColor: theme.tint, shadowColor: theme.tint }, animStyle]}>
        <Touchable
          style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', borderRadius: radius.full }}
          onPress={() => router.push('/add-transaction')}
          haptic="medium"
          rippleColor="rgba(255,255,255,0.3)"
          accessibilityLabel="Add transaction"
        >
          <Ionicons name="add" size={28} color={theme.tintText} />
        </Touchable>
      </Animated.View>
    </GestureDetector>
  );
};

export default function TabLayout() {
  const { theme } = useTheme();

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
      {/* Always mounted: the add modal covers it anyway, and hiding it on the route change re-rendered
          the whole tab bar at the exact moment the modal started to slide, and again as it closed. */}
      <CustomAddButton theme={theme} />
    </View>
  );
}

const styles = StyleSheet.create({
  floatingAddBtn: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    // eslint-disable-next-line local/design-tokens
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 99,
  },
});
