// The sync engine (W3-14..17, W3-21) against the in-memory AsyncStorage and a stubbed server:
// what the outbox coalesces, what a push does with each result, what a pull applies and what it
// leaves alone, where the cursor lands when a page fails, and when the scheduler says a run is due.

import test from 'node:test';
import assert from 'node:assert/strict';

import { __reset as resetSecure } from './stubs/secureStore.mjs';
import { __reset as resetStorage } from './stubs/asyncStorage.mjs';
const { __resetLocalStores } = await import('../src/services/local/jsonStore.ts');
import { __reset as resetAxios, __handle, __calls, __status } from './stubs/axios.mjs';

const outbox     = await import('../src/sync/outbox.ts');
const meta       = await import('../src/sync/meta.ts');
const session    = await import('../src/sync/session.ts');
const engine     = await import('../src/sync/engine.ts');
const scheduler  = await import('../src/sync/scheduler.ts');
const dataService = await import('../src/services/dataService.ts');
const localTx    = await import('../src/services/local/localTransactionService.ts');
const localAcct  = await import('../src/services/local/localAccountService.ts');
const localCat   = await import('../src/services/local/localCategoryService.ts');

function setup({ signedIn = true, groupId = 'g-home' } = {}) {
  resetSecure({ token: 'tok', refreshToken: 'ref' });
  resetStorage({});
  __resetLocalStores();
  resetAxios();
  meta.__resetSyncMetaCache();
  session.setSignedIn(signedIn);
  dataService.setMode(!signedIn);
  return meta.updateSyncMeta({ activeGroupId: groupId, schedule: 'manual' });
}

const entry = (over = {}) => ({
  id: 'e', collection: 'transactions', op: 'create', clientId: 'c1', payload: { amount: 1 },
  updatedAt: '2026-09-13T10:00:00Z', groupId: null, attempts: 0, ...over,
});

// ── outbox ────────────────────────────────────────────────────────────────────

test('coalesce: edit-after-create rewrites the create; delete-after-create drops both', () => {
  const created = [entry({ op: 'create', payload: { amount: 1, note: 'a' } })];
  const edited  = outbox.coalesce(created, entry({ id: 'e2', op: 'update', payload: { amount: 2 } }));
  assert.equal(edited.length, 1);
  assert.equal(edited[0].op, 'create', 'the server still has to be told to create it');
  assert.deepEqual(edited[0].payload, { amount: 2, note: 'a' }, 'later fields win, earlier ones survive');

  assert.deepEqual(outbox.coalesce(created, entry({ id: 'e3', op: 'delete' })), [], 'the server never saw it');
});

test('coalesce: delete-after-update is a delete; create-after-delete is an update that revives', () => {
  const updated = [entry({ op: 'update' })];
  const deleted = outbox.coalesce(updated, entry({ id: 'e2', op: 'delete' }));
  assert.equal(deleted.length, 1);
  assert.equal(deleted[0].op, 'delete');

  const revived = outbox.coalesce(deleted, entry({ id: 'e3', op: 'create', payload: { amount: 9 } }));
  assert.equal(revived.length, 1);
  assert.equal(revived[0].op, 'update', 'the server has a tombstone under this id; an upsert revives it');
});

test('coalesce leaves other rows alone and keeps order', () => {
  const two = [entry({ id: 'a', clientId: 'x' }), entry({ id: 'b', clientId: 'y' })];
  const out = outbox.coalesce(two, entry({ id: 'c', clientId: 'x', op: 'update', payload: { amount: 5 } }));
  assert.deepEqual(out.map(e => e.clientId), ['y', 'x'], 'the coalesced row moves to the end — it is the latest write');
  assert.equal(out.find(e => e.clientId === 'y').payload.amount, 1);
});

// ── push ──────────────────────────────────────────────────────────────────────

