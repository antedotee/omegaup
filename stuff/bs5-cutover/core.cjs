// Pure rewrite functions for the bs5-cutover codemod (design 3.2).
//
// No I/O. The adapters find class lists and selectors in source files and
// hand the bare strings to these functions; the results say what the string
// becomes and what could not be rewritten.
//
// Result shape for both rewriters:
//   { value: string,
//     replacements: { from, to: string[], entry }[],   // entry = map key
//     unresolved: { token, reason: 'manual-conversion' | 'manual-review', detail }[] }
'use strict';

const selectorParser = require('postcss-selector-parser');
const { RENAME_MAP, REMOVAL_MAP, BS4_KEYS } = require('./maps.cjs');

// `detail` strings, exported so adapters can recognise the cases they handle
// themselves (the Vue adapter applies `unwrap` and decides `stackedBlock`).
const DETAIL = Object.freeze({
  unwrap: 'unwrap: remove the wrapper element and keep its children',
  manual: 'needs a layout choice',
  stackedBlock: 'btn-block (stacked): needs a d-grid gap-2 wrapper',
  selectorRemoval: 'selector on generic utility',
  selectorDropped: 'class has no BS5 equivalent; selector needs retargeting',
  selectorInterpolation: 'selector with #{} interpolation',
  selectorParseError: 'selector could not be parsed',
  selectorEscaped: 'escaped class name in selector',
  selectorAttribute: 'BS4 class inside a [class] attribute selector',
});

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function isBs4Class(token) {
  return typeof token === 'string' && BS4_KEYS.has(token);
}

// ---------------------------------------------------------------------------
// Class lists

const WS_SPLIT = /([ \t\n\r\f]+)/;

// Returns the BS5 tokens for `token`, or null when the core leaves it alone.
// Pushes an unresolved entry for unwrap / manual / stacked btn-block.
function classTokenTarget(token, ctx, unresolved) {
  if (has(RENAME_MAP, token)) return RENAME_MAP[token];
  if (!has(REMOVAL_MAP, token)) return null;
  const entry = REMOVAL_MAP[token];
  switch (entry.kind) {
    case 'replace':
      return entry.tokens;
    case 'conditional':
      if (ctx[entry.manualWhen]) {
        unresolved.push({
          token,
          reason: 'manual-conversion',
          detail: DETAIL.stackedBlock,
        });
        return null;
      }
      return entry.tokens;
    case 'unwrap':
      unresolved.push({
        token,
        reason: 'manual-conversion',
        detail: DETAIL.unwrap,
      });
      return null;
    case 'manual':
      unresolved.push({
        token,
        reason: 'manual-conversion',
        detail: DETAIL.manual,
      });
      return null;
    default:
      throw new Error(`unknown Removal_Map kind for ${token}: ${entry.kind}`);
  }
}

// Rewrites a whitespace-separated class list. Separators are kept byte for
// byte. A produced token that the list already holds (an original token that
// stays, or an earlier produced token) is dropped; when every produced token
// of a key is dropped, the key goes with one adjacent separator. Duplicates
// already in the input are left alone.
function rewriteClassList(value, ctx = {}) {
  const replacements = [];
  const unresolved = [];
  // parts alternate: [sep?, token, sep, token, ..., sep?]; split keeps seps.
  const parts = String(value).split(WS_SPLIT);
  const isSep = (s) => s !== '' && WS_SPLIT.test(s) && s.trim() === '';

  const targets = parts.map((p) =>
    p === '' || isSep(p) ? null : classTokenTarget(p, ctx, unresolved),
  );

  // Tokens that stay as they are seed the dedupe set.
  const seen = new Set(
    parts.filter((p, i) => p !== '' && !isSep(p) && targets[i] === null),
  );

  const out = []; // { text, sep: boolean }
  let skipNextSep = false;
  const lastTokenIndex = () => {
    for (let i = out.length - 1; i >= 0; i--) if (!out[i].sep) return i;
    return -1;
  };

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p === '') continue;
    if (isSep(p)) {
      if (skipNextSep) {
        skipNextSep = false;
        continue;
      }
      out.push({ text: p, sep: true });
      continue;
    }
    const target = targets[i];
    if (target === null) {
      out.push({ text: p, sep: false });
      continue;
    }
    const emitted = target.filter((t) => !seen.has(t));
    for (const t of emitted) seen.add(t);
    replacements.push({ from: p, to: emitted, entry: p });
    if (emitted.length > 0) {
      out.push({ text: emitted.join(' '), sep: false });
      continue;
    }
    // Drop the token and one adjacent separator: the preceding one when a
    // token precedes it (keeps line layout), else the following one.
    const prev = out[out.length - 1];
    if (prev && prev.sep && lastTokenIndex() !== -1) {
      out.pop();
    } else {
      skipNextSep = true;
    }
  }

  return {
    value: out.map((o) => o.text).join(''),
    replacements,
    unresolved,
  };
}

