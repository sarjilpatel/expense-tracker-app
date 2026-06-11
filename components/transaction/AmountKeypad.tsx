import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal,
  StyleSheet, Dimensions,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_HEIGHT = Math.round(SCREEN_H * 0.52);
const GAP = 8;

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

export function AmountKeypad({ visible, value, onClose, onDone, onChange, accentColor, theme }: Props) {
  const [mounted, setMounted] = useState(false);
  const [calcMode, setCalcMode] = useState(false);
  const [calcExpr, setCalcExpr] = useState('');
  const [calcLeft, setCalcLeft] = useState('');
  const [calcOp, setCalcOp] = useState<CalcOp>(null);
  // tracks when = was just pressed so next digit starts a fresh number
  const [freshResult, setFreshResult] = useState(false);
  const slide = useSharedValue(SHEET_HEIGHT);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slide.value }],
  }));

  useEffect(() => {
    if (visible) {
      setMounted(true);
      slide.value = SHEET_HEIGHT;
      slide.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
    } else {
      setCalcMode(false);
      setCalcExpr(''); setCalcLeft(''); setCalcOp(null); setFreshResult(false);
      slide.value = withTiming(SHEET_HEIGHT, { duration: 220, easing: Easing.in(Easing.cubic) }, (finished) => {
        'worklet';
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [visible]);

  // ── Regular keypad ────────────────────────────────────────────────────────
  const pressNum = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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

    // Decimal
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

    // Digit
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
    setCalcMode(false);
    setCalcExpr(''); setCalcLeft(''); setCalcOp(null); setFreshResult(false);
    onDone();
  };

  const openCalc = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCalcMode(true);
    setCalcExpr(value); setCalcLeft(''); setCalcOp(null); setFreshResult(false);
  };

  // ── Key renderer ──────────────────────────────────────────────────────────
  const keyBg    = theme.card;
  const opBg     = accentColor + '22';
  const dangerBg = (theme.danger || '#EF4444') + '22';

  const renderKey = (k: string, flex = 1) => {
    const isDel     = k === '⌫';
    const isAC      = k === 'AC';
    const isOp      = ['+', '-', '×', '÷'].includes(k);
    const isEq      = k === '=';
    const isDone    = k === 'done';
    const isCalcBtn = k === 'calc';

    const bgColor = (isEq || isDone) ? accentColor
      : isOp        ? opBg
      : isAC        ? dangerBg
      : isCalcBtn   ? opBg
      : keyBg;

    const txtColor = (isEq || isDone)       ? '#FFF'
      : (isOp || isCalcBtn) ? accentColor
      : isAC                ? (theme.danger || '#EF4444')
      : theme.text;

    const onPress = isDone    ? handleDone
      : isCalcBtn ? openCalc
      : calcMode  ? () => calcPress(k)
      : () => pressNum(k);

    return (
      <TouchableOpacity
        key={k + String(flex)}
        style={[styles.key, { flex, backgroundColor: bgColor }]}
        onPress={onPress}
        activeOpacity={(isEq || isDone) ? 0.7 : 0.55}
      >
        {isDel ? (
          <Ionicons name="backspace-outline" size={20} color={theme.text} />
        ) : isDone ? (
          <Text style={[styles.keyText, styles.doneText]}>Done</Text>
        ) : isCalcBtn ? (
          <Ionicons name="calculator-outline" size={22} color={accentColor} />
        ) : isEq ? (
          <Text style={[styles.keyText, styles.doneText]}>=</Text>
        ) : isOp ? (
          <Text style={[styles.keyText, { color: txtColor, fontSize: 24, fontWeight: '400' }]}>{k}</Text>
        ) : isAC ? (
          <Text style={[styles.keyText, { color: txtColor, fontSize: 15, fontWeight: '700' }]}>AC</Text>
        ) : (
          <Text style={[styles.keyText, { color: txtColor }]}>{k}</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.container} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, { backgroundColor: theme.background, height: SHEET_HEIGHT }, sheetStyle]}>

          <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />

          {/* Display */}
          <View style={[styles.display, { borderBottomColor: theme.border }]}>
            {calcMode && calcExpr ? (
              <Text style={[styles.exprText, { color: theme.secondaryText }]} numberOfLines={1}>
                {calcExpr}
              </Text>
            ) : null}
            <View style={styles.displayRow}>
              <Text
                style={[styles.displayAmount, { color: value ? theme.text : theme.secondaryText }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {value || '0'}
              </Text>
              <View style={[styles.cursor, { backgroundColor: accentColor }]} />
            </View>
          </View>

          {/* Keys */}
          <View style={styles.keypadArea}>
            {calcMode ? (
              // Calculator: 5 rows — standard layout, 0 is double-wide, Done in last row
              <>
                <View style={styles.row}>{renderKey('AC')}{renderKey('⌫')}{renderKey('÷')}{renderKey('×')}</View>
                <View style={styles.row}>{renderKey('7')}{renderKey('8')}{renderKey('9')}{renderKey('-')}</View>
                <View style={styles.row}>{renderKey('4')}{renderKey('5')}{renderKey('6')}{renderKey('+')}</View>
                <View style={styles.row}>{renderKey('1')}{renderKey('2')}{renderKey('3')}{renderKey('=')}</View>
                <View style={styles.row}>{renderKey('.')}{renderKey('0', 2)}{renderKey('done')}</View>
              </>
            ) : (
              // Regular: 4 rows — no null gaps, 0 is triple-wide on last row
              <>
                <View style={styles.row}>{renderKey('1')}{renderKey('2')}{renderKey('3')}{renderKey('⌫')}</View>
                <View style={styles.row}>{renderKey('4')}{renderKey('5')}{renderKey('6')}{renderKey('calc')}</View>
                <View style={styles.row}>{renderKey('7')}{renderKey('8')}{renderKey('9')}{renderKey('done')}</View>
                <View style={styles.row}>{renderKey('.')}{renderKey('0', 3)}</View>
              </>
            )}
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'transparent' },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 20,
  },
  dragHandle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginTop: 10, marginBottom: 2, opacity: 0.4,
  },
  display: {
    paddingHorizontal: 20, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 52, justifyContent: 'center',
  },
  exprText:      { fontSize: 12, fontWeight: '500', marginBottom: 2 },
  displayRow:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  displayAmount: {
    fontSize: 32, fontWeight: '800',
    fontVariant: ['tabular-nums'], letterSpacing: -0.5, flex: 1,
  },
  cursor:     { width: 2, height: 32, borderRadius: 1, opacity: 0.9 },
  keypadArea: { flex: 1, padding: GAP, gap: GAP },
  row:        { flexDirection: 'row', gap: GAP, flex: 1 },
  key: {
    flex: 1, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  keyText:  { fontSize: 22, fontWeight: '500' },
  doneText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
});
