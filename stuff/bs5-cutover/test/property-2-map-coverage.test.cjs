// Property 2: Map coverage.
//
// For any class list built from arbitrary non-BS4 tokens plus any Rename_Map
// key (every family and responsive infix) or Removal_Map `replace` key, the
// rewritten list contains none of those keys and contains every token of each
// key's mapped replacement.
//
// Every class context (static `class`, `*-class`, `:class` literal, `.ts`
// class context, HTML-in-string, `.tpl`/`.html` attribute) hands its bare
// class-list string to `rewriteClassList`, so the property is checked there.
// The whitespace shapes below cover what each context passes in: multi-line
// and tab-separated static attributes, and space-only JS string literals.
//
// **Validates: Requirements 5.2, 5.4**
'use strict';

const fc = require('fast-check');
const { rewriteClassList } = require('../core.cjs');
const {
  KEY_FAMILIES,
  nearMiss,
  rewritableKey,
  classList,
  RENAME_MAP,
  REMOVAL_MAP,
} = require('./arbitraries.cjs');

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

// Mapped replacement tokens for a rewritable key.
const targetOf = (key) =>
  has(RENAME_MAP, key) ? RENAME_MAP[key] : REMOVAL_MAP[key].tokens;

const tokensOf = (s) => s.split(/[ \t\n\r\f]+/).filter(Boolean);

function assertCoverage(input, output, keys) {
  const out = tokensOf(output);
  for (const key of keys) {
    expect(out).not.toContain(key);
    for (const t of targetOf(key)) expect(out).toContain(t);
  }
  return true;
}

const RUNS = { numRuns: 300 };

describe('Property 2: Map coverage', () => {
  test('every rewritable key is replaced by its full mapping, among non-BS4 tokens', () => {
    const SEPS = [' ', '  ', '\t', '\n', '\n  '];
    fc.assert(
      fc.property(
        fc.uniqueArray(rewritableKey, { minLength: 1, maxLength: 4 }),
        fc.uniqueArray(nearMiss, { maxLength: 5 }),
        fc.nat(),
        fc.constantFrom('any', 'space'),
        fc.array(fc.nat(), { minLength: 10, maxLength: 10 }),
        (keys, others, seed, ws, gapPicks) => {
          // Interleave keys and non-BS4 tokens in a seed-chosen order.
          const tokens = [...others];
          keys.forEach((k, i) => {
            tokens.splice((seed + i * 7) % (tokens.length + 1), 0, k);
          });
          const seps = ws === 'space' ? SEPS.slice(0, 2) : SEPS;
          const input = tokens.reduce(
            (acc, t, i) =>
              i === 0 ? t : acc + seps[gapPicks[i % 10] % seps.length] + t,
            '',
          );
          const { value } = rewriteClassList(input);
          return assertCoverage(input, value, keys);
        },
      ),
      RUNS,
    );
  });

  test('generated class lists (any whitespace, any context shape) lose every rewritable key', () => {
    const rewritable = new Set([
      ...Object.keys(RENAME_MAP),
      ...Object.keys(REMOVAL_MAP).filter(
        (k) => REMOVAL_MAP[k].kind === 'replace',
      ),
    ]);
    fc.assert(
      fc.property(
        fc.oneof(
          classList({ maxLength: 6, keys: rewritableKey }),
          classList({ maxLength: 6, ws: 'space', keys: rewritableKey }),
        ),
        (input) => {
          const keys = tokensOf(input).filter((t) => rewritable.has(t));
          const { value } = rewriteClassList(input);
          return assertCoverage(input, value, keys);
        },
      ),
      RUNS,
    );
  });

  test('exhaustive: every Rename_Map and Removal_Map replace key is covered', () => {
    // Exhaustive pass: each Rename_Map key (all families and responsive
    // infixes) and each Removal_Map `replace` key, alone and between
    // non-BS4 tokens.
    const keys = [
      ...Object.keys(RENAME_MAP),
      ...Object.keys(REMOVAL_MAP).filter(
        (k) => REMOVAL_MAP[k].kind === 'replace',
      ),
    ];
    expect(Object.keys(KEY_FAMILIES).length).toBeGreaterThan(0);
    for (const key of keys) {
      for (const input of [key, `x-a ${key} x-b`, `\n  x-a\n  ${key}\n`]) {
        assertCoverage(input, rewriteClassList(input).value, [key]);
      }
    }
  });
});
