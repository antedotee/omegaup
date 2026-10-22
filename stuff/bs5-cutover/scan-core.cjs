// Pure residual-scan core for the bs5-cutover (design 5, Requirement 7).
//
// scanText(path, text, opts) -> Match[], Match = { path, line, token, category }
//
// Categories:
//   bs4-class               in-scope files. The codemod adapters run in
//                           report-only mode: every token they would rewrite
//                           and every entry they report as unresolved is a
//                           match, so the codemod and the scan agree.
//   bs4-data-attribute      in-scope `.vue` (template attributes, static and
//                           `:`/`v-bind:` bound, plus attribute selectors in
//                           script string literals) and Cypress files under
//                           cypress/e2e and cypress/support (attribute
//                           selectors in string literals). Exact names only
//                           (maps.isBs4DataAttribute).
//   component-bs-import     in-scope `.vue` scripts, `.ts`, `.js`: import,
//                           import(), require() of `bootstrap/dist/css/*`.
//   jquery-bs-plugin-call   in-scope `.vue` scripts, `.ts`, `.js`: a BS4
//                           plugin method called on a receiver rooted in
//                           `$(…)` / `jQuery(…)`.
//   vendored-bs4-ref        any file: each occurrence of `bootstrap-4.5.0`.
//   sfc-sass-entry-import   in-scope `.vue` `<style>` blocks importing
//                           `sass/main` (would inline Bootstrap per SFC).
//   parse-error             the file could not be parsed, so it cannot be
//                           verified; reported as a match so the scan never
//                           passes on it.
//
// No I/O: adapters get `allowlist: []` so they never read allowlist.json;
// the allowlist from `opts.allowlist` is applied here.
'use strict';
const ts = require('typescript');
const selectorParser = require('postcss-selector-parser');
const { parse: parseSfc } = require('@vue/compiler-sfc');
const {
  BS4_KEYS,
  isBs4DataAttribute,
  isInScope,
  normalizePath,
} = require('./maps.cjs');
const { adapterEdits } = require('./codemod-core.cjs');

const CATEGORIES = Object.freeze([
  'bs4-class',
  'bs4-data-attribute',
  'component-bs-import',
  'jquery-bs-plugin-call',
  'vendored-bs4-ref',
]);
const EXTRA_CATEGORIES = Object.freeze([
  'sfc-sass-entry-import',
  'parse-error',
]);

const VENDORED_REF = 'bootstrap-4.5.0';
const JQUERY_PLUGINS = new Set([
  'modal',
  'tooltip',
  'popover',
  'collapse',
  'dropdown',
  'tab',
  'carousel',
  'scrollspy',
  'toast',
  'alert',
  'button',
]);
const JQUERY_ROOTS = new Set(['$', 'jQuery']);
const BS_CSS_SPECIFIER = /^~?bootstrap\/dist\/css\//;
const CYPRESS_SELECTOR_DIRS = /^cypress\/(e2e|support)\//;
const TOKEN_RUN = /[A-Za-z0-9_-]+/g;
const ATTR_FALLBACK = /\[\s*([A-Za-z_][\w-]*)\s*(?=[~|^$*]?=|\])/g;
const SASS_ENTRY_IMPORT = /@(?:import|use|forward)\s+(['"])([^'"]+)\1/g;
const SASS_MAIN = /(^|\/)sass\/_?main(\.scss)?$/;

// ---------------------------------------------------------------------------
// Helpers

function lineCounter(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) starts.push(i + 1);
  }
  return (pos) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= pos) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

const extOf = (p) => {
  const m = /\.[^./]+$/.exec(p);
  return m ? m[0].toLowerCase() : '';
};

function unwrapExpr(n) {
  while (
    ts.isParenthesizedExpression(n) ||
    ts.isAsExpression(n) ||
    ts.isNonNullExpression(n) ||
    ts.isTypeAssertionExpression(n) ||
    (ts.isSatisfiesExpression && ts.isSatisfiesExpression(n))
  ) {
    n = n.expression;
  }
  return n;
}

