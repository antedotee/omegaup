// Feature: bootstrap5-css-cutover, Property 11: Integrity detects non-codemod
// changes (design, Correctness Properties).
//
// For any generated valid .vue file x, with y = codemod(x), and any mutation m
// of y that adds or removes a block, changes a block's lang/setup/scoped/module
// attribute, or inserts, deletes, or replaces a character in a <script> or
// <style> block outside a BS4_Class token replacement, checkPair(x, m(y))
// fails with the file path and the affected block type.
//
// Mutations are built on the codemod output, so they sit next to real
// replacements (the hard case for the checker). Two classes of edit are
// excluded by construction, because they are map-explained, not corruption:
//   - a character edit whose new words include a BS4_Class or a BS5
//     replacement token (`ml-2` -> `ms-2` in a comment, or `ms-2` -> `ml-2`,
//     which reverts the codemod);
//   - whitespace, `.`, and quote edits in a block the codemod changed. The
//     design lets these separators travel with a replacement (multi-token
//     joins, dropped or deduped keys, quoted object keys). They are generated
//     only in blocks the codemod left unchanged.
// The filters read maps.cjs only; they never call integrity-core.
//
// A duplicated <template> or <script> is rejected by @vue/compiler-sfc, so
// the expected failure is a parse error that names that element.
//
// **Validates: Requirements 6.3, 6.4**
'use strict';
const fc = require('fast-check');
const { parse } = require('@vue/compiler-sfc');
const { checkPair } = require('../integrity-core.cjs');
const { processText } = require('../codemod-core.cjs');
const { RENAME_MAP, REMOVAL_MAP, BS4_KEYS } = require('../maps.cjs');
const { sfc } = require('./arbitraries.cjs');

const P = 'frontend/www/js/omegaup/components/Generated.vue';
const RUNS = { numRuns: 300 };

// Every BS5 token a BS4 key may become.
const BS5_TOKENS = new Set([
  ...Object.values(RENAME_MAP).flat(),
  ...Object.values(REMOVAL_MAP).flatMap((e) => e.tokens || []),
]);
const isMapWord = (w) => BS4_KEYS.has(w) || BS5_TOKENS.has(w);

