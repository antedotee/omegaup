// Feature: bootstrap5-css-cutover, Property 6: Class-binding expression forms
//
// For any `:class` / `v-bind:class` expression built from string literals,
// arrays, quoted-key object literals, and conditionals (nested to depth 3)
// containing BS4_Class keys, the rewritten expression still parses as a
// TypeScript expression with the same AST shape. Every literal in a class
// position is rewritten as in Property 2 (core rewriteClassList), and every
// identifier and condition is unchanged.
//
// **Validates: Requirements 5.5**
'use strict';
const fc = require('fast-check');
const ts = require('typescript');
const { classExpr, RENAME_MAP, REMOVAL_MAP } = require('./arbitraries.cjs');
const { rewriteClassList } = require('../core.cjs');
const { classExprEdits } = require('../adapters/ts.cjs');
const { vueEdits } = require('../adapters/vue.cjs');

const RUNS = { numRuns: 200 };

const REWRITABLE = new Set([
  ...Object.keys(RENAME_MAP),
  ...Object.keys(REMOVAL_MAP).filter((k) => REMOVAL_MAP[k].kind === 'replace'),
]);

function apply(text, edits) {
  let out = text;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return out;
}

// Parses `(expr)` and returns the inner expression, or null on parse errors.
function parseExpr(expr) {
  const sf = ts.createSourceFile(
    'x.ts',
    `(${expr})`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (sf.parseDiagnostics.length || sf.statements.length !== 1) return null;
  const stmt = sf.statements[0];
  if (!ts.isExpressionStatement(stmt)) return null;
  return { sf, root: stmt.expression };
}

const isLit = (n) =>
  ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);

// Class-position literals of the generated forms, in source order.
function classLiterals(root) {
  const out = [];
  const visit = (node) => {
    let n = node;
    while (ts.isParenthesizedExpression(n)) n = n.expression;
    if (isLit(n)) out.push(n);
    else if (ts.isArrayLiteralExpression(n)) n.elements.forEach(visit);
    else if (ts.isConditionalExpression(n)) {
      visit(n.whenTrue);
      visit(n.whenFalse);
    } else if (ts.isObjectLiteralExpression(n)) {
      for (const p of n.properties) {
        if (ts.isPropertyAssignment(p) && isLit(p.name)) out.push(p.name);
      }
    }
  };
  visit(root);
  return out;
}

// AST shape with class-position literal text blanked; every other token
// (identifiers, condition operators and literals) keeps its text.
function shape(parsed) {
  const classLits = new Set(classLiterals(parsed.root));
  const walk = (n) => {
    const kind = ts.SyntaxKind[n.kind];
    if (classLits.has(n)) return `${kind}<class>`;
    const kids = n.getChildren(parsed.sf);
    if (!kids.length) return `${kind}:${n.getText(parsed.sf)}`;
    return `${kind}(${kids.map(walk).join(',')})`;
  };
  return walk(parsed.root);
}

// Expected output: each class-position literal's inner text rewritten by core.
function expectedRewrite(expr) {
  const parsed = parseExpr(expr);
  const lits = classLiterals(parsed.root);
  let out = expr;
  // Positions are in the `(expr)` wrapper (shift by 1); the inner span skips
  // one quote on each side. In the wrapper, start + 1 - 1 = start.
  for (const lit of [...lits].sort((a, b) => b.getStart() - a.getStart())) {
    const s = lit.getStart(parsed.sf);
    const e = lit.end - 2;
    out =
      out.slice(0, s) + rewriteClassList(out.slice(s, e)).value + out.slice(e);
  }
  return out;
}

function checkRewritten(input, output) {
  const before = parseExpr(input);
  const after = parseExpr(output);
  expect(before).not.toBeNull();
  // Still a single TypeScript expression.
  expect(after).not.toBeNull();
  // Same AST shape; identifiers and conditions unchanged.
  expect(shape(after)).toBe(shape(before));
  // Every class-position literal rewritten as in Property 2.
  expect(output).toBe(expectedRewrite(input));
  for (const lit of classLiterals(after.root)) {
    for (const t of lit.text.split(/\s+/).filter(Boolean)) {
      expect(REWRITABLE.has(t)).toBe(false);
    }
  }
}

const OFFSET_PREFIX = '<span :class="';

describe('Property 6: class-binding expression forms', () => {
  test('classExprEdits rewrites class literals and keeps shape', () => {
    fc.assert(
      fc.property(classExpr(3), fc.nat(500), (expr, pad) => {
        // Arbitrary file offset: edits must be absolute.
        const file = ' '.repeat(pad) + expr;
        const res = classExprEdits(expr, pad, { path: 'x.vue', allowlist: [] });
        const out = apply(file, res.edits).slice(pad);
        checkRewritten(expr, out);
      }),
      RUNS,
    );
  });

  test.each([':class', 'v-bind:class'])(
    'vueEdits rewrites %s bindings and keeps shape',
    (binding) => {
      fc.assert(
        fc.property(classExpr(3), (expr) => {
          const prefix = `<template>\n  <div>\n    <span ${binding}="`;
          const suffix = '"></span>\n  </div>\n</template>\n';
          const src = prefix + expr + suffix;
          const res = vueEdits(src, { path: 'x.vue', allowlist: [] });
          expect(res.error).toBeUndefined();
          const out = apply(src, res.edits);
          expect(out.startsWith(prefix)).toBe(true);
          expect(out.endsWith(suffix)).toBe(true);
          checkRewritten(
            expr,
            out.slice(prefix.length, out.length - suffix.length),
          );
        }),
        RUNS,
      );
    },
  );

  test('example: nested forms', () => {
    const expr =
      "['ml-2 card', { 'badge-primary': isActive }, (cond ? `float-left` : 'pr-3')]";
    const res = classExprEdits(expr, OFFSET_PREFIX.length);
    const out = apply(OFFSET_PREFIX + expr, res.edits).slice(
      OFFSET_PREFIX.length,
    );
    expect(out).toBe(
      "['ms-2 card', { 'bg-primary': isActive }, (cond ? `float-start` : 'pe-3')]",
    );
  });
});
