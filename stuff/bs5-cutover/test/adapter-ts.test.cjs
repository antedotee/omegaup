// Example tests for adapters/ts.cjs (design 3.3, Requirements 5.5, 5.12).
'use strict';
const { tsEdits, classExprEdits, TS_DETAIL } = require('../adapters/ts.cjs');
const { DETAIL } = require('../core.cjs');

const apply = (text, edits) => {
  let out = text;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return out;
};
const run = (src, opts = {}) => {
  const res = tsEdits(src, { allowlist: [], ...opts });
  return { ...res, out: apply(src, res.edits) };
};
const tokens = (res) => res.unresolved.map((u) => u.token);

describe('class-value contexts', () => {
  test('classList.add rewrites, keeps quotes', () => {
    expect(run("el.classList.add('ml-2');").out).toBe(
      "el.classList.add('ms-2');",
    );
    expect(run('el.classList.replace("mr-1", "pl-3");').out).toBe(
      'el.classList.replace("me-1", "ps-3");',
    );
  });

  test('className assignment (Markdown.vue shape)', () => {
    const r = run(
      "copyButton.className = 'btn btn-link btn-sm ml-2 copy-btn';",
    );
    expect(r.out).toBe(
      "copyButton.className = 'btn btn-link btn-sm ms-2 copy-btn';",
    );
    expect(r.replacements).toEqual([
      { from: 'ml-2', to: ['ms-2'], entry: 'ml-2' },
    ]);
  });

  test('jQuery addClass / toggleClass', () => {
    expect(
      run("$(el).addClass('float-right').toggleClass('sr-only', x);").out,
    ).toBe("$(el).addClass('float-end').toggleClass('visually-hidden', x);");
  });

  test('*Class object property and object-key rewrite', () => {
    expect(run("const f = { key: 'a', tdClass: 'text-right' };").out).toBe(
      "const f = { key: 'a', tdClass: 'text-end' };",
    );
    expect(run('const c = { class: { "text-right": x, close: y } };').out).toBe(
      'const c = { class: { "text-end": x, \'btn-close\': y } };',
    );
  });

  test('unwrap token in a class value goes to manual-conversion', () => {
    const r = run("el.className = 'input-group-append';");
    expect(r.edits).toEqual([]);
    expect(r.unresolved).toEqual([
      {
        token: 'input-group-append',
        reason: 'manual-conversion',
        detail: DETAIL.unwrap,
        line: 1,
      },
    ]);
  });
});

describe('selector contexts', () => {
  test('cy.get(.close) -> .btn-close', () => {
    expect(
      run("cy.get('[data-overlay-popup] button.close').click();").out,
    ).toBe("cy.get('[data-overlay-popup] button.btn-close').click();");
    expect(run("cy.get('.close:visible')").out).toBe(
      "cy.get('.btn-close:visible')",
    );
  });

  test('wrapper.find(.badge-danger) is rewritten', () => {
    expect(run("wrapper.find('.badge-danger').exists()").out).toBe(
      "wrapper.find('.bg-danger').exists()",
    );
  });

  test('Removal_Map class in a selector -> manual-review, unchanged', () => {
    const src = "wrapper.find('.form-group input');";
    const r = run(src);
    expect(r.out).toBe(src);
    expect(r.unresolved).toEqual([
      {
        token: 'form-group',
        reason: 'manual-review',
        detail: DETAIL.selectorRemoval,
        line: 1,
      },
    ]);
  });

  test('[class="close"] attribute selector -> manual-review', () => {
    const r = run(`w.find('div button[class="close"]')`);
    expect(r.edits).toEqual([]);
    expect(r.unresolved[0]).toMatchObject({
      token: 'close',
      detail: DETAIL.selectorAttribute,
    });
  });

  test('interpolated selector -> manual-review', () => {
    const r = run('document.querySelector(`.ml-2 ${x}`);');
    expect(r.edits).toEqual([]);
    expect(r.unresolved[0]).toMatchObject({
      token: 'ml-2',
      detail: TS_DETAIL.selectorInterpolation,
    });
  });

  test('get() off cy is not a selector context', () => {
    expect(run("map.get('.close')").edits).toEqual([]);
  });
});

