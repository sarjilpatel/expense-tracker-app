// W1-01 regression: `syncLocalToServer` used to clear the device's guest data unconditionally at
// the end of the run. A dropped connection halfway through a first login therefore deleted
// everything the user had entered before signing up, with no way back.
//
// This runs the shipped syncService.ts and the real local/* services against an in-memory
// AsyncStorage, so what is pinned is the actual retain/clear behaviour rather than a description
// of it. Only the three native packages are stubbed.

import test from 'node:test';
import assert from 'node:assert/strict';

import { __reset as resetStorage, __raw } from './stubs/asyncStorage.mjs';
import { __reset as resetAxios, __handle, __status, __calls } from './stubs/axios.mjs';

const { syncLocalToServer, getSyncSummary, discardLocalData } =
  await import('../src/services/syncService.ts');

const TX_KEY   = '@local_transactions_v1';
const CAT_KEY  = '@local_categories_v1';
const BUD_KEY  = '@local_budgets_v1';
const ACC_KEY  = '@accounts_v2';
const TRIP_KEY = '@trip_master_v1';
const MAP_KEY  = '@tx_account_map_v2';
const SYNC_KEY = '@last_sync_at';

const tx = (id, over = {}) => ({
  _id: id, amount: 100, type: 'expense', category: 'Food', note: id,
  date: '2026-09-01T00:00:00.000Z', createdAt: '2026-09-01T00:00:00.000Z', ...over,
});
const cat = (id, over = {}) => ({ _id: id, name: id, icon: 'cart', type: 'expense', ...over });
const bud = (id, over = {}) => ({ _id: id, amount: 500, month: 9, year: 2026, category: 'Food',
                                  createdAt: '2026-09-01T00:00:00.000Z', ...over });
const acc = (id, over = {}) => ({ id, name: id, type: 'cash', openingBalance: 0, color: '', icon: '',
                                  createdAt: '2026-09-01T00:00:00.000Z', ...over });
const trip = (id, over = {}) => ({
  id, name: id, currency: 'INR', ownerId: null,
  members: [{ id: 'm-a', name: 'Alice', userId: null }, { id: 'm-b', name: 'Bob', userId: null }],
  expenses: [{ id: 'e1', description: 'Dinner', amountMinor: 240000, paidById: 'm-a',
               participantIds: ['m-a', 'm-b'], createdAt: '2026-09-01T00:00:00.000Z' }],
  settlements: [],
  createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', ...over,
});

/** What the stub server has been told about trips, so a test can assert on what actually arrived. */
const serverTrips = new Map();
let tripSeq = 0;
const tripOf = (url) => serverTrips.get(url.split('/')[2]);

/** Seeds the device with guest data and a working server, then lets the test break pieces of it. */
function setup({ txs = [], cats = [], budgets = [], accounts = [], trips = [], map = {} } = {}) {
  resetStorage({
    [TX_KEY]: txs, [CAT_KEY]: cats, [BUD_KEY]: budgets, [ACC_KEY]: accounts,
    [TRIP_KEY]: trips, [MAP_KEY]: map,
  });
  resetAxios();
  // A server that accepts everything. Individual tests re-register a route to fail.
  __handle('post', '/group/categories', () => ({ ok: true }));
  __handle('post', '/accounts/import', (cfg) => {
    const sent = cfg.data.accounts;
    return { imported: sent.length, received: sent.length,
             idMap: Object.fromEntries(sent.map((a) => [a.id, 'srv_' + a.id])) };
  });
  __handle('post', '/transactions/import-json', (cfg) => ({ imported: cfg.data.transactions.length }));
  __handle('post', '/budgets', () => ({ ok: true }));

  // A trip server that keeps what it is given, so the assertions below are about the payload the
  // sync actually sent rather than about which calls it made.
  serverTrips.clear();
  tripSeq = 0;
  __handle('post', '/trips', (cfg) => {
    const _id = 'srv' + (++tripSeq);
    // The real server always seeds a member for the account doing the sync, and keeps any member
    // id the client supplied. Both matter to the caller, so the stub does both.
    const row = {
      _id, name: cfg.data.name, currency: cfg.data.currency || 'INR', ownerId: 'u1',
      members: [{ id: 'srv-me', name: 'Me', userId: 'u1' },
                ...(cfg.data.members || []).map((m) => ({ id: m.id || 'gen', name: m.name, userId: null }))],
      expenses: [], settlements: [],
    };
    serverTrips.set(_id, row);
    return row;
  });
  __handle('post', /\/trips\/[^/]+\/expenses$/, (cfg) => {
    const row = tripOf(cfg.url);
    row.expenses.push({ id: 'se' + row.expenses.length, ...cfg.data });
    return row;
  });
  __handle('post', /\/trips\/[^/]+\/settlements$/, (cfg) => {
    const row = tripOf(cfg.url);
    row.settlements.push({ id: 'ss' + row.settlements.length, ...cfg.data, settledAt: '2026-09-01T00:00:00.000Z' });
    return row;
  });
  __handle('delete', /\/trips\/[^/]+$/, (cfg) => {
    serverTrips.delete(cfg.url.split('/')[2]);
    return { ok: true };
  });
}