test('push drains the outbox in order and writes the server row back under the local id', async () => {
  await setup();
  const tx = await dataService.addTransaction({ amount: 120, type: 'expense', category: 'Food', date: '2026-09-13T09:00:00Z' });
  assert.equal(await outbox.count(), 1);

  __handle('post', '/sync/push', (cfg) => ({
    results: cfg.data.items.map(i => ({
      clientId: i.clientId, collection: i.collection, status: 'applied', serverId: 'srv-1',
      row: { _id: 'srv-1', ...i.payload, userId: 'me', groupId: 'g-home', note: 'from server' },
    })),
    serverTime: '2026-09-13T10:00:00Z',
  }));
  __handle('get', '/sync/changes', () => ({ changes: [], cursor: '2026-09-13T10:00:00Z', hasMore: false }));

  const out = await engine.runSync('manual');
  assert.equal(out.pushed, 1);
  assert.equal(await outbox.count(), 0);
  const sent = __calls().find(c => c.url === '/sync/push').data.items[0];
  assert.equal(sent.op, 'upsert');
  assert.equal(sent.clientId, tx._id);
  assert.equal(sent.groupId, 'g-home');

  const [row] = await localTx.getLocalTransactions();
  assert.equal(row._id, tx._id, 'the local id is the clientId, always');
  assert.equal(row.groupId, 'g-home', 'the server row is written back — it now carries its group');
  assert.equal(row.serverId, 'srv-1');
});

test('push: a rejected row stays queued for another try and does not block the rest', async () => {
  await setup();
  await dataService.addTransaction({ amount: 1, type: 'expense', category: 'Food', date: '2026-09-13T09:00:00Z' });
  const bad = await dataService.addTransaction({ amount: 2, type: 'expense', category: 'Food', date: '2026-09-13T09:00:00Z' });

  __handle('post', '/sync/push', (cfg) => ({
    results: cfg.data.items.map(i => i.clientId === bad._id
      ? { clientId: i.clientId, collection: i.collection, status: 'rejected', error: 'amount is required' }
      : { clientId: i.clientId, collection: i.collection, status: 'applied', serverId: 's', row: { _id: 's', ...i.payload } }),
  }));
  __handle('get', '/sync/changes', () => ({ changes: [], cursor: null, hasMore: false }));

  const out = await engine.runSync('manual');
  assert.equal(out.pushed, 1);
  assert.equal(out.rejected, 1);
  const [left] = await outbox.peek();
  assert.equal(left.clientId, bad._id);
  assert.equal(left.attempts, 1);
  assert.equal(left.lastError, 'amount is required');
});

test('push: superseded means the server wins — its row overwrites ours', async () => {
  await setup();
  const tx = await dataService.addTransaction({ amount: 50, type: 'expense', category: 'Food', date: '2026-09-13T09:00:00Z' });
  __handle('post', '/sync/push', (cfg) => ({
    results: [{ clientId: tx._id, collection: 'transactions', status: 'superseded', serverId: 's', row: { _id: 's', amount: 200, type: 'expense', category: 'Food', groupId: 'g-home' } }],
  }));
  __handle('get', '/sync/changes', () => ({ changes: [], cursor: null, hasMore: false }));
  await engine.runSync('manual');
  const [row] = await localTx.getLocalTransactions();
  assert.equal(row.amount, 200);
  assert.equal(await outbox.count(), 0);
});

test('push: a category deduped by name becomes the server\'s row, and ours goes', async () => {
  await setup();
  await dataService.addCategory('Travel', 'airplane');
  const mine = (await localCat.getAllLocalCategories()).find(c => c.name === 'Travel');
  __handle('post', '/sync/push', () => ({
    results: [{ clientId: mine._id, collection: 'categories', status: 'superseded', serverId: 'cat-srv',
                row: { _id: 'cat-srv', clientId: 'theirs', name: 'Travel', icon: 'bus', type: 'expense', groupId: 'g-home' } }],
  }));
  __handle('get', '/sync/changes', () => ({ changes: [], cursor: null, hasMore: false }));
  await engine.runSync('manual');
  const cats = await localCat.getAllLocalCategories();
  assert.ok(!cats.some(c => c._id === mine._id), 'our duplicate is gone');
  const theirs = cats.find(c => c._id === 'theirs');
  assert.equal(theirs.icon, 'bus');
});

test('a network failure mid-push keeps the rest queued, in order, and reports the error', async () => {
  await setup();
  await dataService.addTransaction({ amount: 1, type: 'expense', category: 'Food', date: '2026-09-13T09:00:00Z' });
  __handle('post', '/sync/push', () => { throw __status(503, { message: 'down' }); });
  const out = await engine.runSync('manual');
  assert.equal(out.error, 'down');
  assert.equal(await outbox.count(), 1);
  assert.equal((await meta.getSyncMeta()).lastError, 'down');
  assert.equal((await meta.getSyncMeta()).lastSyncAt, null, 'a failed run is not a backup');
});

// ── pull ──────────────────────────────────────────────────────────────────────

