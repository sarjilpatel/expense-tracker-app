import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { getContrastText, hexToRGBA } from '@/constants/theme';
import { space, radius, type, tabular, icon as iconSize } from '@/constants/tokens';
import { Sheet, Touchable, type SheetHandle } from '@/components/ui';

/**
 * The amount keypad, with a calculator mode.
 *
 * This was the modal the user reported could not be dismissed by tapping outside: a hand-rolled
 * `Modal` with a transparent container that refused touches and no scrim at all (W2-11). It now
 * sits in the shared `Sheet` — scrim, tap-outside, drag-down and hardware back come from there,
 * and only the keys and the arithmetic are this file's own.
 *
 * The `visible` prop is kept so callers are unchanged; it drives the sheet's present/dismiss.
 */
interface Props {
  visible: boolean;
  value: string;
  onClose: () => void;
  onDone: () => void;
  onChange: (v: string) => void;
  accentColor: string;
  theme: any;
}

type CalcOp = '+' | '-' | '×' | '÷' | null;

const KEY_HEIGHT = 56;

export function AmountKeypad({ visible, value, onClose, onDone, onChange, accentColor, theme }: Props) {
  const sheet = useRef<SheetHandle>(null);
  const [calcMode, setCalcMode] = useState(false);
  const [calcExpr, setCalcExpr] = useState('');
  const [calcLeft, setCalcLeft] = useState('');
  const [calcOp, setCalcOp] = useState<CalcOp>(null);
  // tracks when = was just pressed so next digit starts a fresh number
  const [freshResult, setFreshResult] = useState(false);

  useEffect(() => {
    if (visible) sheet.current?.present();
    else sheet.current?.dismiss();
  }, [visible]);

  const resetCalc = () => {
    setCalcMode(false);
    setCalcExpr(''); setCalcLeft(''); setCalcOp(null); setFreshResult(false);
  };

  // ── Regular keypad ────────────────────────────────────────────────────────
  const pressNum = (key: string) => {
    if (key === '⌫') { onChange(value.slice(0, -1)); return; }
    if (key === '.') {
      if (value.includes('.')) return;
      onChange((value === '' || value === '0') ? '0.' : value + '.');
      return;
    }
    if (value === '0' || value === '') { onChange(key); return; }
    const dot = value.indexOf('.');
    if (dot !== -1 && value.length - dot > 2) return;
    onChange(value + key);
  };

  // ── Calculator ────────────────────────────────────────────────────────────
  const evaluate = (left: string, op: CalcOp, right: string): string => {
    const a = parseFloat(left) || 0;
    const b = parseFloat(right) || 0;
    let result = 0;
    if (op === '+') result = a + b;
    else if (op === '-') result = a - b;
    else if (op === '×') result = a * b;
    else if (op === '÷') result = b !== 0 ? a / b : 0;
    return parseFloat(result.toFixed(2)).toString();
  };

  const calcPress = (key: string) => {
    if (key === 'AC') {
      setCalcExpr(''); setCalcLeft(''); setCalcOp(null); setFreshResult(false);
      onChange('');
      return;
    }

    if (key === '⌫') {
      if (freshResult) {
        setFreshResult(false); onChange(''); setCalcExpr('');
        return;
      }
      if (calcOp !== null && value === '') {
        // undo the operator
        setCalcOp(null); setCalcExpr(calcLeft); onChange(calcLeft);
      } else {
        const next = value.slice(0, -1);
        onChange(next);
        setCalcExpr((calcOp ? `${calcLeft} ${calcOp} ` : '') + next);
      }
      return;
    }

    const OPS: CalcOp[] = ['+', '-', '×', '÷'];
    if (OPS.includes(key as CalcOp)) {
      const base = value !== '' ? value : (calcLeft !== '' ? calcLeft : '0');
      setCalcLeft(base); setCalcOp(key as CalcOp);
      setCalcExpr(`${base} ${key}`);
      onChange(''); setFreshResult(false);
      return;
    }

    if (key === '=') {
      if (!calcOp) {
        if (value) { setCalcExpr(`${value} =`); setFreshResult(true); }
        return;
      }
      const right = value !== '' ? value : calcLeft;
      const rounded = evaluate(calcLeft, calcOp, right);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCalcExpr(`${calcLeft} ${calcOp} ${right} =`);
      onChange(rounded);
      setCalcLeft(''); setCalcOp(null); setFreshResult(true);
      return;
    }

    if (key === '.') {
      if (value.includes('.')) return;
      if (freshResult) {
        setFreshResult(false); setCalcLeft(''); setCalcOp(null);
        onChange('0.'); setCalcExpr('0.');
        return;
      }
      const next = (value === '' || value === '0') ? '0.' : value + '.';
      onChange(next);
      setCalcExpr((calcOp ? `${calcLeft} ${calcOp} ` : '') + next);
      return;
    }

    if (freshResult) {
      setFreshResult(false); setCalcLeft(''); setCalcOp(null);
      onChange(key); setCalcExpr(key);
      return;
    }
    const dot = value.indexOf('.');
    if (dot !== -1 && value.length - dot > 2) return;
    const next = (value === '0' || value === '') ? key : value + key;
    onChange(next);
    setCalcExpr((calcOp ? `${calcLeft} ${calcOp} ` : '') + next);
  };

  const handleDone = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (calcMode && calcOp && calcLeft !== '' && value !== '') {
      onChange(evaluate(calcLeft, calcOp, value));
    }
    resetCalc();
    onDone();
  };

  const openCalc = () => {
    setCalcMode(true);
    setCalcExpr(value); setCalcLeft(''); setCalcOp(null); setFreshResult(false);
  };

  // ── Key renderer ──────────────────────────────────────────────────────────
  const renderKey = (k: string, flex = 1) => {
    const isDel     = k === '⌫';
    const isAC      = k === 'AC';
    const isOp      = ['+', '-', '×', '÷'].includes(k);
    const isEq      = k === '=';
    const isDone    = k === 'done';
    const isCalcBtn = k === 'calc';

    const bgColor = (isEq || isDone) ? accentColor
      : (isOp || isCalcBtn) ? hexToRGBA(accentColor, 0.14)
      : isAC ? hexToRGBA(theme.danger, 0.14)
      : theme.cardAlt;
    const txtColor = (isEq || isDone) ? getContrastText(accentColor)
      : (isOp || isCalcBtn) ? accentColor
      : isAC ? theme.danger
      : theme.text;

    const onPress = isDone ? handleDone : isCalcBtn ? openCalc : calcMode ? () => calcPress(k) : () => pressNum(k);
    const label = isDel ? 'Delete' : isDone ? 'Done' : isCalcBtn ? 'Calculator' : isAC ? 'All clear' : k;

    return (
      <Touchable
        key={k + String(flex)}
        style={[styles.key, { flex, backgroundColor: bgColor }]}
        onPress={onPress}
        haptic={isEq || isDone ? 'medium' : 'selection'}
        accessibilityLabel={label}
      >
        {isDel ? <Ionicons name="backspace-outline" size={iconSize.md} color={theme.text} />
          : isCalcBtn ? <Ionicons name="calculator-outline" size={iconSize.lg} color={accentColor} />
          : isDone ? <Text style={[type.bodyStrong, { color: txtColor }]}>Done</Text>
          : isAC ? <Text style={[type.label, { color: txtColor }]}>AC</Text>
          : <Text style={[styles.keyText, { color: txtColor }]}>{k}</Text>}
      </Touchable>
    );
  };

  return (
    <Sheet ref={sheet} onDismiss={() => { resetCalc(); onClose(); }} keyboard="none" contentStyle={styles.content}>
      {/* Display */}
      <View style={[styles.display, { borderBottomColor: theme.separator }]}>
        {calcMode && calcExpr ? (
          <Text style={[type.label, { color: theme.secondaryText }]} numberOfLines={1}>{calcExpr}</Text>
        ) : null}
        <View style={styles.displayRow}>
          <Text style={[styles.displayAmount, { color: value ? theme.text : theme.secondaryText }]} numberOfLines={1} adjustsFontSizeToFit>
            {value || '0'}
          </Text>
          <View style={[styles.cursor, { backgroundColor: accentColor }]} />
        </View>
      </View>

      {/* Keys */}
      <View style={styles.keys}>
        {calcMode ? (
          <>
            <View style={styles.row}>{renderKey('AC')}{renderKey('⌫')}{renderKey('÷')}{renderKey('×')}</View>
            <View style={styles.row}>{renderKey('7')}{renderKey('8')}{renderKey('9')}{renderKey('-')}</View>
            <View style={styles.row}>{renderKey('4')}{renderKey('5')}{renderKey('6')}{renderKey('+')}</View>
            <View style={styles.row}>{renderKey('1')}{renderKey('2')}{renderKey('3')}{renderKey('=')}</View>
            <View style={styles.row}>{renderKey('.')}{renderKey('0', 2)}{renderKey('done')}</View>
          </>
        ) : (
          <>
            <View style={styles.row}>{renderKey('1')}{renderKey('2')}{renderKey('3')}{renderKey('⌫')}</View>
            <View style={styles.row}>{renderKey('4')}{renderKey('5')}{renderKey('6')}{renderKey('calc')}</View>
            <View style={styles.row}>{renderKey('7')}{renderKey('8')}{renderKey('9')}{renderKey('done')}</View>
            <View style={styles.row}>{renderKey('.')}{renderKey('0', 3)}</View>
          </>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content:       { paddingHorizontal: space.sm, paddingTop: 0 },
  display:       { paddingHorizontal: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 56, justifyContent: 'center' },
  displayRow:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  displayAmount: { ...type.display, ...tabular, flex: 1 },
  cursor:        { width: 2, height: 32, borderRadius: 1, opacity: 0.9 },
  keys:          { paddingTop: space.sm, gap: space.sm },
  row:           { flexDirection: 'row', gap: space.sm, height: KEY_HEIGHT },
  key:           { borderRadius: radius.md, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  keyText:       { ...type.heading, ...tabular },
});