// ---------------------------------------------------------------------------
// Selectors

const CLASS_IN_TEXT = /\.(-?[_a-zA-Z][_a-zA-Z0-9-]*)/g;

// Fallback for selectors the parser cannot be trusted with: report every
// BS4 class-looking token, change nothing.
function reportOnly(selector, detail) {
  const unresolved = [];
  for (const m of selector.matchAll(CLASS_IN_TEXT)) {
    if (BS4_KEYS.has(m[1])) {
      unresolved.push({ token: m[1], reason: 'manual-review', detail });
    }
  }
  return { value: selector, replacements: [], unresolved };
}

// Class values in the same compound selector as `node` (between combinators).
function compoundClasses(node) {
  const siblings = node.parent ? node.parent.nodes : [node];
  const idx = siblings.indexOf(node);
  let start = idx;
  let end = idx;
  while (start > 0 && siblings[start - 1].type !== 'combinator') start--;
  while (end < siblings.length - 1 && siblings[end + 1].type !== 'combinator') {
    end++;
  }
  return {
    first: siblings[start],
    classes: siblings
      .slice(start, end + 1)
      .filter((n) => n.type === 'class')
      .map((n) => n.value),
  };
}

// Rewrites Rename_Map class nodes in a CSS selector. Every byte outside the
// rewritten class names is kept: edits are computed from node source offsets
// and spliced into the original string, never re-stringified.
function rewriteSelector(selector) {
  const text = String(selector);
  if (text.includes('#{')) {
    return reportOnly(text, DETAIL.selectorInterpolation);
  }

  let root;
  try {
    root = selectorParser().astSync(text);
  } catch (e) {
    return reportOnly(text, DETAIL.selectorParseError);
  }

  const replacements = [];
  const unresolved = [];
  const edits = []; // { start, end, text }
  // First node of each compound -> classes present or produced, for dedupe.
  const compoundSeen = new Map();

  root.walkAttributes((node) => {
    if (node.attribute !== 'class' || typeof node.value !== 'string') return;
    for (const t of node.value.split(/\s+/)) {
      if (BS4_KEYS.has(t)) {
        unresolved.push({
          token: t,
          reason: 'manual-review',
          detail: DETAIL.selectorAttribute,
        });
      }
    }
  });

  root.walkClasses((node) => {
    const name = node.value;
    if (!BS4_KEYS.has(name)) return;

    const start = node.sourceIndex;
    const raw = node.raws && node.raws.value ? node.raws.value : name;
    const end = start + 1 + raw.length;
    if (raw !== name || text.slice(start, end) !== `.${name}`) {
      unresolved.push({
        token: name,
        reason: 'manual-review',
        detail: DETAIL.selectorEscaped,
      });
      return;
    }

    if (has(REMOVAL_MAP, name)) {
      unresolved.push({
        token: name,
        reason: 'manual-review',
        detail: DETAIL.selectorRemoval,
      });
      return;
    }

    const target = RENAME_MAP[name];
    if (target.length === 0) {
      unresolved.push({
        token: name,
        reason: 'manual-review',
        detail: DETAIL.selectorDropped,
      });
      return;
    }

    const { first, classes } = compoundClasses(node);
    let seen = compoundSeen.get(first);
    if (!seen) {
      seen = new Set(classes.filter((c) => !BS4_KEYS.has(c)));
      compoundSeen.set(first, seen);
    }
    const emitted = target.filter((t) => !seen.has(t));
    for (const t of emitted) seen.add(t);
    replacements.push({ from: name, to: emitted, entry: name });
    edits.push({ start, end, text: emitted.map((t) => `.${t}`).join('') });
  });

  let value = text;
  for (const e of edits.sort((a, b) => b.start - a.start)) {
    value = value.slice(0, e.start) + e.text + value.slice(e.end);
  }
  return { value, replacements, unresolved };
}

module.exports = {
  DETAIL,
  isBs4Class,
  rewriteClassList,
  rewriteSelector,
};
