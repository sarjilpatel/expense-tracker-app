// The component layer (W2-30) — the parts of it that are pure.
//
// The primitives themselves are React Native and cannot render under node:test; what can run is
// the logic they delegate to, which is where the rules live: the sign on every amount (W2-24),
// tabular formatting, and the 44dp hit-target maths (W2-22). Pinning these here means `Amount`
// and `Touchable` are thin wrappers over tested functions rather than the sixth copy of each.

import test from 'node:test';
import assert from 'node:assert/strict';

const money  = await import('../src/utils/money.ts');
const layout = await import('../src/utils/layout.ts');

const { formatAmount, formatMinorAmount, formatCompactAmount, setDefaultCurrency, MINUS } = money;
const { slopFor, MIN_TARGET } = layout;

// --- sign and direction ------------------------------------------------------------------------

test('an expense carries a minus sign and income a plus — the colour is never the only cue', () => {
  setDefaultCurrency('₹', 'en-IN');
  assert.equal(formatAmount(1234.5, 'expense'), `${MINUS}₹1,234.50`);
  assert.equal(formatAmount(1234.5, 'income'),  '+₹1,234.50');
  assert.equal(formatAmount(1234.5, 'neutral'), '₹1,234.50');
});

test('the minus is U+2212, not a hyphen, so it is as wide as the plus in tabular figures', () => {
  assert.equal(MINUS, '−');
  assert.notEqual(MINUS, '-');
  assert.ok(formatAmount(1, 'expense').startsWith(MINUS));
});

test('direction comes from kind, never from the sign of the number', () => {
  // A stored negative must not be able to flip a row.
  assert.equal(formatAmount(-500, 'income'),  '+₹500.00');
  assert.equal(formatAmount(-500, 'expense'), `${MINUS}₹500.00`);
});

test('unsigned drops the sign for totals whose label already states the direction', () => {
  assert.equal(formatAmount(99, 'expense', { unsigned: true }), '₹99.00');
});

// --- formatting ----------------------------------------------------------------------------------

test('Indian locale groups lakhs and crores', () => {
  setDefaultCurrency('₹', 'en-IN');
  assert.equal(formatAmount(1234567.89), '₹12,34,567.89');
});

test('the default currency follows the preference, for both symbol and grouping', () => {
  setDefaultCurrency('$', 'en-US');
  assert.equal(formatAmount(1234567.89), '$1,234,567.89');
  setDefaultCurrency('₹', 'en-IN');
});

test('a per-value symbol and locale override the default without changing it', () => {
  assert.equal(formatAmount(1000, 'neutral', { symbol: '€', locale: 'de-DE' }), '€1.000,00');
  assert.equal(formatAmount(1000), '₹1,000.00', 'the default is untouched');
});

test('whole-unit currencies drop the decimals', () => {
  assert.equal(formatAmount(1500, 'neutral', { symbol: '¥', locale: 'ja-JP', decimals: false }), '¥1,500');
});

test('minor units divide by 100 — the trip model stores paise', () => {
  assert.equal(formatMinorAmount(123456, 'expense'), `${MINUS}₹1,234.56`);
  assert.equal(formatMinorAmount(0), '₹0.00');
});

test('nonsense input renders as zero rather than NaN', () => {
  assert.equal(formatAmount(NaN), '₹0.00');
  assert.equal(formatAmount(undefined), '₹0.00');
  assert.equal(formatMinorAmount(Infinity), '₹0.00');
});

// --- compact --------------------------------------------------------------------------------------

test('compact form uses lakh and crore for Indian locales and K/M/B elsewhere', () => {
  setDefaultCurrency('₹', 'en-IN');
  assert.equal(formatCompactAmount(1500),      '₹1.5K');
  assert.equal(formatCompactAmount(250000),    '₹2.5L');
  assert.equal(formatCompactAmount(30000000),  '₹3Cr');
  assert.equal(formatCompactAmount(2500000, { symbol: '$', locale: 'en-US' }), '$2.5M');
  assert.equal(formatCompactAmount(999),       '₹999');
});

test('compact form is unsigned — an axis has no direction', () => {
  assert.equal(formatCompactAmount(-1500), '₹1.5K');
});

// --- hit targets ----------------------------------------------------------------------------------

test('a control smaller than the minimum target gets hitSlop up to it, per side', () => {
  assert.equal(MIN_TARGET, 44);
  assert.deepEqual(slopFor(20), { top: 12, bottom: 12, left: 12, right: 12 });
  assert.deepEqual(slopFor(36), { top: 4,  bottom: 4,  left: 4,  right: 4  });
  assert.deepEqual(slopFor(43), { top: 1,  bottom: 1,  left: 1,  right: 1  });
});

test('a control already at or over the minimum gets no slop', () => {
  assert.equal(slopFor(44), undefined);
  assert.equal(slopFor(48), undefined);
});

test('no size means no slop — the caller has not told us the rendered size', () => {
  assert.equal(slopFor(undefined), undefined);
  assert.equal(slopFor(0), undefined);
  assert.equal(slopFor(NaN), undefined);
});
