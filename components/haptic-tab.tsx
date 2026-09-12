import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';

/**
 * The tab bar button. Selection haptic on press-in, on every platform — the Expo template gated
 * it to iOS, and Android is the build target (W2-10). `selectionAsync` is the light tick both
 * platforms use for a tab change; a failed call (no vibrator, simulator) is ignored.
 */
export function HapticTab(props: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...props}
      android_ripple={{ color: 'rgba(127,127,127,0.2)', borderless: true }}
      onPressIn={(ev) => {
        Haptics.selectionAsync().catch(() => {});
        props.onPressIn?.(ev);
      }}
    />
  );
}
