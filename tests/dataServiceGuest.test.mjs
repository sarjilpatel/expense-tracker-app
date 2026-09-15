// `dataService` is the one door every screen goes through, and since W3-18 everything behind it
// is local: a guest and a signed-in user read the same store, and a write lands there and in the
// sync outbox — never straight on the network. That is what these pin, for the two features that
// used to answer differently (goals refused guests; trips were local-only for guests).
//
// The old signed-in-reaches-the-API tests are gone with the behaviour: the only code that talks to
// `/goals` or `/trips` now is the sync engine (tests/syncEngine.test.mjs).

import test from 'node:test';
import assert from 'node:assert/strict';

import { __reset as resetSecure } from './stubs/secureStore.mjs';
import { __reset as resetStorage } from './stubs/asyncStorage.mjs';
const { __resetLocalStores } = await import('../src/services/local/jsonStore.ts');
import { __reset as resetAxios, __handle, __calls } from './stubs/axios.mjs';

const dataService = await import('../src/services/dataService.ts');
const outbox = await import('../src/sync/outbox.ts');

/** Fresh transport with every goals/trips endpoint wired, so a leaked call shows up as a call. */
function setup(guest) {
  resetSecure({ token: 'tok', refreshToken: 'ref' });
  resetStorage({});
  __resetLocalStores();
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


test('goals live on the device for a guest — read, write, delete, no request', async () => {
  setup(true);
  assert.deepEqual(await dataService.getGoals(), []);
  const goal = await dataService.createGoal(NEW_GOAL);
  await dataService.updateGoal(goal._id, { addAmount: 250 });
  const [read] = await dataService.getGoals();
  assert.equal(read.savedAmount, 250);
  await dataService.deleteGoal(goal._id);
  assert.deepEqual(await dataService.getGoals(), []);
  assert.equal(__calls().length, 0, 'a guest never reaches the network');
});

test('a signed-in write is local too, and lands in the outbox instead of on the wire', async () => {
  setup(false);
  const goal = await dataService.createGoal(NEW_GOAL);
  assert.equal(__calls().length, 0, 'the server hears about it from the sync engine, not from here');
  const [entry] = await outbox.peek();
  assert.equal(entry.collection, 'goals');
  assert.equal(entry.op, 'create');
  assert.equal(entry.clientId, goal._id);
  assert.equal(entry.payload.name, 'Car');
});

test('an edit and a delete of the same unsynced row collapse in the outbox', async () => {
  setup(false);
  const goal = await dataService.createGoal(NEW_GOAL);
  await dataService.updateGoal(goal._id, { savedAmount: 10 });
  assert.equal((await outbox.peek()).length, 1, 'create + update is one create');
  await dataService.deleteGoal(goal._id);
  assert.equal((await outbox.peek()).length, 0, 'created and deleted before a sync: nothing to send');
});

test('setMode changes nothing about reads — both modes read the device', async () => {
  setup(true);
  await dataService.createGoal(NEW_GOAL);
  dataService.setMode(false);
  assert.equal(dataService.isGuestMode(), false);
  assert.equal((await dataService.getGoals()).length, 1, 'signing in does not hide what was written as a guest');
  assert.equal(__calls().length, 0);
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
  // nobody to link to, and storing a stray id would claim the wrong account on push.
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

test('recent categories come newest first, one entry per category, capped per type', async () => {
  setup(true);
  const add = (type, category, date) => dataService.addTransaction({ amount: 1, type, category, date });
  await add('expense', 'Food',   '2026-01-01');
  await add('expense', 'Fuel',   '2026-03-01');
  await add('expense', 'Food',   '2026-02-01');   // older than its Fuel neighbour, newer than its first use
  await add('income',  'Salary', '2026-01-15');
  await add('expense', 'Rent',   '2026-04-01');

  const recent = await dataService.getRecentCategories(2);
  assert.deepEqual(recent, { income: ['Salary'], expense: ['Rent', 'Fuel'] });

  const all = await dataService.getRecentCategories();
  assert.deepEqual(all.expense, ['Rent', 'Fuel', 'Food']);
});
