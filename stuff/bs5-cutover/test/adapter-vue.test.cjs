// Example-based tests for adapters/vue.cjs (design 3.3, Requirements 5.2,
// 5.4, 5.5, 5.11, 5.12, 6.8). Task 6.10 adds the wider DOM-rule cases.
'use strict';
const { parse } = require('@vue/compiler-sfc');
const { vueEdits, VUE_DETAIL } = require('../adapters/vue.cjs');
const { DETAIL } = require('../core.cjs');

function apply(text, edits) {
  let out = text;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return out;
}
const run = (text, opts = {}) => {
  const r = vueEdits(text, { path: 'x.vue', allowlist: [], ...opts });
  return { ...r, out: apply(text, r.edits) };
};
const tpl = (body) => `<template>\n${body}\n</template>\n`;

describe('vueEdits: template classes', () => {
  test('static class keeps quotes and other tokens', () => {
    const { out, replacements, unresolved } = run(
      tpl(`  <div class="mr-2 card" title="mr-2"></div>`),
    );
    expect(out).toBe(tpl(`  <div class="me-2 card" title="mr-2"></div>`));
    expect(replacements).toEqual([
      { from: 'mr-2', to: ['me-2'], entry: 'mr-2' },
    ]);
    expect(unresolved).toEqual([]);
  });

  test('*-class static attribute and nested slot template', () => {
    const { out } = run(
      tpl(
        `  <b-dropdown toggle-class="text-right">\n    <template #button-content><span class="sr-only">x</span></template>\n  </b-dropdown>`,
      ),
    );
    expect(out).toBe(
      tpl(
        `  <b-dropdown toggle-class="text-end">\n    <template #button-content><span class="visually-hidden">x</span></template>\n  </b-dropdown>`,
      ),
    );
  });

  test(':class array, object and ternary', () => {
    const src = tpl(
      `  <div :class="['ml-1', { 'text-left': a, 'font-italic': b }, c ? 'float-right' : 'pl-2']"></div>`,
    );
    expect(run(src).out).toBe(
      tpl(
        `  <div :class="['ms-1', { 'text-start': a, 'fst-italic': b }, c ? 'float-end' : 'ps-2']"></div>`,
      ),
    );
  });

  test('identifier object key is quoted with the opposite of the attribute quote', () => {
    expect(run(tpl(`  <div :class="{ close: a }"></div>`)).out).toBe(
      tpl(`  <div :class="{ 'btn-close': a }"></div>`),
    );
    expect(run(tpl(`  <div v-bind:class='{ close: a }'></div>`)).out).toBe(
      tpl(`  <div v-bind:class='{ "btn-close": a }'></div>`),
    );
  });

  test('camelCase *Class binding and v-if branches', () => {
    const src = tpl(
      `  <x v-if="a" :bodyClass="'mr-1'" />\n  <y v-else class="ml-3" />`,
    );
    expect(run(src).out).toBe(
      tpl(`  <x v-if="a" :bodyClass="'me-1'" />\n  <y v-else class="ms-3" />`),
    );
  });

  test('template literal with interpolation goes to manual-review', () => {
    const { edits, unresolved } = run(
      tpl('  <div :class="`mr-2 ${x}`"></div>'),
    );
    expect(edits).toEqual([]);
    expect(unresolved).toMatchObject([
      { token: 'mr-2', reason: 'manual-review', line: 2 },
    ]);
  });
});

