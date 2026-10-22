// Vue SFC adapter for the bs5-cutover codemod (design 3.3).
//
// vueEdits(text, { path, allowlist }) returns
//   { edits: { start, end, text }[], replacements,
//     unresolved: (Unresolved & { line })[], error? }
// with absolute offsets into `text`. When the original does not parse, the
// result is `{ edits: [], replacements: [], unresolved: [], error }` and the
// codemod reports the file (Requirement 6.8).
//
// Template class contexts go through core.rewriteClassList (static `class`
// and `*-class` attributes) or ts.classExprEdits (`:class`, `:*-class`,
// `:*Class` bindings). DOM rules: unwrap of bare `input-group-append/prepend`,
// `btn-block` stacked detection, `btn-close` glyph-content strip and
// accessible-name check. `<script>`/`<script setup>` go through the TS
// adapter, `<style>` (none/css/scss) through the CSS adapter.
//
// compiler-sfc 3.5 template AST offsets (`loc.start.offset`) are absolute
// file offsets; the adapter relies on that and checks it once per file.
'use strict';
const { parse } = require('@vue/compiler-sfc');
const { DETAIL, isBs4Class, rewriteClassList } = require('../core.cjs');
const { tsEdits, classExprEdits } = require('./ts.cjs');
const { cssEdits } = require('./css.cjs');

// compiler-core NodeTypes / ElementTypes / attribute prop types.
const NODE = { ELEMENT: 1, TEXT: 2, COMMENT: 3 };
const TAG = { ELEMENT: 0, COMPONENT: 1, SLOT: 2, TEMPLATE: 3 };
const PROP = { ATTRIBUTE: 6, DIRECTIVE: 7 };

const VUE_DETAIL = Object.freeze({
  entities: 'class value uses HTML character references',
  unquotedBinding: 'unquoted class binding cannot hold a quoted key',
  unwrapShape:
    'input-group-append/prepend wrapper is not a bare <div>/<span>, or has other classes, attributes, or no children',
  closeNonButton: 'close on a non-<button> element; not a BS4 close button',
  closeContent: 'btn-close content is not a plain × glyph; BS5 draws the glyph',
  closeName: 'btn-close needs accessible name, use T.wordsClose',
  styleLang: 'BS4 class in a <style> block with an unsupported lang',
  templateLang: 'BS4 class in a <template> block with an unsupported lang',
  cssParse: 'style block could not be parsed',
});

const UNWRAP_TOKENS = new Set(['input-group-append', 'input-group-prepend']);
// Only these wrappers are unwrapped. Removing any other tag (`<label>`,
// `<button>`, a component) would drop semantics or behavior, not just a
// layout box, so those shapes go to manual-conversion.
const UNWRAP_TAGS = new Set(['div', 'span']);
const GLYPHS = new Set(['×', '&times;']);
const WS_CHARS = /[ \t\n\r\f]/;
const WS_SPLIT = /[ \t\n\r\f]+/;
const STATIC_CLASS_ATTR = /^class$|-class$/;
const BOUND_CLASS_ARG = /^class$|-class$|Class$/;
// Placeholder that keeps a non-button `close` away from the Rename_Map.
const KEEP_CLOSE = '\u0000keep-close\u0000';

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

const words = (s) =>
  String(s)
    .split(WS_SPLIT)
    .filter((t) => t !== '');
const bs4Words = (s) => words(s).filter(isBs4Class);

function staticAttr(el, name) {
  return el.props.find((p) => p.type === PROP.ATTRIBUTE && p.name === name);
}

function staticClassTokens(el) {
  const p = staticAttr(el, 'class');
  return p && p.value ? words(p.value.content) : [];
}

function hasBoundArg(el, name) {
  return el.props.some(
    (p) =>
      p.type === PROP.DIRECTIVE &&
      p.name === 'bind' &&
      p.arg &&
      p.arg.isStatic &&
      p.arg.content === name,
  );
}

