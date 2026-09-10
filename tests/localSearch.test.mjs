// W1-28, app side. The server cannot substring-match a note — it stores AES-GCM ciphertext and
// searches a keyed hash of each word (a blind index) instead. Guest data is plaintext on the
// device, so the local search could keep doing `note.includes(q)`, and used to. That made the same
// query return different rows before and after signing in, behind an identical search screen: as a
// guest "cof" found the coffee row, and the day the user created an account it silently stopped.
//
// The local filter now splits notes the same way the index does, so both modes answer the same.
// This runs the shipped localTransactionService against the in-memory AsyncStorage, so what is
// pinned is the real filter and not a copy of it.

import test from 'node:test';
import assert from 'node:assert/strict';

import { __reset as resetStorage } from './stubs/asyncStorage.mjs';

const { getLocalTransactions, addLocalTransaction } =
  await import('../src/services/local/localTransactionService.ts');

/** Seeds the given notes (one transaction each) and returns the notes a query matches. */
async function found(notes, query, extra = {}) {
  resetStorage();
  for (const note of notes) {
    await addLocalTransaction({
      amount: 100, type: 'expense', category: extra.category ?? 'Food',
      note, date: '2026-09-01T00:00:00.000Z',
    });
  }
  const rows = await getLocalTransactions(undefined, undefined, query);
  return rows.map((t) => t.note);
}

test('a whole word in the note matches', async () => {
  assert.deepEqual(await found(['Morning coffee run', 'Bus fare'], 'coffee'), ['Morning coffee run']);
});

test('a partial word does not — the server cannot do it, so neither does this', async () => {
  // The parity is the point. A guest who searches "cof" and finds nothing learns the rule once;
  // one who finds it and then loses it on sign-in has no way to work out what changed.
  assert.deepEqual(await found(['Morning coffee run'], 'cof'), []);
});

test('case and accents are folded, as they are in the index', async () => {
  assert.deepEqual(await found(['Café visit'], 'CAFE'), ['Café visit']);
  assert.deepEqual(await found(['CAFE VISIT'], 'café'), ['CAFE VISIT']);
});

test('punctuation separates words on both sides', async () => {
  assert.deepEqual(await found(['taxi-fare home'], 'taxi'), ['taxi-fare home']);
  assert.deepEqual(await found(["Monthly's bill!"], 'bill'), ["Monthly's bill!"]);
});

test('the category is still matched as a substring', async () => {
  // Category is not encrypted and the server still regex-matches it, so it keeps substring
  // behaviour — the narrowing applies only to the field that had to change.
  const rows = await found(['anything'], 'Foo', { category: 'Food' });
  assert.deepEqual(rows, ['anything']);
});

test('a transaction with no note is not a crash and not a match', async () => {
  resetStorage();
  await addLocalTransaction({ amount: 100, type: 'expense', category: 'Food', date: '2026-09-01T00:00:00.000Z' });
  assert.deepEqual(await getLocalTransactions(undefined, undefined, 'coffee'), []);
});

test('a symbol-only query matches nothing rather than everything', async () => {
  // `noteWords('***')` is empty; a missing guard would have made the note test vacuously true.
  assert.deepEqual(await found(['Morning coffee run', 'Bus fare'], '***'), []);
});

test('an empty query is not a filter at all', async () => {
  const rows = await found(['a', 'b'], '   ');
  assert.equal(rows.length, 2, 'whitespace must not be treated as a search');
});