const WORD_CH = /[A-Za-z0-9_-]/;
const WORDS = /[A-Za-z0-9_-]+/g;
const SEPARATOR = /^[\s.'"]$/;

// Characters inserted anywhere (never a separator the design tolerates).
const SAFE_CHARS = ';#{}()[]@!%&*+=,:<>?/|~^$`\\aZq7_-é';
// Extra characters allowed only in blocks the codemod left unchanged.
const SEP_CHARS = ' .\'"\n\t';

// Words the edit s[i, j) -> r adds, over the word runs touching the edit.
function addedWords(s, i, j, r) {
  let left = i;
  while (left > 0 && WORD_CH.test(s[left - 1])) left--;
  let right = j;
  while (right < s.length && WORD_CH.test(s[right])) right++;
  const before = s.slice(left, right).match(WORDS) || [];
  const after = (s.slice(left, i) + r + s.slice(j, right)).match(WORDS) || [];
  const pool = new Map();
  for (const w of before) pool.set(w, (pool.get(w) || 0) + 1);
  return after.filter((w) => {
    const n = pool.get(w) || 0;
    if (n) pool.set(w, n - 1);
    return n === 0;
  });
}

// ---------------------------------------------------------------------------
// Mutations. Each returns { text, expect: (failure) => boolean } or null when
// the mutation does not apply (filtered with fc.pre).

const blockRe = {
  template: /<template>\n[\s\S]*?\n<\/template>\n/,
  script: /<script lang="ts">\n[\s\S]*?\n<\/script>\n/,
  style: /<style lang="scss" scoped>\n[\s\S]*?\n<\/style>\n/,
};
const blockText = (text, b) => text.match(blockRe[b])[0];

const structureOf = (block) => (f) =>
  f.kind === 'structure' && f.block === block;
const parseErrorNaming = (block) => (f) =>
  f.kind === 'parse-error' && f.detail.includes(`<${block}>`);
const contentOf = (block) => (f) => f.kind === 'content' && f.block === block;
const anyOf =
  (...ps) =>
  (f) =>
    ps.some((p) => p(f));

const dropBlock = fc
  .constantFrom('template', 'script', 'style')
  .map((block) => ({
    name: `drop ${block}`,
    apply: (y) => ({
      text: y.replace(blockRe[block], ''),
      expect: structureOf(block),
    }),
  }));

const duplicateBlock = fc
  .constantFrom('template', 'script', 'style')
  .map((block) => ({
    name: `duplicate ${block}`,
    apply: (y) => ({
      text: `${y}\n${blockText(y, block)}`,
      expect:
        block === 'style' ? structureOf('style') : parseErrorNaming(block),
    }),
  }));

const addCustomBlock = fc.constantFrom('docs', 'i18n').map((type) => ({
  name: `add <${type}>`,
  apply: (y) => ({
    text: `${y}\n<${type}>\n{}\n</${type}>\n`,
    expect: structureOf(type),
  }),
}));

const SCRIPT_TAGS = [
  '<script>',
  '<script lang="js">',
  '<script lang="tsx">',
  '<script lang="TS">',
  '<script lang="ts" setup>',
];
const STYLE_TAGS = [
  '<style lang="scss">',
  '<style scoped>',
  '<style lang="css" scoped>',
  '<style lang="sass" scoped>',
  '<style lang="scss" scoped module>',
  '<style lang="scss" scoped module="classes">',
  '<style lang="scss" scoped="false">',
];
const changeAttr = fc.oneof(
  fc.constantFrom(...SCRIPT_TAGS).map((tag) => ({
    name: `script tag -> ${tag}`,
    apply: (y) => ({
      text: y.replace('<script lang="ts">', tag),
      expect: anyOf(structureOf('script'), structureOf('scriptSetup')),
    }),
  })),
  fc.constantFrom(...STYLE_TAGS).map((tag) => ({
    name: `style tag -> ${tag}`,
    apply: (y) => ({
      text: y.replace('<style lang="scss" scoped>', tag),
      expect: structureOf('style'),
    }),
  })),
);

// Content offsets [start, end) of a block in text, from an independent parse.
function contentRange(text, block) {
  const { descriptor: d } = parse(text, { filename: P, sourceMap: false });
  const b = block === 'script' ? d.script : d.styles[0];
  return [b.loc.start.offset, b.loc.end.offset];
}

const characterEdit = fc
  .record({
    block: fc.constantFrom('script', 'style'),
    op: fc.constantFrom('insert', 'delete', 'replace'),
    at: fc.nat(),
    ch: fc.constantFrom(...SAFE_CHARS),
    sep: fc.constantFrom(...SEP_CHARS),
    useSep: fc.boolean(),
  })
  .map((m) => ({
    name: `${m.op} in ${m.block}`,
    apply: (y, x) => {
      const [s, e] = contentRange(y, m.block);
      const codemodChanged =
        y.slice(s, e) !== x.slice(...contentRange(x, m.block));
      const r =
        m.op === 'delete' ? '' : m.useSep && !codemodChanged ? m.sep : m.ch;
      const len = e - s;
      let i;
      let j;
      if (m.op === 'insert') {
        i = j = s + (m.at % (len + 1));
      } else {
        if (len === 0) return null;
        i = s + (m.at % len);
        j = i + 1;
        if (codemodChanged && SEPARATOR.test(y[i])) return null;
        if (y[i] === r) return null;
      }
      if (addedWords(y, i, j, r).some(isMapWord)) return null;
      return {
        text: y.slice(0, i) + r + y.slice(j),
        expect: contentOf(m.block),
      };
    },
  }));

// PR2 ProblemMarkdown.vue shape: the style block's content (or the whole
// style element) is pasted into the script.
const pr2Corruption = fc
  .record({ whole: fc.boolean(), atEnd: fc.boolean() })
  .map(({ whole, atEnd }) => ({
    name: `PR2 style-into-script (${whole ? 'element' : 'content'}, ${
      atEnd ? 'end' : 'start'
    })`,
    apply: (y) => {
      const [ss, se] = contentRange(y, 'style');
      const paste = whole ? blockText(y, 'style') : y.slice(ss, se);
      const [cs, ce] = contentRange(y, 'script');
      const at = atEnd ? ce : cs;
      return {
        text: y.slice(0, at) + paste + y.slice(at),
        // A pasted `</style>` inside <script> is still script content.
        expect: contentOf('script'),
      };
    },
  }));

const mutation = fc.oneof(
  { weight: 2, arbitrary: dropBlock },
  { weight: 2, arbitrary: duplicateBlock },
  { weight: 1, arbitrary: addCustomBlock },
  { weight: 3, arbitrary: changeAttr },
  { weight: 8, arbitrary: characterEdit },
  { weight: 2, arbitrary: pr2Corruption },
);

// ---------------------------------------------------------------------------

describe('Property 11: integrity detects non-codemod changes', () => {
  test('checkPair reports a failure for the mutated block', () => {
    fc.assert(
      fc.property(sfc, mutation, (x, m) => {
        const y = processText(P, x).output;
        // The unmutated codemod output must pass, or the property is vacuous.
        fc.pre(checkPair(P, x, y).length === 0);
        const mutated = m.apply(y, x);
        fc.pre(mutated !== null && mutated.text !== y);
        const failures = checkPair(P, x, mutated.text);
        if (!failures.some((f) => f.path === P && mutated.expect(f))) {
          throw new Error(
            `${m.name}: expected failure not reported; got ${JSON.stringify(
              failures,
            )}`,
          );
        }
      }),
      RUNS,
    );
  });

  test('a map-explained edit is not a mutation (filter sanity)', () => {
    // `ml-2` -> `ms-2` adds a BS5 token; the filter rejects it.
    expect(addedWords('a ml-2 b', 3, 4, 's').some(isMapWord)).toBe(true);
    // `ms-2` -> `ms;2` adds no map word; it is a real mutation.
    expect(addedWords('a ms-2 b', 4, 5, ';').some(isMapWord)).toBe(false);
  });
});
