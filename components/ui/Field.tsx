import React, { forwardRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/context/ThemeContext';
import { space, radius, type, icon as iconSize, hairline } from '@/constants/tokens';

/**
 * A labelled text input with an error line. Every form in the app built its own; this is the one.
 *
 * The border turns to the accent on focus and to `danger` on error — the only two states a field
 * needs to show. The label is a real label for screen readers (`accessibilityLabelledBy` is not
 * reliable on Android, so the input carries `accessibilityLabel` itself).
 */
export interface FieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  help?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  /** Trailing content — a unit, a clear button, a picker chevron. */
  right?: React.ReactNode;
  /** A textarea: this many lines tall, text anchored to the top, grows with content. */
  lines?: number;
  style?: StyleProp<ViewStyle>;
}

export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, error, help, icon, right, lines, style, onFocus, onBlur, editable = true, ...input },
  ref,
) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);

  const border = error ? theme.danger : focused ? theme.tint : theme.border;
  const area = lines !== undefined && lines > 1;

  return (
    <View style={[styles.wrap, style]}>
      {!!label && <Text style={[type.label, styles.label, { color: theme.secondaryText }]}>{label}</Text>}
      <View style={[
        styles.box,
        { backgroundColor: theme.inputBg, borderColor: border, borderWidth: focused || error ? 1.5 : hairline },
        area && styles.boxArea,
        !editable && styles.readonly,
      ]}>
        {icon && <Ionicons name={icon} size={iconSize.md} color={theme.secondaryText} />}
        <TextInput
          ref={ref}
          multiline={area || input.multiline}
          numberOfLines={area ? lines : input.numberOfLines}
          textAlignVertical={area ? 'top' : input.textAlignVertical}
          {...input}
          editable={editable}
          accessibilityLabel={input.accessibilityLabel ?? label}
          placeholderTextColor={theme.secondaryText}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          style={[type.body, styles.input, { color: theme.text }, area && { minHeight: lines * type.body.lineHeight + space.md }]}
        />
        {right}
      </View>
      {!!(error || help) && (
        <Text style={[type.label, styles.hint, { color: error ? theme.danger : theme.secondaryText }]}>
          {error || help}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap:     { gap: space.xs },
  label:    { marginLeft: space.xs },
  box:      { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.md, paddingHorizontal: space.md, minHeight: 48 },
  input:    { flex: 1, paddingVertical: space.sm },
  boxArea:  { alignItems: 'flex-start' },
  readonly: { opacity: 0.6 },
  hint:     { marginLeft: space.xs },
});