describe('vueEdits: DOM rules', () => {
  test('bare input-group-append is unwrapped', () => {
    const src = tpl(
      [
        '  <div class="input-group">',
        '    <input class="form-control" />',
        '    <div class="input-group-append">',
        '      <button class="btn">Go</button>',
        '    </div>',
        '  </div>',
      ].join('\n'),
    );
    const { out, unresolved, replacements } = run(src);
    expect(out).toBe(
      tpl(
        [
          '  <div class="input-group">',
          '    <input class="form-control" />',
          '    <button class="btn">Go</button>',
          '  </div>',
        ].join('\n'),
      ),
    );
    expect(unresolved).toEqual([]);
    expect(replacements).toContainEqual({
      from: 'input-group-append',
      to: [],
      entry: 'input-group-append',
    });
  });

  test('unwrap candidate with another attribute is manual-conversion', () => {
    const src = tpl(
      '  <div class="input-group">\n    <div v-if="a" class="input-group-prepend"><span>x</span></div>\n  </div>',
    );
    const { edits, unresolved } = run(src);
    expect(edits).toEqual([]);
    expect(unresolved).toEqual([
      {
        token: 'input-group-prepend',
        reason: 'manual-conversion',
        detail: VUE_DETAIL.unwrapShape,
        line: 3,
      },
    ]);
  });

  test('single btn-block becomes w-100, stacked ones are manual', () => {
    expect(
      run(tpl('  <div><button class="btn btn-block">a</button></div>')).out,
    ).toBe(tpl('  <div><button class="btn w-100">a</button></div>'));
    const stacked = run(
      tpl(
        '  <div><a class="btn btn-block">a</a><a class="btn btn-block">b</a></div>',
      ),
    );
    expect(stacked.edits).toEqual([]);
    expect(stacked.unresolved.map((u) => u.detail)).toEqual([
      DETAIL.stackedBlock,
      DETAIL.stackedBlock,
    ]);
  });

  test('close button: glyph content stripped, missing aria-label reported', () => {
    const { out, unresolved } = run(
      tpl(
        '  <button class="close" :aria-label="T.wordsClose">\n    <span aria-hidden="true">&times;</span>\n  </button>',
      ),
    );
    expect(out).toBe(
      tpl('  <button class="btn-close" :aria-label="T.wordsClose"></button>'),
    );
    expect(unresolved).toEqual([]);
    const bare = run(tpl('  <button class="close">×</button>'));
    expect(bare.out).toBe(tpl('  <button class="btn-close"></button>'));
    expect(bare.unresolved).toMatchObject([
      {
        token: 'btn-close',
        reason: 'manual-review',
        detail: VUE_DETAIL.closeName,
      },
    ]);
  });

  test('btn-close follow-ups persist on an already-BS5 button (report-only)', () => {
    const noName = run(tpl('  <button class="btn-close"></button>'));
    expect(noName.edits).toEqual([]);
    expect(noName.unresolved).toMatchObject([
      {
        token: 'btn-close',
        reason: 'manual-review',
        detail: VUE_DETAIL.closeName,
        line: 2,
      },
    ]);
    const content = run(
      tpl('  <button class="btn-close" aria-label="x">❌</button>'),
    );
    expect(content.edits).toEqual([]);
    expect(content.unresolved).toMatchObject([
      { token: 'btn-close', detail: VUE_DETAIL.closeContent },
    ]);
    // An already-BS5 button is never edited, glyph or not.
    const glyph = run(
      tpl('  <button class="btn-close" aria-label="x">×</button>'),
    );
    expect(glyph.edits).toEqual([]);
    expect(glyph.unresolved).toEqual([]);
    const clean = run(
      tpl('  <button class="btn-close" :aria-label="T.wordsClose"></button>'),
    );
    expect(clean.unresolved).toEqual([]);
  });

  test('unwrap candidate on a non-div/span tag is manual-conversion', () => {
    const src = tpl(
      '  <div class="input-group">\n    <label class="input-group-prepend"><span>x</span></label>\n  </div>',
    );
    const { edits, unresolved } = run(src);
    expect(edits).toEqual([]);
    expect(unresolved).toEqual([
      {
        token: 'input-group-prepend',
        reason: 'manual-conversion',
        detail: VUE_DETAIL.unwrapShape,
        line: 3,
      },
    ]);
  });

  test('close on a non-button is kept and reported', () => {
    const { out, unresolved } = run(
      tpl('  <a class="close mr-1" aria-label="x">×</a>'),
    );
    expect(out).toBe(tpl('  <a class="close me-1" aria-label="x">×</a>'));
    expect(unresolved).toMatchObject([
      { token: 'close', detail: VUE_DETAIL.closeNonButton },
    ]);
  });
});

describe('vueEdits: blocks', () => {
  test('script offsets and lines are absolute', () => {
    const src =
      tpl('  <div></div>') +
      `<script lang="ts">\nel.classList.add('ml-2');\n</script>\n` +
      `<script setup lang="ts">\nconst s = 'pr-1';\n</script>\n`;
    const { out, unresolved } = run(src);
    expect(out).toContain(`el.classList.add('ms-2');`);
    expect(unresolved).toMatchObject([
      { token: 'pr-1', reason: 'manual-review', line: 8 },
    ]);
  });

  test('style blocks: scss rewritten, less reported', () => {
    const src =
      tpl('  <div></div>') +
      `<style lang="scss" scoped>\n.a .ml-2 { color: red; }\n</style>\n` +
      `<style lang="less">\n.mr-3 { color: red; }\n</style>\n`;
    const { out, unresolved } = run(src);
    expect(out).toContain('.a .ms-2 { color: red; }');
    expect(out).toContain('.mr-3 { color: red; }');
    expect(unresolved).toEqual([
      {
        token: 'mr-3',
        reason: 'manual-review',
        detail: VUE_DETAIL.styleLang,
        line: 8,
      },
    ]);
  });

  test('original with parse errors returns error and no edits', () => {
    const r = vueEdits('<template><div class="mr-2"></template>\n', {
      path: 'x.vue',
    });
    expect(r.edits).toEqual([]);
    expect(r.error).toMatch(/original already invalid/);
  });

  test('result still parses with the same blocks', () => {
    const src =
      tpl('  <div class="form-group"><label class="sr-only">a</label></div>') +
      `<script lang="ts">\nexport default {};\n</script>\n<style>\n.ml-1 {}\n</style>\n`;
    const { out } = run(src);
    const { descriptor, errors } = parse(out);
    expect(errors).toEqual([]);
    expect(!!descriptor.template && !!descriptor.script).toBe(true);
    expect(descriptor.styles).toHaveLength(1);
    expect(out).toContain('<div class="mb-3"><label class="visually-hidden">');
  });
});
