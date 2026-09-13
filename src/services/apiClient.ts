import axios, { InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_BASE_URL) {
  console.error('[apiClient] EXPO_PUBLIC_API_URL is not set — all API calls will fail.');
} else if (!API_BASE_URL.startsWith('https://') && !__DEV__) {
  console.error('[apiClient] EXPO_PUBLIC_API_URL must use HTTPS in production. Current value:', API_BASE_URL);
}

interface ApiClientInstance extends ReturnType<typeof axios.create> {
  logout?: () => Promise<void> | void;
  injectLogout: (logoutFn: () => Promise<void> | void) => void;
}

let isRefreshing = false;
let isLoggingOut = false;
let refreshQueue: { resolve: (token: string) => void; reject: (error: unknown) => void }[] = [];

function drainQueue(newToken: string) {
  refreshQueue.forEach(({ resolve }) => resolve(newToken));
  refreshQueue = [];
}

/**
 * A failed refresh has to settle the waiters as well, not just forget them. Dropping the queue
 * leaves every request that arrived during the refresh holding a promise that can never settle —
 * which, now that the refresh itself can time out, is a reachable way to hang the whole app.
 */
function failQueue(error: unknown) {
  refreshQueue.forEach(({ reject }) => reject(error));
  refreshQueue = [];
}

/**
 * Without a timeout a request that never gets a reply — a dropped mobile connection, a server that
 * accepted the socket and then stalled — hangs forever, and the screen waiting on it spins forever
 * with no way back. 15s is well past a normal round trip on a bad connection but short enough that
 * the user gets an error instead of a dead screen.
 */
export const REQUEST_TIMEOUT_MS = 15000;

/**
 * For the few calls that legitimately take longer than a round trip: the AI insights endpoint waits
 * on an LLM, a profile photo is a real upload, and a sync chunk is up to 250 rows. Pass it as a
 * per-request override rather than raising the default for everything.
 */
export const LONG_TIMEOUT_MS = 60000;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
}) as ApiClientInstance;

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {}
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Seconds to wait before the one retry of a 429, from the server's `Retry-After` when it sends
 * one (express-rate-limit does, in seconds), capped so a long window cannot hold a screen hostage.
 */
const RETRY_AFTER_MAX_MS = 5000;
const retryAfterMs = (error: any): number => {
  const header = error.response?.headers?.['retry-after'];
  const secs = header !== undefined ? parseFloat(String(header)) : NaN;
  return Math.min(RETRY_AFTER_MAX_MS, Number.isFinite(secs) && secs > 0 ? secs * 1000 : 1000);
};
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // Too many requests: honour Retry-After and try once more (W3-02). The limiter is per user
    // now, so a 429 means this device really did burst — one short wait clears it; a second
    // 429 is reported to the caller like any other failure.
    if (error.response?.status === 429 && original && !original._retried429) {
      original._retried429 = true;
      await sleep(retryAfterMs(error));
      return apiClient(original);
    }

    // Only attempt refresh on 401, once per request, and not on the auth endpoints that are
    // themselves part of ending a session — refreshing to retry a logout is pointless, and it is
    // reached from inside the forced-logout path below.
    if (
      error.response?.status === 401 &&
      !original._retried &&
      !original.url?.includes('/auth/refresh') &&
      !original.url?.includes('/auth/logout')
    ) {
      if (isRefreshing) {
        // Queue this request until the in-flight refresh completes
        return new Promise((resolve, reject) => {
          refreshQueue.push({
            resolve: (token: string) => {
              original.headers.Authorization = `Bearer ${token}`;
              resolve(apiClient(original));
            },
            reject,
          });
        });
      }

      original._retried = true;
      isRefreshing = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) throw new Error('no_refresh_token');

        // Deliberately the bare axios, not apiClient — going through the instance would re-enter
        // this interceptor. It therefore gets none of the instance defaults, so the timeout has to
        // be set here: a refresh that hangs holds `isRefreshing` true forever and every request
        // behind it queues for good.
        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          { refreshToken },
          { timeout: REQUEST_TIMEOUT_MS }
        );
        const newToken: string = data.token;

        await SecureStore.setItemAsync('token', newToken);
        // The server now rotates the refresh token on every refresh. Storing the new one is what
        // keeps the 30-day window sliding; without it an active session would still expire 30 days
        // after login. Older servers don't send one — keep the existing token in that case.
        if (data.refreshToken) await SecureStore.setItemAsync('refreshToken', data.refreshToken);
        drainQueue(newToken);

        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      } catch {
        // Reject with the original 401 rather than the refresh failure: to the caller this is the
        // request it made failing on an expired session, which is what actually happened.
        failQueue(error);
        // Refresh failed — session truly expired, force logout
        if (apiClient.logout && !isLoggingOut) {
          isLoggingOut = true;
          try { await apiClient.logout(); } finally { isLoggingOut = false; }
        }
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

apiClient.injectLogout = (logoutFn) => {
  apiClient.logout = logoutFn;
};

/**
 * Identical GETs in flight share one request (W3-02). Two screens mounting together — the tab
 * bar's first paint, a focus refetch racing a pull-to-refresh — used to send the same query twice
 * and pay for it twice against the rate limit; the second caller now gets the first's promise.
 * Keyed on URL + params; cleared as soon as the request settles, so nothing is ever served stale.
 */
const inflight = new Map<string, Promise<any>>();
const rawGet = apiClient.get.bind(apiClient);
apiClient.get = ((url: string, config?: any) => {
  const key = `${url}|${JSON.stringify(config?.params ?? null)}`;
  const pending = inflight.get(key);
  if (pending) return pending;
  const request = rawGet(url, config).finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}) as typeof apiClient.get;

export default apiClient;
