/**
 * The component layer (W2-30). Screens import from here, never from the individual files, so a
 * primitive can be reshaped without touching its call sites.
 *
 * Twelve primitives, one job each:
 *   Screen        the shell — safe area, header, scroll, keyboard, footer
 *   Card          a raised surface
 *   Row           a list row
 *   Touchable     the one pressable — ripple, haptic, 44dp target, a11y role
 *   Button        primary / secondary / ghost / danger
 *   Sheet         the bottom sheet — scrim, drag, outside-tap dismiss
 *   Field         a labelled input with an error line
 *   Amount        money — sign, tabular figures, semantic colour
 *   EmptyState    nothing here, and what to do about it
 *   SectionHeader the overline label
 *   Chip          filter / badge / tag
 *   Skeleton      loading placeholders
 */
export { Screen }        from './Screen';
export { Card }          from './Card';
export { Row }           from './Row';
export { Touchable }     from './Touchable';
export { Button }        from './Button';
export { Sheet }         from './Sheet';
export { Field }         from './Field';
export { Amount }        from './Amount';
export { EmptyState }    from './EmptyState';
export { SectionHeader } from './SectionHeader';
export { Chip }          from './Chip';
export { Skeleton, SkeletonLoader } from './Skeleton';

export type { ScreenProps }        from './Screen';
export type { CardProps }          from './Card';
export type { RowProps }           from './Row';
export type { TouchableProps, HapticKind } from './Touchable';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';
export type { SheetProps, SheetHandle } from './Sheet';
export type { FieldProps }         from './Field';
export type { AmountProps }        from './Amount';
export type { EmptyStateProps }    from './EmptyState';
export type { SectionHeaderProps } from './SectionHeader';
export type { ChipProps }          from './Chip';
