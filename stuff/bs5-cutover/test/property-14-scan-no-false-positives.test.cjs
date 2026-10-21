// Property 14: Scan has no false positives (design, Correctness Properties).
//
// For any text built only from decoys, scanText returns no matches. Decoys
// are CSS property names, `panel-*` classes, identifiers containing BS4 names
// (`closeModal`, `channel.close()`), omegaUp `data-*` attributes that begin
// with a BS4 attribute name (`data-toggle-layout-sidebar`,
// `data-content-tab`), event-name literals (`$emit('close')`), plain jQuery
// calls, and the near-miss classes from Property 3.
//
// Second half: BS5-only text (the codemod output of a generated in-scope
// file for which the codemod reported no unresolved entries) has zero
// `bs4-class` matches.
//
// **Validates: Requirements 7.2, 9.3**
'use strict';
const fc = require('fast-check');
const { scanText } = require('../scan-core.cjs');
const { processText } = require('../codemod-core.cjs');
const {
  SCAN_HOSTS,
  decoyText,
  nearMiss,
  sfc,
  scss,
  tsFile,
  tplFile,
} = require('./arbitraries.cjs');

const RUNS = { numRuns: 200 };

// Formats matches for a readable counterexample.
const show = (ms) => ms.map((m) => `${m.line}:${m.category}:${m.token}`);

describe('Property 14: decoy-only text yields zero matches', () => {
  for (const host of Object.keys(SCAN_HOSTS)) {
    test(`${host} decoys (${SCAN_HOSTS[host].path})`, () => {
      fc.assert(
        fc.property(decoyText(host), (text) => {
          expect(show(scanText(SCAN_HOSTS[host].path, text))).toEqual([]);
        }),
        RUNS,
      );
    });
  }

  // CSS property names (border-left, text-align, …) and near-miss selectors
  // in a stylesheet. Property names contain no BS4 class selector.
  const CSS_DECLS = [
    'border-left: 1px solid #ccc;',
    'border-right: 0;',
    'text-align: right;',
    'margin-left: 0.5rem;',
    'padding-right: 1rem;',
    'float: left;',
    'font-weight: bold;',
  ];
  const cssDecoy = fc
    .array(
      fc.tuple(
        nearMiss,
        fc.array(fc.constantFrom(...CSS_DECLS), { minLength: 1, maxLength: 3 }),
      ),
      { minLength: 1, maxLength: 5 },
    )
    .map(
      (rules) =>
        rules
          .map(([cls, decls]) => `.${cls} {\n  ${decls.join('\n  ')}\n}`)
          .join('\n\n') + '\n',
    );

  test('scss decoys (frontend/www/sass/x.scss)', () => {
    fc.assert(
      fc.property(cssDecoy, (text) => {
        expect(show(scanText('frontend/www/sass/x.scss', text))).toEqual([]);
      }),
      RUNS,
    );
  });
});

describe('Property 14: BS5-only codemod output yields zero bs4-class matches', () => {
  const cases = [
    ['.vue', 'frontend/www/js/omegaup/components/X.vue', sfc],
    ['.scss', 'frontend/www/sass/x.scss', scss],
    ['.ts', 'frontend/www/js/omegaup/x.ts', tsFile],
    ['.tpl', 'frontend/templates/x.tpl', tplFile],
  ];
  for (const [ext, path, arb] of cases) {
    test(`${ext}: scan(codemod(x)) has no bs4-class match when nothing is unresolved`, () => {
      fc.assert(
        fc.property(arb, (text) => {
          const res = processText(path, text);
          expect(res.error).toBeUndefined();
          fc.pre(res.unresolved.length === 0);
          const bs4 = scanText(path, res.output).filter(
            (m) => m.category === 'bs4-class' || m.category === 'parse-error',
          );
          expect(show(bs4)).toEqual([]);
        }),
        { ...RUNS, maxSkipsPerRun: 1000 },
      );
    });
  }
});
