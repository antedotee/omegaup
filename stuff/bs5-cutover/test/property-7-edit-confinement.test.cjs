// Property 7: Edits are confined to class spans (design, Correctness
// Properties).
//
// For any generated file, every byte outside the spans that adapters
// classify as class values or selectors is identical between input and
// output. CSS declarations, at-rule params, comments, and every non-class
// attribute name and value (including all `data-*` attributes) are unchanged.
//
// The class spans are recomputed here from independent parses (compiler-sfc
// AST, TypeScript literals, postcss-scss rules, the markup class-attribute
// regex), not read back from the adapters. The one documented exception is
// the Vue DOM rules (design 3.3): a deletion outside every class span is
// allowed only when the deleted bytes are exactly the start or end tag of a
// bare `input-group-append/prepend` wrapper (only a class attribute), or the
// × glyph content of a `btn-close`. So it can never remove a non-class
// attribute either. (vueEdits strips its internal `structural` flag, so the
// shape is matched on the deleted bytes.)
//
// **Validates: Requirements 5.7, 4.6**
'use strict';
const fc = require('fast-check');
const ts = require('typescript');
const postcssScss = require('postcss-scss');
const { parse: parseSfc } = require('@vue/compiler-sfc');
const { vueEdits } = require('../adapters/vue.cjs');
const { tsEdits } = require('../adapters/ts.cjs');
const { cssEdits } = require('../adapters/css.cjs');
const { markupEdits } = require('../adapters/markup.cjs');
const { sfc, scss, tsFile, tplFile } = require('./arbitraries.cjs');

const RUNS = { numRuns: 150 };

// ---------------------------------------------------------------------------
// Helpers

function apply(text, edits) {
  let out = text;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return out;
}

function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++)
    if (text[i] === '\n') starts.push(i + 1);
  return starts;
}
const offsetOf = (starts, pos) => starts[pos.line - 1] + pos.column - 1;

// Spans of rule selectors and `@extend` at-rules in a CSS/SCSS text.
function cssClassSpans(text, base = 0) {
  const starts = lineStarts(text);
  const spans = [];
  postcssScss.parse(text).walk((node) => {
    const start = offsetOf(starts, node.source.start);
    if (node.type === 'rule') {
      const raw =
        (node.raws.selector && node.raws.selector.raw) || node.selector;
      spans.push([base + start, base + start + raw.length]);
    } else if (node.type === 'atrule' && node.name === 'extend') {
      spans.push([base + start, base + offsetOf(starts, node.source.end) + 1]);
    }
  });
  return spans;
}

