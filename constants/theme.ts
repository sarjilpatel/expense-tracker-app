const primaryLight  = '#18181B';
const primaryDark   = '#E4E4E7';
const successLight  = '#22C55E';
const successDark   = '#4ADE80';
const dangerLight   = '#EF4444';
const dangerDark    = '#F87171';
const warningLight  = '#F59E0B';
const warningDark   = '#FCD34D';

/**
 * The palette as it is written down: surfaces, accents and semantic colours only.
 * Foregrounds are deliberately absent — see `ThemeColors` below.
 */
export type BaseColors = {
  text: string;
  secondaryText: string;
  background: string;
  card: string;
  cardAlt: string;
  border: string;
  separator: string;
  surface: string;
  inputBg: string;
  tint: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;
  income: string;
  expense: string;
  primary: string;
  success: string;
  danger: string;
  warning: string;
  chart: string[];
};

/**
 * A palette with its foregrounds derived. Every `*Text` token is computed from the colour it sits
 * on, never written by hand — that is the whole point (W2-01/W2-02). Build one with
 * `withContrastText`, or take the live one from `useTheme()`, which also folds in presets and
 * user overrides. A preset may declare its own foreground; nothing else may.
 */
export type ThemeColors = BaseColors & {
  tintText: string;
  incomeText: string;
  expenseText: string;
  warningText: string;
};

export const Colors: { light: BaseColors; dark: BaseColors } = {
  light: {
    text:            '#18181B',
    secondaryText:   '#636369',
    background:      '#F5F5F5',
    card:            '#FFFFFF',
    cardAlt:         '#E5E7EB',
    border:          '#D1D5DB',
    separator:       '#E5E7EB',
    surface:         '#F3F4F6',
    inputBg:         '#FFFFFF',
    tint:            primaryLight,
    icon:            '#71717A',
    tabIconDefault:  '#85858E',
    tabIconSelected: primaryLight,
    income:          successLight,
    expense:         dangerLight,
    primary:         primaryLight,
    success:         successLight,
    danger:          dangerLight,
    warning:         warningLight,
    chart: ['#18181B','#27272A','#3F3F46','#52525B','#71717A','#A1A1AA','#D4D4D8'],
  },
  dark: {
    text:            '#F4F4F5',
    secondaryText:   '#A1A1AA',
    background:      '#09090B',
    card:            '#18181B',
    cardAlt:         '#27272A',
    border:          '#3F3F46',
    separator:       '#18181B',
    surface:         '#1C1C1E',
    inputBg:         '#18181B',
    tint:            primaryDark,
    icon:            '#A1A1AA',
    tabIconDefault:  '#71717A',
    tabIconSelected: primaryDark,
    income:          successDark,
    expense:         dangerDark,
    primary:         primaryDark,
    success:         successDark,
    danger:          dangerDark,
    warning:         warningDark,
    chart: ['#F4F4F5','#E7E5E4','#D4D4D8','#A1A1AA','#71717A','#52525B','#3F3F46'],
  },
};

// A preset states the three surface colours and nothing else. It used to declare its own
// foregrounds too, and 25 of those 48 pairs were below 4.5:1, so ThemeContext computes them
// all from the surface now and there is nothing here for a new preset to get wrong.
export interface PresetColors {
  accent: string;
  income: string;
  expense: string;
}

export interface ThemePreset {
  name: string;
  light: PresetColors;
  dark: PresetColors;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    name: 'Graphite',
    // Light: deep charcoal accent is bold and readable
    // Dark: near-white so active tab is clearly highlighted against dark bg
    light: { accent: '#18181B', income: '#22C55E', expense: '#EF4444' },
    dark:  { accent: '#E4E4E7', income: '#4ADE80', expense: '#F87171' },
  },
  {
    name: 'Ocean',
    light: { accent: '#2563EB', income: '#10B981', expense: '#F43F5E' },
    dark:  { accent: '#3B82F6', income: '#34D399', expense: '#FB7185' },
  },
  {
    name: 'Forest',
    light: { accent: '#16A34A', income: '#059669', expense: '#DC2626' },
    dark:  { accent: '#22C55E', income: '#4ADE80', expense: '#F87171' },
  },
  {
    name: 'Dusk',
    light: { accent: '#7C3AED', income: '#0EA5E9', expense: '#EC4899' },
    dark:  { accent: '#A78BFA', income: '#38BDF8', expense: '#F472B6' },
  },
  {
    name: 'Ember',
    light: { accent: '#EA580C', income: '#16A34A', expense: '#DC2626' },
    dark:  { accent: '#FB923C', income: '#4ADE80', expense: '#F87171' },
  },
  {
    name: 'Pearl',
    light: { accent: '#475569', income: '#0EA5E9', expense: '#F43F5E' },
    dark:  { accent: '#CBD5E1', income: '#38BDF8', expense: '#FB7185' },
  },
  {
    name: 'Azure',
    light: { accent: '#0369A1', income: '#10B981', expense: '#F43F5E' },
    dark:  { accent: '#38BDF8', income: '#34D399', expense: '#FB7185' },
  },
  {
    name: 'Coral',
    light: { accent: '#E11D48', income: '#0EA5E9', expense: '#E11D48' },
    dark:  { accent: '#FB7185', income: '#38BDF8', expense: '#FB7185' },
  },
];


