import test from 'node:test';
import assert from 'node:assert/strict';
import { __reset } from './stubs/asyncStorage.mjs';
import { hasSeenWelcome, markWelcomeSeen, subscribeWelcomeSeen } from '../src/services/onboardingService.ts';

test('welcome completion persists and notifies active listeners', async () => {
  __reset();
  const events = [];
  const unsubscribe = subscribeWelcomeSeen(seen => events.push(seen));

  assert.equal(await hasSeenWelcome(), false);

  await markWelcomeSeen();

  assert.equal(await hasSeenWelcome(), true);
  assert.deepEqual(events, [true]);

  unsubscribe();
  await markWelcomeSeen();
  assert.deepEqual(events, [true]);
});
