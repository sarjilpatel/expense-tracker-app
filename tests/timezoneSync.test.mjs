// W1-30, app side. `User.timezone` is what the server's hourly cron uses to decide when a user's
// recurring transactions fire (W1-16). The app posted it once, from `app/signup.tsx`, and never
// again — so a user who moved kept firing on their old day, and no screen in the app could fix it.
//
// `syncDeviceTimezone` is the missing write. What matters about it is as much what it does *not*
// do: it runs on every app start, so an unchanged zone must not become a request, and a failure
// must not become an error the user sees on launch.

import test from 'node:test';
import assert from 'node:assert/strict';

import { __reset as resetSecure } from './stubs/secureStore.mjs';
import { __reset as resetAxios, __handle, __calls, __status } from './stubs/axios.mjs';

const { syncDeviceTimezone, deviceTimezone, updateTimezone } =
  await import('../src/services/authApi.ts');

/** Fresh transport with the endpoint wired; returns the calls it recorded. */
function setup({ fail = null } = {}) {
  resetSecure({ token: 'tok', refreshToken: 'ref' });
  resetAxios();
  __handle('patch', '/auth/timezone', (cfg) => {
    if (fail) throw __status(fail, { message: 'Unknown time zone' });
    return { timezone: cfg.data.timezone, updated: true };
  });
}

const patches = () => __calls().filter((c) => c.url === '/auth/timezone');

/** Runs `fn` with the device pretending to be in `zone`. */
async function inZone(zone, fn) {
  const real = Intl.DateTimeFormat;
  Intl.DateTimeFormat = function (...args) {
    const fmt = new real(...args);
    if (args.length === 0) fmt.resolvedOptions = () => ({ timeZone: zone });
    return fmt;
  };
  try {
    return await fn();
  } finally {
    Intl.DateTimeFormat = real;
  }
}

test('a device that has moved sends its new zone', async () => {
  setup();
  const stored = await inZone('Europe/Berlin', () => syncDeviceTimezone('Asia/Kolkata'));

  assert.equal(stored, 'Europe/Berlin', 'the caller needs the zone back to update its own copy');
  assert.equal(patches().length, 1);
  assert.deepEqual(patches()[0].data, { timezone: 'Europe/Berlin' });
});

test('a device that has not moved sends nothing at all', async () => {
  // This is the common case — every start of every session. A request per launch to write a value
  // that already matches is the thing worth avoiding, not the write itself.
  setup();
  const stored = await inZone('Asia/Kolkata', () => syncDeviceTimezone('Asia/Kolkata'));

  assert.equal(stored, null);
  assert.equal(patches().length, 0);
});

test('an account with no stored zone gets one', async () => {
  // Accounts created before signup sent a zone, and Google sign-ups, have nothing on file.
  setup();
  for (const missing of [undefined, null, '']) {
    resetAxios();
    __handle('patch', '/auth/timezone', (cfg) => ({ timezone: cfg.data.timezone, updated: true }));
    const stored = await inZone('Asia/Kolkata', () => syncDeviceTimezone(missing));
    assert.equal(stored, 'Asia/Kolkata', `a stored ${JSON.stringify(missing)} must count as different`);
  }
});

test('a rejected zone is swallowed, not thrown at the launch screen', async () => {
  // The server refuses a zone it does not recognise. That is a disagreement between two runtimes'
  // Intl data, not something the user did or can act on, so it must not surface as an error.
  setup({ fail: 400 });
  const stored = await inZone('Mars/Base', () => syncDeviceTimezone('Asia/Kolkata'));

  assert.equal(stored, null, 'nothing was stored, so the local copy must not be updated either');
  assert.equal(patches().length, 1);
});

test('being offline is silent too, and leaves the zone to be retried next start', async () => {
  resetSecure({ token: 'tok', refreshToken: 'ref' });
  resetAxios();
  __handle('patch', '/auth/timezone', () => { throw new Error('Network Error'); });

  const stored = await inZone('Europe/Berlin', () => syncDeviceTimezone('Asia/Kolkata'));
  assert.equal(stored, null);
});

test('a runtime with no zone to report is not a request', async () => {
  setup();
  const stored = await inZone(undefined, () => syncDeviceTimezone('Asia/Kolkata'));

  assert.equal(stored, null, 'an unknown device zone must never overwrite a known stored one');
  assert.equal(patches().length, 0);
});

test('deviceTimezone reports what Intl resolves', async () => {
  assert.equal(await inZone('America/New_York', async () => deviceTimezone()), 'America/New_York');
  assert.ok(deviceTimezone(), 'the real runtime should name a zone');
});

test('updateTimezone itself surfaces the server message', async () => {
  // The bare call is used directly nowhere yet, but it is the one that would back a settings
  // control; a failure there does need to reach the caller.
  setup({ fail: 400 });
  await assert.rejects(() => updateTimezone('Mars/Base'), (e) => e === 'Unknown time zone');
});
