// The slice of react-native the services touch outside a device: AppState for the scheduler.
const listeners = new Set();
export const AppState = {
  currentState: 'active',
  addEventListener(_type, fn) { listeners.add(fn); return { remove: () => listeners.delete(fn) }; },
  /** Test control: fire a state change. */
  __emit(state) { listeners.forEach((fn) => fn(state)); },
};
export default { AppState };
