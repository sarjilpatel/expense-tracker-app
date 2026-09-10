// W1-20 regression: the axios instance had no `timeout`, so a request the server accepted and then
// never answered — a dropped mobile connection, a stalled worker — hung forever, and the screen
// waiting on it spun with no error and no way back.
//
// Giving the refresh call a timeout exposed a second hang behind it: a failed refresh emptied
// `refreshQueue` without settling the promises in it, so every request that arrived during the
// refresh hung for the life of the process. Both are pinned here, along with the retry-after-refresh
// path the timeout had to not break.

import test from 'node:test';
import assert from 'node:assert/strict';

import { __reset as resetSecure } from './stubs/secureStore.mjs';
import { __reset as resetAxios, __handle, __status, __calls } from './stubs/axios.mjs';

const apiClientModule = await import('../src/services/apiClient.ts');
const apiClient = apiClientModule.default;
const { REQUEST_TIMEOUT_MS, LONG_TIMEOUT_MS } = apiClientModule;

/** A signed-in device talking to a server that answers everything. */
function setup({ token = 'tok_old', refreshToken = 'ref_1' } = {}) {
  resetSecure({ token, refreshToken });
  resetAxios();
  __handle('get', '/ping', () => ({ ok: true }));
}

const callsTo = (url) => __calls().filter((c) => c.url.includes(url));

test('every request carries a timeout', async () => {
  setup();
  await apiClient.get('/ping');

  assert.equal(REQUEST_TIMEOUT_MS, 15000);
  assert.equal(callsTo('/ping')[0].timeout, REQUEST_TIMEOUT_MS,
    'a request with no timeout never settles and the screen behind it never recovers');
});

test('a per-request timeout overrides the default without changing it', async () => {
  setup();
  await apiClient.get('/ping', { timeout: LONG_TIMEOUT_MS });
  await apiClient.get('/ping');

  assert.equal(callsTo('/ping')[0].timeout, LONG_TIMEOUT_MS);
  assert.equal(callsTo('/ping')[1].timeout, REQUEST_TIMEOUT_MS, 'the default must not be mutated');
});

test('the refresh call has its own timeout', async () => {
  // It bypasses the instance to avoid re-entering the interceptor, so it inherits no defaults. A
  // refresh that hangs holds `isRefreshing` true forever and every later request queues behind it.
  setup();
  __handle('get', '/ping', () => { throw __status(401); });
  __handle('post', '/auth/refresh', () => ({ token: 'tok_new' }));

  // The retry 401s as well here — what matters is the refresh attempt it made on the way.
  await apiClient.get('/ping').catch(() => {});

  assert.equal(callsTo('/auth/refresh')[0].timeout, REQUEST_TIMEOUT_MS);
});

test('a 401 refreshes once and retries the original request with the new token', async () => {
  setup();
  let seen = 0;
  __handle('get', '/ping', (cfg) => {
    seen += 1;
    if (seen === 1) throw __status(401);
    return { auth: cfg.headers.Authorization };
  });
  __handle('post', '/auth/refresh', () => ({ token: 'tok_new', refreshToken: 'ref_2' }));

  const res = await apiClient.get('/ping');

  assert.equal(res.data.auth, 'Bearer tok_new', 'the retry must carry the refreshed token');
  assert.equal(callsTo('/auth/refresh').length, 1);
});

test('a rotated refresh token is stored, so the 30-day window keeps sliding', async () => {
  setup();
  let seen = 0;
  __handle('get', '/ping', () => { seen += 1; if (seen === 1) throw __status(401); return { ok: 1 }; });
  __handle('post', '/auth/refresh', () => ({ token: 'tok_new', refreshToken: 'ref_2' }));

  await apiClient.get('/ping');

  // A second 401 must present the rotated token, not the one from login.
  seen = 0;
  await apiClient.get('/ping');
  const sent = callsTo('/auth/refresh').at(-1).data.refreshToken;
  assert.equal(sent, 'ref_2');
});

test('concurrent 401s share one refresh instead of stampeding it', async () => {
  setup();
  let release;
  const held = new Promise((r) => { release = r; });

  let pings = 0;
  __handle('get', '/ping', () => { pings += 1; if (pings <= 2) throw __status(401); return { ok: 1 }; });
  __handle('post', '/auth/refresh', async () => { await held; return { token: 'tok_new' }; });

  const both = Promise.all([apiClient.get('/ping'), apiClient.get('/ping')]);
  release();
  await both;

  assert.equal(callsTo('/auth/refresh').length, 1,
    'the second request must wait on the in-flight refresh, not start another');
});