describe('event names and other literals', () => {
  test.each([
    "this.$emit('close');",
    "wrapper.emitted('close');",
    "rl.on('close', () => {});",
    "el.addEventListener('close', f);",
    "await wrapper.trigger('close');",
    "new CustomEvent('close');",
    "export default { emits: ['close', 'submit'] };",
    "const e = defineEmits(['close']);",
    "type E = (e: 'close') => void;",
    'channel.close();',
    "it('should arm once across repeated close events', () => {});",
    "describe.only('close', () => {});",
    "test.each([1])('close %s', () => {});",
  ])('%s untouched, nothing reported', (src) => {
    const r = run(src);
    expect(r.edits).toEqual([]);
    expect(r.unresolved).toEqual([]);
  });

  test('BS4-shaped literal outside a context -> manual-review', () => {
    const r = run("function f() {\n  return 'badge-success';\n}");
    expect(r.edits).toEqual([]);
    expect(r.unresolved).toEqual([
      {
        token: 'badge-success',
        reason: 'manual-review',
        detail: TS_DETAIL.literal,
        line: 2,
      },
    ]);
  });

  test('prose and near misses are not reported', () => {
    const r = run(
      "const a = 'Please close this tab'; const b = 'close-button badge-layer';",
    );
    expect(r.unresolved).toEqual([]);
  });

  test('allowlist entry suppresses the literal report', () => {
    const src = "const kind = 'close';";
    expect(tokens(run(src, { path: 'a/b.ts' }))).toEqual(['close']);
    const allowlist = [
      { path: 'a/b.ts', line: 1, token: 'close', reason: 'enum' },
    ];
    expect(run(src, { path: 'a/b.ts', allowlist }).unresolved).toEqual([]);
  });
});

describe('interpolation and concatenation (Requirement 5.12)', () => {
  test('`${x} ml-2` -> manual-review, unchanged', () => {
    const src = 'el.className = `${x} ml-2`;';
    const r = run(src);
    expect(r.out).toBe(src);
    expect(r.unresolved).toEqual([
      {
        token: 'ml-2',
        reason: 'manual-review',
        detail: TS_DETAIL.interpolation,
        line: 1,
      },
    ]);
  });

  test('template outside a context with BS4 tokens -> manual-review', () => {
    expect(run('const c = `${x} ml-2`;').unresolved[0]).toMatchObject({
      token: 'ml-2',
      detail: TS_DETAIL.interpolation,
    });
  });

  test('concatenated class value -> manual-review, unchanged', () => {
    const src = "el.className = 'btn ' + (a ? 'mr-2' : '');";
    const r = run(src);
    expect(r.out).toBe(src);
    expect(r.unresolved).toEqual([
      {
        token: 'mr-2',
        reason: 'manual-review',
        detail: TS_DETAIL.concatenation,
        line: 1,
      },
    ]);
  });

  test('escaped literal is never edited', () => {
    const src = "el.className = 'ml-2\\u0020x';";
    const r = run(src);
    expect(r.out).toBe(src);
    expect(r.unresolved[0]).toMatchObject({
      token: 'ml-2',
      detail: TS_DETAIL.escapes,
    });
  });
});

describe('HTML class attributes in strings', () => {
  test('markdown.ts template literal with substitutions elsewhere', () => {
    const src = [
      'const html = `',
      '  <div class="form-group row">',
      '    <label class="col-sm-2 ${labelCls}">${T.x}</label>',
      "    <span class='text-right'>${y}</span>",
      '  </div>`;',
    ].join('\n');
    const r = run(src);
    expect(r.out).toBe(
      [
        'const html = `',
        '  <div class="mb-3 row">',
        '    <label class="col-sm-2 ${labelCls}">${T.x}</label>',
        "    <span class='text-end'>${y}</span>",
        '  </div>`;',
      ].join('\n'),
    );
    expect(r.unresolved).toEqual([]);
  });

  test('Storybook template string', () => {
    expect(
      run(
        `export const S = () => ({ template: '<button class="btn mr-2">x</button>' });`,
      ).out,
    ).toBe(
      `export const S = () => ({ template: '<button class="btn me-2">x</button>' });`,
    );
  });

  test('value straddling ${} -> manual-review', () => {
    const src = 'const h = `<div class="ml-2 ${x} mr-1">`;';
    const r = run(src);
    expect(r.out).toBe(src);
    expect(tokens(r).sort()).toEqual(['ml-2', 'mr-1']);
    expect(r.unresolved[0].detail).toBe(TS_DETAIL.htmlStraddle);
  });

  test('class="language-${x}" with no BS4 token is silent', () => {
    const r = run('const c = ` class="language-${language}"`;');
    expect(r.edits).toEqual([]);
    expect(r.unresolved).toEqual([]);
  });
});

