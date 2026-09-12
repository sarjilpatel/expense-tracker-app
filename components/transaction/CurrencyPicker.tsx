import React, { useState, useEffect, useRef } from 'react';
import { Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CURRENCY_META, CurrencyCode } from '@/src/services/preferencesService';
import { useTheme } from '@/src/context/ThemeContext';
import { space, radius, type, icon as iconSize } from '@/constants/tokens';
import { Sheet, Touchable, Card, Row, type SheetHandle } from '@/components/ui';

const CURRENCIES = Object.entries(CURRENCY_META) as [CurrencyCode, { symbol: string; name: string; locale: string }][];

interface Props {
  value: CurrencyCode;
  onChange: (code: CurrencyCode) => void;
  /** Controlled: the parent owns open/closed. Uncontrolled: a trigger button is rendered. */
  visible?: boolean;
  onClose?: () => void;
}

/** Currency chooser on the shared `Sheet` (W2-11). Works controlled or with its own trigger. */
export function CurrencyPicker({ value, onChange, visible: externalVisible, onClose }: Props) {
  const { theme } = useTheme();
  const sheet = useRef<SheetHandle>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const meta = CURRENCY_META[value];

  const isControlled = externalVisible !== undefined;
  const isOpen = isControlled ? externalVisible! : internalOpen;

  useEffect(() => {
    if (isOpen) sheet.current?.present();
    else sheet.current?.dismiss();
  }, [isOpen]);

  const handleDismiss = () => {
    if (isControlled) onClose?.();
    else setInternalOpen(false);
  };

  const handleSelect = (code: CurrencyCode) => {
    onChange(code);
    sheet.current?.dismiss();
  };

  return (
    <>
      {!isControlled && (
        <Touchable
          onPress={() => setInternalOpen(true)}
          haptic="selection"
          style={[S.trigger, { backgroundColor: theme.card, borderColor: theme.border }]}
          accessibilityLabel={`Currency ${meta.name}, change`}
        >
          <Text style={[type.bodyStrong, { color: theme.tint }]}>{meta.symbol}</Text>
          <Text style={[type.body, { color: theme.text }]}>{value}</Text>
          <Ionicons name="chevron-down" size={iconSize.sm} color={theme.secondaryText} />
        </Touchable>
      )}

      <Sheet ref={sheet} title="Currency" scroll snapPoints={['60%']} keyboard="none" onDismiss={handleDismiss}>
        <Card padded={false}>
          {CURRENCIES.map(([code, m], i) => (
            <Row
              key={code}
              leading={<Text style={[type.heading, S.symbol, { color: theme.tint }]}>{m.symbol}</Text>}
              title={m.name}
              subtitle={code}
              right={value === code ? <Ionicons name="checkmark" size={iconSize.md} color={theme.tint} /> : undefined}
              chevron={false}
              onPress={() => handleSelect(code)}
              last={i === CURRENCIES.length - 1}
            />
          ))}
        </Card>
      </Sheet>
    </>
  );
}

const S = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.md, minHeight: 40, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  symbol:  { width: 38, textAlign: 'center' },
});
