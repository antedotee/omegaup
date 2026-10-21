// TS/JS adapter for the bs5-cutover codemod (design 3.3).
//
// Finds the string spans in TS/JS source that are class values or CSS
// selectors, hands them to core.cjs, and returns offset edits into the
// original file text:
//
//   { edits: { start, end, text }[],
//     replacements: { from, to, entry }[],
//     unresolved: { token, reason, detail, line }[] }
//
// Edits are always inside a literal's quotes, computed on the raw source
// text, so quote characters and escape sequences are kept. A literal whose
// raw text differs from its cooked value (escapes) is never edited; it goes
// to manual-review instead.
//
// Exports:
//   tsEdits(text, opts)                      whole TS/JS source (or a Vue
//                                            <script> block with baseOffset)
//   classExprEdits(exprText, exprOffset, o)  one class-binding expression
//                                            (Vue `:class`)
'use strict';
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const {
  isBs4Class,
  rewriteClassList,
  rewriteSelector,
} = require('../core.cjs');

const TS_DETAIL = Object.freeze({
  interpolation: 'class value with a template interpolation',
  concatenation: 'class value built by string concatenation',
  selectorInterpolation: 'selector built with a template interpolation',
  selectorConcatenation: 'selector built by string concatenation',
  literal: 'BS4-shaped string literal outside a class or selector context',
  escapes: 'literal uses escape sequences',
  htmlStraddle: 'class attribute value straddles a template interpolation',
  htmlBound: 'bound class attribute inside a string template',
  shorthand: 'shorthand object property used as a class key',
  parseError: 'class expression could not be parsed',
});

// classList.<m>(...) and jQuery .<m>(...): which arguments are class values.
const CLASS_LIST_METHODS = {
  add: 'all',
  remove: 'all',
  contains: 'all',
  replace: 'all',
  toggle: 'first',
};
const JQUERY_CLASS_METHODS = {
  addClass: 'first',
  removeClass: 'first',
  toggleClass: 'first',
  hasClass: 'first',
};
// First string argument is a CSS selector. `get` only on `cy`.
const SELECTOR_METHODS = new Set([
  'querySelector',
  'querySelectorAll',
  'closest',
  'matches',
  'find',
  'findAll',
  'findComponent',
  'is',
  'filter',
  'children',
  'parents',
  'within',
]);
const SELECTOR_FUNCTIONS = new Set(['$', 'jQuery']);
// First string argument is an event name, never a class.
const EVENT_METHODS = new Set([
  '$emit',
  'emit',
  'emitted',
  'on',
  'off',
  'once',
  'addEventListener',
  'removeEventListener',
  'dispatchEvent',
  'trigger',
  'Emit', // vue-property-decorator @Emit('close')
]);
// Every literal in the arguments / initializer is an event name.
const EVENT_LIST_CALLS = new Set(['defineEmits']);
const EVENT_LIST_PROPS = new Set(['emits']);
// First string argument is a test title (prose), never a class.
const TEST_TITLE_CALLS = new Set([
  'it',
  'test',
  'describe',
  'context',
  'specify',
]);
const EVENT_CONSTRUCTORS = new Set(['Event', 'CustomEvent']);

const CLASS_PROP_NAME = /^(class|className)$|Class$|-class$/;
const CLASS_SHAPED = /^[a-z][a-z0-9-]*$/;
const SELECTOR_CLASS = /\.(-?[_a-zA-Z][_a-zA-Z0-9-]*)/g;
const WS = /[ \t\n\r\f]+/;

// ---------------------------------------------------------------------------
// Allowlist

let defaultAllowlist = null;
function loadDefaultAllowlist() {
  if (defaultAllowlist) return defaultAllowlist;
  const file = path.join(__dirname, '..', 'allowlist.json');
  let entries = [];
  if (fs.existsSync(file)) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    entries = Array.isArray(data) ? data : data.entries || [];
  }
  defaultAllowlist = entries;
  return entries;
}