const read = (key) => { const raw = __raw(key); return raw === null ? null : JSON.parse(raw); };
/** The last-sync stamp is a bare ISO string, not JSON. */
const lastSync = () => __raw(SYNC_KEY);
const ids  = (key) => (read(key) || []).map((r) => r._id ?? r.id);

test('a clean run uploads everything and leaves nothing behind', async () => {
  setup({ txs: [tx('t1'), tx('t2')], cats: [cat('c1')], budgets: [bud('b1')], accounts: [acc('a1')] });

  const result = await syncLocalToServer();

  assert.equal(result.success, true);
  assert.equal(result.synced, 5);
  assert.equal(result.failed, 0);
  assert.deepEqual(ids(TX_KEY), []);
  assert.deepEqual(ids(CAT_KEY), []);
  assert.deepEqual(ids(BUD_KEY), []);
  assert.deepEqual(ids(ACC_KEY), []);
  assert.ok(lastSync(), 'a successful sync stamps the last-sync time');
});

test('a failed transaction chunk keeps its rows on the device', async () => {
  // The bug. Before, this cleared local storage anyway and the rows were gone for good.
  setup({ txs: [tx('t1'), tx('t2')] });
  __handle('post', '/transactions/import-json', () => { throw __status(500, { msg: 'boom' }); });

  const result = await syncLocalToServer();

  assert.equal(result.success, false);
  assert.equal(result.failed, 2);
  assert.equal(result.synced, 0);
  assert.deepEqual(ids(TX_KEY), ['t1', 't2'], 'both rows must still be on the device');
  assert.match(result.error, /still on this device/);
});

test('only the items that failed are kept', async () => {
  setup({ txs: [tx('t1')], cats: [cat('c1')], budgets: [bud('b1')] });
  __handle('post', '/budgets', () => { throw __status(400, { message: 'bad budget' }); });

  const result = await syncLocalToServer();

  assert.equal(result.failed, 1);
  assert.equal(result.synced, 2);
  assert.deepEqual(ids(BUD_KEY), ['b1'], 'the rejected budget stays');
  assert.deepEqual(ids(TX_KEY), [], 'the accepted transaction goes');
  assert.deepEqual(ids(CAT_KEY), [], 'the accepted category goes');
});

test('a partially accepted chunk is held whole rather than guessed at', async () => {
  // The server silently drops rows it considers invalid. Without knowing which, keeping the
  // whole chunk is the only option that cannot lose data.
  setup({ txs: [tx('t1'), tx('t2'), tx('t3')] });
  __handle('post', '/transactions/import-json', () => ({ imported: 2 }));

  const result = await syncLocalToServer();

  assert.equal(result.failed, 3);
  assert.deepEqual(ids(TX_KEY), ['t1', 't2', 't3']);
  assert.match(result.error, /accepted 2 of 3/);
});

test('a failure part-way through does not stamp the last-sync time', async () => {
  // Otherwise the app believes the guest data is already on the server.
  setup({ txs: [tx('t1')] });
  __handle('post', '/transactions/import-json', () => { throw __status(500); });

  await syncLocalToServer();
  assert.equal(lastSync(), null);
});

test('an unexpected throw clears nothing at all', async () => {
  setup({ txs: [tx('t1')], cats: [cat('c1')] });
  // A non-HTTP failure: the whole run aborts before the retain step.
  __handle('post', '/group/categories', () => { throw new TypeError('network down'); });
  __handle('post', '/transactions/import-json', () => { throw new TypeError('network down'); });

  const result = await syncLocalToServer();

  assert.equal(result.success, false);
  assert.deepEqual(ids(TX_KEY), ['t1']);
  assert.deepEqual(ids(CAT_KEY), ['c1']);
});

test('transactions are uploaded in bulk, not one request each', async () => {
  // The API is rate limited to 60 req/min; the old per-item loop blew through it and lost
  // everything past the limit.
  setup({ txs: Array.from({ length: 300 }, (_, i) => tx('t' + i)) });

  await syncLocalToServer();

  const imports = __calls().filter((c) => c.url === '/transactions/import-json');
  assert.equal(imports.length, 2, '300 rows at a chunk size of 250');
  assert.equal(imports[0].data.transactions.length, 250);
  assert.equal(imports[1].data.transactions.length, 50);
});

