// Category presets — named packs, so setting up for a wedding or a trip is one tap rather than
// typing twelve categories in one at a time.
//
// Both halves are pinned here because they are two implementations of one behaviour: signed in,
// the server holds the catalogue and does the merge; as a guest, `localCategoryService` does it
// against the copy bundled in `constants/categoryPresets.ts`. The merge rule — skip anything the
// user already has, matched on name case-insensitively — has to agree, or the same tap gives a
// different result before and after signing in.
//
// The keys must agree too. A pack the app offers and the server does not know answers 404, so the
// last test walks the bundled catalogue and checks it against the backend's.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { __reset as resetStorage } from './stubs/asyncStorage.mjs';
const { __resetLocalStores } = await import('../src/services/local/jsonStore.ts');
import { __reset as resetSecure } from './stubs/secureStore.mjs';
import { __reset as resetAxios, __handle, __calls } from './stubs/axios.mjs';

const dataService = await import('../src/services/dataService.ts');
const localCat    = await import('../src/services/local/localCategoryService.ts');
const { CATEGORY_PRESETS } = await import('../constants/categoryPresets.ts');
const outbox = await import('../src/sync/outbox.ts');

const HERE = path.dirname(fileURLToPath(import.meta.url));

function setup(guest) {
  resetStorage();
  __resetLocalStores();
  resetSecure({ token: 'tok', refreshToken: 'ref' });
  resetAxios();
  dataService.setMode(guest);
}

// --- guest ------------------------------------------------------------------------------------

test('a guest applies a preset locally and never reaches the network', async () => {
  setup(true);

  const { added } = await dataService.applyCategoryPreset('travel');
  const { categories } = await localCat.getLocalCategories();

  assert.ok(added > 0);
  assert.ok(categories.some(c => c.name === 'Flights'), 'it was actually persisted');
  assert.equal(__calls().length, 0, 'a guest has no server to ask');
});

test('applying the same preset twice adds nothing the second time', async () => {
  setup(true);

  const first  = await dataService.applyCategoryPreset('wedding');
  const second = await dataService.applyCategoryPreset('wedding');

  assert.ok(first.added > 0);
  assert.equal(second.added, 0);
  assert.equal(second.categories.length, first.categories.length);
});

test('a preset does not duplicate a category the user already has', async () => {
  setup(true);

  // 'Food' is in the guest defaults; the household pack carries Groceries but not Food.
  await dataService.applyCategoryPreset('household');
  const { categories } = await localCat.getLocalCategories();

  const food = categories.filter(c => c.name.toLowerCase() === 'food');
  assert.equal(food.length, 1);
});

test('a category typed by hand blocks the preset row of the same name', async () => {
  setup(true);

  await dataService.addCategory('flights', 'airplane-outline', 'expense');
  const { added } = await dataService.applyCategoryPreset('travel');
  const { categories } = await localCat.getLocalCategories();

  assert.equal(categories.filter(c => c.name.toLowerCase() === 'flights').length, 1,
    'matched case-insensitively, the way the server does it');
  assert.equal(added, CATEGORY_PRESETS.find(p => p.key === 'travel').count - 1);
});

test('a duplicate category name is refused, as it is on the server', async () => {
  setup(true);

  await assert.rejects(() => dataService.addCategory('  FOOD ', 'grid-outline', 'expense'));
});

test('the default list is not mutated by what a user adds', async () => {
  // load() used to hand back DEFAULT_CATEGORIES itself, so a push polluted the module's defaults
  // for the life of the process — and clearing local data then reseeded those "defaults".
  setup(true);
  await dataService.applyCategoryPreset('travel');

  resetStorage();

  __resetLocalStores();
  const { categories } = await localCat.getLocalCategories();

  assert.ok(!categories.some(c => c.name === 'Flights'), 'a fresh device starts from the defaults');
});

test('an unknown preset key rejects rather than silently doing nothing', async () => {
  setup(true);

  await assert.rejects(() => dataService.applyCategoryPreset('nonsense'));
});

test('a guest gets the catalogue from the bundled copy', async () => {
  setup(true);

  const presets = await dataService.getCategoryPresets();

  assert.equal(presets.length, CATEGORY_PRESETS.length);
  assert.ok(presets.every(p => p.key && p.name && p.count > 0));
  assert.equal(__calls().length, 0);
});

// --- signed in --------------------------------------------------------------------------------

test('a signed-in user applies the preset on the device and the outbox carries it (W3-18)', async () => {
  setup(false);
  const { added } = await dataService.applyCategoryPreset('travel');
  const { categories } = await localCat.getLocalCategories();
  assert.ok(added > 0);
  assert.ok(categories.some(c => c.name === 'Flights'), 'written to the device like any write');
  assert.equal(__calls().length, 0, 'the sync engine, not dataService, talks to the server');
  const queued = await outbox.peek(100);
  assert.equal(queued.filter(e => e.collection === 'categories' && e.op === 'create').length, added);
});

test('the catalogue is the bundled one in both modes', async () => {
  setup(false);
  const presets = await dataService.getCategoryPresets();
  assert.equal(presets.length, CATEGORY_PRESETS.length);
  assert.equal(__calls().length, 0);
});

// --- the two catalogues -------------------------------------------------------------------------

test('every bundled preset key exists on the backend', () => {
  // A key the picker offers and the server does not know is a 404 the moment a signed-in user taps
  // it, and nothing else would catch the drift.
  const backend = readFileSync(
    path.join(HERE, '..', '..', 'expense-tracker-backend', 'utils', 'categoryPresets.js'), 'utf8');

  for (const preset of CATEGORY_PRESETS) {
    assert.match(backend, new RegExp(`^\\s{2}${preset.key}:`, 'm'),
      `backend utils/categoryPresets.js has no "${preset.key}" pack`);
  }
});