const normPath = (p) =>
  String(p || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '');
function isAllowlisted(allowlist, filePath, line, token) {
  if (!allowlist.length || !filePath) return false;
  const p = normPath(filePath);
  return allowlist.some(
    (e) =>
      e.token === token &&
      Number(e.line) === line &&
      (normPath(e.path) === p || p.endsWith('/' + normPath(e.path))),
  );
}

// ---------------------------------------------------------------------------
// Helpers

function scriptKindFor(kind, filePath) {
  if (typeof kind === 'number') return kind;
  const k = String(kind || path.extname(filePath || '').slice(1)).toLowerCase();
  switch (k) {
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

function lineCounter(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++)
    if (text[i] === '\n') starts.push(i + 1);
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

// Line of an absolute offset: from opts.fullText when given, else from the
// local text plus opts.lineOffset (lines before the local text).
function makeLineOf(localText, localBase, opts) {
  if (typeof opts.fullText === 'string') {
    const count = lineCounter(opts.fullText);
    return (abs) => count(abs);
  }
  const count = lineCounter(localText);
  const lineOffset = opts.lineOffset || 0;
  return (abs) => lineOffset + count(abs - localBase);
}

const isStringy = (n) =>
  ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);

const isPlus = (n) =>
  ts.isBinaryExpression(n) &&
  (n.operatorToken.kind === ts.SyntaxKind.PlusToken ||
    n.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken);

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

function propName(name) {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) {
    return name.text;
  }
  return null;
}

// Method name and receiver of a call: `a.b.c(...)` -> { name: 'c', recv: a.b }.
function calleeOf(call) {
  const e = unwrapExpr(call.expression);
  if (ts.isIdentifier(e)) return { name: e.text, recv: null };
  if (ts.isPropertyAccessExpression(e)) {
    return { name: e.name.text, recv: unwrapExpr(e.expression) };
  }
  if (ts.isElementAccessExpression(e) && isStringy(e.argumentExpression)) {
    return { name: e.argumentExpression.text, recv: unwrapExpr(e.expression) };
  }
  return { name: null, recv: null };
}

function bs4Words(text) {
  return String(text)
    .split(WS)
    .filter((t) => t !== '' && isBs4Class(t));
}

