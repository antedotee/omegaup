// Property 3: Whole-token preservation (design.md, Correctness Properties).
//
// For any class list or selector, every token that is not a BS4_Class key
// keeps its value and relative order in the output. This includes tokens that
// contain a key as a proper substring (close-button, form-group-title,
// badge-layer, custom-badge, font-weight-medium), panel-* tokens, and Font
// Awesome fa-* tokens.
//
// **Validates: Requirements 5.6, 10.3, 10.5**
'use strict';
const fc = require('fast-check');
const selectorParser = require('postcss-selector-parser');
const { rewriteClassList, rewriteSelector } = require('../core.cjs');
const { BS4_KEYS } = require('../maps.cjs');
const {
  MEASURED_NEAR_MISSES,
  RENAME_MAP,
  REMOVAL_MAP,
  bs4Key,
  rewritableKey,
  nearMiss,
  classList,
  selector,
} = require('./arbitraries.cjs');

const RUNS = { numRuns: 200 };

// Every token the maps can produce. A produced token may legitimately equal a
// non-key input token (e.g. a random `ms-2` near miss next to `ml-2` in
// another compound), so extra occurrences of these are allowed.
const PRODUCED = new Set([
  ...Object.values(RENAME_MAP).flat(),
  ...Object.values(REMOVAL_MAP).flatMap((e) => e.tokens || []),
]);

const classTokens = (s) => s.split(/[ \t\n\r\f]+/).filter(Boolean);

// Class names of a selector in source order (parser-based, so pseudo args
// like :not(.active) are included).
const selectorClasses = (s) => {
  const out = [];
  selectorParser((root) =>
    root.walkClasses((n) => out.push(n.value)),
  ).processSync(s);
  return out;
};

// Asserts the non-key tokens of `input` appear in `output` with the same
// values and relative order, and that any extra occurrence of one of those
// values in `output` is a map-produced token.
function assertPreserved(inputTokens, outputTokens) {
  const kept = inputTokens.filter((t) => !BS4_KEYS.has(t));
  const keptSet = new Set(kept);
  const candidates = outputTokens.filter((t) => keptSet.has(t));
  // Greedy subsequence match of `kept` inside `candidates`.
  let j = 0;
  const extras = [];
  for (const t of candidates) {
    if (j < kept.length && t === kept[j]) j++;
    else extras.push(t);
  }
  expect({ matched: kept.slice(0, j) }).toEqual({ matched: kept });
  expect(extras.filter((t) => !PRODUCED.has(t))).toEqual([]);
}

// Lists that always contain at least one panel-* and one fa-* token among
// rewritable keys and other near misses.
const PANEL = MEASURED_NEAR_MISSES.filter((t) => t.startsWith('panel-'));
const FA = MEASURED_NEAR_MISSES.filter((t) => t.startsWith('fa-'));
const forcedList = fc
  .tuple(
    fc.constantFrom(...PANEL),
    fc.constantFrom(...FA),
    fc.uniqueArray(fc.oneof(rewritableKey, bs4Key, nearMiss), {
      maxLength: 5,
    }),
  )
  .chain(([p, f, rest]) => {
    const uniq = [...new Set([p, f, ...rest])];
    return fc.shuffledSubarray(uniq, {
      minLength: uniq.length,
      maxLength: uniq.length,
    });
  })
  .map((ts) => ts.join(' '));

describe('Property 3: whole-token preservation', () => {
  test('class lists keep non-key tokens in value and order', () => {
    fc.assert(
      fc.property(
        classList({ maxLength: 8 }),
        fc.boolean(),
        (list, stacked) => {
          const { value } = rewriteClassList(list, { stacked });
          assertPreserved(classTokens(list), classTokens(value));
        },
      ),
      RUNS,
    );
  });

  test('class lists with panel-* and fa-* tokens keep them untouched', () => {
    fc.assert(
      fc.property(forcedList, (list) => {
        const { value } = rewriteClassList(list);
        const out = classTokens(value);
        for (const t of classTokens(list).filter((x) =>
          /^(panel|fa)-/.test(x),
        )) {
          expect(out).toContain(t);
        }
        assertPreserved(classTokens(list), out);
      }),
      RUNS,
    );
  });

  test('selectors keep non-key class tokens in value and order', () => {
    fc.assert(
      fc.property(selector, (sel) => {
        const { value } = rewriteSelector(sel);
        assertPreserved(selectorClasses(sel), selectorClasses(value));
      }),
      RUNS,
    );
  });

  test('requirement examples', () => {
    expect(rewriteClassList('close-button ml-2 form-group-title').value).toBe(
      'close-button ms-2 form-group-title',
    );
    expect(
      rewriteClassList('badge-layer custom-badge font-weight-medium').value,
    ).toBe('badge-layer custom-badge font-weight-medium');
    expect(rewriteClassList('panel-heading fa fa-close').value).toBe(
      'panel-heading fa fa-close',
    );
    expect(rewriteSelector('.panel-body .fa-times.ml-2').value).toBe(
      '.panel-body .fa-times.ms-2',
    );
  });
});
