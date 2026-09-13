let state = { type: 'wifi', isConnected: true };
export default {
  fetch: async () => state,
  addEventListener: () => () => {},
  /** Test control. */
  __set(next) { state = { ...state, ...next }; },
};
