// ESM resolve hooks that let plain Node run the app's TypeScript services.
//
// Node 22 strips types from .ts on its own, so no build step and no jest/babel toolchain is
// needed — the only things missing are Metro's extensionless imports, the `@/` alias from
// tsconfig, and the three native packages that cannot exist outside a device. That is all this
// file supplies. Everything under src/ is the real shipped code.

import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

/** Packages that only exist inside a React Native runtime. */
const NATIVE_STUBS = {
  '@react-native-async-storage/async-storage': 'stubs/asyncStorage.mjs',
  'expo-secure-store': 'stubs/secureStore.mjs',
  axios: 'stubs/axios.mjs',
  // The sync scheduler (W3) reaches these; none can load outside a device.
  'react-native': 'stubs/reactNative.mjs',
  '@react-native-community/netinfo': 'stubs/netinfo.mjs',
  'expo-task-manager': 'stubs/taskManager.mjs',
  'expo-background-task': 'stubs/taskManager.mjs',
  'expo-file-system/legacy': 'stubs/fileSystem.mjs',
};

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

/** Metro resolves `./foo` to foo.ts / foo/index.ts; Node does not. */
function withExtension(filePath) {
  if (existsSync(filePath) && path.extname(filePath)) return filePath;
  for (const ext of EXTENSIONS) {
    if (existsSync(filePath + ext)) return filePath + ext;
  }
  for (const ext of EXTENSIONS) {
    const indexed = path.join(filePath, 'index' + ext);
    if (existsSync(indexed)) return indexed;
  }
  return null;
}

export function resolve(specifier, context, nextResolve) {
  if (Object.hasOwn(NATIVE_STUBS, specifier)) {
    return { url: pathToFileURL(path.join(HERE, NATIVE_STUBS[specifier])).href, shortCircuit: true };
  }

  // `@/` is the tsconfig alias for the project root.
  if (specifier.startsWith('@/')) {
    const resolved = withExtension(path.join(ROOT, specifier.slice(2)));
    if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true };
  }

  if (specifier.startsWith('.') && context.parentURL) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const resolved = withExtension(path.resolve(parentDir, specifier));
    if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}
