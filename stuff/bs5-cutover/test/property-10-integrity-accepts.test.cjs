// Feature: bootstrap5-css-cutover, Property 10: Integrity accepts codemod output
//
// For any generated valid `.vue` file x, integrity(x, codemod(x)) passes with
// zero failures. Backs gate 12.7.
//
// **Validates: Requirements 6.1, 6.4, 6.5, 12.7**
'use strict';
const fc = require('fast-check');
const { processText } = require('../codemod-core.cjs');
const { checkPair } = require('../integrity-core.cjs');
const { sfc } = require('./arbitraries.cjs');

const PATH = 'frontend/www/js/omegaup/components/X.vue';

describe('Property 10: integrity accepts codemod output', () => {
  test('checkPair(x, codemod(x)) returns no failures', () => {
    fc.assert(
      fc.property(sfc, (x) => {
        const result = processText(PATH, x);
        expect(result.error).toBeUndefined();
        expect(checkPair(PATH, x, result.output)).toEqual([]);
      }),
      { numRuns: 200 },
    );
  });
});
