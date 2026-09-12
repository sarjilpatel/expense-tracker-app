// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const designTokens = require('./eslint/rules/design-tokens');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // W2-23: inside the UI, sizes, weights, radii, spacing and colours are tokens, not literals.
    // `constants/` is where the tokens are written down, so it is the one place literals belong.
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
    plugins: { local: { rules: { 'design-tokens': designTokens } } },
    rules: { 'local/design-tokens': 'error' },
  },
]);
