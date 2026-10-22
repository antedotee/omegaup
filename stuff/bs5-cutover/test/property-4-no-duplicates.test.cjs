// Property 4: Rewrite never introduces duplicates (design, Correctness
// Properties).
//
// For any class list with no duplicate tokens, the rewritten class list has
// no duplicate tokens. The core leaves duplicates already in the input alone,
// so the general form checks only duplicates the rewrite introduces.
//
// **Validates: Requirements 5.3**
'use strict';
const fc = require('fast-check');
const { rewriteClassList } = require('../core.cjs');
const {
  classList,
  rewritableKey,
  nearMiss,
  bs4Key,
} = require('./arbitraries.cjs');

const RUNS = { numRuns: 200 };

const tokens = (s) => s.split(/[ \t\n\r\f]+/).filter(Boolean);
const counts = (xs) => {
  const m = new Map();
  for (const x of xs) m.set(x, (m.get(x) || 0) + 1);
  return m;
};
const duplicates = (xs) =>
  [...counts(xs)].filter(([, n]) => n > 1).map(([t]) => t);

// Both values of the one context flag the core reads (`btn-block`).
const ctx = fc.record({ stackedBlock: fc.boolean() });

describe('Property 4: Rewrite never introduces duplicates', () => {
  test('design examples', () => {
    expect(rewriteClassList('custom-control custom-switch').value).toBe(
      'form-check form-switch',
    );
    expect(rewriteClassList('row form-row').value).toBe('row g-2');
  });

  test('a class list with no duplicates rewrites to one with no duplicates', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          classList({ maxLength: 8 }),
          // Dense in rewritable keys, where produced tokens collide most.
          classList({ maxLength: 8, keys: rewritableKey }),
        ),
        ctx,
        (list, c) => {
          expect(duplicates(tokens(list))).toEqual([]);
          const out = tokens(rewriteClassList(list, c).value);
          expect(duplicates(out)).toEqual([]);
        },
      ),
      RUNS,
    );
  });

  test('duplicates already in the input are the only duplicates in the output', () => {
    // Lists that may repeat tokens: a rewritten token appears at most once,
    // and a token kept from the input appears at most as often as it did.
    const listWithRepeats = fc
      .array(fc.oneof(bs4Key, rewritableKey, nearMiss), {
        minLength: 1,
        maxLength: 10,
      })
      .chain((pool) =>
        fc
          .array(fc.constantFrom(...pool), { minLength: 1, maxLength: 12 })
          .map((xs) => xs.join(' ')),
      );
    fc.assert(
      fc.property(listWithRepeats, ctx, (list, c) => {
        const inCounts = counts(tokens(list));
        const outCounts = counts(tokens(rewriteClassList(list, c).value));
        const excess = [...outCounts]
          .filter(([t, n]) => n > Math.max(1, inCounts.get(t) || 0))
          .map(([t]) => t);
        expect(excess).toEqual([]);
      }),
      RUNS,
    );
  });
});