// Spans of string and template-literal pieces in TS/JS text.
function tsLiteralSpans(text, base = 0) {
  const sf = ts.createSourceFile('x.ts', text, ts.ScriptTarget.Latest, true);
  const spans = [];
  const visit = (n) => {
    if (
      ts.isStringLiteral(n) ||
      ts.isNoSubstitutionTemplateLiteral(n) ||
      n.kind === ts.SyntaxKind.TemplateHead ||
      n.kind === ts.SyntaxKind.TemplateMiddle ||
      n.kind === ts.SyntaxKind.TemplateTail
    ) {
      spans.push([base + n.getStart(sf), base + n.getEnd()]);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return spans;
}

const STATIC_CLASS = /^(class|.+-class)$/;
const BOUND_CLASS = /^(class|.+-class|.+Class)$/;

// Template class spans: static class/*-class values (with quotes) and bound
// class expressions.
function templateClassSpans(ast) {
  const spans = [];
  const walk = (node) => {
    for (const c of node.children || []) {
      if (c.type !== 1) continue;
      for (const p of c.props) {
        if (p.type === 6 && STATIC_CLASS.test(p.name) && p.value) {
          spans.push([p.value.loc.start.offset, p.value.loc.end.offset]);
        } else if (
          p.type === 7 &&
          p.name === 'bind' &&
          p.arg &&
          p.arg.isStatic &&
          BOUND_CLASS.test(p.arg.content) &&
          p.exp
        ) {
          spans.push([p.exp.loc.start.offset, p.exp.loc.end.offset]);
        }
      }
      walk(c);
    }
  };
  walk(ast);
  return spans;
}

function vueClassSpans(text) {
  const { descriptor } = parseSfc(text, { sourceMap: false });
  const spans = templateClassSpans(descriptor.template.ast);
  for (const block of [descriptor.script, descriptor.scriptSetup]) {
    if (block)
      spans.push(...tsLiteralSpans(block.content, block.loc.start.offset));
  }
  for (const s of descriptor.styles) {
    spans.push(...cssClassSpans(s.content, s.loc.start.offset));
  }
  return spans;
}

function markupClassSpans(text) {
  const spans = [];
  for (const m of text.matchAll(/(\sclass\s*=\s*)("[^"]*"|'[^']*')/g)) {
    const s = m.index + m[1].length;
    spans.push([s, s + m[2].length]);
  }
  for (const m of text.matchAll(/(<style\b[^>]*>)([\s\S]*?)<\/style/gi)) {
    spans.push(...cssClassSpans(m[2], m.index + m[1].length));
  }
  return spans;
}

// DOM-rule exception: the exact byte shapes a structural edit may delete.
// The start tag holds nothing but the class attribute, and only a `<div>`
// or `<span>` wrapper is unwrapped (other tags go to manual-conversion).
const UNWRAP_OPEN =
  /^<(div|span)\s+class\s*=\s*(["'])\s*input-group-(append|prepend)\s*\2\s*>\s*$/;
const UNWRAP_CLOSE = /^\s*<\/(div|span)\s*>$/;
const GLYPH_CONTENT =
  /^\s*(×|&times;|<span aria-hidden="true">\s*(×|&times;)\s*<\/span>)\s*$/;
const structuralOk = (text, e) => {
  const deleted = text.slice(e.start, e.end);
  return (
    e.text === '' &&
    (UNWRAP_OPEN.test(deleted) ||
      UNWRAP_CLOSE.test(deleted) ||
      GLYPH_CONTENT.test(deleted))
  );
};

// Every edit lies inside one class span (or, for .vue, is a DOM-rule
// deletion), and
// edits do not overlap.
function expectConfined(text, edits, spans, { structural = false } = {}) {
  const sorted = [...edits].sort((a, b) => a.start - b.start);
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    expect(0 <= e.start && e.start <= e.end && e.end <= text.length).toBe(true);
    if (i > 0) expect(sorted[i - 1].end <= e.start).toBe(true);
    const inside = spans.some(([s, end]) => s <= e.start && e.end <= end);
    if (!inside && !(structural && structuralOk(text, e))) {
      throw new Error(
        `edit outside class spans at ${e.start}-${e.end}: ${JSON.stringify(
          text.slice(e.start, e.end),
        )} -> ${JSON.stringify(e.text)}`,
      );
    }
  }
}

// Non-class content the generators emit. Each must occur exactly as often in
// the output as in the input.
const PROTECTED = Object.freeze([
  // CSS declarations, variables, at-rule params, comments
  'border-left: 1px solid #ccc;',
  'border-right: 0;',
  'text-align: right;',
  'margin-left: 0.5rem;',
  'float: left;',
  'display: block;',
  'color: $omegaup-primary--darker;',
  '$panel-gap: 1rem;',
  '@media (max-width: 576px)',
  "@import '../../../../sass/site';",
  '// close the ml-2 gap',
  '// .form-group spacing',
  '/* .badge-primary legacy */',
  // Non-class template attributes and text
  '@click="onClose"',
  '{{ T.wordsClose }}',
  '{{ title }}',
  '{% if LOGGED_IN %}',
  '{% endif %}',
  // Script decoys
  "this.$emit('close');",
  "this.$emit('update:value', 1);",
  "wrapper.vm.$emit('close');",
  'channel.close();',
  'const closeModal = (): void => {};',
  '// close the modal after ml-2 spacing',
  '// close ml-2 form-group',
]);
const count = (hay, needle) => hay.split(needle).length - 1;
// Every data-* attribute (template) or attribute selector (CSS/JS), with value.
const dataAttrs = (s) =>
  (s.match(/data-[a-z0-9-]+(?:="[^"]*")?/g) || []).sort();

function expectProtectedKept(input, output) {
  for (const p of PROTECTED) {
    expect([p, count(output, p)]).toEqual([p, count(input, p)]);
  }
  expect(dataAttrs(output)).toEqual(dataAttrs(input));
}

// ---------------------------------------------------------------------------

describe('Property 7: Edits are confined to class spans', () => {
  test('example: declarations, comments and data-* survive a rewrite', () => {
    const src =
      '.ml-2 {\n  // .ml-2 spacing\n  margin-left: 0.5rem;\n  text-align: right;\n}\n';
    const { edits } = cssEdits(src, { path: 'x.scss' });
    const out = apply(src, edits);
    expect(out).toBe(
      '.ms-2 {\n  // .ml-2 spacing\n  margin-left: 0.5rem;\n  text-align: right;\n}\n',
    );
    const vue =
      '<template>\n  <div>\n    <span class="mr-2" data-toggle="collapse" data-run-status-help title="mr-2">x</span>\n  </div>\n</template>\n';
    const r = vueEdits(vue, { path: 'x.vue', allowlist: [] });
    expect(apply(vue, r.edits)).toBe(
      vue.replace('class="mr-2"', 'class="me-2"'),
    );
  });

  test('example: DOM-rule deletions match the documented shapes', () => {
    const vue =
      '<template>\n  <div class="input-group" data-x="1">\n    <div class="input-group-append">\n      <button class="close" aria-label="x" data-close-btn>&times;</button>\n    </div>\n  </div>\n</template>\n';
    const r = vueEdits(vue, { path: 'x.vue', allowlist: [] });
    expectConfined(vue, r.edits, vueClassSpans(vue), { structural: true });
    expect(apply(vue, r.edits)).toBe(
      '<template>\n  <div class="input-group" data-x="1">\n    <button class="btn-close" aria-label="x" data-close-btn></button>\n  </div>\n</template>\n',
    );
    // The same deletions are rejected outside .vue DOM rules.
    expect(() => expectConfined(vue, r.edits, vueClassSpans(vue))).toThrow(
      /outside class spans/,
    );
  });

  test('.vue: edits stay in class spans or DOM-rule shapes', () => {
    fc.assert(
      fc.property(sfc, (text) => {
        const r = vueEdits(text, { path: 'x.vue', allowlist: [] });
        expect(r.error).toBeUndefined();
        expectConfined(text, r.edits, vueClassSpans(text), {
          structural: true,
        });
        expectProtectedKept(text, apply(text, r.edits));
      }),
      RUNS,
    );
  });

  test('.scss: edits stay in selectors and @extend params', () => {
    fc.assert(
      fc.property(scss, (text) => {
        const r = cssEdits(text, { path: 'x.scss' });
        expectConfined(text, r.edits, cssClassSpans(text));
        expectProtectedKept(text, apply(text, r.edits));
      }),
      RUNS,
    );
  });

  test('.ts: edits stay in string literals', () => {
    fc.assert(
      fc.property(tsFile, (text) => {
        const r = tsEdits(text, { path: 'x.ts', allowlist: [] });
        expectConfined(text, r.edits, tsLiteralSpans(text));
        expectProtectedKept(text, apply(text, r.edits));
      }),
      RUNS,
    );
  });

  test('.tpl: edits stay in class attributes and <style> selectors', () => {
    fc.assert(
      fc.property(tplFile, (text) => {
        const r = markupEdits(text, { path: 'x.tpl' });
        expectConfined(text, r.edits, markupClassSpans(text));
        expectProtectedKept(text, apply(text, r.edits));
      }),
      RUNS,
    );
  });
});
