// Sanity tests for maps.cjs and the generators in arbitraries.cjs.
'use strict';
const fc = require('fast-check');
const ts = require('typescript');
const { parse: parseSfc } = require('@vue/compiler-sfc');
const postcssScss = require('postcss-scss');
const selectorParser = require('postcss-selector-parser');
const maps = require('../maps.cjs');
const arb = require('./arbitraries.cjs');

const { RENAME_MAP, REMOVAL_MAP, BS4_KEYS } = maps;

describe('maps.cjs', () => {
  test('every replacement token is a non-BS4 class', () => {
    for (const [key, tokens] of Object.entries(RENAME_MAP)) {
      for (const t of tokens) {
        expect([key, t, BS4_KEYS.has(t)]).toEqual([key, t, false]);
      }
    }
    for (const [key, entry] of Object.entries(REMOVAL_MAP)) {
      for (const t of entry.tokens || []) {
        expect([key, t, BS4_KEYS.has(t)]).toEqual([key, t, false]);
      }
    }
  });

  test('Rename_Map and Removal_Map keys are disjoint', () => {
    const overlap = Object.keys(REMOVAL_MAP).filter((k) => k in RENAME_MAP);
    expect(overlap).toEqual([]);
    expect(BS4_KEYS.size).toBe(
      Object.keys(RENAME_MAP).length + Object.keys(REMOVAL_MAP).length,
    );
  });

  test('families cover every responsive infix', () => {
    expect(RENAME_MAP['ml-sm-auto']).toEqual(['ms-sm-auto']);
    expect(RENAME_MAP['mr-xl-n3']).toEqual(['me-xl-n3']);
    expect(RENAME_MAP['pr-lg-5']).toEqual(['pe-lg-5']);
    expect(RENAME_MAP['pl-0']).toEqual(['ps-0']);
    expect(RENAME_MAP['text-md-right']).toEqual(['text-md-end']);
    expect(RENAME_MAP['float-left']).toEqual(['float-start']);
    expect(RENAME_MAP['dropdown-menu-lg-right']).toEqual([
      'dropdown-menu-lg-end',
    ]);
    // auto and negative steps are margin-only.
    expect(RENAME_MAP['pl-auto']).toBeUndefined();
    expect(RENAME_MAP['pr-n1']).toBeUndefined();
    // BS4 has no xxl breakpoint.
    expect(RENAME_MAP['ml-xxl-1']).toBeUndefined();
    const spacing = Object.keys(maps.RENAME_FAMILIES['spacing-side']);
    expect(spacing).toHaveLength(2 * 5 * 12 + 2 * 5 * 6);
  });

  test('accepted extensions and special entries', () => {
    expect(RENAME_MAP['badge-warning']).toEqual(['bg-warning', 'text-dark']);
    expect(RENAME_MAP['badge-light']).toEqual(['bg-light', 'text-dark']);
    expect(RENAME_MAP['custom-select-sm']).toEqual(['form-select-sm']);
    expect(RENAME_MAP['sr-only-focusable']).toEqual([
      'visually-hidden-focusable',
    ]);
    expect(RENAME_MAP['custom-switch']).toEqual(['form-check', 'form-switch']);
    expect(RENAME_MAP['custom-control-label']).toEqual(['form-check-label']);
    expect(RENAME_MAP['embed-responsive-16by9']).toEqual(['ratio-16x9']);
    expect(RENAME_MAP['embed-responsive-item']).toEqual([]);
    expect(RENAME_MAP.close).toEqual(['btn-close']);
    expect(REMOVAL_MAP['form-row']).toEqual({
      kind: 'replace',
      tokens: ['row', 'g-2'],
    });
    expect(REMOVAL_MAP['btn-block'].kind).toBe('conditional');
    expect(REMOVAL_MAP['input-group-append'].kind).toBe('unwrap');
    expect(REMOVAL_MAP.jumbotron.kind).toBe('manual');
  });

  test('near misses are not BS4 classes', () => {
    for (const t of [
      'badge-layer',
      'custom-badge',
      'font-weight-medium',
      'panel-heading',
      'close-button',
      'form-group-title',
      'btn-close',
      'fa-close',
    ]) {
      expect([t, BS4_KEYS.has(t)]).toEqual([t, false]);
    }
  });

  test('BS4 data attributes match exact names, including data-bs-*', () => {
    expect(maps.BS4_DATA_ATTRIBUTES).toHaveLength(30);
    expect(maps.isBs4DataAttribute('data-toggle')).toBe(true);
    expect(maps.isBs4DataAttribute('data-bs-slide-to')).toBe(true);
    expect(maps.isBs4DataAttribute('data-toggle-layout-sidebar')).toBe(false);
    expect(maps.isBs4DataAttribute('data-content-tab')).toBe(false);
  });

  test.each([
    ['frontend/www/js/omegaup/components/arena/Runs.vue', true],
    ['./frontend/www/js/omegaup/markdown.ts', true],
    ['frontend/templates/template.tpl', true],
    ['frontend/www/sass/_site.scss', true],
    ['frontend/www/issues/index.html', true],
    ['cypress/e2e/contest.cy.ts', true],
    ['frontend/www/js/omegaup/api.json', false],
    ['frontend/server/src/UITools.php', false],
    ['webpack.config-frontend.js', false],
    ['stuff/bs5-cutover/fixtures/scan/a.vue', false],
    ['frontend/www/third_party/bootstrap-4.5.0/css/bootstrap.css', false],
    ['frontend/www/karel.js/index.html', false],
    ['frontend/www/rekarel/src/app.ts', false],
    ['frontend/www/preguntas/x.html', false],
    ['frontend/www/libinteractive/index.html', false],
    ['frontend/www/libinteractive/gen/index.php', false],
    ['frontend/www/docs/libinteractive/a.html', false],
    ['frontend/www/node_modules/x/y.js', false],
    ['frontend/www/js/dist/app.js', false],
    ['frontend/www/js/distribution.ts', true],
  ])('isInScope(%s) is %s', (p, expected) => {
    expect(maps.isInScope(p)).toBe(expected);
  });

  test('libinteractive gen/index.php is the one non-excluded path there', () => {
    expect(maps.isExcluded('frontend/www/libinteractive/gen/index.php')).toBe(
      false,
    );
    expect(maps.isExcluded('frontend/www/libinteractive/gen/other.php')).toBe(
      true,
    );
  });
});

