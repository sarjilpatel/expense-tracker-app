import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import {
  BottomSheetModal, BottomSheetBackdrop, BottomSheetView, BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/context/ThemeContext';
import { space, radius, type, icon as iconSize } from '@/constants/tokens';
import { Touchable } from './Touchable';

/**
 * The bottom sheet. Replaces the 23 hand-rolled `<Modal>`s, of which only 4 dismissed on an outside
 * tap and none had a scrim that read as a sheet (W2-11, W2-12).
 *
 * Built on `@gorhom/bottom-sheet`, which sits on the Reanimated + gesture-handler the app already
 * ships: native-feeling snap points, drag-to-dismiss, a backdrop that dismisses on tap, and
 * hardware-back on Android — all things the 23 copies each got some subset of.
 *
 * Usage:
 *   const ref = useRef<SheetHandle>(null);
 *   <Sheet ref={ref} title="Pick an account">…</Sheet>
 *   ref.current?.present();  ref.current?.dismiss();
 *
 * `BottomSheetModalProvider` must wrap the app once (it does, in `app/_layout.tsx`).
 */
export interface SheetHandle {
  present: () => void;
  dismiss: () => void;
}

export interface SheetProps {
  title?: string;
  /** Snap points as percentages or dp. Default fits content. */
  snapPoints?: (string | number)[];
  /** Content scrolls inside the sheet. Default false — most sheets are short. */
  scroll?: boolean;
  /** Called after the sheet has fully dismissed, by drag, backdrop tap or `dismiss()`. */
  onDismiss?: () => void;
  /** Hide the drag handle (a keypad with its own chrome). */
  handle?: boolean;
  /** Show an × in the header. Default true when there is a title. */
  closeButton?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** A sheet holding inputs grows with the keyboard; a picker does not need to. Default `form`. */
  keyboard?: 'form' | 'none';
  /** False locks the sheet open: no drag-down, no backdrop tap, no ×. For a flow mid-write. */
  dismissable?: boolean;
  children?: React.ReactNode;
}

export const Sheet = forwardRef<SheetHandle, SheetProps>(function Sheet(
  { title, snapPoints, scroll = false, onDismiss, handle = true, closeButton, contentStyle, keyboard = 'form', dismissable = true, children },
  ref,
) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const modal = useRef<BottomSheetModal>(null);

  useImperativeHandle(ref, () => ({
    present: () => modal.current?.present(),
    dismiss: () => modal.current?.dismiss(),
  }), []);

  const points = useMemo(() => snapPoints, [snapPoints]);

  // The scrim: tap to dismiss, fades with the sheet. `appearsOnIndex={0}` so it is there from the
  // first snap point — the default of 1 leaves a content-height sheet with no backdrop at all.
  const backdrop = useCallback((props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} pressBehavior={dismissable ? 'close' : 'none'} />
  ), [dismissable]);

  const showClose = (closeButton ?? !!title) && dismissable;
  const header = (title || showClose) && (
    <View style={[styles.header, { borderBottomColor: theme.separator }]}>
      <Text style={[type.heading, styles.title, { color: theme.text }]} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      {showClose && (
        <Touchable onPress={() => modal.current?.dismiss()} size={32} style={styles.close} accessibilityLabel="Close" rippleBorderless>
          <Ionicons name="close" size={iconSize.lg} color={theme.secondaryText} />
        </Touchable>
      )}
    </View>
  );

  const Body = scroll ? BottomSheetScrollView : BottomSheetView;

  return (
    <BottomSheetModal
      ref={modal}
      snapPoints={points}
      enableDynamicSizing={!points}
      enablePanDownToClose={dismissable}
      backdropComponent={backdrop}
      onDismiss={onDismiss}
      handleComponent={handle ? undefined : null}
      handleIndicatorStyle={{ backgroundColor: theme.border }}
      backgroundStyle={{ backgroundColor: theme.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}
      // Android back closes the sheet rather than the screen behind it.
      android_keyboardInputMode="adjustResize"
      keyboardBehavior={keyboard === 'form' ? 'extend' : 'interactive'}
      keyboardBlurBehavior="restore"
    >
      {header}
      <Body
        style={styles.body}
        contentContainerStyle={scroll ? [styles.content, { paddingBottom: insets.bottom + space.lg }, contentStyle] : undefined}
      >
        {scroll
          ? children
          : <View style={[styles.content, { paddingBottom: insets.bottom + space.lg }, contentStyle]}>{children}</View>}
      </Body>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  header:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingBottom: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  title:   { flex: 1 },
  close:   { width: 32, height: 32, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center' },
  body:    { flexShrink: 1 },
  content: { paddingHorizontal: space.lg, paddingTop: space.md },
});
