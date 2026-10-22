// Example-based tests for adapters/css.cjs (design 3.3, Requirements 5.2, 5.7, 5.12).
'use strict';
const { cssEdits } = require('../adapters/css.cjs');
const { DETAIL } = require('../core.cjs');

// Applies edits back to front to the full text.
function apply(text, edits) {
  let out = text;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return out;
}
const run = (text, opts) => {
  const r = cssEdits(text, opts);
  return { ...r, out: apply(text, r.edits) };
};

describe('cssEdits', () => {
  test('plain css rule selector', () => {
    const { out, replacements, unresolved } = run('.ml-2 { color: red; }\n');
    expect(out).toBe('.ms-2 { color: red; }\n');
    expect(replacements).toEqual([
      { from: 'ml-2', to: ['ms-2'], entry: 'ml-2' },
    ]);
    expect(unresolved).toEqual([]);
  });

  test('nested scss with & compound', () => {
    const text =
      '.card {\n  &.ml-2 { margin: 0; }\n  .x > .text-right { a: b; }\n}\n';
    expect(run(text).out).toBe(
      '.card {\n  &.ms-2 { margin: 0; }\n  .x > .text-end { a: b; }\n}\n',
    );
  });

  test('@extend params are rewritten, !optional kept', () => {
    const text = '.a { @extend .ml-2; }\n.b { @extend .ml-2 !optional; }\n';
    expect(run(text).out).toBe(
      '.a { @extend .ms-2; }\n.b { @extend .ms-2 !optional; }\n',
    );
  });

  test('declarations are never touched', () => {
    const text =
      '.x { border-left: 1px solid; text-align: right; content: ".ml-2"; }\n';
    const r = run(text);
    expect(r.edits).toEqual([]);
    expect(r.unresolved).toEqual([]);
  });

  test('comments are never touched', () => {
    const text = '/* .ml-2 */\n// .text-right\n.x { /* .ml-2 */ a: b; }\n';
    const r = run(text);
    expect(r.out).toBe(text);
    expect(r.replacements).toEqual([]);
  });

  test('@media params are not inspected; nested rules are', () => {
    const text = '@media (min-width: 1px) and .ml-2 { .ml-2 { a: b; } }\n';
    expect(run(text).out).toBe(
      '@media (min-width: 1px) and .ml-2 { .ms-2 { a: b; } }\n',
    );
  });

  test('multi-line selector list with an inline comment', () => {
    const text = '.a .ml-2,\n/* keep */ .b,\n  .text-right\n{\n  a: b;\n}\n';
    const r = run(text);
    expect(r.out).toBe(
      '.a .ms-2,\n/* keep */ .b,\n  .text-end\n{\n  a: b;\n}\n',
    );
    expect(r.edits).toHaveLength(1);
  });

  test('CRLF input keeps every \\r\\n', () => {
    const text =
      'a {}\r\n.x,\r\n  .ml-2\r\n{ a: b; }\r\n.p {\r\n  &.mr-1 { a: b; }\r\n}\r\n';
    expect(run(text).out).toBe(
      'a {}\r\n.x,\r\n  .ms-2\r\n{ a: b; }\r\n.p {\r\n  &.me-1 { a: b; }\r\n}\r\n',
    );
  });

  test('baseOffset / baseLine map into the enclosing file', () => {
    const file =
      '<template><div /></template>\n<style lang="scss">\n.a {}\n.form-group { a: b; }\n.ml-2 { a: b; }\n</style>\n';
    const open = file.indexOf('>', file.indexOf('<style')) + 1;
    const close = file.indexOf('</style>');
    const block = file.slice(open, close);
    const r = cssEdits(block, { baseOffset: open, baseLine: 2 });
    expect(apply(file, r.edits)).toBe(file.replace('.ml-2 {', '.ms-2 {'));
    expect(r.unresolved).toEqual([
      {
        token: 'form-group',
        reason: 'manual-review',
        detail: DETAIL.selectorRemoval,
        line: 4,
      },
    ]);
  });

  test('#{} interpolation with a BS4 token is manual-review, unchanged', () => {
    const text = '.x-#{$n} .ml-2 { a: b; }\n';
    const r = run(text);
    expect(r.out).toBe(text);
    expect(r.unresolved).toEqual([
      expect.objectContaining({
        token: 'ml-2',
        reason: 'manual-review',
        detail: DETAIL.selectorInterpolation,
        line: 1,
      }),
    ]);
  });

  test(':deep(), ::v-deep and >>> are plain selector text', () => {
    const text =
      ':deep(.ml-2) { a: b; }\n::v-deep .text-right { a: b; }\n.a >>> .mr-1 { a: b; }\n';
    expect(run(text).out).toBe(
      ':deep(.ms-2) { a: b; }\n::v-deep .text-end { a: b; }\n.a >>> .me-1 { a: b; }\n',
    );
  });

  test('near misses survive', () => {
    const text = '.close-button, .form-group-title, .panel-heading { a: b; }\n';
    const r = run(text);
    expect(r.out).toBe(text);
    expect(r.unresolved).toEqual([]);
  });
});