test('the local _id is never sent to the server', async () => {
  setup({ txs: [tx('t1')] });
  await syncLocalToServer();

  const [sent] = __calls().find((c) => c.url === '/transactions/import-json').data.transactions;
  assert.equal(sent._id, undefined);
  assert.equal(sent.createdAt, undefined);
  assert.equal(sent.amount, 100);
});

test('accounts are uploaded before transactions so the id map exists', async () => {
  setup({ txs: [tx('t1')], accounts: [acc('a1')], map: { t1: 'a1' } });
  await syncLocalToServer();

  const urls = __calls().map((c) => c.url);
  assert.ok(urls.indexOf('/accounts/import') < urls.indexOf('/transactions/import-json'),
    'a transaction that references an account the server has not seen lands unassigned');
});

test('a transaction carries its account across as the new server id', async () => {
  setup({ txs: [tx('t1')], accounts: [acc('a1')], map: { t1: 'a1' } });
  await syncLocalToServer();

  const [sent] = __calls().find((c) => c.url === '/transactions/import-json').data.transactions;
  assert.equal(sent.accountId, 'srv_a1');
});

test('the tx-account map is rewritten to server ids even when the upload fails', async () => {
  // The rows stay on the device and are retried later — by which point the guest account ids no
  // longer exist anywhere, so a map still holding them would strand every retried transaction.
  setup({ txs: [tx('t1')], accounts: [acc('a1')], map: { t1: 'a1' } });
  __handle('post', '/transactions/import-json', () => { throw __status(500); });

  await syncLocalToServer();

  assert.deepEqual(read(MAP_KEY), { t1: 'srv_a1' });
  assert.deepEqual(ids(TX_KEY), ['t1']);
});

test('the map is only dropped once nothing is left referencing it', async () => {
  setup({ txs: [tx('t1')], accounts: [acc('a1')], map: { t1: 'a1' } });
  await syncLocalToServer();

  assert.equal(read(MAP_KEY), null, 'a fully synced device has no local map to keep');
});

test('accounts the server did not map are kept, not assumed uploaded', async () => {
  setup({ accounts: [acc('a1'), acc('a2')] });
  __handle('post', '/accounts/import', () => ({ imported: 1, received: 2, idMap: { a1: 'srv_a1' } }));

  const result = await syncLocalToServer();

  assert.equal(result.failed, 1);
  assert.deepEqual(ids(ACC_KEY), ['a2']);
  assert.match(result.error, /accepted 1 of 2/);
});

test('a total account-import failure keeps every account', async () => {
  setup({ accounts: [acc('a1'), acc('a2')] });
  __handle('post', '/accounts/import', () => { throw __status(500); });

  const result = await syncLocalToServer();

  assert.equal(result.failed, 2);
  assert.deepEqual(ids(ACC_KEY), ['a1', 'a2']);
});

test('default categories are not uploaded or counted', async () => {
  // `dc_` ids are the built-in list; the server already has them.
  setup({ cats: [cat('dc_food'), cat('c1')] });

  const summary = await getSyncSummary();
  assert.equal(summary.categories, 1);

  await syncLocalToServer();
  const posted = __calls().filter((c) => c.url === '/group/categories');
  assert.equal(posted.length, 1);
  assert.equal(posted[0].data.name, 'c1');
});

test('an empty device syncs trivially and stamps the time', async () => {
  setup();
  const result = await syncLocalToServer();

  assert.deepEqual(result, { success: true, synced: 0, failed: 0 });
  assert.ok(lastSync());
});

test('progress is reported against the real item count', async () => {
  setup({ txs: [tx('t1')], cats: [cat('c1')], budgets: [bud('b1')], accounts: [acc('a1')] });

  const steps = [];
  await syncLocalToServer((step, done, total) => steps.push({ step, done, total }));

  assert.ok(steps.length > 0);
  assert.ok(steps.every((s) => s.total === 4), JSON.stringify(steps));
  assert.equal(steps[steps.length - 1].done, 4, 'the bar must reach the end');
});

test('discardLocalData is the explicit opt-out and clears everything', async () => {
  // Losing the data must be something the user chose, not something a failed sync did to them.
  setup({ txs: [tx('t1')], cats: [cat('c1')], budgets: [bud('b1')], accounts: [acc('a1')],
          trips: [trip('tr1')] });

  await discardLocalData();

  assert.deepEqual(ids(TX_KEY), []);
  assert.deepEqual(ids(CAT_KEY), []);
  assert.deepEqual(ids(BUD_KEY), []);
  assert.deepEqual(ids(ACC_KEY), []);
  assert.deepEqual(ids(TRIP_KEY), []);
});

