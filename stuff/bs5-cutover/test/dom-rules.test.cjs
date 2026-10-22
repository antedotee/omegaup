// Unit tests for the Vue DOM rules and the markup / TS HTML cases (task 6.10,
// Requirements 5.4, 5.11, 5.12; design 3.3 and the testing section).
//
// Each case applies the adapter's edits, asserts the exact output, and checks
// that the result parses with @vue/compiler-sfc (HTML from .ts / .tpl inputs
// is parsed as a <template> body).
'use strict';
const { parse } = require('@vue/compiler-sfc');
const { vueEdits, VUE_DETAIL } = require('../adapters/vue.cjs');
const { tsEdits } = require('../adapters/ts.cjs');
const { markupEdits, MARKUP_DETAIL } = require('../adapters/markup.cjs');
const { DETAIL } = require('../core.cjs');

function apply(text, edits) {
  let out = text;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return out;
}

function expectParses(sfc) {
  const { descriptor, errors } = parse(sfc, { filename: 'x.vue' });
  expect(errors).toEqual([]);
  expect(descriptor.template).toBeTruthy();
  return descriptor;
}

const tpl = (lines) =>
  `<template>\n${[].concat(lines).join('\n')}\n</template>\n`;

function runVue(src) {
  const r = vueEdits(src, { path: 'x.vue', allowlist: [] });
  expect(r.error).toBeUndefined();
  const out = apply(src, r.edits);
  expectParses(out);
  return { ...r, out };
}

const brief = (unresolved) =>
  unresolved.map(({ token, reason, detail, line }) => ({
    token,
    reason,
    detail,
    line,
  }));

describe('unwrap of input-group-append / input-group-prepend', () => {
  test('bare wrapper with several children keeps every child', () => {
    const src = tpl([
      '  <div class="input-group">',
      '    <input class="form-control" />',
      '    <div class="input-group-append">',
      '      <button class="btn btn-primary">A</button>',
      '      <button class="btn btn-secondary">B</button>',
      '    </div>',
      '  </div>',
    ]);
    const { out, unresolved, replacements } = runVue(src);
    expect(out).toBe(
      tpl([
        '  <div class="input-group">',
        '    <input class="form-control" />',
        '    <button class="btn btn-primary">A</button>',
        '      <button class="btn btn-secondary">B</button>',
        '  </div>',
      ]),
    );
    expect(unresolved).toEqual([]);
    expect(replacements).toEqual([
      { from: 'input-group-append', to: [], entry: 'input-group-append' },
    ]);
  });

  test('extra class (contest/AddProblem.vue `input-group-prepend w-25`) is manual-conversion', () => {
    // Shape from frontend/www/js/omegaup/components/contest/AddProblem.vue:14-16.
    const src = tpl([
      '  <div>',
      '    <div v-if="x" />',
      '    <div v-else class="input-group w-100">',
      '      <div class="input-group-prepend w-25">',
      '        <select v-model="selectedSearchType" class="custom-select">',
      '          <option value="a">a</option>',
      '        </select>',
      '      </div>',
      '    </div>',
      '  </div>',
    ]);
    const { out, unresolved } = runVue(src);
    expect(out).toBe(
      src.replace('class="custom-select"', 'class="form-select"'),
    );
    expect(brief(unresolved)).toEqual([
      {
        token: 'input-group-prepend',
        reason: 'manual-conversion',
        detail: VUE_DETAIL.unwrapShape,
        line: 5,
      },
    ]);
  });

  test('v-if on the wrapper is manual-conversion', () => {
    const src = tpl([
      '  <div class="input-group">',
      '    <div v-if="show" class="input-group-prepend">',
      '      <span class="input-group-text">@</span>',
      '    </div>',
      '  </div>',
    ]);
    const { out, unresolved } = runVue(src);
    expect(out).toBe(src);
    expect(brief(unresolved)).toEqual([
      {
        token: 'input-group-prepend',
        reason: 'manual-conversion',
        detail: VUE_DETAIL.unwrapShape,
        line: 3,
      },
    ]);
  });

  test('wrapper as a template root child is not unwrapped', () => {
    const src = tpl([
      '  <div class="input-group-append">',
      '    <button class="btn">Go</button>',
      '  </div>',
    ]);
    const { out, unresolved } = runVue(src);
    expect(out).toBe(src);
    expect(brief(unresolved)).toEqual([
      {
        token: 'input-group-append',
        reason: 'manual-conversion',
        detail: VUE_DETAIL.unwrapShape,
        line: 2,
      },
    ]);
  });

  test('empty wrapper is manual-conversion', () => {
    const src = tpl([
      '  <div class="input-group">',
      '    <div class="input-group-append"></div>',
      '  </div>',
    ]);
    const { out, unresolved } = runVue(src);
    expect(out).toBe(src);
    expect(unresolved.map((u) => u.detail)).toEqual([VUE_DETAIL.unwrapShape]);
  });

  test('nested input-groups: both bare wrappers are unwrapped', () => {
    const src = tpl([
      '  <div class="input-group">',
      '    <div class="input-group-prepend">',
      '      <div class="input-group">',
      '        <div class="input-group-append">',
      '          <button class="btn ml-1">Go</button>',
      '        </div>',
      '      </div>',
      '    </div>',
      '  </div>',
    ]);
    const { out, unresolved, replacements } = runVue(src);
    expect(out).toBe(
      tpl([
        '  <div class="input-group">',
        '    <div class="input-group">',
        '        <button class="btn ms-1">Go</button>',
        '      </div>',
        '  </div>',
      ]),
    );
    expect(unresolved).toEqual([]);
    expect(replacements.map((r) => r.from).sort()).toEqual([
      'input-group-append',
      'input-group-prepend',
      'ml-1',
    ]);
  });
});

