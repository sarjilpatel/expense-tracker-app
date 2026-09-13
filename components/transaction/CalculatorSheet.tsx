import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { getContrastText, hexToRGBA } from '@/constants/theme';
import { space, radius, type, tabular, icon as iconSize } from '@/constants/tokens';
import { Sheet, Touchable, type SheetHandle } from '@/components/ui';

/**
 * A calculator on the shared `Sheet`, opened from the transaction form's header. The amount itself
 * is typed on the OS keyboard now — the custom keypad that used to own both jobs is gone — so this
 * only has to do arithmetic and hand the result back through "Use".
 *
 * Ref-driven: `present(initial)` seeds it with whatever is already in the amount field.
 */
export interface CalculatorHandle {
  present: (initial?: string) => void;
  dismiss: () => void;
}

interface Props {
  onUse: (value: string) => void;
  accentColor: string;
  theme: any;
}

type Op = '+' | '-' | '×' | '÷' | null;
const OPS: Op[] = ['+', '-', '×', '÷'];
const KEY_HEIGHT = 56;

const evaluate = (left: string, op: Op, right: string): string => {
  const a = parseFloat(left) || 0;
  const b = parseFloat(right) || 0;
  let result = 0;
  if (op === '+') result = a + b;
  else if (op === '-') result = a - b;
  else if (op === '×') result = a * b;
  else if (op === '÷') result = b !== 0 ? a / b : 0;
  return parseFloat(result.toFixed(2)).toString();
};

export const CalculatorSheet = forwardRef<CalculatorHandle, Props>(function CalculatorSheet({ onUse, accentColor, theme }, ref) {
  const sheet = useRef<SheetHandle>(null);
  const [value, setValue] = useState('');
  const [expr, setExpr]   = useState('');
  const [left, setLeft]   = useState('');
  const [op, setOp]       = useState<Op>(null);
  // `=` was just pressed: the next digit starts a fresh number instead of appending.
  const [fresh, setFresh] = useState(false);

  const reset = (initial = '') => {
    setValue(initial); setExpr(initial); setLeft(''); setOp(null); setFresh(false);
  };

  useImperativeHandle(ref, () => ({
    present: (initial) => { reset(initial && parseFloat(initial) > 0 ? initial : ''); sheet.current?.present(); },
    dismiss: () => sheet.current?.dismiss(),
  }), []);

  const press = (key: string) => {
    if (key === 'AC') { reset(); return; }

    if (key === '⌫') {
      if (fresh) { reset(); return; }
      if (op !== null && value === '') { setOp(null); setExpr(left); setValue(left); return; }
      const next = value.slice(0, -1);
      setValue(next);
      setExpr((op ? `${left} ${op} ` : '') + next);
      return;
    }

    if (OPS.includes(key as Op)) {
      // Chain: `2 + 3 ×` evaluates the pending pair first.
      const base = op && value !== '' ? evaluate(left, op, value) : value !== '' ? value : left !== '' ? left : '0';
      setLeft(base); setOp(key as Op); setExpr(`${base} ${key}`); setValue(''); setFresh(false);
      return;
    }

    if (key === '=') {
      if (!op) { if (value) { setExpr(`${value} =`); setFresh(true); } return; }
      const right = value !== '' ? value : left;
      const result = evaluate(left, op, right);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setExpr(`${left} ${op} ${right} =`); setValue(result); setLeft(''); setOp(null); setFresh(true);
      return;
    }

    if (key === '.') {
      if (fresh) { setFresh(false); setLeft(''); setOp(null); setValue('0.'); setExpr('0.'); return; }
      if (value.includes('.')) return;
      const next = value === '' || value === '0' ? '0.' : value + '.';
      setValue(next); setExpr((op ? `${left} ${op} ` : '') + next);
      return;
    }

    if (fresh) { setFresh(false); setLeft(''); setOp(null); setValue(key); setExpr(key); return; }
    const dot = value.indexOf('.');
    if (dot !== -1 && value.length - dot > 2) return;
    const next = value === '0' || value === '' ? key : value + key;
    setValue(next); setExpr((op ? `${left} ${op} ` : '') + next);
  };

  const use = () => {
    const result = op && left !== '' && value !== '' ? evaluate(left, op, value) : value || left;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onUse(result && parseFloat(result) > 0 ? result : '');
    sheet.current?.dismiss();
  };

  const key = (k: string, flex = 1) => {
    const isOp = OPS.includes(k as Op);
    const isEq = k === '=';
    const isAC = k === 'AC';
    const bg   = isEq ? accentColor : isOp ? hexToRGBA(accentColor, 0.14) : isAC ? hexToRGBA(theme.danger, 0.14) : theme.cardAlt;
    const fg   = isEq ? getContrastText(accentColor) : isOp ? accentColor : isAC ? theme.danger : theme.text;
    return (
      <Touchable
        key={k}
        style={[S.key, { flex, backgroundColor: bg }]}
        onPress={() => press(k)}
        haptic={isEq ? 'medium' : 'selection'}
        accessibilityLabel={k === '⌫' ? 'Delete' : isAC ? 'All clear' : k}
      >
        {k === '⌫'
          ? <Ionicons name="backspace-outline" size={iconSize.md} color={theme.text} />
          : <Text style={[isAC ? type.label : type.heading, tabular, { color: fg }]}>{k}</Text>}
      </Touchable>
    );
  };

  const canUse = !!(value || left);

  return (
    <Sheet ref={sheet} title="Calculator" keyboard="none" contentStyle={S.content}>
      <View style={[S.display, { backgroundColor: theme.cardAlt }]}>
        <Text style={[type.label, { color: theme.secondaryText }]} numberOfLines={1}>{expr || ' '}</Text>
        <Text style={[type.display, tabular, { color: value || left ? theme.text : theme.secondaryText }]} numberOfLines={1} adjustsFontSizeToFit>
          {value || left || '0'}
        </Text>
      </View>

      <View style={S.keys}>
        <View style={S.row}>{key('AC')}{key('⌫')}{key('÷')}{key('×')}</View>
        <View style={S.row}>{key('7')}{key('8')}{key('9')}{key('-')}</View>
        <View style={S.row}>{key('4')}{key('5')}{key('6')}{key('+')}</View>
        <View style={S.row}>{key('1')}{key('2')}{key('3')}{key('=')}</View>
        <View style={S.row}>
          {key('.')}{key('0', 2)}
          <Touchable
            style={[S.key, { flex: 1, backgroundColor: canUse ? accentColor : theme.cardAlt }]}
            onPress={use}
            disabled={!canUse}
            haptic="medium"
            accessibilityLabel="Use this value as the amount"
          >
            <Text style={[type.bodyStrong, { color: canUse ? getContrastText(accentColor) : theme.secondaryText }]}>Use</Text>
          </Touchable>
        </View>
      </View>
    </Sheet>
  );
});

const S = StyleSheet.create({
  content: { paddingTop: space.sm },
  display: { paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.md, minHeight: 84, justifyContent: 'center', alignItems: 'flex-end', gap: space.xs },
  keys:    { paddingTop: space.md, gap: space.sm },
  row:     { flexDirection: 'row', gap: space.sm, height: KEY_HEIGHT },
  key:     { borderRadius: radius.md, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
});
