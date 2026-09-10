// Entry point for `npm test`: installs the resolve hooks and the handful of globals the app
// expects from the Expo runtime.
import { register } from 'node:module';

globalThis.__DEV__ = true;
process.env.EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://test.local/api';

register('./loader.mjs', import.meta.url);