const change = (over = {}) => ({
  collection: 'transactions', clientId: 'r1', serverId: 'srv-r1', updatedAt: '2026-09-13T09:00:00Z', deleted: false,
  row: { _id: 'srv-r1', amount: 75, type: 'expense', category: 'Food', date: '2026-09-13T08:00:00Z', groupId: 'g-home', userId: 'them' },
  ...over,
});

test('pull applies rows under their clientId, links accounts, and removes tombstones', async () => {
  await setup();
  __handle('get', '/sync/changes', () => ({
    changes: [
      { collection: 'accounts', clientId: 'acc-w', serverId: 'srv-a', updatedAt: 'x', deleted: false, row: { _id: 'srv-a', name: 'Wallet', type: 'cash', openingBalance: 0, color: '', icon: '', createdAt: '2026-01-01' } },
      change({ row: { ...change().row, accountId: 'acc-w' } }),
      change({ clientId: 'gone', serverId: 'srv-gone', deleted: true, row: { _id: 'srv-gone', deletedAt: 'x' } }),
      { collection: 'categories', clientId: 'cat-1', serverId: 's', updatedAt: 'x', deleted: false, row: { _id: 's', clientId: 'cat-1', name: 'Fuel', icon: 'car', type: 'expense', groupId: 'g-home' } },
    ],
    cursor: '2026-09-13T10:00:00Z', hasMore: false,
  }));
  await localTx.upsertLocalTransaction({ _id: 'gone', amount: 1, type: 'expense', category: 'x', date: 'x', createdAt: 'x', groupId: 'g-home' });

  const out = await engine.runSync('manual');
  assert.equal(out.pulled, 4);

  const rows = await localTx.getLocalTransactions();
  assert.deepEqual(rows.map(r => r._id), ['r1'], 'the tombstoned row is gone, the new one is here');
  assert.equal(rows[0].serverId, 'srv-r1');
  assert.equal((await localAcct.getLocalTxAccountMap()).r1, 'acc-w', 'the account link came with the row');
  assert.equal((await localAcct.getLocalAccounts())[0].id, 'acc-w');
  assert.ok((await localCat.getLocalCategories()).categories.some(c => c._id === 'cat-1' && c.name === 'Fuel'));
  assert.equal((await meta.getSyncMeta()).cursor, '2026-09-13T10:00:00Z');
});

test('pull never overwrites a row with a pending outbox entry — local wins until pushed', async () => {
  await setup();
  const tx = await dataService.addTransaction({ amount: 10, type: 'expense', category: 'Food', date: '2026-09-13T09:00:00Z' });
  __handle('post', '/sync/push', () => { throw __status(503); });     // the push fails, so it stays pending
  __handle('get', '/sync/changes', () => ({ changes: [change({ clientId: tx._id, row: { ...change().row, amount: 999 } })], cursor: 'c', hasMore: false }));

  await engine.runSync('manual');                                     // push fails → pull is skipped this run
  assert.equal((await localTx.getLocalTransactions())[0].amount, 10);

  // Even with a pull that does run, the pending row is skipped.
  resetAxios();
  __handle('post', '/sync/push', (cfg) => ({ results: cfg.data.items.map(i => ({ clientId: i.clientId, collection: i.collection, status: 'rejected', error: 'no' })) }));
  __handle('get', '/sync/changes', () => ({ changes: [change({ clientId: tx._id, row: { ...change().row, amount: 999 } })], cursor: 'c', hasMore: false }));
  await engine.runSync('manual');
  assert.equal((await localTx.getLocalTransactions())[0].amount, 10, 'still ours');
});

test('pull pages until hasMore is false and stores the cursor only after a page is applied', async () => {
  await setup();
  let page = 0;
  __handle('get', '/sync/changes', (cfg) => {
    page++;
    if (page === 1) return { changes: [change({ clientId: 'p1', serverId: 's1' })], cursor: 'after-1', hasMore: true };
    if (page === 2) { assert.equal(cfg.params.since, 'after-1'); throw __status(503, { message: 'blip' }); }
    return { changes: [change({ clientId: 'p2', serverId: 's2' })], cursor: 'after-2', hasMore: false };
  });

  const first = await engine.runSync('manual');
  assert.equal(first.error, 'blip');
  assert.equal((await meta.getSyncMeta()).cursor, 'after-1', 'the first page landed and its cursor is kept');
  assert.deepEqual((await localTx.getLocalTransactions()).map(r => r._id), ['p1']);

  const second = await engine.runSync('manual');
  assert.equal(second.error, null);
  assert.equal((await meta.getSyncMeta()).cursor, 'after-2');
  assert.equal(__calls().filter(c => c.url === '/sync/changes').at(-1).params.since, 'after-1', 'resumed, not restarted');
});