describe('btn-block', () => {
  test('single btn-block becomes w-100', () => {
    const src = tpl([
      '  <form>',
      '    <input class="form-control" />',
      '    <button type="submit" class="btn btn-primary btn-block">Save</button>',
      '  </form>',
    ]);
    const { out, unresolved } = runVue(src);
    expect(out).toBe(src.replace('btn-primary btn-block', 'btn-primary w-100'));
    expect(unresolved).toEqual([]);
  });

  test('stacked btn-block siblings are manual-conversion and left unchanged', () => {
    const src = tpl([
      '  <div>',
      '    <button class="btn btn-primary btn-block">A</button>',
      '    <button class="btn btn-secondary btn-block">B</button>',
      '  </div>',
    ]);
    const { out, unresolved } = runVue(src);
    expect(out).toBe(src);
    expect(brief(unresolved)).toEqual([
      {
        token: 'btn-block',
        reason: 'manual-conversion',
        detail: DETAIL.stackedBlock,
        line: 3,
      },
      {
        token: 'btn-block',
        reason: 'manual-conversion',
        detail: DETAIL.stackedBlock,
        line: 4,
      },
    ]);
  });
});

describe('btn-close', () => {
  test('bare × is stripped', () => {
    const src = tpl(
      '  <button type="button" class="close" aria-label="Close">×</button>',
    );
    const { out, unresolved } = runVue(src);
    expect(out).toBe(
      tpl(
        '  <button type="button" class="btn-close" aria-label="Close"></button>',
      ),
    );
    expect(unresolved).toEqual([]);
  });

  test('bare &times; is stripped', () => {
    const src = tpl(
      '  <button type="button" class="close" :aria-label="T.wordsClose">\n    &times;\n  </button>',
    );
    const { out, unresolved } = runVue(src);
    expect(out).toBe(
      tpl(
        '  <button type="button" class="btn-close" :aria-label="T.wordsClose"></button>',
      ),
    );
    expect(unresolved).toEqual([]);
  });

  test('span-wrapped × is stripped', () => {
    const src = tpl(
      '  <button class="close" aria-label="Close"><span aria-hidden="true">×</span></button>',
    );
    const { out, unresolved } = runVue(src);
    expect(out).toBe(
      tpl('  <button class="btn-close" aria-label="Close"></button>'),
    );
    expect(unresolved).toEqual([]);
  });

  test('❌ content (OverlayPopup.vue) is kept and reported, as is the missing name', () => {
    // frontend/www/js/omegaup/components/OverlayPopup.vue:3
    const src = tpl([
      '  <div data-overlay-popup>',
      `    <button type="button" class="close" @click="$emit('dismiss')">❌</button>`,
      '    <slot></slot>',
      '  </div>',
    ]);
    const { out, unresolved } = runVue(src);
    expect(out).toBe(src.replace('class="close"', 'class="btn-close"'));
    expect(brief(unresolved)).toEqual([
      {
        token: 'btn-close',
        reason: 'manual-review',
        detail: VUE_DETAIL.closeName,
        line: 3,
      },
      {
        token: 'btn-close',
        reason: 'manual-review',
        detail: VUE_DETAIL.closeContent,
        line: 3,
      },
    ]);
  });

  test('font-awesome icon child is kept and reported', () => {
    const src = tpl(
      `  <button class="close" :aria-label="T.wordsClose"><font-awesome-icon :icon="['fas', 'times']" /></button>`,
    );
    const { out, unresolved } = runVue(src);
    expect(out).toBe(src.replace('class="close"', 'class="btn-close"'));
    expect(brief(unresolved)).toEqual([
      {
        token: 'btn-close',
        reason: 'manual-review',
        detail: VUE_DETAIL.closeContent,
        line: 2,
      },
    ]);
  });

  test('missing aria-label with glyph content: stripped and reported', () => {
    const src = tpl(
      '  <button class="close"><span aria-hidden="true">&times;</span></button>',
    );
    const { out, unresolved } = runVue(src);
    expect(out).toBe(tpl('  <button class="btn-close"></button>'));
    expect(brief(unresolved)).toEqual([
      {
        token: 'btn-close',
        reason: 'manual-review',
        detail: VUE_DETAIL.closeName,
        line: 2,
      },
    ]);
  });
});

