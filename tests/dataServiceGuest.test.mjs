// W1-25 regression: `app/goals.tsx` and `app/splits.tsx` imported `goalService`/`splitService`
// directly, bypassing `dataService` — the one switch CONTEXT.md says every data feature goes
// through. Both screens did guard guest mode, but by hand, at each call site, which is exactly the
// arrangement that holds until someone adds a fourth call and forgets the guard.
//
// The two features answer that guard differently, and both answers are pinned here.
//
// Goals are group-scoped server-side, so there is nothing coherent to store for a guest with no
// group: the guest branch refuses rather than faking one, and a guest must not reach the network.
//
// Trips are the opposite, and were the point of W2-28. A shared bill needs people, not a group, so
// a guest keeps whole trips on the device and `syncService` hands them to the server on first
// login. The guard here is therefore "use the local service", and what must be pinned is that a
// guest reaches the local store and never the network, while a signed-in user reaches `/trips`.

import test from 'node:test';
import assert from 'node:assert/strict';

import { __reset as resetSecure } from './stubs/secureStore.mjs';
import { __reset as resetStorage } from './stubs/asyncStorage.mjs';
import { __reset as resetAxios, __handle, __calls } from './stubs/axios.mjs';

const dataService = await import('../src/services/dataService.ts');

/** Fresh transport with every goals/trips endpoint wired, so a leaked call shows up as a call. */
function setup(guest) {
  resetSecure({ token: 'tok', refreshToken: 'ref' });
  resetStorage({});
  resetAxios();

  for (const url of ['/goals', '/trips']) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      __handle(method, url, () => []);
    }
  }
  __handle('post', '/goals/g1', () => ({ _id: 'g1' }));
  __handle('put',  '/goals/g1', () => ({ _id: 'g1' }));
  __handle('delete', '/goals/g1', () => ({}));
  __handle('post', '/trips', () => ({ _id: 't1', name: 'Goa', members: [], expenses: [] }));

  dataService.setMode(guest);
}

const NEW_GOAL = { name: 'Car', targetAmount: 1000 };

/** Every goal write, as [label, invocation]. */
const goalWrites = [
  ['createGoal', () => dataService.createGoal(NEW_GOAL)],
  ['updateGoal', () => dataService.updateGoal('g1', { savedAmount: 10 })],
  ['deleteGoal', () => dataService.deleteGoal('g1')],
];

test('a guest reading goals gets an empty list, not a request', async () => {
  setup(true);
  assert.deepEqual(await dataService.getGoals(), []);
  assert.deepEqual(__calls(), [], 'a guest has no token worth spending on a 401');
});

test('every guest goal write rejects instead of silently doing nothing', async () => {
  // Resolving quietly would leave the user staring at a form that accepted their input and threw
  // it away. A rejection is at least visible.
  for (const [label, invoke] of goalWrites) {
    setup(true);
    await assert.rejects(invoke(), (err) => {
      assert.equal(err.name, 'GuestUnsupportedError', `${label} rejected with the wrong error`);
      return true;
    }, `${label} must reject in guest mode`);
  }
});

test('no guest goal write reaches the network', async () => {
  // The point of routing through dataService at all: the guard is structural, not per-screen.
  for (const [label, invoke] of goalWrites) {
    setup(true);
    await invoke().catch(() => {});
    assert.deepEqual(__calls(), [], `${label} sent a request as a guest`);
  }
});

test('the guest error names the feature so a screen can say something useful', async () => {
  setup(true);
  await assert.rejects(dataService.createGoal(NEW_GOAL), /Savings goals/);
});

test('a signed-in user reaches the real endpoints', async () => {
  // The other half: the guard must not have quietly disabled the feature for everyone.
  setup(false);
  await dataService.getGoals();
  await dataService.getTrips();

  const urls = __calls().map((c) => c.url);
  assert.deepEqual(urls, ['/goals', '/trips']);
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
  await dataService.getTrips();
  assert.ok(__calls().some((c) => c.url === '/trips'), 'logging in must re-enable the feature');
});

// ── Trips (W2-28) ─────────────────────────────────────────────────────

test('a guest trip is created on the device, not refused and not sent', async () => {
  // This is the behaviour change W2-28 bought. The old splits feature rejected this call.
  setup(true);
  const trip = await dataService.createTrip({ name: 'Goa', currency: 'INR' });

  assert.equal(trip.name, 'Goa');
  assert.equal(trip.ownerId, null, 'a device trip has no owning account');
  assert.deepEqual(__calls(), [], 'a guest trip must never leave the device');
  assert.deepEqual((await dataService.getTrips()).map((t) => t.name), ['Goa']);
});

test('a guest can run a whole trip end to end without an account', async () => {
  setup(true);
  const made = await dataService.createTrip({
    name: 'Goa', members: [{ name: 'Alice' }, { name: 'Bob' }],
  });
  const [alice, bob] = made.members;

  await dataService.addTripExpense(made.id, {
    description: 'Dinner', amountMinor: 240000, paidById: alice.id,
    participantIds: [alice.id, bob.id],
  });
  const settled = await dataService.recordTripSettlement(made.id, {
    fromId: bob.id, toId: alice.id, amountMinor: 120000,
  });

  assert.equal(settled.expenses.length, 1);
  assert.equal(settled.settlements.length, 1);
  assert.deepEqual(__calls(), [], 'none of it reached the network');
});

test('adding a member as a guest ignores the userId there is no account to link', async () => {
  // The signature takes one because the signed-in screen offers group members; locally there is
  // nobody to link to, and storing a stray id would make `syncService` claim the wrong account.
  setup(true);
  const made = await dataService.createTrip({ name: 'Goa' });
  const withMember = await dataService.addTripMember(made.id, 'Alice', 'u1');

  const alice = withMember.members.find(m => m.name === 'Alice');
  assert.ok(alice);
  assert.equal(alice.userId, null);
});

test("a guest trip starts with the device's user as a member, marked isSelf", async () => {
  // Mirrors the server, where the creator is always a member. `isSelf` is what the sync later
  // uses to link this member to the account rather than seeding a second "you" beside it.
  setup(true);
  const made = await dataService.createTrip({ name: 'Goa' });

  assert.equal(made.members.length, 1);
  assert.equal(made.members[0].isSelf, true);
  assert.equal(made.members[0].userId, null, 'a guest has no account id yet');
});
