import React, { useCallback } from 'react';
import {
  Pressable, Platform, StyleSheet,
  type PressableProps, type StyleProp, type ViewStyle, type GestureResponderEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/src/context/ThemeContext';
import { hexToRGBA } from '@/constants/theme';
import { slopFor } from '@/src/utils/layout';

/**
 * The one touchable. Replaces the 306 `TouchableOpacity`s (W2-09).
 *
 * An opacity fade is *the* tell that an app is React Native; Android's native idiom is a ripple
 * from the touch point, which `Pressable` gives for free via `android_ripple`. iOS keeps a light
 * fade, because that is its idiom. Both come from here so the feel is uniform.
 *
 * Also enforces two things a screen would otherwise forget:
 *   - a 44×44 minimum hit target (W2-22), by padding `hitSlop` out from the rendered size, so a
 *     20dp icon button is still tappable without growing;
 *   - an accessibility role, so TalkBack/VoiceOver announce it as a button. Icon-only buttons
 *     must pass `accessibilityLabel` — there is nothing else to read out (W2-26).
 */
export type HapticKind = 'light' | 'medium' | 'selection' | 'none';

export interface TouchableProps extends Omit<PressableProps, 'style' | 'children'> {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Fires on press-in. `light` is the default for anything that navigates or toggles. */
  haptic?: HapticKind;
  /** Ripple colour override. Defaults to the theme text at 12%, which reads on any surface. */
  rippleColor?: string;
  /** Contain the ripple inside the view's own bounds (needs `overflow: 'hidden'` on rounded shapes). */
  rippleBorderless?: boolean;
  /** Rendered width/height, used to compute hitSlop up to MIN_TARGET. Pass for icon-only buttons. */
  size?: number;
  /** iOS pressed opacity. */
  pressedOpacity?: number;
}

const fire = (kind: HapticKind) => {
  if (kind === 'none') return;
  if (kind === 'selection') { Haptics.selectionAsync().catch(() => {}); return; }
  Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light)
    .catch(() => {});
};

export function Touchable({
  children, style, haptic = 'light', rippleColor, rippleBorderless = false, size,
  pressedOpacity = 0.6, onPressIn, hitSlop, accessibilityRole = 'button', disabled, ...rest
}: TouchableProps) {
  const { theme } = useTheme();

  const handlePressIn = useCallback((e: GestureResponderEvent) => {
    if (!disabled) fire(haptic);
    onPressIn?.(e);
  }, [disabled, haptic, onPressIn]);

  if (__DEV__ && !rest.accessibilityLabel && typeof children !== 'string' && !hasTextChild(children)) {
    // Once per site is enough; the point is that it is visible in the console during development.
    console.warn('[Touchable] icon-only control without accessibilityLabel');
  }

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: !!disabled, ...(rest.accessibilityState ?? {}) }}
      onPressIn={handlePressIn}
      hitSlop={hitSlop ?? slopFor(size)}
      android_ripple={{
        color: rippleColor ?? hexToRGBA(theme.text, 0.12),
        borderless: rippleBorderless,
        foreground: true,
      }}
      style={({ pressed }) => [
        style,
        disabled && styles.disabled,
        // Android gets the ripple; iOS gets a fade. Never both — a ripple under a fade looks broken.
        Platform.OS === 'ios' && pressed && { opacity: pressedOpacity },
      ]}
    >
      {children}
    </Pressable>
  );
}

function hasTextChild(node: React.ReactNode): boolean {
  let found = false;
  React.Children.forEach(node, (child) => {
    if (found) return;
    if (typeof child === 'string' || typeof child === 'number') { found = true; return; }
    if (React.isValidElement(child)) {
      const props = child.props as { accessibilityLabel?: string; children?: React.ReactNode };
      if (props.accessibilityLabel) { found = true; return; }
      if (props.children && hasTextChild(props.children)) found = true;
    }
  });
  return found;
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.45 },
});