const isStringy = (n) =>
  ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);

function scriptKindOf(langOrExt) {
  switch (langOrExt) {
    case 'js':
    case 'cjs':
    case 'mjs':
      return ts.ScriptKind.JS;
    case 'jsx':
      return ts.ScriptKind.JSX;
    case 'tsx':
      return ts.ScriptKind.TSX;
    default:
      return ts.ScriptKind.TS;
  }
}

// ---------------------------------------------------------------------------
// bs4-class: adapters in report-only mode

// BS4 keys in `s` with their offsets (whole [A-Za-z0-9_-] runs).
function bs4Runs(s) {
  const out = [];
  for (const m of String(s).matchAll(TOKEN_RUN)) {
    if (BS4_KEYS.has(m[0])) out.push({ token: m[0], index: m.index });
  }
  return out;
}

// Tokens an edit rewrites: BS4 keys in the original span minus BS4 keys
// still present in the replacement text (multiset). Tokens kept by the edit
// (unresolved ones in the same literal) are left to the unresolved list.
function editTokens(text, edit) {
  const before = bs4Runs(text.slice(edit.start, edit.end));
  const remaining = new Map();
  for (const r of bs4Runs(edit.text)) {
    remaining.set(r.token, (remaining.get(r.token) || 0) + 1);
  }
  const removedCount = new Map();
  for (const r of before) {
    removedCount.set(r.token, (removedCount.get(r.token) || 0) + 1);
  }
  for (const [t, n] of remaining) {
    removedCount.set(t, Math.max(0, (removedCount.get(t) || 0) - n));
  }
  const out = [];
  for (const r of before) {
    const left = removedCount.get(r.token) || 0;
    if (left === 0) continue;
    removedCount.set(r.token, left - 1);
    out.push({ token: r.token, offset: edit.start + r.index });
  }
  return out;
}

function bs4ClassMatches(path, text, lineOf) {
  let res;
  try {
    res = adapterEdits(path, text, { allowlist: [] });
  } catch (e) {
    return [parseError(path, e.message)];
  }
  if (res.error) return [parseError(path, res.error)];
  const out = [];
  for (const edit of res.edits || []) {
    for (const { token, offset } of editTokens(text, edit)) {
      out.push({ path, line: lineOf(offset), token, category: 'bs4-class' });
    }
  }
  for (const u of res.unresolved || []) {
    out.push({ path, line: u.line, token: u.token, category: 'bs4-class' });
  }
  return out;
}

function parseError(path, message) {
  const first = String(message).split('\n')[0];
  return { path, line: 1, token: first.slice(0, 200), category: 'parse-error' };
}

// ---------------------------------------------------------------------------
// Script checks (TS AST): imports, jQuery plugin calls, selector attributes

function selectorAttributes(s) {
  const names = [];
  if (!s.includes('[')) return names;
  try {
    selectorParser((root) => {
      root.walkAttributes((node) => {
        names.push({ name: node.attribute, index: node.sourceIndex });
      });
    }).processSync(s, { lossless: true });
    return names;
  } catch (_) {
    names.length = 0;
    for (const m of s.matchAll(ATTR_FALLBACK)) {
      names.push({ name: m[1], index: m.index });
    }
    return names;
  }
}

// Receiver chain roots in `$(…)` / `jQuery(…)` through parens, `as` casts,
// non-null assertions, property accesses and chained calls.
function rootedInJQuery(node) {
  let n = unwrapExpr(node);
  for (;;) {
    if (ts.isCallExpression(n)) {
      const callee = unwrapExpr(n.expression);
      if (ts.isIdentifier(callee) && JQUERY_ROOTS.has(callee.text)) return true;
      if (
        ts.isPropertyAccessExpression(callee) &&
        JQUERY_ROOTS.has(callee.name.text)
      ) {
        return true; // window.$(…)
      }
      if (
        ts.isPropertyAccessExpression(callee) ||
        ts.isElementAccessExpression(callee)
      ) {
        n = unwrapExpr(callee.expression);
        continue;
      }
      return false;
    }
    if (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) {
      n = unwrapExpr(n.expression);
      continue;
    }
    return false;
  }
}

