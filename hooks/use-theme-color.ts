/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors, ThemeColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/src/context/ThemeContext';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: Exclude<keyof ThemeColors, 'chart'>
) {
  let contextTheme: ThemeColors | undefined;
  try {
    const context = useTheme();
    contextTheme = context?.theme;
  } catch (e) {
    // Context might not be initialized yet in some static environments
  }

  const scheme = useColorScheme() ?? 'light';
  const colorFromProps = props[scheme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return (contextTheme?.[colorName] ?? Colors[scheme][colorName]) as string;
  }
}