describe('offsets', () => {
  test('Vue <script> block: baseOffset and fullText lines', () => {
    const file = [
      '<template><div /></template>',
      '<script lang="ts">',
      'export default {',
      '  mounted() {',
      "    this.$el.classList.add('pr-3');",
      "    return 'form-inline';",
      '  },',
      '};',
      '</script>',
    ].join('\n');
    const open = file.indexOf('<script lang="ts">');
    const start = file.indexOf('>', open) + 1;
    const end = file.indexOf('</script>');
    const r = tsEdits(file.slice(start, end), {
      baseOffset: start,
      fullText: file,
      scriptKind: 'ts',
      allowlist: [],
    });
    const out = apply(file, r.edits);
    expect(out).toBe(file.replace("'pr-3'", "'pe-3'"));
    expect(r.unresolved).toEqual([
      {
        token: 'form-inline',
        reason: 'manual-review',
        detail: TS_DETAIL.literal,
        line: 6,
      },
    ]);
  });

  test('JS script kind parses plain JS', () => {
    expect(run("el.classList.add('ml-2')", { path: 'x.js' }).out).toBe(
      "el.classList.add('ms-2')",
    );
  });
});

describe('classExprEdits (Vue :class)', () => {
  const expr = (text, offset = 10, opts = {}) => {
    const file = ' '.repeat(offset) + text;
    const res = classExprEdits(text, offset, { allowlist: [], ...opts });
    return { ...res, out: apply(file, res.edits).slice(offset) };
  };

  test('string, array, conditional, object keys', () => {
    expect(expr("'ml-2 font-weight-bold'").out).toBe("'ms-2 fw-bold'");
    expect(
      expr("['btn', x ? 'float-right' : 'float-left', y && 'pl-1']").out,
    ).toBe("['btn', x ? 'float-end' : 'float-start', y && 'ps-1']");
    expect(expr("{ 'text-right': x, 'badge-pill': y, active: z }").out).toBe(
      "{ 'text-end': x, 'rounded-pill': y, active: z }",
    );
  });

  test('identifier key that is a BS4 class is quoted', () => {
    expect(expr('{ close: x }').out).toBe("{ 'btn-close': x }");
    expect(expr('{ close: x }', 0, { quote: '"' }).out).toBe(
      '{ "btn-close": x }',
    );
  });

  test('template with substitution and concatenation -> manual-review', () => {
    const t = expr('`${a} mr-2`');
    expect(t.edits).toEqual([]);
    expect(t.unresolved[0]).toMatchObject({
      token: 'mr-2',
      detail: TS_DETAIL.interpolation,
    });
    const c = expr("'mr-2 ' + a");
    expect(c.edits).toEqual([]);
    expect(c.unresolved[0]).toMatchObject({
      token: 'mr-2',
      detail: TS_DETAIL.concatenation,
    });
  });

  test('literal in a call argument is not a class value', () => {
    const r = expr("getClass('badge-success')");
    expect(r.edits).toEqual([]);
    expect(r.unresolved[0]).toMatchObject({
      token: 'badge-success',
      detail: TS_DETAIL.literal,
    });
  });

  test('line comes from fullText', () => {
    const file = '<div\n  :class="`${a} ml-2`"\n/>';
    const text = '`${a} ml-2`';
    const off = file.indexOf(text);
    const r = classExprEdits(text, off, { fullText: file, allowlist: [] });
    expect(r.unresolved[0].line).toBe(2);
  });
});
