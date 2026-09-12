import React, { useRef } from 'react';
import { Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Account, ACCOUNT_TYPE_META } from '@/src/services/accountService';
import { getContrastText } from '@/constants/theme';
import { space, radius, type, icon as iconSize } from '@/constants/tokens';
import { Sheet, Touchable, Button, Card, Row, EmptyState, type SheetHandle } from '@/components/ui';

interface Props {
  accounts: Account[];
  selectedId: string | null;
  onChange: (accountId: string | null) => void;
  theme: any;
}

/**
 * Inline value + a sheet of accounts. Rendered inside a `Row`'s right slot on the transaction
 * forms, so the trigger is deliberately just text and a chevron.
 */
export function AccountPicker({ accounts, selectedId, onChange, theme }: Props) {
  const sheet = useRef<SheetHandle>(null);
  const selected = accounts.find(a => a.id === selectedId);

  const handleSelect = (accountId: string | null) => {
    onChange(accountId);
    sheet.current?.dismiss();
  };

  return (
    <>
      <Touchable onPress={() => sheet.current?.present()} haptic="selection" style={S.trigger} accessibilityLabel={selected ? `Account: ${selected.name}, change` : 'Select account'}>
        <Text style={[type.body, { color: selected ? theme.text : theme.secondaryText }]} numberOfLines={1}>
          {selected ? selected.name : 'Select'}
        </Text>
        <Ionicons name="chevron-forward" size={iconSize.sm} color={theme.secondaryText} />
      </Touchable>

      <Sheet ref={sheet} title="Account" scroll snapPoints={['60%']} keyboard="none">
        {accounts.length === 0 ? (
          <EmptyState compact icon="wallet-outline" title="No accounts yet" action={{ label: 'Add account', onPress: () => { sheet.current?.dismiss(); router.push('/add-account'); } }} />
        ) : (
          <>
            <Card padded={false}>
              <Row
                icon="close-circle-outline"
                iconColor={theme.secondaryText}
                iconBg="transparent"
                title="No account"
                right={selectedId === null ? <Ionicons name="checkmark" size={iconSize.md} color={theme.tint} /> : undefined}
                chevron={false}
                onPress={() => handleSelect(null)}
              />
              {accounts.map((acc, i) => {
                const meta = ACCOUNT_TYPE_META[acc.type];
                const sel = selectedId === acc.id;
                return (
                  <Row
                    key={acc.id}
                    icon={meta.icon as any}
                    iconBg={acc.color}
                    iconColor={getContrastText(acc.color)}
                    title={acc.name}
                    subtitle={meta.label}
                    right={sel ? <Ionicons name="checkmark" size={iconSize.md} color={theme.tint} /> : undefined}
                    chevron={false}
                    onPress={() => handleSelect(acc.id)}
                    last={i === accounts.length - 1}
                  />
                );
              })}
            </Card>
            <Button variant="ghost" icon="add-circle-outline" label="Add account" onPress={() => { sheet.current?.dismiss(); router.push('/add-account'); }} style={{ marginTop: space.md }} />
          </>
        )}
      </Sheet>
    </>
  );
}

const S = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingVertical: space.xs, paddingHorizontal: space.xs, borderRadius: radius.sm, maxWidth: 200 },
});