test('a failed refresh rejects the queued requests instead of abandoning them', async () => {
  // The bug behind the bug. `refreshQueue = []` dropped the waiters without settling them, so every
  // request that arrived during a failing refresh hung for the life of the process — a spinner that
  // survives even pulling to refresh.
  setup();
  let release;
  const held = new Promise((r) => { release = r; });

  __handle('get', '/ping', () => { throw __status(401); });
  __handle('post', '/auth/refresh', async () => { await held; throw __status(401, { msg: 'expired' }); });

  const first  = apiClient.get('/ping');
  const queued = apiClient.get('/ping');
  const settled = [first, queued].map((p) => p.then(() => 'ok', () => 'rejected'));
  release();

  const outcome = await Promise.race([
    Promise.all(settled),
    new Promise((r) => setTimeout(() => r('HUNG'), 1000)),
  ]);
  assert.deepEqual(outcome, ['rejected', 'rejected'], 'a queued request must not hang forever');
});

test('a queued request is rejected with the original 401, not the refresh failure', async () => {
  setup();
  let release;
  const held = new Promise((r) => { release = r; });

  __handle('get', '/ping', () => { throw __status(401, { msg: 'token expired' }); });
  __handle('post', '/auth/refresh', async () => { await held; throw __status(403, { msg: 'revoked' }); });

  const first  = apiClient.get('/ping').catch((e) => e);
  const queued = apiClient.get('/ping').catch((e) => e);
  release();

  const err = await queued;
  await first;
  assert.equal(err.response.status, 401, 'the caller made a request; that request is what failed');
  assert.deepEqual(err.response.data, { msg: 'token expired' });
});

test('a failed refresh forces a logout exactly once', async () => {
  setup();
  let logouts = 0;
  apiClient.injectLogout(() => { logouts += 1; });

  __handle('get', '/ping', () => { throw __status(401); });
  __handle('post', '/auth/refresh', () => { throw __status(401); });

  await apiClient.get('/ping').catch(() => {});
  assert.equal(logouts, 1);

  apiClient.injectLogout(undefined);
});

test('a 401 from the refresh endpoint itself is not refreshed again', async () => {
  // Otherwise a dead session recurses: refresh 401s, which triggers a refresh, which 401s.
  setup();
  __handle('post', '/auth/refresh', () => { throw __status(401); });

  await apiClient.post('/auth/refresh', { refreshToken: 'ref_1' }).catch(() => {});
  assert.equal(callsTo('/auth/refresh').length, 1);
});

test('a missing refresh token fails immediately rather than calling the server', async () => {
  setup({ refreshToken: undefined });
  resetSecure({ token: 'tok_old' });
  __handle('get', '/ping', () => { throw __status(401); });

  await apiClient.get('/ping').catch(() => {});
  assert.equal(callsTo('/auth/refresh').length, 0);
});

test('the calls that outlast a round trip get the long timeout', async () => {
  // Insights waits on an LLM, a profile photo is a real upload, and a sync chunk is 250 rows. All
  // three would fail at 15s on a slow connection, so they opt out of the default explicitly.
  setup();
  assert.equal(LONG_TIMEOUT_MS, 60000);

  const { getInsights }   = await import('../src/services/transactionApi.ts');
  const { updateProfile } = await import('../src/services/authApi.ts');
  const { importAccounts } = await import('../src/services/accountApi.ts');

  __handle('get',  '/transactions/insights', () => ({ insights: [] }));
  __handle('put',  '/auth/update-profile',   () => ({ ok: true }));
  __handle('post', '/accounts/import',       () => ({ imported: 0, received: 0, idMap: {} }));

  await getInsights(9, 2026);
  await updateProfile(new Map());
  await importAccounts([]);

  assert.equal(callsTo('/transactions/insights')[0].timeout, LONG_TIMEOUT_MS);
  assert.equal(callsTo('/auth/update-profile')[0].timeout, LONG_TIMEOUT_MS);
  assert.equal(callsTo('/accounts/import')[0].timeout, LONG_TIMEOUT_MS);
});
