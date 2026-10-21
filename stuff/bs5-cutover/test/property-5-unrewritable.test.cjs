// Property 5: Unrewritable constructs are left in place and reported (design,
// Correctness Properties).
//
// For any input that holds a Removal_Map `manual`/`unwrap` construct the
// adapter cannot apply, a stacked `btn-block`, a Removal_Map class inside a
// selector, or a BS4_Class inside a template literal with an interpolation or
// a string concatenation, the codemod leaves that span byte-identical. The
// report then holds one manual-conversion or manual-review entry with the
// correct file, line, and token for it.
//
// Runs through the real adapters (markup, css, ts, vue). Each generated file
// holds constructs on their own lines among filler lines (some of which the
// codemod does rewrite). The adapters return entries without a file; the
// codemod attributes them to the path it ran the adapter on, which `report`
// below mirrors.
//
// **Validates: Requirements 5.11, 5.12**
'use strict';
const fc = require('fast-check');
const { markupEdits } = require('../adapters/markup.cjs');
const { cssEdits } = require('../adapters/css.cjs');
const { tsEdits } = require('../adapters/ts.cjs');
const { vueEdits } = require('../adapters/vue.cjs');
const { bs4Key, removalKey, nearMiss } = require('./arbitraries.cjs');
const RUNS = { numRuns: 200 };
const CONVERSION = 'manual-conversion'; // Requirement 5.11
const REVIEW = 'manual-review'; // Requirement 5.12
const INTERP = '${x}';
// ---------------------------------------------------------------------------
// Construct generators. A construct is
//   { text: one source line, span: substring of text, token, reason }
// `span` is the part that must stay byte-identical.
// `token` plus 0-2 near misses, shuffled, single-space separated.
const listWith = (token) =>
  fc
    .tuple(fc.uniqueArray(nearMiss, { maxLength: 2 }), fc.nat())
    .map(([others, pos]) => {
      const xs = [...others];
      xs.splice(pos % (xs.length + 1), 0, token);
      return xs.join(' ');
    });
const make = (reason) => (text, span, token) => ({ text, span, token, reason });
const conv = make(CONVERSION);
const rev = make(REVIEW);
// Removal_Map `manual`/`unwrap` token in a static class list.
const manualOrUnwrap = fc.oneof(removalKey('manual'), removalKey('unwrap'));
const manualListOf = (keys) =>
  keys.chain((k) => listWith(k).map((list) => ({ k, list })));
// A Removal_Map class inside a selector.
const removalSelector = fc
  .tuple(
    removalKey(),
    nearMiss,
    fc.constantFrom('K', 'N K', 'K.N', 'div > K', 'K:hover', 'K, N'),
  )
  .map(([k, n, shape]) => ({
    k,
    sel: shape.replace('K', `.${k}`).replace('N', `.${n}`),
  }));
// --- TS / JS (also used in Vue <script>) ---
const tsManual = manualListOf(manualOrUnwrap).chain(({ k, list }) =>
  fc.constantFrom(
    conv(`el.classList.add('${list}');`, list, k),
    conv(`el.className = '${list}';`, list, k),
    conv(`$(el).addClass('${list}');`, list, k),
  ),
);
const tsSelector = removalSelector.chain(({ k, sel }) =>
  fc.constantFrom(
    rev(`cy.get('${sel}').click();`, sel, k),
    rev(`document.querySelector('${sel}');`, sel, k),
  ),
);
const tsDynamic = bs4Key.chain((k) =>
  listWith(k).chain((list) => {
    const tpl = `\`${list} ${INTERP}\``;
    const cat = `'${list} ' + x`;
    return fc.constantFrom(
      rev(`el.className = ${tpl};`, tpl, k),
      rev(`el.classList.add(${tpl});`, tpl, k),
      rev(`const cls = ${tpl};`, tpl, k),
      rev(`el.className = ${cat};`, cat, k),
      rev(`const cls = ${cat};`, cat, k),
      rev(`cy.get('.${k} ' + x);`, `'.${k} ' + x`, k),
    );
  }),
);
const tsConstruct = fc.oneof(tsManual, tsSelector, tsDynamic);
// --- CSS / SCSS (also used in .tpl and Vue <style>) ---
const cssConstruct = fc.oneof(
  removalSelector.map(({ k, sel }) =>
    rev(`${sel} { display: block; }`, sel, k),
  ),
  removalKey().map((k) => rev(`.wrap { @extend .${k}; }`, `.${k}`, k)),
);
// --- Markup (.tpl / .html body) ---
const markupConstruct = manualListOf(manualOrUnwrap).map(({ k, list }) =>
  conv(`<div class="${list}">x</div>`, list, k),
);
// --- Vue template ---
const vueManual = manualListOf(removalKey('manual')).map(({ k, list }) =>
  conv(`<div class="${list}">x</div>`, list, k),
);
// `input-group-append/prepend` in a shape the adapter refuses to unwrap.
const vueUnwrapRefused = fc
  .tuple(
    removalKey('unwrap'),
    nearMiss,
    fc.constantFrom('extra', 'attr', 'empty'),
  )
  .map(([k, n, shape]) => {
    if (shape === 'extra') {
      const list = `${k} ${n}`;
      return conv(`<div class="${list}"><span>Go</span></div>`, list, k);
    }
    if (shape === 'attr') {
      return conv(`<div class="${k}" id="g"><span>Go</span></div>`, k, k);
    }
    return conv(`<div class="${k}"></div>`, k, k);
  });