// Offset just after the `>` of the start tag.
function startTagEnd(src, el) {
  let i = el.loc.start.offset + 1 + el.tag.length;
  for (const p of el.props) i = Math.max(i, p.loc.end.offset);
  const gt = src.indexOf('>', i);
  return gt === -1 ? -1 : gt + 1;
}

// Offset of `</tag` when the element has an end tag in the source.
function endTagStart(src, el) {
  const close = `</${el.tag}`;
  const at = el.loc.end.offset;
  const i = src.lastIndexOf(close, at);
  if (i < startTagEnd(src, el)) return -1;
  // Only whitespace may sit between `</tag` and `>`.
  if (!/^\s*>$/.test(src.slice(i + close.length, at))) return -1;
  return i;
}

const isBlankText = (n) => n.type === NODE.TEXT && n.content.trim() === '';
const contentNodes = (el) => el.children.filter((c) => !isBlankText(c));

// True when the element's only content is the × glyph, bare or in one
// `<span aria-hidden="true">`.
function isGlyphOnly(src, el) {
  const kids = contentNodes(el);
  if (kids.length !== 1) return false;
  const k = kids[0];
  const glyph = (n) => n.type === NODE.TEXT && GLYPHS.has(n.loc.source.trim());
  if (glyph(k)) return true;
  if (k.type !== NODE.ELEMENT || k.tag !== 'span' || k.props.length !== 1) {
    return false;
  }
  const a = k.props[0];
  if (
    a.type !== PROP.ATTRIBUTE ||
    a.name !== 'aria-hidden' ||
    !a.value ||
    a.value.content !== 'true'
  ) {
    return false;
  }
  const inner = contentNodes(k);
  return inner.length === 1 && glyph(inner[0]);
}

function createCtx(src, opts) {
  const lineOf = lineCounter(src);
  const ctx = {
    src,
    opts,
    lineOf,
    edits: [], // { start, end, text, structural? }
    replacements: [],
    unresolved: [],
  };
  ctx.report = (offset, list) => {
    const line = lineOf(offset);
    for (const u of list) ctx.unresolved.push({ ...u, line });
  };
  ctx.review = (offset, tokens, detail, reason = 'manual-review') => {
    ctx.report(
      offset,
      tokens.map((token) => ({ token, reason, detail })),
    );
  };
  ctx.merge = (res) => {
    ctx.edits.push(...res.edits);
    ctx.replacements.push(...res.replacements);
    ctx.unresolved.push(...res.unresolved);
  };
  return ctx;
}

// ---------------------------------------------------------------------------
// Template

// Static `class` / `*-class` attribute. `opts.keepClose` keeps a `close`
// token unchanged; `opts.dropUnwrap` drops the core's unwrap entries (the
// element is unwrapped structurally).
function staticClassAttr(ctx, prop, { stackedBlock, keepClose, dropUnwrap }) {
  const { src } = ctx;
  const v = prop.value;
  if (!v) return;
  let s = v.loc.start.offset;
  let e = v.loc.end.offset;
  const q = src[s];
  const quoted = (q === '"' || q === "'") && src[e - 1] === q && e - s >= 2;
  if (quoted) {
    s += 1;
    e -= 1;
  }
  const raw = src.slice(s, e);
  // The Vue parser condenses whitespace in `class` values, so compare the
  // decoded content with the condensed raw text: only a real character
  // reference makes them differ.
  const condensed =
    prop.name === 'class' ? raw.replace(/[ \t\n\r\f]+/g, ' ').trim() : raw;
  if (condensed !== v.content) {
    // Tokens the element unwrap already removed are not left for review.
    const tokens = bs4Words(v.content).filter(
      (t) => !(dropUnwrap === true && UNWRAP_TOKENS.has(t)),
    );
    if (tokens.length) ctx.review(s, tokens, VUE_DETAIL.entities);
    return;
  }
  const input = keepClose
    ? raw
        .split(/([ \t\n\r\f]+)/)
        .map((t) => (t === 'close' ? KEEP_CLOSE : t))
        .join('')
    : raw;
  const res = rewriteClassList(input, { selectorContext: false, stackedBlock });
  const value = keepClose
    ? res.value.split(KEEP_CLOSE).join('close')
    : res.value;
  ctx.replacements.push(...res.replacements);
  // Unwrap entries: dropped when the element was unwrapped, else the core's
  // generic detail is replaced with the reason the shape was refused.
  ctx.report(
    s,
    res.unresolved
      .filter((u) => !(dropUnwrap === true && u.detail === DETAIL.unwrap))
      .map((u) =>
        dropUnwrap === false && u.detail === DETAIL.unwrap
          ? { ...u, detail: VUE_DETAIL.unwrapShape }
          : u,
      ),
  );
  if (value === raw) return;
  if (!quoted && /[ \t\n\r\f]/.test(value)) {
    ctx.edits.push({
      start: v.loc.start.offset,
      end: v.loc.end.offset,
      text: `"${value}"`,
    });
  } else {
    ctx.edits.push({ start: s, end: e, text: value });
  }
}

