/**
 * Modern Theme configuration for Expense Tracker
 */

import { Platform } from 'react-native';

const primary = '#5856D6'; // Premium Indigo
const success = '#34C759'; // Apple Green
const danger = '#FF3B30';  // Apple Red
const warning = '#FF9500'; // Apple Orange

export const Colors = {
  light: {
    text: '#1C1C1E',
    background: '#F8F9FE',
    tint: primary,
    icon: '#8E8E93',
    tabIconDefault: '#C7C7CC',
    tabIconSelected: primary,
    income: success,
    expense: danger,
    card: '#FFFFFF',
    border: '#E5E5E7',
    secondaryText: '#8E8E93',
    primary: primary,
    success: success,
    danger: danger,
    warning: warning,
  },
  dark: {
    text: '#FFFFFF',
    background: '#0D0D0E',
    tint: '#5E5CE6',
    icon: '#98989D',
    tabIconDefault: '#48484A',
    tabIconSelected: '#5E5CE6',
    income: '#32D74B',
    expense: '#FF453A',
    card: '#1C1C1E',
    border: '#38383A',
    secondaryText: '#8E8E93',
    primary: '#5E5CE6',
    success: '#32D74B',
    danger: '#FF453A',
    warning: '#FF9F0A',
  },
};

export const Currency = {
  symbol: '₹',
  code: 'INR',
  format: (amount: number) => {
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