function scriptMatches(path, block, lineOf, { selectors }) {
  const out = [];
  const sf = ts.createSourceFile(
    'x.ts',
    block.content,
    ts.ScriptTarget.Latest,
    true,
    scriptKindOf(block.kind),
  );
  const abs = (pos) => block.baseOffset + pos;
  const add = (pos, token, category) =>
    out.push({ path, line: lineOf(abs(pos)), token, category });

  const importSpec = (lit) => {
    if (lit && isStringy(lit) && BS_CSS_SPECIFIER.test(lit.text)) {
      add(lit.getStart(sf), lit.text, 'component-bs-import');
    }
  };

  const literalPieces = (n) => {
    if (isStringy(n)) return [{ node: n, text: n.text }];
    if (ts.isTemplateExpression(n)) {
      return [
        { node: n.head, text: n.head.text },
        ...n.templateSpans.map((s) => ({
          node: s.literal,
          text: s.literal.text,
        })),
      ];
    }
    return [];
  };

  const visit = (n) => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) {
      importSpec(n.moduleSpecifier);
      return;
    }
    if (
      ts.isImportEqualsDeclaration(n) &&
      ts.isExternalModuleReference(n.moduleReference)
    ) {
      importSpec(n.moduleReference.expression);
      return;
    }
    if (ts.isCallExpression(n)) {
      const callee = unwrapExpr(n.expression);
      const isImport = n.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(callee) && callee.text === 'require';
      if ((isImport || isRequire) && n.arguments[0]) {
        importSpec(unwrapExpr(n.arguments[0]));
      }
      if (
        ts.isPropertyAccessExpression(callee) &&
        JQUERY_PLUGINS.has(callee.name.text) &&
        rootedInJQuery(callee.expression)
      ) {
        add(
          callee.name.getStart(sf),
          callee.name.text,
          'jquery-bs-plugin-call',
        );
      }
    }
    if (selectors && (isStringy(n) || ts.isTemplateExpression(n))) {
      for (const piece of literalPieces(n)) {
        const start = piece.node.getStart(sf);
        const raw = block.content.slice(start + 1, piece.node.end - 1);
        for (const a of selectorAttributes(piece.text)) {
          if (!isBs4DataAttribute(a.name)) continue;
          // Raw and cooked agree when there are no escapes: use the exact
          // offset; else the literal's start.
          const pos = raw.startsWith(piece.text) ? start + 1 + a.index : start;
          add(pos, a.name, 'bs4-data-attribute');
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

// ---------------------------------------------------------------------------
// Vue template and style checks

const NODE_ELEMENT = 1;
const PROP_ATTRIBUTE = 6;
const PROP_DIRECTIVE = 7;

function templateDataAttributes(path, ast, lineOf) {
  const out = [];
  const walk = (node) => {
    for (const c of node.children || []) {
      if (c.type !== NODE_ELEMENT) continue;
      for (const p of c.props) {
        let name = null;
        if (p.type === PROP_ATTRIBUTE) name = p.name;
        else if (
          p.type === PROP_DIRECTIVE &&
          p.name === 'bind' &&
          p.arg &&
          p.arg.isStatic
        ) {
          name = p.arg.content;
        }
        if (name && isBs4DataAttribute(name)) {
          out.push({
            path,
            line: lineOf(p.loc.start.offset),
            token: name,
            category: 'bs4-data-attribute',
          });
        }
      }
      walk(c);
    }
  };
  walk(ast);
  return out;
}

function sassEntryImports(path, style, lineOf) {
  const out = [];
  for (const m of style.content.matchAll(SASS_ENTRY_IMPORT)) {
    if (!SASS_MAIN.test(m[2])) continue;
    out.push({
      path,
      line: lineOf(style.loc.start.offset + m.index),
      token: m[2],
      category: 'sfc-sass-entry-import',
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Allowlist

function allowKey(path, line, token) {
  return `${normalizePath(path)}\u0000${Number(line)}\u0000${token}`;
}

// Splits matches into kept and allowlisted. `used` holds the indexes of the
// allowlist entries that suppressed at least one match (task 9.2 counts the
// rest as stale).
function applyAllowlist(matches, allowlist = []) {
  const index = new Map();
  allowlist.forEach((e, i) => {
    const k = allowKey(e.path, e.line, e.token);
    if (!index.has(k)) index.set(k, []);
    index.get(k).push(i);
  });
  const kept = [];
  const used = new Set();
  for (const m of matches) {
    const hit = index.get(allowKey(m.path, m.line, m.token));
    if (hit) {
      for (const i of hit) used.add(i);
      continue;
    }
    kept.push(m);
  }
  return { matches: kept, used };
}

// ---------------------------------------------------------------------------
// Public API

function compareMatches(a, b) {
  return (
    a.line - b.line ||
    a.category.localeCompare(b.category) ||
    a.token.localeCompare(b.token)
  );
}

// All matches for one file before the allowlist is applied.
function rawMatches(filePath, text) {
  const path = normalizePath(filePath);
  const src = String(text);
  const lineOf = lineCounter(src);
  const out = [];

  for (
    let i = src.indexOf(VENDORED_REF);
    i !== -1;
    i = src.indexOf(VENDORED_REF, i + 1)
  ) {
    out.push({
      path,
      line: lineOf(i),
      token: VENDORED_REF,
      category: 'vendored-bs4-ref',
    });
  }

  if (!isInScope(path) || src.length === 0) return out.sort(compareMatches);

  out.push(...bs4ClassMatches(path, src, lineOf));

  const ext = extOf(path);
  if (ext === '.vue') {
    let descriptor;
    let errors;
    try {
      ({ descriptor, errors } = parseSfc(src, {
        sourceMap: false,
        filename: path,
      }));
    } catch (e) {
      errors = [e];
    }
    if (errors && errors.length) {
      // bs4ClassMatches already reported the same failure from the adapter.
      if (!out.some((m) => m.category === 'parse-error')) {
        out.push(parseError(path, String(errors[0].message || errors[0])));
      }
      return out.sort(compareMatches);
    }
    if (descriptor.template && descriptor.template.ast) {
      out.push(
        ...templateDataAttributes(path, descriptor.template.ast, lineOf),
      );
    }
    for (const block of [descriptor.script, descriptor.scriptSetup]) {
      if (!block) continue;
      out.push(
        ...scriptMatches(
          path,
          {
            content: block.content,
            baseOffset: block.loc.start.offset,
            kind: block.lang || 'js',
          },
          lineOf,
          { selectors: true },
        ),
      );
    }
    for (const style of descriptor.styles) {
      out.push(...sassEntryImports(path, style, lineOf));
    }
  } else if (ext === '.ts' || ext === '.js') {
    out.push(
      ...scriptMatches(
        path,
        { content: src, baseOffset: 0, kind: ext.slice(1) },
        lineOf,
        { selectors: CYPRESS_SELECTOR_DIRS.test(path) },
      ),
    );
  }
  return out.sort(compareMatches);
}

// opts: { allowlist?: { path, line, token }[] }
function scanText(filePath, text, opts = {}) {
  return applyAllowlist(rawMatches(filePath, text), opts.allowlist || [])
    .matches;
}

module.exports = {
  CATEGORIES,
  EXTRA_CATEGORIES,
  VENDORED_REF,
  JQUERY_PLUGINS,
  scanText,
  rawMatches,
  applyAllowlist,
  editTokens,
};
