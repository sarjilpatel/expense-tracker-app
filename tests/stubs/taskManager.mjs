// expo-task-manager / expo-background-task outside a device: remember what was registered.
const defined = new Map();
const registered = new Map();
export function defineTask(name, fn) { defined.set(name, fn); }
export function isTaskDefined(name) { return defined.has(name); }
export async function isTaskRegisteredAsync(name) { return registered.has(name); }
export async function registerTaskAsync(name, options) { registered.set(name, options); }
export async function unregisterTaskAsync(name) { registered.delete(name); }
export const BackgroundTaskResult = { Success: 1, Failed: 2 };
export const BackgroundTaskStatus = { Restricted: 1, Available: 2 };
export const __registered = registered;
export const __defined = defined;