// `:class` / `v-bind:class` / `:*-class` / `:*Class`.
function boundClassAttr(ctx, prop) {
  const { src } = ctx;
  const exp = prop.exp;
  if (!exp) return;
  const s = exp.loc.start.offset;
  const e = exp.loc.end.offset;
  const raw = src.slice(s, e);
  const attrQuote = src[s - 1];
  const quoted = attrQuote === '"' || attrQuote === "'";
  if (raw !== exp.content) {
    const tokens = (exp.content.match(/[a-z][a-z0-9-]*/g) || []).filter(
      isBs4Class,
    );
    if (tokens.length) ctx.review(s, tokens, VUE_DETAIL.entities);
    return;
  }
  const res = classExprEdits(raw, s, {
    path: ctx.opts.path,
    allowlist: ctx.opts.allowlist,
    fullText: src,
    quote: attrQuote === "'" ? '"' : "'",
  });
  // Any edit that writes a quote would end an unquoted attribute value.
  if (!quoted && res.edits.some((ed) => /["']/.test(ed.text))) {
    ctx.replacements.push(...res.replacements);
    ctx.unresolved.push(...res.unresolved);
    ctx.review(
      s,
      res.replacements.map((r) => r.from),
      VUE_DETAIL.unquotedBinding,
    );
    return;
  }
  ctx.merge(res);
}

// Unwrap of a bare `input-group-append/prepend`. Returns true when applied.
function tryUnwrap(ctx, el, parent) {
  const { src } = ctx;
  if (el.tagType !== TAG.ELEMENT || !UNWRAP_TAGS.has(el.tag)) return false;
  if (el.props.length !== 1) return false;
  const tokens = staticClassTokens(el);
  if (tokens.length !== 1 || !UNWRAP_TOKENS.has(tokens[0])) return false;
  if (contentNodes(el).length === 0) return false;
  // Only inside a real element: unwrapping a template / component root
  // would change the number of root nodes.
  if (
    !parent ||
    parent.type !== NODE.ELEMENT ||
    parent.tagType === TAG.TEMPLATE
  ) {
    return false;
  }
  const tagEnd = startTagEnd(src, el);
  const endStart = endTagStart(src, el);
  if (tagEnd < 0 || endStart < 0) return false;
  let a = tagEnd;
  while (a < endStart && WS_CHARS.test(src[a])) a++;
  let b = endStart;
  while (b > a && WS_CHARS.test(src[b - 1])) b--;
  ctx.edits.push(
    { start: el.loc.start.offset, end: a, text: '', structural: true },
    { start: b, end: el.loc.end.offset, text: '', structural: true },
  );
  ctx.replacements.push({ from: tokens[0], to: [], entry: tokens[0] });
  return true;
}

// `btn-close` rules on a `<button>` whose static class has `close` (being
// rewritten to `btn-close`; `strip` is true) or already has `btn-close`
// (BS5 markup, e.g. the output of an earlier run; `strip` is false).
//
// The follow-ups (missing accessible name, non-glyph content) are reported
// on every run, report-only, until they are fixed by hand. They use the
// token `btn-close` on both runs: that is the class the element carries in
// the output, so the scan (which runs this adapter in report-only mode over
// the rewritten file) reports the same token on the same line, and the
// codemod's unresolved list and the scan's bs4-class matches agree
// (Property 15). Using `close` would make the entry vanish once `close` is
// gone from the file, so the scan could not verify the fix.
//
// Glyph content is deleted only on the run that rewrites `close`; an
// already-BS5 `btn-close` is never edited, which keeps the codemod
// idempotent (Property 1).
function closeButton(ctx, el, { strip }) {
  const { src } = ctx;
  const at = el.loc.start.offset;
  const review = (detail) => ctx.review(at, ['btn-close'], detail);
  if (!staticAttr(el, 'aria-label') && !hasBoundArg(el, 'aria-label')) {
    review(VUE_DETAIL.closeName);
  }
  if (contentNodes(el).length === 0) return;
  if (!isGlyphOnly(src, el)) {
    review(VUE_DETAIL.closeContent);
    return;
  }
  const s = startTagEnd(src, el);
  const e = endTagStart(src, el);
  // Same check on both runs: glyph content we cannot cut out exactly stays
  // and is reported, so the entry persists after `close` is rewritten.
  if (s < 0 || e < 0 || e <= s) {
    review(VUE_DETAIL.closeContent);
    return;
  }
  if (strip) ctx.edits.push({ start: s, end: e, text: '', structural: true });
}

function walkElement(ctx, el, parent) {
  const classTokens = staticClassTokens(el);
  const hasUnwrapToken = classTokens.some((t) => UNWRAP_TOKENS.has(t));
  // The core reports unwrap tokens as manual-conversion; staticClassAttr
  // drops that entry when the unwrap applies, else rewords its detail.
  const unwrapped = hasUnwrapToken && tryUnwrap(ctx, el, parent);

  let stackedBlock = false;
  if (classTokens.includes('btn-block') && parent) {
    const blocks = parent.children.filter(
      (c) =>
        c.type === NODE.ELEMENT && staticClassTokens(c).includes('btn-block'),
    );
    stackedBlock = blocks.length >= 2;
  }

  const isButton = el.tag === 'button';
  const hasClose = classTokens.includes('close');
  const keepClose = hasClose && !isButton;
  if (keepClose) {
    ctx.review(el.loc.start.offset, ['close'], VUE_DETAIL.closeNonButton);
  }

  for (const p of el.props) {
    if (p.type === PROP.ATTRIBUTE && STATIC_CLASS_ATTR.test(p.name)) {
      staticClassAttr(ctx, p, {
        stackedBlock,
        keepClose: keepClose && p.name === 'class',
        dropUnwrap: p.name === 'class' && hasUnwrapToken ? unwrapped : null,
      });
    } else if (
      p.type === PROP.DIRECTIVE &&
      p.name === 'bind' &&
      p.arg &&
      p.arg.type === 4 &&
      p.arg.isStatic &&
      BOUND_CLASS_ARG.test(p.arg.content)
    ) {
      boundClassAttr(ctx, p);
    }
  }

  if (isButton && (hasClose || classTokens.includes('btn-close'))) {
    closeButton(ctx, el, { strip: hasClose });
  }

  walkChildren(ctx, el);
}

function walkChildren(ctx, node) {
  for (const c of node.children || []) {
    if (c.type === NODE.ELEMENT) walkElement(ctx, c, node);
  }
}

function templateBlock(ctx, tpl) {
  if (tpl.lang && tpl.lang !== 'html') {
    const tokens = (tpl.content.match(/[a-z][a-z0-9-]*/g) || []).filter(
      isBs4Class,
    );
    if (tokens.length) {
      ctx.review(tpl.loc.start.offset, tokens, VUE_DETAIL.templateLang);
    }
    return;
  }
  const ast = tpl.ast;
  if (!ast) return;
  // The root's children are the template's children; the root itself is not
  // an element, so unwrap at the top level is refused (see tryUnwrap).
  walkChildren(ctx, ast);
}

// ---------------------------------------------------------------------------
// Script and style

function scriptKindOf(lang) {
  switch (lang) {
    case 'ts':
    case 'tsx':
    case 'jsx':
      return lang;
    default:
      return 'js';
  }
}

function scriptBlock(ctx, block) {
  ctx.merge(
    tsEdits(block.content, {
      baseOffset: block.loc.start.offset,
      path: ctx.opts.path,
      scriptKind: scriptKindOf(block.lang),
      allowlist: ctx.opts.allowlist,
      fullText: ctx.src,
    }),
  );
}

const STYLE_CLASS = /\.(-?[_a-zA-Z][_a-zA-Z0-9-]*)/g;

function styleBlock(ctx, block) {
  const start = block.loc.start.offset;
  if (!block.lang || block.lang === 'css' || block.lang === 'scss') {
    ctx.merge(
      cssEdits(block.content, {
        baseOffset: start,
        baseLine: block.loc.start.line,
        path: ctx.opts.path,
      }),
    );
    return;
  }
  for (const m of block.content.matchAll(STYLE_CLASS)) {
    if (isBs4Class(m[1])) {
      ctx.review(start + m.index, [m[1]], VUE_DETAIL.styleLang);
    }
  }
}

// ---------------------------------------------------------------------------
// Overlaps

// Structural edits win; a plain edit that overlaps one is dropped (its
// element is removed or emptied anyway). Two overlapping plain edits are a
// bug in the adapter and fail the file.
function resolveOverlaps(edits) {
  const structural = edits.filter((e) => e.structural);
  const overlaps = (a, b) => a.start < b.end && b.start < a.end;
  const kept = edits.filter(
    (e) => e.structural || !structural.some((s) => overlaps(s, e)),
  );
  kept.sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 1; i < kept.length; i++) {
    if (kept[i].start < kept[i - 1].end) {
      throw new Error(
        `overlapping edits at ${kept[i - 1].start}-${kept[i - 1].end} and ${
          kept[i].start
        }-${kept[i].end}`,
      );
    }
  }
  return {
    edits: kept.map(({ start, end, text }) => ({ start, end, text })),
    dropped: edits.length - kept.length,
  };
}

// ---------------------------------------------------------------------------
// Public API

function failed(error) {
  return { edits: [], replacements: [], unresolved: [], error };
}

function vueEdits(text, opts = {}) {
  const src = String(text);
  const path = opts.path || '<input>.vue';
  let descriptor;
  let errors;
  try {
    ({ descriptor, errors } = parse(src, { sourceMap: false, filename: path }));
  } catch (e) {
    return failed(`original already invalid: ${e.message}`);
  }
  if (errors.length) {
    return failed(
      `original already invalid: ${errors
        .map((e) => String(e.message || e))
        .join('; ')}`,
    );
  }

  const ctx = createCtx(src, { ...opts, path });
  try {
    if (descriptor.template) {
      const t = descriptor.template;
      if (
        t.ast &&
        t.ast.children.length &&
        src.slice(
          t.ast.children[0].loc.start.offset,
          t.ast.children[0].loc.end.offset,
        ) !== t.ast.children[0].loc.source
      ) {
        return failed('template AST offsets are not absolute file offsets');
      }
      templateBlock(ctx, t);
    }
    if (descriptor.script) scriptBlock(ctx, descriptor.script);
    if (descriptor.scriptSetup) scriptBlock(ctx, descriptor.scriptSetup);
    for (const s of descriptor.styles) {
      try {
        styleBlock(ctx, s);
      } catch (e) {
        return failed(`${VUE_DETAIL.cssParse}: ${e.message}`);
      }
    }
    const { edits, dropped } = resolveOverlaps(ctx.edits);
    ctx.unresolved.sort((a, b) => a.line - b.line);
    return {
      edits,
      replacements: ctx.replacements,
      unresolved: ctx.unresolved,
      dropped,
    };
  } catch (e) {
    return failed(e.message);
  }
}

module.exports = { vueEdits, VUE_DETAIL };