// ── Trips (W2-28) ──────────────────────────────────────────────────────
// The point of merging splits into trips was that a guest's trip is real data the server can be
// given later. Splits could never do this: they were group-scoped rows a guest had no way to make.

test('a guest trip goes up whole — members, expenses and payments', async () => {
  setup({ trips: [trip('tr1', {
    settlements: [{ id: 's1', fromId: 'm-b', toId: 'm-a', amountMinor: 120000,
                    settledAt: '2026-09-02T00:00:00.000Z', recordedBy: null }],
  })] });

  const result = await syncLocalToServer();

  assert.equal(result.failed, 0, result.error);
  const [row] = [...serverTrips.values()];
  assert.equal(row.name, 'tr1');
  assert.equal(row.expenses.length, 1);
  assert.equal(row.settlements.length, 1);
  assert.equal(row.settlements[0].amountMinor, 120000);
  assert.deepEqual(ids(TRIP_KEY), [], 'an accepted trip does not stay on the device');
});

test('member ids survive the upload, so nobody inherits another member\'s share', async () => {
  // The expenses are posted after the trip exists and name their payer by id. If the server minted
  // fresh member ids the upload would still succeed and every balance would be wrong — which is why
  // the ids are sent with the members rather than mapped afterwards.
  setup({ trips: [trip('tr1')] });
  await syncLocalToServer();

  const [row] = [...serverTrips.values()];
  assert.deepEqual(row.members.map((m) => m.id), ['srv-me', 'm-a', 'm-b']);
  assert.equal(row.expenses[0].paidById, 'm-a');
  assert.deepEqual(row.expenses[0].participantIds, ['m-a', 'm-b']);
});

test('an uneven split keeps its explicit shares', async () => {
  setup({ trips: [trip('tr1', {
    expenses: [{ id: 'e1', description: 'Cab', amountMinor: 140000, paidById: 'm-a',
                 participantIds: ['m-a', 'm-b'], sharesMinor: { 'm-a': 40000, 'm-b': 100000 },
                 createdAt: '2026-09-01T00:00:00.000Z' }],
  })] });
  await syncLocalToServer();

  const [row] = [...serverTrips.values()];
  assert.deepEqual(row.expenses[0].sharesMinor, { 'm-a': 40000, 'm-b': 100000 });
});

test('an evenly divided expense sends no shares at all', async () => {
  // `null`, not an omitted key: the same field is a PATCH-merge elsewhere, and a stale share map
  // there would go on dividing the expense by numbers the user has since changed.
  setup({ trips: [trip('tr1')] });
  await syncLocalToServer();

  const posted = __calls().find((c) => /\/expenses$/.test(c.url || ''));
  assert.equal(posted.data.sharesMinor, null);
});

test('a trip that fails halfway is rolled back and stays on the device', async () => {
  // Without the rollback the retry would add a second, complete copy next to the broken one — two
  // trips where the user has one, and no way to tell which is which.
  setup({ trips: [trip('tr1')] });
  __handle('post', /\/trips\/[^/]+\/expenses$/, () => { throw __status(500, { message: 'nope' }); });

  const result = await syncLocalToServer();

  assert.equal(result.success, false);
  assert.equal(result.failed, 1);
  assert.deepEqual(ids(TRIP_KEY), ['tr1'], 'the device keeps what the server refused');
  assert.equal(serverTrips.size, 0, 'and the half-built trip is gone from the server');
});

test('one failed trip does not hold back the others', async () => {
  setup({ trips: [trip('tr1'), trip('tr2')] });
  let first = true;
  __handle('post', /\/trips\/[^/]+\/expenses$/, (cfg) => {
    if (first) { first = false; throw __status(500, { message: 'nope' }); }
    const row = tripOf(cfg.url);
    row.expenses.push({ id: 'se0', ...cfg.data });
    return row;
  });

  const result = await syncLocalToServer();

  assert.equal(result.failed, 1);
  assert.equal(result.synced, 1);
  assert.equal(ids(TRIP_KEY).length, 1);
  assert.equal(serverTrips.size, 1);
});

test('trips are counted in the summary and in the progress bar', async () => {
  setup({ txs: [tx('t1')], trips: [trip('tr1'), trip('tr2')] });

  const summary = await getSyncSummary();
  assert.equal(summary.trips, 2);
  assert.equal(summary.total, 3);

  const steps = [];
  await syncLocalToServer((step, done, total) => steps.push({ step, done, total }));
  assert.ok(steps.every((s) => s.total === 3), JSON.stringify(steps));
  assert.equal(steps[steps.length - 1].done, 3);
});
