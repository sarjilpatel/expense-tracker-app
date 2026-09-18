import React, { createContext, forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Keyboard, KeyboardAvoidingView, Modal,
  type StyleProp, type ViewStyle,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/context/ThemeContext';
import { space, radius, type, icon as iconSize } from '@/constants/tokens';
import { Touchable } from './Touchable';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS, interpolate } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

export const SheetOpenContext = createContext(false);

export interface SheetHandle {
  present: () => void;
  dismiss: () => void;
}

export interface SheetProps {
  title?: string;
  snapPoints?: (string | number)[];
  scroll?: boolean;
  onDismiss?: () => void;
  handle?: boolean;
  closeButton?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  keyboard?: 'form' | 'none';
  dismissable?: boolean;
  children?: React.ReactNode;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

export const Sheet = forwardRef<SheetHandle, SheetProps>(function Sheet(
  { title, snapPoints, scroll = false, onDismiss, handle = true, closeButton, contentStyle, keyboard = 'form', dismissable = true, children },
  ref,
) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const maxHeight = (snapPoints?.[0] ?? '85%') as ViewStyle['maxHeight'];

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const opacity = useSharedValue(0);

  const closeAnimation = useCallback(() => {
    opacity.value = withTiming(0, { duration: 150 });
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(setOpen)(false);
        if (onDismiss) runOnJS(onDismiss)();
      }
    });
  }, [onDismiss]);

  const present = useCallback(() => {
    Keyboard.dismiss();
    setOpen(true);
    translateY.value = SCREEN_HEIGHT;
    opacity.value = withTiming(1, { duration: 250 });
    translateY.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.8 });
  }, []);

  const dismiss = useCallback(() => {
    Keyboard.dismiss();
    closeAnimation();
  }, [closeAnimation]);

  useImperativeHandle(ref, () => ({
    present,
    dismiss,
  }), [dismiss, present]);

  const panGesture = Gesture.Pan()
    .onChange((e) => {
      if (!dismissable) return;
      if (e.translationY > 0) {
        translateY.value = e.translationY;
        opacity.value = Math.max(0, 1 - (e.translationY / (SCREEN_HEIGHT / 2)));
      }
    })
    .onEnd((e) => {
      if (!dismissable) return;
      if (e.translationY > 150 || e.velocityY > 500) {
        runOnJS(closeAnimation)();
      } else {
        translateY.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.8 });
        opacity.value = withTiming(1, { duration: 150 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const showClose = (closeButton ?? !!title) && dismissable;
  const header = (title || showClose) && (
    <View style={[styles.header, { borderBottomColor: theme.separator }]}>
      <Text style={[type.heading, styles.title, { color: theme.text }]} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      {showClose && (
        <Touchable onPress={dismiss} size={32} style={styles.close} accessibilityLabel="Close" rippleBorderless>
          <Ionicons name="close" size={iconSize.lg} color={theme.secondaryText} />
        </Touchable>
      )}
    </View>
  );

  return (
    <Modal transparent visible={open} onRequestClose={dismiss} statusBarTranslucent animationType="none">
      <KeyboardAvoidingView style={styles.layer} behavior={keyboard === 'form' ? 'padding' : undefined}>
        {dismissable && (
          <Animated.View style={[styles.backdrop, backdropStyle]}>
            <Touchable onPress={dismiss} style={StyleSheet.absoluteFillObject} accessibilityLabel="Close sheet" />
          </Animated.View>
        )}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border, maxHeight }, animatedStyle]}>
            {handle && <View style={[styles.handle, { backgroundColor: theme.border }]} />}
            <SheetOpenContext.Provider value={open}>
              {header}
              {scroll
                ? <ScrollView style={styles.body} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.lg }, contentStyle]} keyboardShouldPersistTaps="handled">
                    {children}
                  </ScrollView>
                : <View style={[styles.content, { paddingBottom: insets.bottom + space.lg }, contentStyle]}>{children}</View>}
            </SheetOpenContext.Provider>
          </Animated.View>
        </GestureDetector>
      </KeyboardAvoidingView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  layer:   { flex: 1, justifyContent: 'flex-end' },
  backdrop:{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:   { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderTopWidth: StyleSheet.hairlineWidth, flexShrink: 1, width: '100%' },
  handle:  { alignSelf: 'center', width: 36, height: 4, borderRadius: radius.full, marginTop: space.sm, marginBottom: space.sm },
  header:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingBottom: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  title:   { flex: 1 },
  close:   { width: 32, height: 32, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center' },
  body:    { flexShrink: 1 },
  content: { paddingHorizontal: space.lg, paddingTop: space.md },
});
