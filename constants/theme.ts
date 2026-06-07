import { Platform } from 'react-native';

const primaryLight  = '#6366F1';
const primaryDark   = '#818CF8';
const successLight  = '#10B981';
const successDark   = '#34D399';
const dangerLight   = '#F43F5E';
const dangerDark    = '#FB7185';
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

export const Colors: { light: ThemeColors; dark: ThemeColors } = {
  light: {
    text:            '#0F172A',
    secondaryText:   '#64748B',
    background:      '#F8FAFC',
    card:            '#FFFFFF',
    cardAlt:         '#F1F5F9',
    border:          '#E2E8F0',
    separator:       '#F1F5F9',
    surface:         '#EEF2FF',
    inputBg:         '#F8FAFC',
    tint:            primaryLight,
    icon:            '#94A3B8',
    tabIconDefault:  '#CBD5E1',
    tabIconSelected: primaryLight,
    income:          successLight,
    expense:         dangerLight,
    primary:         primaryLight,
    success:         successLight,
    danger:          dangerLight,
    warning:         warningLight,
    chart: ['#6366F1','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#F43F5E'],
  },
  dark: {
    text:            '#F1F5F9',
    secondaryText:   '#94A3B8',
    background:      '#09090B',
    card:            '#18181B',
    cardAlt:         '#27272A',
    border:          '#27272A',
    separator:       '#18181B',
    surface:         '#1E1B4B',
    inputBg:         '#09090B',
    tint:            primaryDark,
    icon:            '#64748B',
    tabIconDefault:  '#475569',
    tabIconSelected: primaryDark,
    income:          successDark,
    expense:         dangerDark,
    primary:         primaryDark,
    success:         successDark,
    danger:          dangerDark,
    warning:         warningDark,
    chart: ['#818CF8','#34D399','#FBBF24','#A78BFA','#F472B6','#22D3EE','#FB7185'],
  },
};

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
  screenTitle:  { fontSize: 22, fontWeight: '800' as const },
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