test('a guest run does nothing and touches nothing', async () => {
  await setup({ signedIn: false, groupId: null });
  await dataService.addTransaction({ amount: 10, type: 'expense', category: 'Food', date: '2026-09-13T09:00:00Z' });
  const out = await engine.runSync('manual');
  assert.deepEqual(out, { pushed: 0, pulled: 0, rejected: 0, error: null });
  assert.equal(__calls().length, 0);
  assert.equal(await outbox.count(), 1, 'the outbox waits for a sign-in');
});

test('only one run at a time — a second call joins the first', async () => {
  await setup();
  let release;
  const held = new Promise(r => { release = r; });
  __handle('post', '/sync/push', async () => { await held; return { results: [] }; });
  __handle('get', '/sync/changes', () => ({ changes: [], cursor: null, hasMore: false }));
  await dataService.addTransaction({ amount: 10, type: 'expense', category: 'Food', date: '2026-09-13T09:00:00Z' });

  const a = engine.runSync('manual');
  const b = engine.runSync('manual');
  assert.equal(a, b);
  release();
  await a;
  assert.equal(__calls().filter(c => c.url === '/sync/push').length, 1);
});

// ── scheduler ─────────────────────────────────────────────────────────────────

test('isDue: intervals, the midnight rule, manual never, instant with pending', () => {
  const at = (s) => new Date(s);
  assert.equal(scheduler.isDue('hourly', null), true, 'never run → due');
  assert.equal(scheduler.isDue('hourly', '2026-09-13T10:00:00', at('2026-09-13T10:59:00')), false);
  assert.equal(scheduler.isDue('hourly', '2026-09-13T10:00:00', at('2026-09-13T11:00:00')), true);
  assert.equal(scheduler.isDue('every4h', '2026-09-13T10:00:00', at('2026-09-13T13:59:00')), false);
  assert.equal(scheduler.isDue('every4h', '2026-09-13T10:00:00', at('2026-09-13T14:00:00')), true);
  assert.equal(scheduler.isDue('daily', '2026-09-13T10:00:00', at('2026-09-13T23:59:00')), false, 'same day');
  assert.equal(scheduler.isDue('daily', '2026-09-13T10:00:00', at('2026-09-14T00:01:00')), true, 'past midnight');
  assert.equal(scheduler.isDue('manual', null), false);
  assert.equal(scheduler.isDue('instant', '2026-09-13T10:00:00', at('2026-09-13T10:01:00'), 0), false);
  assert.equal(scheduler.isDue('instant', '2026-09-13T10:00:00', at('2026-09-13T10:01:00'), 3), true, 'something is waiting');
  assert.equal(scheduler.isDue('instant', '2026-09-13T10:00:00', at('2026-09-13T10:16:00'), 0), true, 'the 15-minute floor');
});

test('syncIfDue honours the schedule and Wi-Fi only', async () => {
  await setup();
  __handle('post', '/sync/push', () => ({ results: [] }));
  __handle('get', '/sync/changes', () => ({ changes: [], cursor: 'c', hasMore: false }));

  await meta.updateSyncMeta({ schedule: 'manual' });
  assert.equal(await scheduler.syncIfDue('schedule'), false);

  await meta.updateSyncMeta({ schedule: 'hourly', lastSyncAt: null, wifiOnly: true });
  const netinfo = (await import('./stubs/netinfo.mjs')).default;
  netinfo.__set({ type: 'cellular' });
  assert.equal(await scheduler.syncIfDue('schedule'), false, 'waits for Wi-Fi');
  netinfo.__set({ type: 'wifi' });
  assert.equal(await scheduler.syncIfDue('schedule'), true);
  assert.ok((await meta.getSyncMeta()).lastSyncAt);
});

// ── attachments (W3-24) ───────────────────────────────────────────────────────

const receipts = await import('../src/services/receiptService.ts');
const fs = await import('./stubs/fileSystem.mjs');

