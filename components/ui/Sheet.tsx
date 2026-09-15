import React, { createContext, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Keyboard, Platform, type StyleProp, type ViewStyle } from 'react-native';
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
/**
 * True once the sheet has finished sliding in. `Field` reads it to hold an `autoFocus` until then:
 * a keyboard rising during the slide resizes the sheet before it has measured itself.
 */
export const SheetOpenContext = createContext(false);

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
  /** A sheet holding inputs rises with the keyboard; a picker does not need to. Default `form`. */
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
    // A sheet opened while a field has focus otherwise rises with the keyboard still up — the
    // picker sits in the top half and the keyboard stays for an input nobody can see.
    present: () => { Keyboard.dismiss(); modal.current?.present(); },
    dismiss: () => modal.current?.dismiss(),
  }), []);

  const points = useMemo(() => snapPoints, [snapPoints]);

  // A tall scrolling form (snapped at 85%, say) rises with the keyboard only as far as the top of
  // the screen, and the keyboard still covers its lower part; the sheet keeps its snapped height.
  // Padding the content by the keyboard's height lets the last fields scroll up into view.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!scroll || keyboard !== 'form') return;
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', e => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, [scroll, keyboard]);

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

  return (
    <BottomSheetModal
      ref={modal}
      snapPoints={points}
      enableDynamicSizing={!points}
      enablePanDownToClose={dismissable}
      backdropComponent={backdrop}
      onDismiss={onDismiss}
      onChange={index => setOpen(index >= 0)}
      handleComponent={handle ? undefined : null}
      handleIndicatorStyle={{ backgroundColor: theme.border }}
      backgroundStyle={{ backgroundColor: theme.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }}
      // A form sheet has to move itself out from under the keyboard: `interactive` raises it by
      // the keyboard's height, `extend` only opens it to its top snap point, which for a sheet
      // sized to its content is where it already is. And `adjustPan`, not `adjustResize` — the
      // library reads `adjustResize` as a promise that the window shrinks for the keyboard and
      // then does nothing itself, but with edge-to-edge the window never shrinks (see `Screen`).
      // Both together are what kept a field low in a sheet behind the keyboard.
      android_keyboardInputMode="adjustPan"
      keyboardBehavior={keyboard === 'form' ? 'interactive' : 'extend'}
      keyboardBlurBehavior="restore"
    >
      <SheetOpenContext.Provider value={open}>
        {scroll
          ? <>
              {header}
              <BottomSheetScrollView
                style={styles.body}
                contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.lg + keyboardHeight }, contentStyle]}
              >
                {children}
              </BottomSheetScrollView>
            </>
          // A content-sized sheet is as tall as this view measures, so the header has to be inside
          // it: outside, the sheet came up a header short and the body was squeezed over the title.
          : <BottomSheetView>
              {header}
              <View style={[styles.content, { paddingBottom: insets.bottom + space.lg }, contentStyle]}>{children}</View>
            </BottomSheetView>}
      </SheetOpenContext.Provider>
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
