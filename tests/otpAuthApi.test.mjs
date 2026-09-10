// W1-32, app side. Signup and password reset both changed shape: signup no longer returns a
// session (there is no account yet — the mailed code creates it), and reset takes the code and
// the new password together instead of a token lifted out of a deep link.
//
// What is pinned here is the contract each screen depends on:
//   * signupUser returns without a token, so a screen that treated a 200 as "logged in" would be
//     caught here rather than by a blank tab bar.
//   * verifySignup is the call that returns the session.
//   * every failure arrives as a plain string message, which is what the screens render — an
//     error object leaking through would show "[object Object]" over the code field.
//   * the 6-digit code goes up as a string, so a code with a leading zero survives.

import test from 'node:test';
import assert from 'node:assert/strict';

import { __reset as resetSecure } from './stubs/secureStore.mjs';
import { __reset as resetAxios, __handle, __calls, __status } from './stubs/axios.mjs';

const { signupUser, verifySignup, resendOtp, forgotPassword, resetPassword } =
  await import('../src/services/authApi.ts');

function setup() {
  resetSecure({ token: 'tok', refreshToken: 'ref' });
  resetAxios();
  __handle('post', '/auth/signup', () => ({
    message: 'If that address can be registered, a code is on its way.',
    email: 'a@b.c',
    expiresInMinutes: 10,
  }));
  __handle('post', '/auth/verify-signup', () => ({
    token: 't', refreshToken: 'r', user: { _id: 'u1', email: 'a@b.c' },
  }));
  __handle('post', '/auth/resend-otp', () => ({ message: 'sent' }));
  __handle('post', '/auth/forgot-password', () => ({ message: 'If that email exists, a code is on its way.' }));
  __handle('post', '/auth/reset-password', () => ({ message: 'Password reset successfully.' }));
}

const callTo = (url) => __calls().find((c) => c.url === url);

test('signup returns no session — the code is what creates the account', async () => {
  setup();
  const data = await signupUser({ name: 'Ada', email: 'a@b.c', password: 'correct horse', timezone: 'Asia/Kolkata' });

  assert.equal(data.token, undefined);
  assert.equal(data.expiresInMinutes, 10);
  assert.deepEqual(callTo('/auth/signup').data, {
    name: 'Ada', email: 'a@b.c', password: 'correct horse', timezone: 'Asia/Kolkata',
  });
});

test('verifying the code is what returns the session', async () => {
  setup();
  const data = await verifySignup('a@b.c', '654321');

  assert.equal(data.token, 't');
  assert.equal(data.user._id, 'u1');
  assert.deepEqual(callTo('/auth/verify-signup').data, { email: 'a@b.c', code: '654321' });
});

test('a code keeps its leading zero on the wire', async () => {
  // Sent as a number it would arrive as 12345 and never match. The server validates /^\d{6}$/ on
  // a string, so this is the difference between "wrong code" and a code that cannot work at all.
  setup();
  await verifySignup('a@b.c', '012345');

  assert.equal(callTo('/auth/verify-signup').data.code, '012345');
  assert.equal(typeof callTo('/auth/verify-signup').data.code, 'string');
});

test('a rejected code surfaces the server message, not an error object', async () => {
  setup();
  __handle('post', '/auth/verify-signup', () => { throw __status(400, { message: 'That code is not right.', attemptsLeft: 3 }); });

  await assert.rejects(
    () => verifySignup('a@b.c', '000000'),
    (e) => { assert.equal(e, 'That code is not right.'); return true; },
  );
});

test('a failure with no message still rejects with something printable', async () => {
  setup();
  __handle('post', '/auth/verify-signup', () => { throw __status(500, {}); });

  await assert.rejects(
    () => verifySignup('a@b.c', '000000'),
    (e) => { assert.equal(typeof e, 'string'); assert.match(e, /verification failed/i); return true; },
  );
});

test('resend names the purpose it wants a code for', async () => {
  // One endpoint serves both flows. Without the purpose, a reset resend would re-issue a signup
  // code — verifying against the wrong pending record and creating nothing.
  setup();
  await resendOtp('a@b.c', 'reset');

  assert.deepEqual(callTo('/auth/resend-otp').data, { email: 'a@b.c', purpose: 'reset' });
});

test('a cooldown refusal reaches the screen as its message', async () => {
  setup();
  __handle('post', '/auth/resend-otp', () => { throw __status(429, { message: 'Please wait before requesting another code.', retryAfter: 41 }); });

  await assert.rejects(
    () => resendOtp('a@b.c', 'signup'),
    (e) => { assert.match(e, /wait before requesting/); return true; },
  );
});

test('forgot-password asks for a code and reports nothing about the address', async () => {
  setup();
  const data = await forgotPassword('a@b.c');

  assert.deepEqual(callTo('/auth/forgot-password').data, { email: 'a@b.c' });
  assert.ok(!('exists' in data), 'the reply must not say whether the address is registered');
});

test('reset sends the address, the code and the password in one call', async () => {
  // There is no reset session in between: the old flow exchanged a token from a deep link, this
  // one proves the address and sets the password in the same request.
  setup();
  await resetPassword('a@b.c', '654321', 'a new one');

  assert.equal(callTo('/auth/reset-password/654321'), undefined, 'the code is a field, not a path segment');
  assert.deepEqual(callTo('/auth/reset-password').data, {
    email: 'a@b.c', code: '654321', password: 'a new one',
  });
});

test('an expired reset code surfaces the message the user needs', async () => {
  setup();
  __handle('post', '/auth/reset-password', () => { throw __status(400, { message: 'That code has expired. Request a new one.' }); });

  await assert.rejects(
    () => resetPassword('a@b.c', '654321', 'a new one'),
    (e) => { assert.match(e, /expired/); return true; },
  );
});