let _currencySymbol = '₹';
let _currencyLocale = 'en-IN';

export function applyCurrency(symbol: string, locale: string): void {
  _currencySymbol = symbol;
  _currencyLocale = locale;
}

export const Currency = {
  get symbol() { return _currencySymbol; },
  format: (amount: number) =>
    `${_currencySymbol} ${(amount || 0).toLocaleString(_currencyLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
};

export const TYPE_SCALE = {
  heroAmount:   { fontSize: 48, fontWeight: '800' as const, fontVariant: ['tabular-nums'] as const, letterSpacing: -0.5 },
  screenTitle:  { fontSize: 24, fontWeight: '800' as const },
  sectionTitle: { fontSize: 17, fontWeight: '700' as const },
  body:         { fontSize: 15, fontWeight: '500' as const },
  label:        { fontSize: 13, fontWeight: '600' as const },
  caption:      { fontSize: 11, fontWeight: '500' as const },
};

export const CATEGORIES = [
  { id: '1', name: 'Food',          icon: 'fast-food' },
  { id: '2', name: 'Transport',     icon: 'car' },
  { id: '3', name: 'Shopping',      icon: 'cart' },
  { id: '4', name: 'Rent',          icon: 'home' },
  { id: '5', name: 'Entertainment', icon: 'game-controller' },
  { id: '6', name: 'Other',         icon: 'ellipsis-horizontal' },
];

export const CATEGORY_COLORS = {
  'Food':          { bg: '#F3F4F6', icon: '#18181B' },
  'Transport':     { bg: '#E5E7EB', icon: '#27272A' },
  'Shopping':      { bg: '#F4F4F5', icon: '#3F3F46' },
  'Health':        { bg: '#E7E5E4', icon: '#52525B' },
  'Entertainment': { bg: '#F5F5F4', icon: '#71717A' },
  'Bills':         { bg: '#E5E7EB', icon: '#3F3F46' },
  'Rent':          { bg: '#E5E7EB', icon: '#27272A' },
  'Education':     { bg: '#F3F4F6', icon: '#52525B' },
  'Salary':        { bg: '#E5E7EB', icon: '#18181B' },
  'Business':      { bg: '#F3F4F6', icon: '#3F3F46' },
  'Investment':    { bg: '#F9FAFB', icon: '#71717A' },
  'Other':         { bg: '#F5F5F5', icon: '#9CA3AF' },
};

export const BORDER_RADIUS = {
  card: 16,
  input: 12,
  chip: 8,
  button: 14,
  pill: 999,
  avatar: '50%',
};

export function hexToRGBA(hex: string, alpha: number): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// The only two foregrounds the app ever puts on a coloured surface.
export const CONTRAST_LIGHT = '#FFFFFF';
export const CONTRAST_DARK  = '#18181B';

// Returns CONTRAST_LIGHT for dark backgrounds, CONTRAST_DARK for light ones (WCAG luminance)
export function getContrastText(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const toLinear = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const lum = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  // The familiar 0.179 crossover is the one for white vs *pure black*; the dark token here is
  // #18181B (luminance 0.00927), so the point where the two stop being equally good sits at
  // sqrt((1 + 0.05) * (0.00927 + 0.05)) - 0.05. Using 0.179 handed #6366F1 dark text at 3.97:1
  // when white would have given 4.47:1.
  return lum > 0.1995 ? CONTRAST_DARK : CONTRAST_LIGHT;
}

/**
 * Derive the four foreground tokens for a palette. `ThemeContext` layers presets and overrides on
 * top of this; anything reading `Colors` directly should go through it rather than assuming white.
 */
export function withContrastText(base: BaseColors): ThemeColors {
  return {
    ...base,
    tintText:    getContrastText(base.tint),
    incomeText:  getContrastText(base.income),
    expenseText: getContrastText(base.expense),
    warningText: getContrastText(base.warning),
  };
}

/**
 * The two palettes with their foregrounds derived, for the rare reader that runs outside
 * `ThemeContext` and so cannot see presets or user overrides. Prefer `useTheme()`.
 */
export const StaticThemes: { light: ThemeColors; dark: ThemeColors } = {
  light: withContrastText(Colors.light),
  dark:  withContrastText(Colors.dark),
};

export function getCategoryColors(category: string, isDark: boolean) {
  const base = CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS['Other'];
  if (isDark) {
    return {
      bg: hexToRGBA(base.icon, 0.15),
      icon: base.icon,
    };
  }
  return base;
}

