// W1-25 regression: `app/goals.tsx` and `app/splits.tsx` imported `goalService`/`splitService`
// directly, bypassing `dataService` — the one switch CONTEXT.md says every data feature goes
// through. Both screens did guard guest mode, but by hand, at each call site, which is exactly the
// arrangement that holds until someone adds a fourth call and forgets the guard.
//
// Neither feature has, or should have, a local implementation: a split is a debt between members
// of a group and goals are group-scoped server-side, so there is nothing to store for a guest with
// no group. The guest branch is therefore "refuse", not "fake it" — and these tests pin that a
// guest reaches the network for neither.

import test from 'node:test';
import assert from 'node:assert/strict';

import { __reset as resetSecure } from './stubs/secureStore.mjs';
import { __reset as resetAxios, __handle, __calls } from './stubs/axios.mjs';

const dataService = await import('../src/services/dataService.ts');

/** Fresh transport with every goals/splits endpoint wired, so a leaked call shows up as a call. */
function setup(guest) {
  resetSecure({ token: 'tok', refreshToken: 'ref' });
  resetAxios();

  for (const url of ['/goals', '/splits']) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      __handle(method, url, () => []);
    }
  }
  __handle('post', '/goals/g1', () => ({ _id: 'g1' }));
  __handle('put',  '/goals/g1', () => ({ _id: 'g1' }));
  __handle('delete', '/goals/g1', () => ({}));
  __handle('post', '/splits/s1/settle', () => ({ _id: 's1' }));
  __handle('delete', '/splits/s1', () => ({}));

  dataService.setMode(guest);
}

const NEW_GOAL  = { name: 'Car', targetAmount: 1000 };
const NEW_SPLIT = { title: 'Dinner', totalAmount: 60, splits: [] };

/** Every write on both features, as [label, invocation]. */
const writes = [
  ['createGoal',  () => dataService.createGoal(NEW_GOAL)],
  ['updateGoal',  () => dataService.updateGoal('g1', { savedAmount: 10 })],
  ['deleteGoal',  () => dataService.deleteGoal('g1')],
  ['createSplit', () => dataService.createSplit(NEW_SPLIT)],
  ['settleSplit', () => dataService.settleSplit('s1', 'u1')],
  ['unsettleSplit', () => dataService.unsettleSplit('s1', 'u1')],
  ['deleteSplit', () => dataService.deleteSplit('s1')],
];

test('a guest reading goals gets an empty list, not a request', async () => {
  setup(true);
  assert.deepEqual(await dataService.getGoals(), []);
  assert.deepEqual(__calls(), [], 'a guest has no token worth spending on a 401');
});

test('a guest reading splits gets an empty list, not a request', async () => {
  setup(true);
  assert.deepEqual(await dataService.getSplits(), []);
  assert.deepEqual(__calls(), []);
});

test('every guest write rejects instead of silently doing nothing', async () => {
  // Resolving quietly would leave the user staring at a form that accepted their input and threw
  // it away. A rejection is at least visible.
  for (const [label, invoke] of writes) {
    setup(true);
    await assert.rejects(invoke(), (err) => {
      assert.equal(err.name, 'GuestUnsupportedError', `${label} rejected with the wrong error`);
      return true;
    }, `${label} must reject in guest mode`);
  }
});

test('no guest write reaches the network', async () => {
  // The point of routing through dataService at all: the guard is structural, not per-screen.
  for (const [label, invoke] of writes) {
    setup(true);
    await invoke().catch(() => {});
    assert.deepEqual(__calls(), [], `${label} sent a request as a guest`);
  }
});

test('the guest error names the feature so a screen can say something useful', async () => {
  setup(true);
  await assert.rejects(dataService.createGoal(NEW_GOAL), /Savings goals/);
  await assert.rejects(dataService.createSplit(NEW_SPLIT), /Split expenses/);
});

test('a signed-in user reaches the real endpoints', async () => {
  // The other half: the guard must not have quietly disabled the feature for everyone.
  setup(false);
  await dataService.getGoals();
  await dataService.getSplits();

  const urls = __calls().map((c) => c.url);
  assert.deepEqual(urls, ['/goals', '/splits']);
});

test('a signed-in write is passed through with its payload intact', async () => {
  setup(false);
  await dataService.createGoal(NEW_GOAL);

  const [call] = __calls();
  assert.equal(call.method, 'post');
  assert.equal(call.url, '/goals');
  assert.deepEqual(call.data, NEW_GOAL, 'dataService is a switch, not a transform');
});

test('setMode flips both features together', async () => {
  // AuthContext calls setMode on login/logout; a stale mode here is a guest hitting the API or a
  // signed-in user seeing an empty screen.
  setup(true);
  assert.deepEqual(await dataService.getGoals(), []);
  assert.equal(dataService.isGuestMode(), true);

  dataService.setMode(false);
  assert.equal(dataService.isGuestMode(), false);
  await dataService.getSplits();
  assert.ok(__calls().some((c) => c.url === '/splits'), 'logging in must re-enable the feature');
});

test('a signed-in undo goes to the settle route as a delete', async () => {
  // W1-29: undoing a settle is deleting the settlement, not a second kind of settle, so it shares
  // the URL and differs by method. Getting the method wrong would silently re-settle instead.
  setup(false);
  await dataService.unsettleSplit('s1', 'u1');

  const [call] = __calls();
  assert.equal(call.method, 'delete');
  assert.equal(call.url, '/splits/s1/settle/u1');
});
