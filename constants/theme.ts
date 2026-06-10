import { Platform } from 'react-native';

const primaryLight  = '#18181B';
const primaryDark   = '#3F3F46';
const successLight  = '#5AAEF0';
const successDark   = '#5AAEF0';
const dangerLight   = '#E07068';
const dangerDark    = '#E07068';
const warningLight  = '#71717A';
const warningDark   = '#A1A1AA';

export type ThemeColors = {
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
  tintText: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;
  income: string;
  incomeText: string;
  expense: string;
  expenseText: string;
  primary: string;
  success: string;
  danger: string;
  warning: string;
  chart: string[];
};

export const Colors: { light: ThemeColors; dark: ThemeColors } = {
  light: {
    text:            '#18181B',
    secondaryText:   '#71717A',
    background:      '#F5F5F5',
    card:            '#FFFFFF',
    cardAlt:         '#E5E7EB',
    border:          '#D1D5DB',
    separator:       '#E5E7EB',
    surface:         '#F3F4F6',
    inputBg:         '#FFFFFF',
    tint:            primaryLight,
    tintText:        '#FFFFFF',
    icon:            '#71717A',
    tabIconDefault:  '#A1A1AA',
    tabIconSelected: primaryLight,
    income:          successLight,
    incomeText:      '#FFFFFF',
    expense:         dangerLight,
    expenseText:     '#FFFFFF',
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
    tintText:        '#FFFFFF',
    icon:            '#A1A1AA',
    tabIconDefault:  '#71717A',
    tabIconSelected: primaryDark,
    income:          successDark,
    incomeText:      '#FFFFFF',
    expense:         dangerDark,
    expenseText:     '#FFFFFF',
    primary:         primaryDark,
    success:         successDark,
    danger:          dangerDark,
    warning:         warningDark,
    chart: ['#F4F4F5','#E7E5E4','#D4D4D8','#A1A1AA','#71717A','#52525B','#3F3F46'],
  },
};

export interface PresetColors {
  accent: string;
  accentText: string;
  income: string;
  incomeText: string;
  expense: string;
  expenseText: string;
}

export interface ThemePreset {
  name: string;
  light: PresetColors;
  dark: PresetColors;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    name: 'Graphite',
    light: { accent: '#18181B', accentText: '#FFFFFF', income: '#5AAEF0', incomeText: '#FFFFFF', expense: '#E07068', expenseText: '#FFFFFF' },
    dark:  { accent: '#3F3F46', accentText: '#FFFFFF', income: '#5AAEF0', incomeText: '#FFFFFF', expense: '#E07068', expenseText: '#FFFFFF' },
  },
  {
    name: 'Ocean',
    light: { accent: '#1D4ED8', accentText: '#FFFFFF', income: '#5AAEF0', incomeText: '#FFFFFF', expense: '#E07068', expenseText: '#FFFFFF' },
    dark:  { accent: '#2563EB', accentText: '#FFFFFF', income: '#5AAEF0', incomeText: '#FFFFFF', expense: '#E07068', expenseText: '#FFFFFF' },
  },
  {
    name: 'Forest',
    light: { accent: '#15803D', accentText: '#FFFFFF', income: '#5AAEF0', incomeText: '#FFFFFF', expense: '#E07068', expenseText: '#FFFFFF' },
    dark:  { accent: '#15803D', accentText: '#FFFFFF', income: '#5AAEF0', incomeText: '#FFFFFF', expense: '#E07068', expenseText: '#FFFFFF' },
  },
  {
    name: 'Dusk',
    light: { accent: '#6D28D9', accentText: '#FFFFFF', income: '#5AAEF0', incomeText: '#FFFFFF', expense: '#E07068', expenseText: '#FFFFFF' },
    dark:  { accent: '#7C3AED', accentText: '#FFFFFF', income: '#5AAEF0', incomeText: '#FFFFFF', expense: '#E07068', expenseText: '#FFFFFF' },
  },
  {
    name: 'Ember',
    light: { accent: '#C2410C', accentText: '#FFFFFF', income: '#5AAEF0', incomeText: '#FFFFFF', expense: '#E07068', expenseText: '#FFFFFF' },
    dark:  { accent: '#C2410C', accentText: '#FFFFFF', income: '#5AAEF0', incomeText: '#FFFFFF', expense: '#E07068', expenseText: '#FFFFFF' },
  },
  {
    name: 'Pearl',
    light: { accent: '#52525B', accentText: '#FFFFFF', income: '#5AAEF0', incomeText: '#FFFFFF', expense: '#E07068', expenseText: '#FFFFFF' },
    dark:  { accent: '#A1A1AA', accentText: '#18181B', income: '#5AAEF0', incomeText: '#FFFFFF', expense: '#E07068', expenseText: '#FFFFFF' },
  },
  {
    name: 'Azure',
    light: { accent: '#5AAEF0', accentText: '#18181B', income: '#5AAEF0', incomeText: '#FFFFFF', expense: '#E07068', expenseText: '#FFFFFF' },
    dark:  { accent: '#5AAEF0', accentText: '#18181B', income: '#5AAEF0', incomeText: '#FFFFFF', expense: '#E07068', expenseText: '#FFFFFF' },
  },
  {
    name: 'Coral',
    light: { accent: '#E07068', accentText: '#18181B', income: '#5AAEF0', incomeText: '#FFFFFF', expense: '#E07068', expenseText: '#FFFFFF' },
    dark:  { accent: '#E07068', accentText: '#18181B', income: '#5AAEF0', incomeText: '#FFFFFF', expense: '#E07068', expenseText: '#FFFFFF' },
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

// Returns '#FFFFFF' for dark backgrounds, '#18181B' for light backgrounds (WCAG luminance)
export function getContrastText(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const toLinear = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const lum = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return lum > 0.179 ? '#18181B' : '#FFFFFF';
}

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

