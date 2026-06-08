import { Platform } from 'react-native';

const primaryLight  = '#059669';
const primaryDark   = '#34D399';
const successLight  = '#16A34A';
const successDark   = '#22C55E';
const dangerLight   = '#DC2626';
const dangerDark    = '#EF4444';
const warningLight  = '#F59E0B';
const warningDark   = '#FBBF24';

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
    text:            '#1C1917',
    secondaryText:   '#78716C',
    background:      '#FAFAF9',
    card:            '#FFFFFF',
    cardAlt:         '#F5F5F0',
    border:          '#E7E5E4',
    separator:       '#F5F5F0',
    surface:         '#F0FDF4',
    inputBg:         '#FAFAF9',
    tint:            primaryLight,
    tintText:        '#FFFFFF',
    icon:            '#78716C',
    tabIconDefault:  '#A8A29E',
    tabIconSelected: primaryLight,
    income:          successLight,
    incomeText:      '#FFFFFF',
    expense:         dangerLight,
    expenseText:     '#FFFFFF',
    primary:         primaryLight,
    success:         successLight,
    danger:          dangerLight,
    warning:         warningLight,
    chart: ['#059669','#16A34A','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#DC2626'],
  },
  dark: {
    text:            '#F0F6FC',
    secondaryText:   '#8B949E',
    background:      '#0D1117',
    card:            '#161B22',
    cardAlt:         '#1F2937',
    border:          '#30363D',
    separator:       '#161B22',
    surface:         '#111827',
    inputBg:         '#0D1117',
    tint:            primaryDark,
    tintText:        '#FFFFFF',
    icon:            '#8B949E',
    tabIconDefault:  '#484F58',
    tabIconSelected: primaryDark,
    income:          successDark,
    incomeText:      '#FFFFFF',
    expense:         dangerDark,
    expenseText:     '#FFFFFF',
    primary:         primaryDark,
    success:         successDark,
    danger:          dangerDark,
    warning:         warningDark,
    chart: ['#34D399','#22C55E','#FBBF24','#A78BFA','#F472B6','#22D3EE','#EF4444'],
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
    name: 'Indigo Slate',
    light: {
      accent: '#4F46E5',
      accentText: '#FFFFFF',
      income: '#2E7D5C',
      incomeText: '#FFFFFF',
      expense: '#C25975',
      expenseText: '#FFFFFF',
    },
    dark: {
      accent: '#818CF8',
      accentText: '#FFFFFF',
      income: '#48BB78',
      incomeText: '#FFFFFF',
      expense: '#E07A8B',
      expenseText: '#FFFFFF',
    },
  },
  {
    name: 'Nordic Sage',
    light: {
      accent: '#3B7A7A',
      accentText: '#FFFFFF',
      income: '#4A8B6F',
      incomeText: '#FFFFFF',
      expense: '#C86A5A',
      expenseText: '#FFFFFF',
    },
    dark: {
      accent: '#8FAEC4',
      accentText: '#18181B',
      income: '#76AB94',
      incomeText: '#18181B',
      expense: '#DCA498',
      expenseText: '#18181B',
    },
  },
  {
    name: 'Ocean Breeze',
    light: {
      accent: '#0D9488',
      accentText: '#FFFFFF',
      income: '#059669',
      incomeText: '#FFFFFF',
      expense: '#E15F41',
      expenseText: '#FFFFFF',
    },
    dark: {
      accent: '#2DD4BF',
      accentText: '#18181B',
      income: '#34D399',
      incomeText: '#18181B',
      expense: '#F87171',
      expenseText: '#18181B',
    },
  },
  {
    name: 'Sunset Gold',
    light: {
      accent: '#C25E00',
      accentText: '#FFFFFF',
      income: '#5A7D36',
      incomeText: '#FFFFFF',
      expense: '#A94442',
      expenseText: '#FFFFFF',
    },
    dark: {
      accent: '#F59E0B',
      accentText: '#18181B',
      income: '#8CAE68',
      incomeText: '#18181B',
      expense: '#DB6A6A',
      expenseText: '#18181B',
    },
  },
  {
    name: 'Minimal Charcoal',
    light: {
      accent: '#18181B',
      accentText: '#FFFFFF',
      income: '#4E5C4A',
      incomeText: '#FFFFFF',
      expense: '#695555',
      expenseText: '#FFFFFF',
    },
    dark: {
      accent: '#F4F4F5',
      accentText: '#18181B',
      income: '#A7B5A2',
      incomeText: '#18181B',
      expense: '#BAA3A3',
      expenseText: '#18181B',
    },
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
  'Food':          { bg: '#FFF3E0', icon: '#FF6B35' },
  'Transport':     { bg: '#E3F2FD', icon: '#2196F3' },
  'Shopping':      { bg: '#FCE4EC', icon: '#E91E63' },
  'Health':        { bg: '#FFEBEE', icon: '#F44336' },
  'Entertainment': { bg: '#F3E5F5', icon: '#9C27B0' },
  'Bills':         { bg: '#ECEFF1', icon: '#607D8B' },
  'Rent':          { bg: '#E8EAF6', icon: '#3F51B5' },
  'Education':     { bg: '#E0F2F1', icon: '#009688' },
  'Salary':        { bg: '#E8F5E9', icon: '#4CAF50' },
  'Business':      { bg: '#E3F2FD', icon: '#1976D2' },
  'Investment':    { bg: '#F9FBE7', icon: '#827717' },
  'Other':         { bg: '#F5F5F5', icon: '#9E9E9E' },
};

export const BORDER_RADIUS = {
  card: 20,
  input: 14,
  chip: 10,
  button: 16,
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

