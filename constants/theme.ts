import { Platform } from 'react-native';

const primaryLight  = '#18181B';
const primaryDark   = '#E4E4E7';
const successLight  = '#22C55E';
const successDark   = '#4ADE80';
const dangerLight   = '#EF4444';
const dangerDark    = '#F87171';
const warningLight  = '#F59E0B';
const warningDark   = '#FCD34D';

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
    // Light: deep charcoal accent is bold and readable
    // Dark: near-white so active tab is clearly highlighted against dark bg
    light: { accent: '#18181B', accentText: '#FFFFFF', income: '#22C55E', incomeText: '#FFFFFF', expense: '#EF4444', expenseText: '#FFFFFF' },
    dark:  { accent: '#E4E4E7', accentText: '#18181B', income: '#4ADE80', incomeText: '#052E16', expense: '#F87171', expenseText: '#FFFFFF' },
  },
  {
    name: 'Ocean',
    light: { accent: '#2563EB', accentText: '#FFFFFF', income: '#10B981', incomeText: '#FFFFFF', expense: '#F43F5E', expenseText: '#FFFFFF' },
    dark:  { accent: '#3B82F6', accentText: '#FFFFFF', income: '#34D399', incomeText: '#064E3B', expense: '#FB7185', expenseText: '#FFFFFF' },
  },
  {
    name: 'Forest',
    light: { accent: '#16A34A', accentText: '#FFFFFF', income: '#059669', incomeText: '#FFFFFF', expense: '#DC2626', expenseText: '#FFFFFF' },
    dark:  { accent: '#22C55E', accentText: '#052E16', income: '#4ADE80', incomeText: '#052E16', expense: '#F87171', expenseText: '#FFFFFF' },
  },
  {
    name: 'Dusk',
    light: { accent: '#7C3AED', accentText: '#FFFFFF', income: '#0EA5E9', incomeText: '#FFFFFF', expense: '#EC4899', expenseText: '#FFFFFF' },
    dark:  { accent: '#A78BFA', accentText: '#1E1B4B', income: '#38BDF8', incomeText: '#082F49', expense: '#F472B6', expenseText: '#FFFFFF' },
  },
  {
    name: 'Ember',
    light: { accent: '#EA580C', accentText: '#FFFFFF', income: '#16A34A', incomeText: '#FFFFFF', expense: '#DC2626', expenseText: '#FFFFFF' },
    dark:  { accent: '#FB923C', accentText: '#431407', income: '#4ADE80', incomeText: '#052E16', expense: '#F87171', expenseText: '#FFFFFF' },
  },
  {
    name: 'Pearl',
    light: { accent: '#475569', accentText: '#FFFFFF', income: '#0EA5E9', incomeText: '#FFFFFF', expense: '#F43F5E', expenseText: '#FFFFFF' },
    dark:  { accent: '#CBD5E1', accentText: '#0F172A', income: '#38BDF8', incomeText: '#082F49', expense: '#FB7185', expenseText: '#FFFFFF' },
  },
  {
    name: 'Azure',
    light: { accent: '#0284C7', accentText: '#FFFFFF', income: '#10B981', incomeText: '#FFFFFF', expense: '#F43F5E', expenseText: '#FFFFFF' },
    dark:  { accent: '#38BDF8', accentText: '#082F49', income: '#34D399', incomeText: '#064E3B', expense: '#FB7185', expenseText: '#FFFFFF' },
  },
  {
    name: 'Coral',
    light: { accent: '#E11D48', accentText: '#FFFFFF', income: '#0EA5E9', incomeText: '#FFFFFF', expense: '#E11D48', expenseText: '#FFFFFF' },
    dark:  { accent: '#FB7185', accentText: '#4C0519', income: '#38BDF8', incomeText: '#082F49', expense: '#FB7185', expenseText: '#FFFFFF' },
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

