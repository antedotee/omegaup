// Testable core of the bs5-cutover integrity check (design 4, Requirement 6).
//
// checkPair(path, original, changed) -> IntegrityFailure[]
// checkAll(pairs)                    -> { checked, failing, failingPaths, failures }
// formatResult(result)               -> printable text
//
//   interface IntegrityFailure {
//     path: string;
//     kind: 'original-invalid' | 'parse-error' | 'structure' | 'content';
//     block?: 'template' | 'script' | 'scriptSetup' | 'style' | string;  // custom block type
//     detail: string;
//   }
//
// The check is independent of the adapters: it never re-runs the rewrite. It
// only proves that each <script>/<style> diff is explained by the maps.
// <template> content is not diffed (the DOM rules unwrap elements and strip
// glyphs there); the template is covered by the parse and structure checks.
'use strict';
const { parse } = require('@vue/compiler-sfc');
const { RENAME_MAP, REMOVAL_MAP } = require('./maps.cjs');

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

// BS5 tokens a BS4 key may become in a script/style, or null when the key is
// never rewritten by token replacement (unwrap / manual Removal_Map kinds).
function replacementTokens(key) {
  if (has(RENAME_MAP, key)) return RENAME_MAP[key];
  if (has(REMOVAL_MAP, key) && REMOVAL_MAP[key].tokens) {
    return REMOVAL_MAP[key].tokens;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Parse and structure

function parseSfc(path, text) {
  try {
    const { descriptor, errors } = parse(String(text), {
      filename: path,
      sourceMap: false,
    });
    return { descriptor, errors: errors.map(errorText) };
  } catch (e) {
    return { descriptor: null, errors: [errorText(e)] };
  }
}

function errorText(e) {
  const msg = e && e.message ? e.message : String(e);
  const start = e && e.loc && e.loc.start;
  return start ? `${msg} (line ${start.line}, column ${start.column})` : msg;
}

const ATTRS = ['lang', 'setup', 'scoped', 'module'];
const attrValue = (block, name) =>
  block && has(block.attrs, name) ? block.attrs[name] : undefined;
const show = (v) => (v === undefined ? '(absent)' : JSON.stringify(v));

// Named block slots of a descriptor, in a fixed order. Styles and custom
// blocks are matched by index (custom blocks by index within their type).
function blockSlots(d) {
  const slots = [
    { block: 'template', list: d.template ? [d.template] : [] },
    { block: 'script', list: d.script ? [d.script] : [] },
    { block: 'scriptSetup', list: d.scriptSetup ? [d.scriptSetup] : [] },
    { block: 'style', list: d.styles },
  ];
  const custom = new Map();
  for (const b of d.customBlocks) {
    if (!custom.has(b.type)) custom.set(b.type, []);
    custom.get(b.type).push(b);
  }
  return { slots, custom };
}

function structureFailures(path, a, b) {
  const failures = [];
  const fail = (block, detail) =>
    failures.push({ path, kind: 'structure', block, detail });
  const sa = blockSlots(a);
  const sb = blockSlots(b);
  const comparePair = (block, la, lb) => {
    if (la.length !== lb.length) {
      fail(block, `block count ${la.length} -> ${lb.length}`);
      return;
    }
    la.forEach((x, i) => {
      for (const attr of ATTRS) {
        const va = attrValue(x, attr);
        const vb = attrValue(lb[i], attr);
        if (va !== vb) {
          const which = la.length > 1 ? ` #${i + 1}` : '';
          fail(
            block,
            `${block}${which} attribute ${attr} ${show(va)} -> ${show(vb)}`,
          );
        }
      }
    });
  };
  for (let i = 0; i < sa.slots.length; i++) {
    comparePair(sa.slots[i].block, sa.slots[i].list, sb.slots[i].list);
  }
  const types = [...new Set([...sa.custom.keys(), ...sb.custom.keys()])].sort();
  for (const t of types) {
    comparePair(t, sa.custom.get(t) || [], sb.custom.get(t) || []);
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Content diff (Requirement 6.4)

// Words, whitespace runs, and single other characters (code points).
const TOKEN_RE = /[A-Za-z0-9_-]+|\s+|[\s\S]/gu;
const WORD_RE = /^[A-Za-z0-9_-]+$/;
const WS_RE = /^\s+$/;
const QUOTES = new Set(["'", '"']);

function tokenize(text) {
  return String(text).match(TOKEN_RE) || [];
}

// Myers O((N+M)D) diff on token arrays. Returns ops { op: '=' | '-' | '+',
// tok, ai, bi, pos } or null when D exceeds maxD. `ai`/`bi` index the token
// in a/b; an insert's `pos` is its insertion point in a.
function diffTokens(a, b, maxD = 20000) {
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (
    suf < a.length - pre &&
    suf < b.length - pre &&
    a[a.length - 1 - suf] === b[b.length - 1 - suf]
  ) {
    suf++;
  }
  const n = a.length - pre - suf;
  const m = b.length - pre - suf;
  const A = (i) => a[pre + i];
  const B = (j) => b[pre + j];
  const mid = [];
  if (n > 0 || m > 0) {
    const max = n + m;
    const off = max + 1;
    const v = new Int32Array(2 * max + 3);
    const trace = [];
    let found = -1;
    for (let d = 0; d <= max; d++) {
      if (d > maxD) return null;
      trace.push(v.slice(off - d - 1, off + d + 2));
      for (let k = -d; k <= d; k += 2) {
        let x =
          k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])
            ? v[off + k + 1]
            : v[off + k - 1] + 1;
        let y = x - k;
        while (x < n && y < m && A(x) === B(y)) {
          x++;
          y++;
        }
        v[off + k] = x;
        if (x >= n && y >= m) {
          found = d;
          break;
        }
      }
      if (found >= 0) break;
    }
    let x = n;
    let y = m;
    for (let d = found; d > 0; d--) {
      const snap = trace[d];
      const at = (k) => snap[k + d + 1];
      const k = x - y;
      const prevK =
        k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1;
      const prevX = at(prevK);
      const prevY = prevX - prevK;
      while (x > prevX && y > prevY) {
        x--;
        y--;
        mid.push({ op: '=', tok: A(x), ai: pre + x, bi: pre + y });
      }
      if (x === prevX) {
        y--;
        mid.push({ op: '+', tok: B(y), bi: pre + y, pos: pre + x });
      } else {
        x--;
        mid.push({ op: '-', tok: A(x), ai: pre + x });
      }
    }
    while (x > 0 && y > 0) {
      x--;
      y--;
      mid.push({ op: '=', tok: A(x), ai: pre + x, bi: pre + y });
    }
    mid.reverse();
  }
  const ops = [];
  for (let i = 0; i < pre; i++) ops.push({ op: '=', tok: a[i], ai: i, bi: i });
  ops.push(...mid);
  for (let i = 0; i < suf; i++) {
    const ai = a.length - suf + i;
    ops.push({ op: '=', tok: a[ai], ai, bi: b.length - suf + i });
  }
  return ops;
}

// Groups non-equal ops into hunks. Hunks separated only by whitespace runs
// or `.` are merged, because an LCS may align a kept separator inside a
// multi-token replacement (`a form-row b` -> `a row g-2 b`,
// `.badge-warning` -> `.bg-warning.text-dark`).
const JOIN_GAP = (t) => t === '.' || WS_RE.test(t);
function hunks(ops) {
  const out = [];
  let cur = null;
  let gap = []; // equal ops since the last change
  for (const o of ops) {
    if (o.op === '=') {
      if (cur) gap.push(o);
      continue;
    }
    if (cur && gap.every((g) => JOIN_GAP(g.tok))) {
      cur.ops.push(...gap, o);
    } else {
      if (cur) out.push(cur);
      cur = { ops: [o] };
    }
    gap = [];
  }
  if (cur) out.push(cur);
  return out;
}

// Returns null when the hunk is a map replacement, else a reason string.
//
// A hunk is explained when every removed word is a BS4 key with a token
// replacement, every added word is one of those replacement tokens (as a
// multiset), separators added are single spaces (class list) or `.`
// (compound selector) joining multi-token replacements, removed whitespace
// is at most one separator per dropped or deduped key, and quotes are added
// only in pairs (identifier object key quoted: { close: x } ->
// { 'btn-close': x }).
//
// opts.selectorOnly (style blocks): the CSS adapter rewrites only class
// selectors with Rename_Map keys, so every removed key must follow a `.` in
// the original (`border-left: 0` is a declaration, not `.border-left`), must
// be a Rename_Map key with tokens, and no whitespace or quotes may change.
// opts.original: the original token array (for the `.` lookbehind).
function explainHunk(h, opts = {}) {
  // A non-BS4 word removed and added again in the same hunk only moved: the
  // diff aligned separators instead of it (`.badge-warning.badge-layer
  // .badge-warning` -> `.bg-warning.text-dark.badge-layer`, where the LCS
  // ties). Class order carries no meaning, so each such pair cancels.
  const added = new Map();
  for (const o of h.ops) {
    if (o.op === '+' && WORD_RE.test(o.tok)) {
      added.set(o.tok, (added.get(o.tok) || 0) + 1);
    }
  }
  const moved = new Map();
  for (const o of h.ops) {
    if (o.op !== '-' || !WORD_RE.test(o.tok) || replacementTokens(o.tok))
      continue;
    const n = moved.get(o.tok) || 0;
    if (n < (added.get(o.tok) || 0)) moved.set(o.tok, n + 1);
  }
  const removedMoved = new Map(moved);
  const addedMoved = new Map(moved);
  const take = (m, t) => {
    const n = m.get(t) || 0;
    if (n === 0) return false;
    m.set(t, n - 1);
    return true;
  };

  const keys = [];
  let removedWs = 0;
  let removedDots = 0;
  for (const o of h.ops) {
    if (o.op !== '-') continue;
    const t = o.tok;
    if (take(removedMoved, t)) continue;
    if (t === '.') {
      // A key deduped within a compound selector (style block, or a
      // querySelector string in a script) takes its `.` with it
      // (`.sr-only-focusable.sr-only-focusable` -> `.visually-hidden-focusable`).
      // Bounded below by the number of removed keys.
      removedDots++;
      continue;
    }
    if (WORD_RE.test(t)) {
      const toks = replacementTokens(t);
      if (!toks)
        return `removed ${JSON.stringify(t)} is not a mapped BS4 class`;
      if (opts.selectorOnly) {
        if (!has(RENAME_MAP, t) || toks.length === 0) {
          return `${JSON.stringify(t)} is not rewritable in a selector`;
        }
        if (!opts.original || opts.original[o.ai - 1] !== '.') {
          return `${JSON.stringify(t)} replaced outside a class selector`;
        }
      }
      keys.push(t);
    } else if (WS_RE.test(t)) {
      removedWs++;
    } else {
      return `removed character ${JSON.stringify(t)}`;
    }
  }
  if (keys.length === 0) return 'change without a BS4 class replacement';
  const budget = new Map();
  let joins = 0;
  for (const k of keys) {
    const toks = replacementTokens(k);
    for (const t of toks) budget.set(t, (budget.get(t) || 0) + 1);
    joins += Math.max(toks.length - 1, 0);
  }
  let addedWs = 0;
  let addedDots = 0;
  let addedQuotes = 0;
  for (const o of h.ops) {
    if (o.op !== '+') continue;
    const t = o.tok;
    if (take(addedMoved, t)) continue;
    if (WORD_RE.test(t)) {
      const left = budget.get(t) || 0;
      if (left === 0) {
        return `added ${JSON.stringify(t)} is not a replacement of ${keys.join(
          ', ',
        )}`;
      }
      budget.set(t, left - 1);
    } else if (WS_RE.test(t)) {
      if (t !== ' ') return `added whitespace ${JSON.stringify(t)}`;
      addedWs++;
    } else if (t === '.') {
      addedDots++;
    } else if (QUOTES.has(t)) {
      addedQuotes++;
    } else {
      return `added character ${JSON.stringify(t)}`;
    }
  }
  if (opts.selectorOnly && (addedWs || removedWs || addedQuotes)) {
    return 'whitespace or quotes changed in a selector';
  }
  // Joins between produced tokens add separators; a dropped or deduped key
  // takes one adjacent separator with it.
  if (addedWs + addedDots - removedWs - removedDots > joins) {
    return 'extra separator added';
  }
  if (removedDots - addedDots > keys.length) return 'extra "." removed';
  if (removedWs - addedWs > keys.length) return 'extra whitespace removed';
  if (addedQuotes > 2 * keys.length || addedQuotes % 2 !== 0) {
    return 'unexpected quote characters added';
  }
  return null;
}

function snippet(toks) {
  const s = toks.join('');
  const flat = JSON.stringify(s.length > 60 ? `${s.slice(0, 57)}...` : s);
  return flat;
}

// Line (1-based, file-relative) of token index `ai` in block `blk`.
function lineOf(blk, aTokens, ai) {
  let line = blk.loc.start.line;
  for (let i = 0; i < ai && i < aTokens.length; i++) {
    for (const ch of aTokens[i]) if (ch === '\n') line++;
  }
  return line;
}

// Failures for one block pair: every unexplained hunk is listed.
function contentFailures(path, block, blkA, blkB, label) {
  const a = tokenize(blkA.content);
  const b = tokenize(blkB.content);
  const ops = diffTokens(a, b);
  if (!ops) {
    return [
      {
        path,
        kind: 'content',
        block,
        detail: `${label}: content differs too much to diff`,
      },
    ];
  }
  const failures = [];
  for (const h of hunks(ops)) {
    const reason = explainHunk(h, {
      selectorOnly: block === 'style',
      original: a,
    });
    if (!reason) continue;
    const first = h.ops[0];
    const anchor = first.ai !== undefined ? first.ai : first.pos;
    const removed = h.ops.filter((o) => o.op !== '+').map((o) => o.tok);
    const added = h.ops.filter((o) => o.op !== '-').map((o) => o.tok);
    failures.push({
      path,
      kind: 'content',
      block,
      detail: `${label} line ${lineOf(blkA, a, anchor)}: ${reason}: ${snippet(
        removed,
      )} -> ${snippet(added)}`,
    });
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Public API

function checkPair(path, original, changed) {
  const failures = [];
  const pa = parseSfc(path, original);
  const pb = parseSfc(path, changed);
  if (pa.errors.length) {
    failures.push({
      path,
      kind: 'original-invalid',
      detail: `original already invalid before the codemod run: ${pa.errors.join(
        '; ',
      )}`,
    });
  }
  if (pb.errors.length) {
    failures.push({ path, kind: 'parse-error', detail: pb.errors.join('; ') });
  }
  // Structure and content comparisons need two trustworthy descriptors.
  if (failures.length) return failures;
  const a = pa.descriptor;
  const b = pb.descriptor;
  const structure = structureFailures(path, a, b);
  failures.push(...structure);
  const pairs = [];
  if (a.script && b.script)
    pairs.push(['script', a.script, b.script, 'script']);
  if (a.scriptSetup && b.scriptSetup) {
    pairs.push(['scriptSetup', a.scriptSetup, b.scriptSetup, 'script setup']);
  }
  const ns = Math.min(a.styles.length, b.styles.length);
  for (let i = 0; i < ns; i++) {
    const label = a.styles.length > 1 ? `style #${i + 1}` : 'style';
    pairs.push(['style', a.styles[i], b.styles[i], label]);
  }
  for (const [block, x, y, label] of pairs) {
    if (x.content === y.content) continue;
    failures.push(...contentFailures(path, block, x, y, label));
  }
  // The codemod never edits custom blocks (<i18n>, <docs>, ...).
  // A count mismatch is already a structure failure; compare equal-size lists.
  const { custom: ca } = blockSlots(a);
  const { custom: cb } = blockSlots(b);
  for (const [type, la] of ca) {
    const lb = cb.get(type) || [];
    if (la.length !== lb.length) continue;
    la.forEach((x, i) => {
      if (x.content !== lb[i].content) {
        failures.push({
          path,
          kind: 'content',
          block: type,
          detail: `${type} block content changed`,
        });
      }
    });
  }
  return failures;
}

// pairs: { path, original, changed }[]. A pair may instead carry `error`
// (the original or changed text could not be read); it counts as failing.
function checkAll(pairs) {
  const failures = [];
  const failingPaths = [];
  for (const p of pairs) {
    const f = p.error
      ? [{ path: p.path, kind: 'structure', detail: p.error }]
      : checkPair(p.path, p.original, p.changed);
    if (f.length) failingPaths.push(p.path);
    failures.push(...f);
  }
  return {
    checked: pairs.length,
    failing: failingPaths.length,
    failingPaths,
    failures,
  };
}

function formatResult(result) {
  const lines = [];
  lines.push(
    `integrity: ${result.checked} .vue files checked, ${result.failing} failing`,
  );
  for (const f of result.failures) {
    lines.push(`  ${f.path}  [${f.block || 'file'}]  ${f.kind}: ${f.detail}`);
  }
  return `${lines.join('\n')}\n`;
}

const exitCodeFor = (result) => (result.failing === 0 ? 0 : 1);

module.exports = {
  replacementTokens,
  tokenize,
  diffTokens,
  explainHunk,
  checkPair,
  checkAll,
  formatResult,
  exitCodeFor,
};
