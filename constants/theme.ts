/**
 * Premium Refined Theme configuration for Expense Tracker
 * Focuses on eye-comfort, sophisticated palettes, and modern aesthetics.
 */

import { Platform } from 'react-native';

const primaryLight = '#6366F1'; // Soft Indigo
const primaryDark = '#818CF8';  // Muted Indigo

const successLight = '#10B981'; // Sage/Emerald
const successDark = '#34D399';  // Mint/Emerald

const dangerLight = '#F43F5E';  // Rose/Rose
const dangerDark = '#FB7185';   // Soft Rose

const warningLight = '#F59E0B'; // Amber
const warningDark = '#FBBF24';  // Muted Amber

export const Colors = {
  light: {
    text: '#111827',           // Deep Gray (Neutral 900)
    secondaryText: '#64748B',  // Slate 500
    background: '#F8FAFC',     // Slate 50
    card: '#FFFFFF',           // Pure White
    border: '#E2E8F0',         // Slate 200
    tint: primaryLight,
    icon: '#94A3B8',           // Slate 400
    tabIconDefault: '#CBD5E1', // Slate 300
    tabIconSelected: primaryLight,
    income: successLight,
    expense: dangerLight,
    primary: primaryLight,
    success: successLight,
    danger: dangerLight,
    warning: warningLight,
    chart: ['#6366F1', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F43F5E'],
  },
  dark: {
    text: '#F1F5F9',           // Slate 100
    secondaryText: '#94A3B8',  // Slate 400
    background: '#0F172A',     // Slate 900 (Deep oceanic blue-grey)
    card: '#1E293B',           // Slate 800
    border: '#334155',         // Slate 700
    tint: primaryDark,
    icon: '#64748B',           // Slate 500
    tabIconDefault: '#475569', // Slate 600
    tabIconSelected: primaryDark,
    income: successDark,
    expense: dangerDark,
    primary: primaryDark,
    success: successDark,
    danger: dangerDark,
    warning: warningDark,
    chart: ['#818CF8', '#34D399', '#FBBF24', '#A78BFA', '#F472B6', '#22D3EE', '#FB7185'],
  },
};

export const Currency = {
  symbol: '₹',
  code: 'INR',
  format: (amount: number) => {
    return `₹${(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
};

export const CATEGORIES = [
  { id: '1', name: 'Food', icon: 'fast-food' },
  { id: '2', name: 'Transport', icon: 'car' },
  { id: '3', name: 'Shopping', icon: 'cart' },
  { id: '4', name: 'Rent', icon: 'home' },
  { id: '5', name: 'Entertainment', icon: 'game-controller' },
  { id: '6', name: 'Other', icon: 'ellipsis-horizontal' },
];