const vueBoundInterp = bs4Key.chain((k) =>
  listWith(k).map((list) => {
    const tpl = `\`${list} ${INTERP}\``;
    return rev(`<span :class="${tpl}"></span>`, tpl, k);
  }),
);
// Stacked btn-block: 2-3 sibling buttons, one construct each. Returned as a
// group so the buttons stay adjacent siblings.
const stackedBlock = fc
  .array(listWith('btn-block'), { minLength: 2, maxLength: 3 })
  .map((lists) =>
    lists.map((list) =>
      conv(`<button class="${list}">Go</button>`, list, 'btn-block'),
    ),
  );
const vueTemplateItem = fc.oneof(
  vueManual.map((c) => [c]),
  vueUnwrapRefused.map((c) => [c]),
  vueBoundInterp.map((c) => [c]),
  stackedBlock,
);
// ---------------------------------------------------------------------------
// Filler lines (no unrewritable construct; some get rewritten).
const TEMPLATE_FILLER = [
  '<p>Close the form</p>',
  '<span class="ml-2">x</span>',
  '<span class="text-right badge-text">x</span>',
];
const SCRIPT_FILLER = [
  'const n = 1;',
  "el.classList.add('mr-2');",
  "cy.get('.text-left').click();",
  "wrapper.vm.$emit('close');",
];
const STYLE_FILLER = [
  '.panel-x { border-left: 1px solid #ccc; }',
  '.ml-2 { margin: 0; }',
  '// .form-group comment',
];
// Interleaves construct groups with filler lines.
const section = (itemArb, filler, { minLength = 0, maxLength = 3 } = {}) =>
  fc
    .tuple(
      fc.array(itemArb, { minLength, maxLength }),
      fc.array(fc.constantFrom(...filler), { maxLength: 4 }),
      fc.array(fc.nat(), { minLength: maxLength, maxLength }),
    )
    .map(([groups, fill, positions]) => {
      const out = [...fill];
      groups.forEach((g, i) => {
        out.splice(positions[i] % (out.length + 1), 0, ...g);
      });
      return out;
    });
const single = (arb) => arb.map((c) => [c]);
// ---------------------------------------------------------------------------
// Files. Each yields { path, adapter, items: (string | construct)[] } where
// items are the file's lines in order.
const indentItem = (n) => (it) =>
  typeof it === 'string'
    ? ' '.repeat(n) + it
    : { ...it, text: ' '.repeat(n) + it.text };
const TS_HEADER = [
  'declare const $: any;',
  'declare const cy: any;',
  'declare const wrapper: any;',
  'declare const el: HTMLElement;',
  'declare const x: string;',
];
const tsFile = fc
  .tuple(
    section(single(tsConstruct), SCRIPT_FILLER, { minLength: 1 }),
    fc.constantFrom('frontend/www/js/omegaup/gen.ts', 'cypress/e2e/gen.cy.ts'),
  )
  .map(([lines, path]) => ({
    path,
    adapter: 'ts',
    items: [...TS_HEADER, '', ...lines],
  }));
const scssFile = section(single(cssConstruct), STYLE_FILLER, {
  minLength: 1,
}).map((lines) => ({
  path: 'frontend/www/sass/gen.scss',
  adapter: 'css',
  items: ['$gap: 1rem;', '', ...lines],
}));
const markupFile = fc
  .tuple(
    section(single(markupConstruct), TEMPLATE_FILLER),
    section(single(cssConstruct), STYLE_FILLER),
    fc.constantFrom('frontend/templates/gen.tpl', 'frontend/www/gen.html'),
  )
  .filter(([body, style]) =>
    [...body, ...style].some((it) => typeof it !== 'string'),
  )
  .map(([body, style, path]) => ({
    path,
    adapter: 'markup',
    items: [
      '<!DOCTYPE html>',
      '<html>',
      '  <head>',
      '    <style>',
      ...style.map(indentItem(6)),
      '    </style>',
      '  </head>',
      '  <body>',
      '    {% if LOGGED_IN %}',
      ...body.map(indentItem(4)),
      '    {% endif %}',
      '  </body>',
      '</html>',
    ],
  }));
