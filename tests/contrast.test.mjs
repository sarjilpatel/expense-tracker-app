// Every colour pair the app can put on screen, measured against WCAG AA.
//
// This is the test that makes W2-01/02/03 stay fixed. It walks the base palette and all eight
// presets in both schemes and fails on anything under 4.5:1, so a new preset or a nudged surface
// cannot ship a pairing nobody can read — which is how the app arrived at 25 failing preset pairs
// and a white-on-light-grey default in the first place.
//
// The ratio maths below is written out longhand rather than imported. `getContrastText` is one of
// the things under test, and a test that measures an implementation with its own arithmetic only
// proves the implementation is self-consistent.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { Colors, THEME_PRESETS, getContrastText, withContrastText, CONTRAST_LIGHT, CONTRAST_DARK } =
  await import('../constants/theme.ts');

const AA_TEXT    = 4.5;  // WCAG 2.1 SC 1.4.3 — body text at any size
const AA_GRAPHIC = 3;    // WCAG 2.1 SC 1.4.11 — icons and other non-text that carries meaning

const toLinear = (channel) => {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

function luminance(hex) {
  const c = hex.replace('#', '');
  assert.equal(c.length, 6, `${hex} is not a 6-digit hex colour`);
  return 0.2126 * toLinear(parseInt(c.slice(0, 2), 16))
       + 0.7152 * toLinear(parseInt(c.slice(2, 4), 16))
       + 0.0722 * toLinear(parseInt(c.slice(4, 6), 16));
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const check = (fg, bg, min, label) => {
  const r = ratio(fg, bg);
  assert.ok(r >= min, `${label}: ${fg} on ${bg} is ${r.toFixed(2)}:1, needs ${min}:1`);
};

const SCHEMES  = ['light', 'dark'];
// Every surface a text token is actually rendered on.
const SURFACES = ['background', 'card', 'cardAlt', 'surface', 'inputBg'];

test('derived foregrounds clear AA on the colour they sit on', () => {
  for (const scheme of SCHEMES) {
    const t = withContrastText(Colors[scheme]);
    for (const [fg, bg] of [['tintText', 'tint'], ['incomeText', 'income'],
                            ['expenseText', 'expense'], ['warningText', 'warning']]) {
      check(t[fg], t[bg], AA_TEXT, `${scheme} ${fg}`);
    }
  }
});

test('body text clears AA on every surface it is drawn on', () => {
  for (const scheme of SCHEMES) {
    const t = Colors[scheme];
    for (const fg of ['text', 'secondaryText']) {
      for (const bg of SURFACES) check(t[fg], t[bg], AA_TEXT, `${scheme} ${fg} on ${bg}`);
    }
  }
});

// Borders and separators are deliberately absent: 1.4.11 covers non-text that is *required* to
// identify a component or its state, and a hairline between two rows that are already separated
// by their own content is decoration. The tab icons are not — an inactive tab still has to be
// findable.
test('meaningful icons clear the 3:1 non-text bar', () => {
  for (const scheme of SCHEMES) {
    const t = Colors[scheme];
    for (const g of ['icon', 'tabIconDefault', 'tabIconSelected']) {
      check(t[g], t.background, AA_GRAPHIC, `${scheme} ${g}`);
    }
  }
});

test('every preset surface has a readable computed foreground', () => {
  assert.ok(THEME_PRESETS.length > 0, 'no presets to check');
  for (const preset of THEME_PRESETS) {
    for (const scheme of SCHEMES) {
      for (const role of ['accent', 'income', 'expense']) {
        const surface = preset[scheme][role];
        check(getContrastText(surface), surface, AA_TEXT, `${preset.name} ${scheme} ${role}`);
      }
    }
  }
});

// The regression test for the threshold bug: getContrastText returned CONTRAST_DARK on a band of
// mid-tones where CONTRAST_LIGHT scored better, because the constant it compared against (0.179)
// is the crossover for pure black and this function returns #18181B.
//
// It sweeps the whole cube rather than the palette's current colours on purpose: every colour in
// the palette today sits well clear of the crossover, so a palette-only sweep passes with the old
// constant restored and locks nothing. The 4,096-colour grid straddles the band where the two
// disagree, which is the only place the bug was ever visible.
test('getContrastText picks whichever of its two foregrounds scores higher', () => {
  const STEP = 17;  // 0, 17, … 255 — 16 levels per channel, 4,096 colours
  const hex  = (n) => n.toString(16).padStart(2, '0').toUpperCase();
  let checked = 0;

  for (let r = 0; r <= 255; r += STEP) {
    for (let g = 0; g <= 255; g += STEP) {
      for (let b = 0; b <= 255; b += STEP) {
        const bg     = `#${hex(r)}${hex(g)}${hex(b)}`;
        const chosen = getContrastText(bg);
        const light  = ratio(CONTRAST_LIGHT, bg);
        const dark   = ratio(CONTRAST_DARK, bg);
        const best   = light >= dark ? CONTRAST_LIGHT : CONTRAST_DARK;
        assert.equal(chosen, best,
          `${bg}: chose ${chosen} (${ratio(chosen, bg).toFixed(2)}:1) over ${best} `
          + `(${Math.max(light, dark).toFixed(2)}:1)`);
        checked++;
      }
    }
  }
  assert.equal(checked, 16 ** 3);
});

// Structural, not chromatic: the only defence against a hand-written foreground coming back is
// that there is nowhere to write one down.
test('nothing in the palette declares a foreground by hand', () => {
  for (const scheme of SCHEMES) {
    const keys = Object.keys(Colors[scheme]);
    // A *derived* foreground is `<surface>Text` where `<surface>` is itself in the palette —
    // `tintText` pairs with `tint`. `secondaryText` is not one of these: it is a body colour in
    // its own right, with no `secondary` surface behind it.
    for (const key of keys) {
      const paired = key.endsWith('Text') && keys.includes(key.slice(0, -4));
      assert.ok(!paired, `Colors.${scheme}.${key} is a hand-written foreground for ${key.slice(0, -4)}`);
    }
  }
  for (const preset of THEME_PRESETS) {
    for (const scheme of SCHEMES) {
      assert.deepEqual(Object.keys(preset[scheme]).sort(), ['accent', 'expense', 'income'],
        `preset ${preset.name}.${scheme} should state three surfaces and nothing else`);
    }
  }
});