test('a saved receipt is queued, uploaded after its row has landed, and the key written back', async () => {
  await setup();
  fs.__reset({ 'file:///picked/r.jpg': 'bytes' });
  const tx = await dataService.addTransaction({ amount: 5, type: 'expense', category: 'Food', date: '2026-09-13T09:00:00Z' });
  await receipts.saveReceipt(tx._id, 'file:///picked/r.jpg');
  assert.deepEqual((await outbox.peek()).map(e => e.collection), ['transactions', 'attachments']);

  __handle('post', '/sync/push', (cfg) => ({ results: cfg.data.items.map(i => ({ clientId: i.clientId, collection: i.collection, status: 'applied', serverId: 's', row: { _id: 's', ...i.payload, groupId: 'g-home' } })) }));
  __handle('post', `/attachments/receipts/${tx._id}`, () => ({ receiptKey: `receipts/me/${tx._id}.jpg` }));
  __handle('get', '/sync/changes', () => ({ changes: [], cursor: 'c', hasMore: false }));

  const out = await engine.runSync('manual');
  assert.equal(out.pushed, 2);
  assert.equal(await outbox.count(), 0);
  assert.equal((await localTx.getLocalTransactions())[0].receiptKey, `receipts/me/${tx._id}.jpg`);
  const upload = __calls().find(c => c.url === `/attachments/receipts/${tx._id}`);
  assert.ok(upload, 'one multipart upload');
  assert.ok(__calls().findIndex(c => c.url === '/sync/push') < __calls().indexOf(upload), 'rows first, then the file');
});

test('an upload the server answers 404 to waits for the next run without burning an attempt', async () => {
  await setup();
  fs.__reset({ 'file:///picked/r.jpg': 'bytes' });
  await outbox.enqueue({ collection: 'attachments', op: 'create', clientId: 'not-landed', groupId: null, payload: { uri: 'file:///picked/r.jpg' } });
  __handle('post', '/attachments/receipts/not-landed', () => { throw __status(404); });
  __handle('get', '/sync/changes', () => ({ changes: [], cursor: 'c', hasMore: false }));
  const out = await engine.runSync('manual');
  assert.equal(out.error, null);
  const [left] = await outbox.peek();
  assert.equal(left.attempts, 0);
});

test('a scheduled run on cellular sends the rows but not the receipts unless opted in', async () => {
  await setup();
  fs.__reset({ 'file:///picked/r.jpg': 'bytes' });
  await meta.updateSyncMeta({ schedule: 'hourly', lastSyncAt: null, wifiOnly: false });
  const tx = await dataService.addTransaction({ amount: 5, type: 'expense', category: 'Food', date: '2026-09-13T09:00:00Z' });
  await receipts.saveReceipt(tx._id, 'file:///picked/r.jpg');
  __handle('post', '/sync/push', (cfg) => ({ results: cfg.data.items.map(i => ({ clientId: i.clientId, collection: i.collection, status: 'applied', serverId: 's', row: { _id: 's', ...i.payload } })) }));
  __handle('post', /\/attachments\/receipts\//, () => ({ receiptKey: 'k' }));
  __handle('get', '/sync/changes', () => ({ changes: [], cursor: 'c', hasMore: false }));
  const netinfo = (await import('./stubs/netinfo.mjs')).default;

  netinfo.__set({ type: 'cellular' });
  assert.equal(await scheduler.syncIfDue('schedule'), true);
  assert.deepEqual((await outbox.peek()).map(e => e.collection), ['attachments'], 'the row went, the file waits');

  await meta.updateSyncMeta({ attachmentsOnCellular: true, lastSyncAt: null });
  await scheduler.syncIfDue('schedule');
  assert.equal(await outbox.count(), 0);
  netinfo.__set({ type: 'wifi' });
});

test('a row pulled with a receiptKey fetches the file on demand, once', async () => {
  await setup();
  fs.__reset();
  await localTx.upsertLocalTransaction({ _id: 'r1', amount: 1, type: 'expense', category: 'x', date: 'x', createdAt: 'x', groupId: 'g-home', receiptKey: 'receipts/them/r1.png' });
  __handle('get', '/attachments/receipts/r1/url', () => ({ url: 'https://signed/r1', receiptKey: 'receipts/them/r1.png' }));

  const uri = await receipts.getReceipt('r1');
  assert.equal(uri, 'file:///doc/receipts/r1.png');
  assert.equal(await receipts.getReceipt('r1'), uri);
  assert.equal(__calls().filter(c => c.url.includes('/url')).length, 1, 'the second read is the local file');
  assert.equal(await receipts.getReceipt('nothing'), null);
});
