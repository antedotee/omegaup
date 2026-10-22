// Markup adapter for the bs5-cutover codemod (design 3.3), for `.tpl`
// (Twig) and `.html` files.
//
// markupEdits(text, { path }) returns
//   { edits: { start, end, text }[], replacements, unresolved: (Unresolved & { line })[] }
// with offsets into `text`. Applying the edits back to front leaves every
// byte outside them unchanged.
//
// - Static `class="…"` / `class='…'` attributes go through rewriteClassList.
//   The edit covers the value between the quotes.
// - A value holding a template construct (`{{`, `{%`, `${`) is never edited.
//   If it holds a BS4 token it goes to manual-review.
// - A bound Vue class (`:class` / `v-bind:class`, used by the in-browser Vue
//   in issues/index.html) holding a BS4 token goes to manual-review.
// - `<style>` element bodies go through the CSS adapter.
// - `<script>` bodies, HTML comments, and Twig comments are not scanned.
'use strict';
const { isBs4Class, rewriteClassList } = require('../core.cjs');
const { cssEdits } = require('./css.cjs');

const MARKUP_DETAIL = Object.freeze({
  template: 'class value with a template interpolation',
  bound: 'bound class attribute',
});

const CLASS_ATTR = /(\sclass\s*=\s*)("([^"]*)"|'([^']*)')/g;
const BOUND_CLASS_ATTR = /\s(?::|v-bind:)class\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const TEMPLATE_MARK = /\{\{|\{%|\$\{/;
// Template constructs removed before looking for BS4 tokens in a value.
const TEMPLATE_CONSTRUCT =
  /\{\{[\s\S]*?(?:\}\}|$)|\{%[\s\S]*?(?:%\}|$)|\$\{[^}]*(?:\}|$)/g;
const WS = /[ \t\n\r\f]+/;

// Regions that are not scanned for class attributes, found left to right so
// a `<script>` inside a comment (or `<!--` inside a script) is handled.
//   kind 'skip'  : comment or script body (masked)
//   kind 'style' : style body (masked, then sent to the CSS adapter)
const OPENERS = /<!--|\{#|<script\b[^>]*>|<style\b[^>]*>/gi;
function findRegions(src) {
  const regions = [];
  OPENERS.lastIndex = 0;
  let m;
  while ((m = OPENERS.exec(src)) !== null) {
    const open = m[0];
    const bodyStart = m.index + open.length;
    let close;
    let kind = 'skip';
    let start = m.index;
    if (open === '<!--') close = '-->';
    else if (open === '{#') close = '#}';
    else {
      const tag = /^<(script|style)/i.exec(open)[1].toLowerCase();
      close = `</${tag}`;
      kind = tag === 'style' ? 'style' : 'skip';
      start = bodyStart; // the opening tag itself is still scanned
    }
    let end = indexOfCI(src, close, bodyStart);
    if (end === -1) end = src.length;
    // Comments are masked with their delimiters; element bodies are not.
    else if (start === m.index) end += close.length;
    regions.push({ kind, start, bodyStart, end });
    OPENERS.lastIndex = Math.max(end, bodyStart);
  }
  return regions;
}

function indexOfCI(src, needle, from) {
  const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'), 'gi');
  re.lastIndex = from;
  const m = re.exec(src);
  return m ? m.index : -1;
}

// Same length as src; masked ranges become spaces (newlines kept).
function mask(src, regions) {
  let out = '';
  let pos = 0;
  for (const r of regions) {
    out += src.slice(pos, r.start);
    out += src.slice(r.start, r.end).replace(/[^\n]/g, ' ');
    pos = r.end;
  }
  return out + src.slice(pos);
}

function lineCounter(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) starts.push(i + 1);
  }
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

const bs4Words = (text) =>
  String(text)
    .split(WS)
    .filter((t) => t !== '' && isBs4Class(t));

// Offset of `token` as a whole whitespace-delimited word in `value`, or 0.
function tokenIndex(value, token) {
  const re = new RegExp(
    `(^|[\\s}])${token.replace(/[-]/g, '\\-')}(?=$|[\\s{])`,
  );
  const m = re.exec(value);
  return m ? m.index + m[1].length : 0;
}

function markupEdits(text, { path } = {}) {
  const src = String(text);
  const lineOf = lineCounter(src);
  const regions = findRegions(src);
  const scan = mask(src, regions);
  const edits = [];
  const replacements = [];
  const unresolved = [];

  const report = (valueStart, value, list) => {
    for (const u of list) {
      unresolved.push({
        ...u,
        line: lineOf(valueStart + tokenIndex(value, u.token)),
      });
    }
  };

  CLASS_ATTR.lastIndex = 0;
  for (const m of scan.matchAll(CLASS_ATTR)) {
    const valueStart = m.index + m[1].length + 1;
    const value = m[3] !== undefined ? m[3] : m[4];
    if (TEMPLATE_MARK.test(value)) {
      const tokens = bs4Words(value.replace(TEMPLATE_CONSTRUCT, ' '));
      report(
        valueStart,
        value,
        tokens.map((token) => ({
          token,
          reason: 'manual-review',
          detail: MARKUP_DETAIL.template,
        })),
      );
      continue;
    }
    const res = rewriteClassList(value, { selectorContext: false });
    replacements.push(...res.replacements);
    report(valueStart, value, res.unresolved);
    if (res.value !== value) {
      edits.push({
        start: valueStart,
        end: valueStart + value.length,
        text: res.value,
      });
    }
  }

  for (const m of scan.matchAll(BOUND_CLASS_ATTR)) {
    const value = m[1] !== undefined ? m[1] : m[2];
    const tokens = (value.match(/[a-z][a-z0-9-]*/g) || []).filter(isBs4Class);
    for (const token of new Set(tokens)) {
      unresolved.push({
        token,
        reason: 'manual-review',
        detail: MARKUP_DETAIL.bound,
        line: lineOf(m.index + 1),
      });
    }
  }

  for (const r of regions) {
    if (r.kind !== 'style') continue;
    const body = src.slice(r.bodyStart, r.end);
    const res = cssEdits(body, {
      baseOffset: r.bodyStart,
      baseLine: lineOf(r.bodyStart),
      path,
    });
    edits.push(...res.edits);
    replacements.push(...res.replacements);
    unresolved.push(...res.unresolved);
  }

  edits.sort((a, b) => a.start - b.start);
  unresolved.sort((a, b) => a.line - b.line);
  return { edits, replacements, unresolved };
}

module.exports = { MARKUP_DETAIL, markupEdits };