describe('arbitraries.cjs generators', () => {
  const opts = { numRuns: 50 };

  test('bs4Key reaches every family; nearMiss never yields a BS4 key', () => {
    fc.assert(
      fc.property(arb.bs4Key, (k) => BS4_KEYS.has(k)),
      opts,
    );
    fc.assert(
      fc.property(arb.nearMiss, (t) => !BS4_KEYS.has(t)),
      opts,
    );
    const families = Object.keys(arb.KEY_FAMILIES);
    expect(families).toEqual(
      expect.arrayContaining([
        'spacing-side',
        'close',
        'embed',
        'removal-replace',
        'removal-conditional',
        'removal-unwrap',
        'removal-manual',
      ]),
    );
  });

  test('classList has no duplicate tokens', () => {
    fc.assert(
      fc.property(arb.classList(), (s) => {
        const tokens = s.split(/\s+/).filter(Boolean);
        return tokens.length >= 1 && new Set(tokens).size === tokens.length;
      }),
      opts,
    );
  });

  test('selector parses', () => {
    fc.assert(
      fc.property(arb.selector, (s) => {
        selectorParser().processSync(s);
      }),
      opts,
    );
  });

  test('classExpr parses as one TS expression', () => {
    fc.assert(
      fc.property(arb.classExpr(), (e) => {
        const sf = ts.createSourceFile(
          'x.ts',
          `(${e})`,
          ts.ScriptTarget.Latest,
        );
        return sf.parseDiagnostics.length === 0 && sf.statements.length === 1;
      }),
      opts,
    );
  });

  test('sfc parses without errors', () => {
    fc.assert(
      fc.property(arb.sfc, (src) => {
        const { descriptor, errors } = parseSfc(src);
        return (
          errors.length === 0 &&
          descriptor.template !== null &&
          descriptor.script !== null &&
          descriptor.styles.length === 1
        );
      }),
      opts,
    );
  });

  test('scss and tsFile parse', () => {
    fc.assert(
      fc.property(arb.scss, (s) => {
        postcssScss.parse(s);
      }),
      opts,
    );
    fc.assert(
      fc.property(arb.tsFile, (s) => {
        const sf = ts.createSourceFile('x.ts', s, ts.ScriptTarget.Latest);
        return sf.parseDiagnostics.length === 0;
      }),
      opts,
    );
  });

  test('tplFile has class attributes and a style element', () => {
    fc.assert(
      fc.property(
        arb.tplFile,
        (s) => /\sclass=/.test(s) && /<style>[\s\S]*<\/style>/.test(s),
      ),
      opts,
    );
  });

  test.each(['cypress-ts', 'vue'])(
    'scanCase(%s) places every instance on its expected line',
    (host) => {
      fc.assert(
        fc.property(arb.scanCase(host), ({ text, expected }) => {
          const lines = text.split('\n');
          return expected.every((m) => lines[m.line - 1].includes(m.token));
        }),
        opts,
      );
    },
  );

  test('scanCase(vue) and decoyText(vue) are valid SFCs', () => {
    fc.assert(
      fc.property(arb.scanCase('vue'), arb.decoyText('vue'), (c, d) => {
        return (
          parseSfc(c.text).errors.length === 0 &&
          parseSfc(d).errors.length === 0
        );
      }),
      opts,
    );
  });

  test('scanInstance covers each category on each host', () => {
    for (const host of Object.keys(arb.SCAN_HOSTS)) {
      for (const category of arb.SCAN_CATEGORIES) {
        const [sample] = fc.sample(arb.scanInstance(category, host), 1);
        expect(sample.category).toBe(category);
        expect(sample.text).toContain(sample.token);
      }
    }
  });
});
