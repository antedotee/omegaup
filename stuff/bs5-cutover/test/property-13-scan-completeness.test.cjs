// Feature: bootstrap5-css-cutover, Property 13: Scan completeness
//
// For any decoy-only text with n instances inserted at random lines,
// scanText returns exactly n matches, each with the correct line, token, and
// category. Instances come from the five categories: BS4_Class in a class
// context, BS4_Data_Attribute (static, `:`, or `v-bind:`), a
// bootstrap/dist/css/* import or require, a jQuery plugin call on a
// $()/jQuery() receiver (including parenthesized and `as`-cast receivers),
// and a bootstrap-4.5.0 reference.
//
// **Validates: Requirements 7.1, 7.4, 2.7, 3.3, 4.1**
'use strict';
const fc = require('fast-check');
const { scanText } = require('../scan-core.cjs');
const { SCAN_CATEGORIES, scanCase } = require('./arbitraries.cjs');

const RUNS = { numRuns: 200 };
const HOSTS = ['cypress-ts', 'vue'];

const project = (matches) =>
  matches
    .map(({ line, token, category }) => ({ line, token, category }))
    .sort(
      (a, b) =>
        a.line - b.line ||
        a.category.localeCompare(b.category) ||
        a.token.localeCompare(b.token),
    );

// Runs the property and returns how many instances were planted in total, so
// each test can also assert it was not vacuous (all-empty cases).
const runComplete = (arb) => {
  let planted = 0;
  fc.assert(
    fc.property(arb, ({ path, text, expected }) => {
      planted += expected.length;
      const matches = scanText(path, text);
      for (const m of matches) expect(m.path).toBe(path);
      expect(project(matches)).toEqual(project(expected));
    }),
    RUNS,
  );
  return planted;
};

describe('Property 13: scan completeness', () => {
  for (const host of HOSTS) {
    test(`${host}: every planted instance is reported, nothing else`, () => {
      expect(runComplete(scanCase(host))).toBeGreaterThan(RUNS.numRuns);
    });

    // One run per category so a rare category cannot hide behind the mix.
    for (const category of SCAN_CATEGORIES) {
      test(`${host}: ${category} instances are reported with line and token`, () => {
        const planted = runComplete(
          scanCase(host, { category, maxInstances: 3 }),
        );
        expect(planted).toBeGreaterThan(RUNS.numRuns / 2);
      });
    }
  }
});
