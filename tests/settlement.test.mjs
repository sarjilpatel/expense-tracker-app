// The settlement engine's docblock claims its balances always sum to exactly zero and its shares
// always sum to exactly the expense. Nothing checked either claim until now, which is a poor
// arrangement for the one module in the app that decides who owes whom.
//
// W2-28 added `sharesMinor` for unevenly divided expenses, so these cover both paths.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { toMinorUnits, fromMinorUnits, splitEvenly, computeBalances, settleBalances, computeSettlement } =
  await import('../src/utils/settlement.ts');

/** Deterministic PRNG — a failing case has to be reproducible to be worth anything. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const members = (n) => Array.from({ length: n }, (_, i) => ({ id: `m${i}`, name: `Member ${i}` }));
const sum     = (xs) => xs.reduce((a, b) => a + b, 0);

test('splitEvenly divides exactly, with at most one minor unit between shares', () => {
  const rand = rng(1);
  for (let i = 0; i < 2000; i++) {
    const amount = Math.floor(rand() * 1_000_000);
    const n      = 1 + Math.floor(rand() * 12);
    const shares = splitEvenly(amount, n);

    assert.equal(shares.length, n);
    assert.equal(sum(shares), amount, `${amount} over ${n} did not sum back`);
    assert.ok(Math.max(...shares) - Math.min(...shares) <= 1, `uneven split of ${amount} over ${n}`);
    assert.ok(shares.every((s) => s >= 0));
  }
});

test('splitEvenly gives the remainder to the earliest shares', () => {
  assert.deepEqual(splitEvenly(1000, 3), [334, 333, 333]);
  assert.deepEqual(splitEvenly(10, 4), [3, 3, 2, 2]);
  assert.deepEqual(splitEvenly(0, 3), [0, 0, 0]);
});

test('minor-unit conversion survives the classic float cases', () => {
  assert.equal(toMinorUnits(0.1 + 0.2), 30);
  assert.equal(toMinorUnits(1234.565), 123457);
  assert.equal(toMinorUnits(-5), 0);
  assert.equal(toMinorUnits(Number.NaN), 0);
  assert.equal(fromMinorUnits(123457), 1234.57);
});

test('balances sum to exactly zero for evenly divided expenses', () => {
  const rand = rng(7);
  for (let trip = 0; trip < 500; trip++) {
    const ms = members(2 + Math.floor(rand() * 8));
    const expenses = Array.from({ length: 1 + Math.floor(rand() * 15) }, () => {
      const participants = ms.filter(() => rand() > 0.35).map((m) => m.id);
      return {
        amountMinor: 1 + Math.floor(rand() * 500_000),
        paidById: ms[Math.floor(rand() * ms.length)].id,
        participantIds: participants.length ? participants : [ms[0].id],
      };
    });
    assert.equal(sum(computeBalances(ms, expenses).map((b) => b.netMinor)), 0);
  }
});

test('an even split attributes the exact amount', () => {
  const ms = members(3);
  const [a, b, c] = computeBalances(ms, [
    { amountMinor: 1000, paidById: 'm0', participantIds: ['m0', 'm1', 'm2'] },
  ]);
  assert.equal(a.paidMinor, 1000);
  assert.equal(a.shareMinor, 334);
  assert.equal(a.netMinor, 666);
  assert.equal(b.netMinor, -333);
  assert.equal(c.netMinor, -333);
  assert.equal(a.netMinor + b.netMinor + c.netMinor, 0);
});

test('sharesMinor overrides even division', () => {
  const ms = members(3);
  const balances = computeBalances(ms, [
    { amountMinor: 1000, paidById: 'm0', participantIds: [], sharesMinor: { m0: 100, m1: 400, m2: 500 } },
  ]);
  assert.deepEqual(balances.map((b) => b.shareMinor), [100, 400, 500]);
  assert.equal(balances[0].paidMinor, 1000);
  assert.equal(balances[0].netMinor, 900);
  assert.equal(sum(balances.map((b) => b.netMinor)), 0);
});

// The invariant that made sharesMinor the single source of truth: a declared total that disagrees
// with its own shares must still not be able to produce non-zero-sum balances.
test('balances still sum to zero when the declared total contradicts the shares', () => {
  const ms = members(3);
  for (const declared of [0, 1, 999_999, -4, Number.NaN]) {
    const balances = computeBalances(ms, [
      { amountMinor: declared, paidById: 'm0', participantIds: ['m1'], sharesMinor: { m0: 100, m1: 400, m2: 500 } },
    ]);
    assert.equal(sum(balances.map((b) => b.netMinor)), 0, `declared ${declared}`);
    assert.equal(balances[0].paidMinor, 1000, `declared ${declared} should credit the share sum`);
  }
});

test('unattributable expenses are skipped rather than guessed at', () => {
  const ms = members(2);
  const zero = (expenses) => assert.deepEqual(computeBalances(ms, expenses).map((b) => b.netMinor), [0, 0]);
  zero([{ amountMinor: 500, paidById: 'ghost', participantIds: ['m0', 'm1'] }]);
  zero([{ amountMinor: 500, paidById: 'm0', participantIds: [] }]);
  zero([{ amountMinor: 0, paidById: 'm0', participantIds: ['m0', 'm1'] }]);
  zero([{ amountMinor: -500, paidById: 'm0', participantIds: ['m0', 'm1'] }]);
  zero([{ amountMinor: 500, paidById: 'm0', participantIds: [], sharesMinor: { ghost: 500 } }]);
});

test('duplicate participants are counted once', () => {
  const ms = members(2);
  const balances = computeBalances(ms, [
    { amountMinor: 1000, paidById: 'm0', participantIds: ['m1', 'm1', 'm1'] },
  ]);
  assert.equal(balances[1].shareMinor, 1000);
});

test('settlement clears every balance in at most N-1 transfers', () => {
  const rand = rng(42);
  for (let trip = 0; trip < 500; trip++) {
    const ms = members(2 + Math.floor(rand() * 8));
    const expenses = Array.from({ length: 1 + Math.floor(rand() * 12) }, () => ({
      amountMinor: 1 + Math.floor(rand() * 200_000),
      paidById: ms[Math.floor(rand() * ms.length)].id,
      participantIds: ms.filter(() => rand() > 0.3).map((m) => m.id),
    }));

    const { balances, transfers } = computeSettlement(ms, expenses);
    assert.ok(transfers.length <= ms.length - 1, `${transfers.length} transfers for ${ms.length} members`);
    assert.ok(transfers.every((t) => t.amountMinor > 0), 'emitted a zero-amount transfer');

    // Applying every transfer must leave nobody owing anything.
    const net = new Map(balances.map((b) => [b.id, b.netMinor]));
    for (const t of transfers) {
      net.set(t.fromId, net.get(t.fromId) + t.amountMinor);
      net.set(t.toId,   net.get(t.toId)   - t.amountMinor);
    }
    assert.ok([...net.values()].every((v) => v === 0), 'a balance survived settlement');
  }
});

test('settlement is deterministic for tied balances', () => {
  const balances = [
    { id: 'b', name: 'B', paidMinor: 0, shareMinor: 0, netMinor: -500 },
    { id: 'a', name: 'A', paidMinor: 0, shareMinor: 0, netMinor: -500 },
    { id: 'd', name: 'D', paidMinor: 0, shareMinor: 0, netMinor: 500 },
    { id: 'c', name: 'C', paidMinor: 0, shareMinor: 0, netMinor: 500 },
  ];
  const once  = settleBalances(balances);
  const twice = settleBalances(balances);
  assert.deepEqual(once, twice);
  assert.deepEqual(once.map((t) => `${t.fromId}->${t.toId}`), ['a->c', 'b->d']);
});

test('settleBalances does not mutate the balances it is given', () => {
  const balances = computeBalances(members(3), [
    { amountMinor: 900, paidById: 'm0', participantIds: ['m0', 'm1', 'm2'] },
  ]);
  const before = structuredClone(balances);
  settleBalances(balances);
  assert.deepEqual(balances, before);
});