function bs4SelectorClasses(text) {
  const out = [];
  for (const m of String(text).matchAll(SELECTOR_CLASS)) {
    if (isBs4Class(m[1])) out.push(m[1]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Analysis context

function createCtx(sf, toAbs, lineOf, opts) {
  const src = sf.text;
  const ctx = {
    sf,
    src,
    toAbs,
    lineOf,
    path: opts.path,
    allowlist: opts.allowlist || loadDefaultAllowlist(),
    quote: opts.quote || "'",
    edits: [],
    replacements: [],
    unresolved: [],
    consumed: new Set(),
  };
  ctx.start = (n) => n.getStart(sf);
  // Raw text between a literal's delimiters (local offsets).
  ctx.inner = (n) => {
    const s = n.getStart(sf) + 1;
    const e = n.end - 1;
    return { s, e, raw: src.slice(s, e) };
  };
  ctx.report = (localPos, list) => {
    const line = lineOf(toAbs(localPos));
    for (const u of list) ctx.unresolved.push({ ...u, line });
  };
  ctx.manual = (localPos, tokens, detail) => {
    ctx.report(
      localPos,
      tokens.map((token) => ({ token, reason: 'manual-review', detail })),
    );
  };
  ctx.edit = (localStart, localEnd, text) => {
    ctx.edits.push({ start: toAbs(localStart), end: toAbs(localEnd), text });
  };
  // Marks every literal under `node` (inclusive) as handled.
  ctx.consumeAll = (node) => {
    const texts = [];
    const visit = (n) => {
      if (isStringy(n) || ts.isTemplateExpression(n)) ctx.consumed.add(n);
      if (isStringy(n)) texts.push(n.text);
      if (ts.isTemplateExpression(n)) {
        texts.push(n.head.text, ...n.templateSpans.map((s) => s.literal.text));
      }
      ts.forEachChild(n, visit);
    };
    visit(node);
    return texts;
  };
  return ctx;
}

// Applies a core rewrite to a plain literal; the edit covers the raw inner
// span. Returns false when the literal has escapes and was sent to review.
function rewriteLiteral(ctx, lit, rewrite, findTokens) {
  ctx.consumed.add(lit);
  const { s, e, raw } = ctx.inner(lit);
  if (raw !== lit.text) {
    const tokens = findTokens(lit.text);
    if (tokens.length) ctx.manual(ctx.start(lit), tokens, TS_DETAIL.escapes);
    return;
  }
  const res = rewrite(raw);
  ctx.replacements.push(...res.replacements);
  ctx.report(ctx.start(lit), res.unresolved);
  if (res.value !== raw) ctx.edit(s, e, res.value);
}

// ---------------------------------------------------------------------------
// Class-value expressions

function classExpr(ctx, node) {
  const n = unwrapExpr(node);
  if (isStringy(n)) {
    rewriteLiteral(ctx, n, (v) => rewriteClassList(v), bs4Words);
    return;
  }
  if (ts.isTemplateExpression(n)) {
    const tokens = ctx.consumeAll(n).flatMap(bs4Words);
    if (tokens.length)
      ctx.manual(ctx.start(n), tokens, TS_DETAIL.interpolation);
    return;
  }
  if (isPlus(n)) {
    const tokens = ctx.consumeAll(n).flatMap(bs4Words);
    if (tokens.length)
      ctx.manual(ctx.start(n), tokens, TS_DETAIL.concatenation);
    return;
  }
  if (ts.isArrayLiteralExpression(n)) {
    for (const el of n.elements) {
      classExpr(ctx, ts.isSpreadElement(el) ? el.expression : el);
    }
    return;
  }
  if (ts.isConditionalExpression(n)) {
    classExpr(ctx, n.whenTrue);
    classExpr(ctx, n.whenFalse);
    return;
  }
  if (ts.isBinaryExpression(n)) {
    const op = n.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) {
      classExpr(ctx, n.right);
    } else if (
      op === ts.SyntaxKind.BarBarToken ||
      op === ts.SyntaxKind.QuestionQuestionToken
    ) {
      classExpr(ctx, n.left);
      classExpr(ctx, n.right);
    }
    return;
  }
  if (ts.isObjectLiteralExpression(n)) {
    for (const p of n.properties) classObjectKey(ctx, p);
  }
}

// Object-literal keys in a class binding are class lists; values are not.
function classObjectKey(ctx, p) {
  if (ts.isShorthandPropertyAssignment(p)) {
    if (isBs4Class(p.name.text)) {
      ctx.manual(ctx.start(p.name), [p.name.text], TS_DETAIL.shorthand);
    }
    return;
  }
  if (!ts.isPropertyAssignment(p) && !ts.isMethodDeclaration(p)) return;
  const name = p.name;
  if (isStringy(name)) {
    rewriteLiteral(ctx, name, (v) => rewriteClassList(v), bs4Words);
  } else if (ts.isIdentifier(name)) {
    const res = rewriteClassList(name.text);
    ctx.replacements.push(...res.replacements);
    ctx.report(ctx.start(name), res.unresolved);
    if (res.value !== name.text) {
      ctx.edit(ctx.start(name), name.end, ctx.quote + res.value + ctx.quote);
    }
  } else if (ts.isComputedPropertyName(name)) {
    classExpr(ctx, name.expression);
  }
}

// ---------------------------------------------------------------------------
// Selector expressions

function selectorExpr(ctx, node) {
  const n = unwrapExpr(node);
  if (isStringy(n)) {
    rewriteLiteral(ctx, n, rewriteSelector, bs4SelectorClasses);
    return;
  }
  if (ts.isTemplateExpression(n) || isPlus(n)) {
    const tokens = ctx.consumeAll(n).flatMap(bs4SelectorClasses);
    const detail = ts.isTemplateExpression(n)
      ? TS_DETAIL.selectorInterpolation
      : TS_DETAIL.selectorConcatenation;
    if (tokens.length) ctx.manual(ctx.start(n), tokens, detail);
  }
}

// ---------------------------------------------------------------------------
// HTML `class="…"` attributes inside string / template spans

const HTML_CLASS = /(^|[\s<])class(\s*=\s*)(?:"([^"]*)"|'([^']*)')/g;
const HTML_CLASS_OPEN = /(^|[\s<])class\s*=\s*(["'])([^"']*)$/;
const HTML_BOUND_CLASS =
  /(?:^|\s)(?::|v-bind:)[\w-]*class\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

// Each span: { s, e, raw, cooked } in local offsets (raw between delimiters).
// Returns true when the spans held any class attribute (handled or not).
function htmlClassAttrs(ctx, spans, litStart) {
  let found = false;
  let open = null; // { quote, tokens } of a value straddling an interpolation
  for (const span of spans) {
    let raw = span.raw;
    let offset = 0;
    if (open) {
      const close = raw.indexOf(open.quote);
      const part = close === -1 ? raw : raw.slice(0, close);
      open.tokens.push(...bs4Words(part));
      if (close === -1) continue;
      if (open.tokens.length) {
        ctx.manual(open.pos, open.tokens, TS_DETAIL.htmlStraddle);
      }
      open = null;
      offset = close + 1;
      raw = raw.slice(offset);
    }
    for (const m of raw.matchAll(HTML_CLASS)) {
      found = true;
      const value = m[3] !== undefined ? m[3] : m[4];
      const valueStart =
        span.s +
        offset +
        m.index +
        m[1].length +
        'class'.length +
        m[2].length +
        1;
      if (value.includes('\\')) {
        const tokens = bs4Words(value);
        if (tokens.length) ctx.manual(valueStart, tokens, TS_DETAIL.escapes);
        continue;
      }
      const res = rewriteClassList(value);
      ctx.replacements.push(...res.replacements);
      ctx.report(valueStart, res.unresolved);
      if (res.value !== value) {
        ctx.edit(valueStart, valueStart + value.length, res.value);
      }
    }
    for (const m of raw.matchAll(HTML_BOUND_CLASS)) {
      found = true;
      const value = m[1] !== undefined ? m[1] : m[2];
      const tokens = (value.match(/[a-z][a-z0-9-]*/g) || []).filter(isBs4Class);
      if (tokens.length) {
        ctx.manual(span.s + offset + m.index, tokens, TS_DETAIL.htmlBound);
      }
    }
    const o = raw.match(HTML_CLASS_OPEN);
    if (o) {
      found = true;
      open = {
        quote: o[2],
        tokens: bs4Words(o[3]),
        pos: span.s + offset + o.index,
      };
    }
  }
  if (open && open.tokens.length) {
    ctx.manual(open.pos, open.tokens, TS_DETAIL.htmlStraddle);
  }
  if (!found) {
    // `class=\"…\"` only shows up in the cooked value.
    const cooked = spans.map((sp) => sp.cooked).join(' ');
    const tokens = [];
    for (const m of cooked.matchAll(HTML_CLASS)) {
      tokens.push(...bs4Words(m[3] !== undefined ? m[3] : m[4]));
    }
    if (tokens.length) {
      ctx.manual(litStart, tokens, TS_DETAIL.escapes);
      return true;
    }
  }
  return found;
}

function templateSpans(ctx, tpl) {
  const src = ctx.src;
  const spans = [];
  const head = tpl.head;
  const hs = head.getStart(ctx.sf) + 1;
  spans.push({
    s: hs,
    e: head.end - 2,
    raw: src.slice(hs, head.end - 2),
    cooked: head.text,
  });
  for (const sp of tpl.templateSpans) {
    const lit = sp.literal;
    const s = lit.getStart(ctx.sf) + 1;
    const e = ts.isTemplateTail(lit) ? lit.end - 1 : lit.end - 2;
    spans.push({ s, e, raw: src.slice(s, e), cooked: lit.text });
  }
  return spans;
}

// ---------------------------------------------------------------------------
// Fallback for literals outside any context

function fallbackLiteral(ctx, n) {
  ctx.consumed.add(n);
  const pos = ctx.start(n);
  let spans;
  let detail = TS_DETAIL.literal;
  if (ts.isTemplateExpression(n)) {
    spans = templateSpans(ctx, n);
    detail = TS_DETAIL.interpolation;
  } else {
    const { s, e, raw } = ctx.inner(n);
    spans = [{ s, e, raw, cooked: n.text }];
    if (n.parent && isPlus(n.parent)) detail = TS_DETAIL.concatenation;
  }
  if (htmlClassAttrs(ctx, spans, pos)) return;
  const words = spans
    .flatMap((sp) => sp.cooked.split(WS))
    .filter((t) => t !== '');
  if (!words.length || !words.every((t) => CLASS_SHAPED.test(t))) return;
  const line = ctx.lineOf(ctx.toAbs(pos));
  for (const token of words.filter(isBs4Class)) {
    if (isAllowlisted(ctx.allowlist, ctx.path, line, token)) continue;
    ctx.unresolved.push({ token, reason: 'manual-review', detail, line });
  }
}

// ---------------------------------------------------------------------------
// Context detection

function handleCall(ctx, call) {
  const { name, recv } = calleeOf(call);
  if (!name) return;
  const args = call.arguments;
  // it('…') / describe.only('…') / test.each(…)('…'): titles are prose.
  const base = recv && ts.isIdentifier(recv) ? recv.text : !recv ? name : null;
  if (base && TEST_TITLE_CALLS.has(base) && args[0]) {
    if (isStringy(unwrapExpr(args[0]))) ctx.consumed.add(unwrapExpr(args[0]));
  } else if (ts.isCallExpression(unwrapExpr(call.expression)) && args[0]) {
    const inner = calleeOf(unwrapExpr(call.expression));
    const innerBase =
      inner.recv && ts.isIdentifier(inner.recv) ? inner.recv.text : null;
    if (
      innerBase &&
      TEST_TITLE_CALLS.has(innerBase) &&
      isStringy(unwrapExpr(args[0]))
    ) {
      ctx.consumed.add(unwrapExpr(args[0]));
    }
  }
  if (!recv && EVENT_LIST_CALLS.has(name)) {
    for (const a of args) ctx.consumeAll(a);
    return;
  }
  if (EVENT_METHODS.has(name)) {
    if (args[0] && isStringy(unwrapExpr(args[0]))) {
      ctx.consumed.add(unwrapExpr(args[0]));
    }
    return;
  }
  const classListRecv =
    recv &&
    ((ts.isPropertyAccessExpression(recv) && recv.name.text === 'classList') ||
      (ts.isIdentifier(recv) && recv.text === 'classList'));
  const classArgs =
    (classListRecv && CLASS_LIST_METHODS[name]) ||
    (recv && JQUERY_CLASS_METHODS[name]);
  if (classArgs) {
    for (const a of classArgs === 'first' ? args.slice(0, 1) : args) {
      classExpr(ctx, a);
    }
    return;
  }
  const isSelector =
    (recv && SELECTOR_METHODS.has(name)) ||
    (!recv && SELECTOR_FUNCTIONS.has(name)) ||
    (name === 'get' && recv && ts.isIdentifier(recv) && recv.text === 'cy');
  if (isSelector && args[0]) selectorExpr(ctx, args[0]);
}

function visitAll(ctx, root) {
  const visit = (n) => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return;
    if (ts.isLiteralTypeNode(n) || ts.isImportTypeNode(n)) return;
    if (ts.isExternalModuleReference(n)) return;

    if (ts.isCallExpression(n)) {
      handleCall(ctx, n);
    } else if (ts.isNewExpression(n)) {
      const e = unwrapExpr(n.expression);
      if (ts.isIdentifier(e) && EVENT_CONSTRUCTORS.has(e.text)) {
        const a = n.arguments && n.arguments[0];
        if (a && isStringy(unwrapExpr(a))) ctx.consumed.add(unwrapExpr(a));
      }
    } else if (
      ts.isBinaryExpression(n) &&
      n.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      const l = unwrapExpr(n.left);
      const lname = ts.isPropertyAccessExpression(l)
        ? l.name.text
        : ts.isElementAccessExpression(l) && isStringy(l.argumentExpression)
        ? l.argumentExpression.text
        : null;
      if (lname === 'className') classExpr(ctx, n.right);
    } else if (ts.isPropertyAssignment(n)) {
      const pname = propName(n.name);
      if (pname && CLASS_PROP_NAME.test(pname)) classExpr(ctx, n.initializer);
      else if (pname && EVENT_LIST_PROPS.has(pname)) {
        ctx.consumeAll(n.initializer);
      }
    }

    if ((isStringy(n) || ts.isTemplateExpression(n)) && !ctx.consumed.has(n)) {
      fallbackLiteral(ctx, n);
    }
    ts.forEachChild(n, visit);
  };
  visit(root);
}

function finish(ctx) {
  ctx.edits.sort((a, b) => a.start - b.start);
  ctx.unresolved.sort((a, b) => a.line - b.line);
  return {
    edits: ctx.edits,
    replacements: ctx.replacements,
    unresolved: ctx.unresolved,
  };
}

// ---------------------------------------------------------------------------
// Public API

// opts: { baseOffset = 0, path, scriptKind, allowlist, fullText, lineOffset }
//   baseOffset  offset of `text` inside the file (Vue <script> block)
//   fullText    whole file text, used for line numbers when given
//   lineOffset  lines before `text` when fullText is not given
function tsEdits(text, opts = {}) {
  const baseOffset = opts.baseOffset || 0;
  const filePath = opts.path || 'x.ts';
  const sf = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(opts.scriptKind, opts.path),
  );
  const ctx = createCtx(
    sf,
    (pos) => baseOffset + pos,
    makeLineOf(text, baseOffset, opts),
    opts,
  );
  visitAll(ctx, sf);
  return finish(ctx);
}

// Class-binding expression (Vue `:class="…"` content) at `exprOffset` in the
// file. opts: { path, allowlist, fullText, lineOffset, quote = "'" }
//   quote  delimiter for identifier keys that need quoting after rewrite
function classExprEdits(exprText, exprOffset = 0, opts = {}) {
  const wrapped = `(${exprText})`;
  const sf = ts.createSourceFile(
    'x.ts',
    wrapped,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const toAbs = (pos) => exprOffset + pos - 1;
  const ctx = createCtx(
    sf,
    toAbs,
    makeLineOf(exprText, exprOffset, opts),
    opts,
  );
  const stmt = sf.statements[0];
  const parseErrors = sf.parseDiagnostics && sf.parseDiagnostics.length;
  if (
    parseErrors ||
    sf.statements.length !== 1 ||
    !ts.isExpressionStatement(stmt)
  ) {
    const tokens = (exprText.match(/[a-z][a-z0-9-]*/g) || []).filter(
      isBs4Class,
    );
    if (tokens.length) ctx.manual(1, tokens, TS_DETAIL.parseError);
    return finish(ctx);
  }
  classExpr(ctx, stmt.expression);
  visitAll(ctx, stmt.expression);
  return finish(ctx);
}

module.exports = { TS_DETAIL, tsEdits, classExprEdits };