describe('HTML class values outside .vue templates', () => {
  test('markdown.ts-style HTML template literal (tsEdits)', () => {
    // Shape from frontend/www/js/omegaup/markdown.ts:74-92.
    const html = (formGroup) =>
      [
        '<div class="libinteractive-download panel panel-default">',
        '        <div class="panel-body">',
        `              <div class="${formGroup} row">`,
        '                <label class="col-xs-6 col-sm-2 control-label">${T.libinteractiveOs}</label>',
        '                <div class="col-xs-6 col-sm-10">',
        '                  <select class="form-control download-os"></select>',
        '                </div>',
        '              </div>',
        '        </div>',
        '      </div>',
      ].join('\n');
    const ts = (h) => `templates['libinteractive:download'] = \`${h}\`;\n`;
    const src = ts(html('form-group'));
    const r = tsEdits(src, {
      path: 'frontend/www/js/omegaup/markdown.ts',
      allowlist: [],
    });
    const out = apply(src, r.edits);
    expect(out).toBe(ts(html('mb-3')));
    expect(r.unresolved).toEqual([]);
    expectParses(tpl(html('mb-3')));
  });

  test('Twig {% if %} class value with a BS4 token is left and reported (markupEdits)', () => {
    // Real line from frontend/templates/template.tpl:51 has no BS4 token.
    const real =
      '    <main role="main" class="flex-grow-1{% if not fullWidth %} container-lg py-5 px-3 px-md-5{% endif %}">\n    </main>\n';
    const r0 = markupEdits(real, { path: 'frontend/templates/template.tpl' });
    expect(r0.edits).toEqual([]);
    expect(r0.unresolved).toEqual([]);

    const src = [
      '<body class="d-flex ml-2{% if OMEGAUP_LOCKDOWN %} lockdown text-right{% endif %}">',
      '  <span class="mr-1">x</span>',
      '</body>',
      '',
    ].join('\n');
    const r = markupEdits(src, { path: 'frontend/templates/x.tpl' });
    const out = apply(src, r.edits);
    expect(out).toBe(src.replace('class="mr-1"', 'class="me-1"'));
    expect(brief(r.unresolved)).toEqual([
      {
        token: 'ml-2',
        reason: 'manual-review',
        detail: MARKUP_DETAIL.template,
        line: 1,
      },
      {
        token: 'text-right',
        reason: 'manual-review',
        detail: MARKUP_DETAIL.template,
        line: 1,
      },
    ]);
    expectParses(tpl(out));
  });
});