const vueFile = fc
  .tuple(
    section(vueTemplateItem, TEMPLATE_FILLER),
    section(single(tsConstruct), SCRIPT_FILLER),
    section(single(cssConstruct), STYLE_FILLER),
  )
  .filter((secs) => secs.flat().some((it) => typeof it !== 'string'))
  .map(([tpl, script, style]) => ({
    path: 'frontend/www/js/omegaup/components/Gen.vue',
    adapter: 'vue',
    items: [
      '<template>',
      '  <div>',
      ...tpl.map(indentItem(4)),
      '  </div>',
      '</template>',
      '',
      '<script lang="ts">',
      ...TS_HEADER,
      ...script,
      '</script>',
      '',
      '<style lang="scss" scoped>',
      ...style,
      '</style>',
    ],
  }));
// ---------------------------------------------------------------------------
// Rendering, running, checking
// Joins items into text; records each construct's line and span offsets.
function render({ items }) {
  const lines = [];
  const constructs = [];
  let offset = 0;
  for (const it of items) {
    const text = typeof it === 'string' ? it : it.text;
    if (typeof it !== 'string') {
      const at = text.indexOf(it.span);
      if (at < 0) throw new Error(`span not in line: ${it.span} / ${text}`);
      constructs.push({
        ...it,
        line: lines.length + 1,
        start: offset + at,
        end: offset + at + it.span.length,
      });
    }
    lines.push(text);
    offset += text.length + 1;
  }
  return { text: lines.join('\n') + '\n', constructs };
}
const ADAPTERS = {
  ts: (text, path) => tsEdits(text, { path, allowlist: [] }),
  css: (text, path) => cssEdits(text, { path }),
  markup: (text, path) => markupEdits(text, { path }),
  vue: (text, path) => vueEdits(text, { path, allowlist: [] }),
};
// One adapter run per file; entries carry the file they came from.
function report(file, text) {
  const res = ADAPTERS[file.adapter](text, file.path);
  if (res.error) throw new Error(`adapter failed: ${res.error}`);
  return {
    edits: res.edits,
    entries: res.unresolved.map((u) => ({ file: file.path, ...u })),
  };
}
function apply(text, edits) {
  let out = text;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return out;
}
// Edits that touch [start, end): overlapping, or inserting strictly inside.
const touches = (e, c) =>
  e.start === e.end
    ? e.start > c.start && e.start < c.end
    : e.start < c.end && e.end > c.start;
function check(file) {
  const { text, constructs } = render(file);
  const { edits, entries } = report(file, text);
  const out = apply(text, edits);
  for (const c of constructs) {
    // The span is byte-identical: no edit touches it, and it sits in the
    // output at its original offset shifted by the edits before it.
    expect(edits.filter((e) => touches(e, c))).toEqual([]);
    const shift = edits
      .filter((e) => e.end <= c.start && !touches(e, c))
      .reduce((n, e) => n + e.text.length - (e.end - e.start), 0);
    expect(out.slice(c.start + shift, c.end + shift)).toBe(c.span);
    // One entry for it, with the right file, line, token, and section.
    const forIt = entries.filter(
      (u) =>
        u.file === file.path &&
        u.line === c.line &&
        u.token === c.token &&
        (u.reason === CONVERSION || u.reason === REVIEW),
    );
    expect({ line: c.text, entries: forIt.map((u) => u.reason) }).toEqual({
      line: c.text,
      entries: [c.reason],
    });
  }
}
describe('Property 5: Unrewritable constructs are left in place and reported', () => {
  test('design examples', () => {
    check({
      path: 'a.scss',
      adapter: 'css',
      items: [
        rev('.form-group .x { color: red; }', '.form-group', 'form-group'),
      ],
    });
    check({
      path: 'a.ts',
      adapter: 'ts',
      items: [
        ...TS_HEADER,
        rev('el.className = `ml-2 ${x}`;', '`ml-2 ${x}`', 'ml-2'),
        rev("el.className = 'ml-2 ' + x;", "'ml-2 ' + x", 'ml-2'),
      ],
    });
    check({
      path: 'A.vue',
      adapter: 'vue',
      items: [
        '<template>',
        '  <div>',
        conv('<button class="btn-block">a</button>', 'btn-block', 'btn-block'),
        conv('<button class="btn-block">b</button>', 'btn-block', 'btn-block'),
        conv('<div class="form-inline">x</div>', 'form-inline', 'form-inline'),
        '  </div>',
        '</template>',
      ],
    });
  });
  test('every unrewritable construct stays byte-identical and is reported once', () => {
    fc.assert(
      fc.property(fc.oneof(tsFile, scssFile, markupFile, vueFile), check),
      RUNS,
    );
  });
});
