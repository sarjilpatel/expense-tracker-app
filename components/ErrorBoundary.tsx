import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Touchable } from '@/components/ui';
// A class component outside ThemeProvider — the boundary renders when the tree below it has
// crashed, so it takes the static light palette rather than a hook.
import { StaticThemes } from '@/constants/theme';
import { router } from 'expo-router';
import { type, radius } from '@/constants/tokens';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  handleRestart = () => {
    this.setState({ hasError: false, errorMessage: '' });
    router.replace('/');
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }
      return (
        <View style={styles.container}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.errorMessage}</Text>
          <Touchable style={styles.button} onPress={this.handleRestart} accessibilityLabel="Restart app">
            <Text style={styles.buttonText}>Restart App</Text>
          </Touchable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: StaticThemes.light.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  icon: {
    ...type.display,
    marginBottom: 24,
  },
  title: {
    ...type.title,
    color: StaticThemes.light.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    ...type.label,
    color: StaticThemes.light.secondaryText,
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    backgroundColor: StaticThemes.light.tint,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: radius.lg,
  },
  buttonText: {
    color: StaticThemes.light.tintText,
    ...type.bodyStrong,
  },
});
