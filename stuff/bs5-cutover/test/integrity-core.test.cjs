// Example tests for integrity-core.cjs (design 4, Requirement 6).
'use strict';
const {
  tokenize,
  checkPair,
  checkAll,
  formatResult,
  exitCodeFor,
} = require('../integrity-core.cjs');
const { processText } = require('../codemod-core.cjs');

const P = 'frontend/www/js/omegaup/components/A.vue';

const sfc = ({
  template = '<div class="ml-2">x</div>',
  script = "export default { data: () => ({ c: 'ml-2' }) };",
  style = '.ml-2 { color: red; }',
  scriptAttrs = ' lang="ts"',
  styleAttrs = ' lang="scss" scoped',
  extra = '',
} = {}) =>
  `<template>\n  ${template}\n</template>\n\n<script${scriptAttrs}>\n${script}\n</script>\n\n<style${styleAttrs}>\n${style}\n</style>\n${extra}`;

const kinds = (f) => f.map((x) => `${x.kind}:${x.block || ''}`);

describe('tokenize', () => {
  test('splits words, whitespace runs, and single other characters', () => {
    expect(tokenize(".ml-2 >  a{x:'é'}")).toEqual([
      '.',
      'ml-2',
      ' ',
      '>',
      '  ',
      'a',
      '{',
      'x',
      ':',
      "'",
      'é',
      "'",
      '}',
    ]);
  });
});

describe('checkPair: parse (6.2, 6.8)', () => {
  test('original already invalid is reported as such (6.8)', () => {
    const bad = '<template><div></template>\n';
    const f = checkPair(P, bad, '<template><div></div></template>\n');
    expect(kinds(f)).toEqual(['original-invalid:']);
    expect(f[0].detail).toMatch(/original already invalid/);
    expect(f[0].path).toBe(P);
    expect(kinds(checkPair(P, bad, bad))).toEqual([
      'original-invalid:',
      'parse-error:',
    ]);
  });

  test('changed file with a parse error fails with the error (6.2)', () => {
    const ok = sfc();
    const broken = ok.replace('</script>', '');
    const f = checkPair(P, ok, broken);
    expect(kinds(f)).toEqual(['parse-error:']);
    expect(f[0].detail.length).toBeGreaterThan(0);
  });

  test('unchanged valid file passes', () => {
    expect(checkPair(P, sfc(), sfc())).toEqual([]);
  });
});

describe('checkPair: structure (6.3)', () => {
  test('a removed <style> block fails with block style', () => {
    const a = sfc();
    const b = a.replace(/<style[\s\S]*<\/style>\n/, '');
    expect(kinds(checkPair(P, a, b))).toEqual(['structure:style']);
  });

  test('an added custom block fails with its type', () => {
    const f = checkPair(P, sfc(), sfc({ extra: '<i18n>{}</i18n>\n' }));
    expect(kinds(f)).toEqual(['structure:i18n']);
  });

  test('script turned into script setup fails for both script slots', () => {
    const f = checkPair(P, sfc(), sfc({ scriptAttrs: ' lang="ts" setup' }));
    expect(kinds(f)).toEqual(['structure:script', 'structure:scriptSetup']);
  });

  test.each([
    ['lang', ' lang="js"', ' lang="scss" scoped', 'script'],
    ['scoped', ' lang="ts"', ' lang="scss"', 'style'],
    ['module', ' lang="ts"', ' lang="scss" scoped module', 'style'],
    ['style lang', ' lang="ts"', ' lang="css" scoped', 'style'],
  ])('a changed %s attribute fails', (_, scriptAttrs, styleAttrs, block) => {
    const f = checkPair(P, sfc(), sfc({ scriptAttrs, styleAttrs }));
    expect(kinds(f)).toEqual([`structure:${block}`]);
  });

  test('template content is not diffed (DOM rules edit it)', () => {
    const a = sfc({
      template: '<div class="input-group-append"><b>x</b></div>',
    });
    const b = sfc({ template: '<b>x</b>' });
    expect(checkPair(P, a, b)).toEqual([]);
  });

  test('custom block content must not change', () => {
    const f = checkPair(
      P,
      sfc({ extra: '<docs>a</docs>\n' }),
      sfc({ extra: '<docs>b</docs>\n' }),
    );
    expect(kinds(f)).toEqual(['content:docs']);
  });
});

describe('checkPair: script/style content (6.4)', () => {
  const pass = (script, script2, style = '.x{}', style2 = style) =>
    expect(
      checkPair(
        P,
        sfc({ script, style }),
        sfc({ script: script2, style: style2 }),
      ),
    ).toEqual([]);

  test.each([
    ['rename', "c('ml-2 mr-1')", "c('ms-2 me-1')"],
    ['multi-token replacement', "c('form-row')", "c('row g-2')"],
    ['multi-token in context', "c('a form-row b')", "c('a row g-2 b')"],
    ['dedupe drop', "c('row form-row')", "c('row g-2')"],
    [
      'full dedupe drops key and a separator',
      "c('w-100 btn-block x')",
      "c('w-100 x')",
    ],
    [
      'dropped token',
      "c('embed-responsive embed-responsive-item')",
      "c('ratio')",
    ],
    [
      'dark-text badge',
      "c('badge badge-warning')",
      "c('badge bg-warning text-dark')",
    ],
    ['close -> btn-close', "c('close')", "c('btn-close')"],
    [
      'identifier key quoted',
      '({ close: x, a: 1 })',
      "({ 'btn-close': x, a: 1 })",
    ],
    ['selector form', "q('.ml-2 > .text-right')", "q('.ms-2 > .text-end')"],
    [
      'compound selector join',
      "q('.badge-warning')",
      "q('.bg-warning.text-dark')",
    ],
  ])('accepts %s', (_, a, b) => pass(a, b));

  test('accepts selector renames in <style>', () => {
    pass(
      'x',
      'x',
      '.ml-2, .float-left:hover { a: b }',
      '.ms-2, .float-start:hover { a: b }',
    );
    pass(
      'x',
      'x',
      '.x { @extend .custom-switch; }',
      '.x { @extend .form-check.form-switch; }',
    );
  });

  test.each([
    [
      'a declaration',
      '.a { border-left: 0; }',
      '.a { border-start: 0; }',
      /outside a class selector/,
    ],
    [
      'a Removal_Map selector',
      '.form-group { a: b }',
      '.mb-3 { a: b }',
      /not rewritable in a selector/,
    ],
    [
      'a space join',
      '.badge-light { a: b }',
      '.bg-light text-dark { a: b }',
      /selector/,
    ],
  ])('rejects %s rewritten in <style>', (_, a, b, re) => {
    const f = checkPair(P, sfc({ style: a }), sfc({ style: b }));
    expect(kinds(f)).toEqual(['content:style']);
    expect(f[0].detail).toMatch(re);
  });

  test.each([
    ['non-BS4 word replaced', "c('foo')", "c('bar')", /not a mapped BS4 class/],
    ['wrong replacement', "c('ml-2')", "c('me-2')", /not a replacement/],
    [
      'unwrap key replaced',
      "c('input-group-append')",
      "c('x')",
      /not a mapped/,
    ],
    ['inserted character', 'a = 1;', 'a = 1;;', /without a BS4/],
    ['deleted character', "c('ml-2');", "c('ms-2')", /removed character/],
    [
      'replacement duplicated',
      "c('ml-2')",
      "c('ms-2 ms-2')",
      /not a replacement/,
    ],
    [
      'newline added with replacement',
      "c('form-row')",
      "c('row\ng-2')",
      /whitespace/,
    ],
  ])('rejects %s', (_, a, b, re) => {
    const f = checkPair(P, sfc({ script: a }), sfc({ script: b }));
    expect(kinds(f)).toEqual(['content:script']);
    expect(f[0].detail).toMatch(re);
  });

  test('rejects a style declaration change with block style and line', () => {
    const f = checkPair(
      P,
      sfc({ style: '.a {\n  border-left: 0;\n}' }),
      sfc({ style: '.a {\n  border-start: 0;\n}' }),
    );
    expect(kinds(f)).toEqual(['content:style']);
    expect(f[0].detail).toMatch(/^style line 11:/);
  });

  test('lists every unexplained hunk in a block', () => {
    const f = checkPair(
      P,
      sfc({ script: 'a; b; c;' }),
      sfc({ script: 'x; b; y;' }),
    );
    expect(f).toHaveLength(2);
  });
});

describe('codemod output', () => {
  test('PR2 ProblemMarkdown.vue shape passes after codemod', () => {
    const original = `<template>
  <div class="form-group">
    <button class="close" aria-label="Close" type="button"><span aria-hidden="true">&times;</span></button>
    <div class="input-group"><input class="form-control" /><div class="input-group-append"><button class="btn">Go</button></div></div>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
@Component
export default class ProblemMarkdown extends Vue {
  get klass() { return { 'mr-2': true, close: this.x }; }
  mounted() { this.$el.querySelector('.text-right'); this.$emit('close'); }
}
</script>

<style lang="scss" scoped>
@import '../../../../sass/site.scss';
.ml-2 > .float-right { border-left: 1px solid; }
</style>
`;
    const r = processText(P, original);
    expect(r.error).toBeUndefined();
    expect(r.output).not.toBe(original);
    expect(checkPair(P, original, r.output)).toEqual([]);
  });

  test('deduped compound selector with a kept class between the keys passes', () => {
    // Property 10 counterexample: the diff ties and aligns `.` instead of
    // badge-layer, so badge-layer shows as removed and added in one hunk.
    const original = sfc({
      style: '.badge-warning.badge-layer.badge-warning { a: b; }',
    });
    const r = processText(P, original);
    expect(r.output).toContain('.bg-warning.text-dark.badge-layer {');
    expect(checkPair(P, original, r.output)).toEqual([]);
    // A non-BS4 class that is dropped (not only moved) is still caught.
    const dropped = original.replace(
      '.badge-warning.badge-layer.badge-warning',
      '.bg-warning.text-dark',
    );
    expect(kinds(checkPair(P, original, dropped))).toEqual(['content:style']);
  });
});

describe('checkAll and formatting (6.5, 6.6, 6.7)', () => {
  test('zero files: count 0, exit 0', () => {
    const r = checkAll([]);
    expect(r).toMatchObject({ checked: 0, failing: 0 });
    expect(formatResult(r)).toMatch(/^integrity: 0 \.vue files checked/);
    expect(exitCodeFor(r)).toBe(0);
  });

  test('checks every file and lists every failing path', () => {
    const bad = '<template><div></template>\n';
    const r = checkAll([
      { path: 'a.vue', original: bad, changed: bad },
      { path: 'b.vue', original: sfc(), changed: sfc() },
      { path: 'c.vue', original: sfc(), changed: sfc({ styleAttrs: '' }) },
      { path: 'd.vue', error: 'snapshot original cannot be read' },
    ]);
    expect(r.checked).toBe(4);
    expect(r.failing).toBe(3);
    expect(r.failingPaths).toEqual(['a.vue', 'c.vue', 'd.vue']);
    const out = formatResult(r);
    expect(out).toMatch(/^integrity: 4 \.vue files checked, 3 failing\n/);
    for (const p of ['a.vue', 'c.vue', 'd.vue'])
      expect(out).toContain(`  ${p}  [`);
    expect(out).toContain('[style]');
    expect(exitCodeFor(r)).toBe(1);
  });
});
