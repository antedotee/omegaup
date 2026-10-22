// CSS/SCSS adapter for the bs5-cutover codemod (design 3.3).
//
// Finds selector spans (rule selectors and `@extend` params) with
// postcss-scss and hands each bare selector string to core.rewriteSelector.
// Declarations, other at-rule params, and comments are never inspected.
//
// cssEdits(text, { baseOffset = 0, baseLine = 1, path }) returns
//   { edits: { start, end, text }[], replacements, unresolved: (Unresolved & { line })[] }
// with offsets into the ORIGINAL file: `text` may be a `<style>` block body
// that starts at `baseOffset` / `baseLine` of the enclosing file. Applying the
// edits back to front leaves every byte outside them unchanged.
'use strict';
const postcssScss = require('postcss-scss');
const { rewriteSelector } = require('../core.cjs');

const DETAIL_LOCATE = 'selector source position did not match its text';

// Offsets of the first character of each line. postcss counts lines on `\n`
// only (a `\r` is the last column of its line), so CRLF needs no special case.
function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) starts.push(i + 1);
  }
  return starts;
}

function lineOfOffset(starts, offset) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

function cssEdits(text, { baseOffset = 0, baseLine = 1, path } = {}) {
  const src = String(text);
  const edits = [];
  const replacements = [];
  const unresolved = [];
  const starts = lineStarts(src);
  const lineAt = (localOffset) =>
    baseLine + lineOfOffset(starts, localOffset) - 1;

  let root;
  try {
    root = postcssScss.parse(src, { from: path });
  } catch (e) {
    const err = new Error(
      `css adapter: cannot parse ${path || '<input>'}: ${e.message}`,
    );
    err.cause = e;
    throw err;
  }

  // Rewrites the selector `raw` found at local offset `at`. `at` < 0 means
  // the position could not be verified: report, never edit.
  const handle = (raw, at, nodeLine) => {
    const result = rewriteSelector(raw);
    const located = at >= 0 && src.slice(at, at + raw.length) === raw;
    const tokenLine = (token) => {
      if (!located) return baseLine + nodeLine - 1;
      const i = raw.indexOf(`.${token}`);
      return lineAt(at + (i >= 0 ? i : 0));
    };
    if (!located) {
      // Only matters when the selector would have changed or been reported.
      const tokens = [
        ...result.replacements.map((r) => r.from),
        ...result.unresolved.map((u) => u.token),
      ];
      for (const token of new Set(tokens)) {
        unresolved.push({
          token,
          reason: 'manual-review',
          detail: DETAIL_LOCATE,
          line: tokenLine(token),
        });
      }
      return;
    }
    for (const u of result.unresolved) {
      unresolved.push({ ...u, line: tokenLine(u.token) });
    }
    replacements.push(...result.replacements);
    if (result.value !== raw) {
      edits.push({
        start: baseOffset + at,
        end: baseOffset + at + raw.length,
        text: result.value,
      });
    }
  };

  const offsetOf = (node) => {
    const pos = node.source && node.source.start;
    if (!pos || pos.line - 1 >= starts.length) return -1;
    return starts[pos.line - 1] + pos.column - 1;
  };

  root.walk((node) => {
    if (node.type === 'rule') {
      const raw =
        (node.raws.selector && node.raws.selector.raw) ?? node.selector;
      handle(raw, offsetOf(node), node.source.start.line);
      return;
    }
    if (node.type !== 'atrule' || node.name !== 'extend') return;
    const params = (node.raws.params && node.raws.params.raw) ?? node.params;
    const at = offsetOf(node);
    const paramsAt =
      at >= 0
        ? at + 1 + node.name.length + (node.raws.afterName || '').length
        : -1;
    // `@extend .x !optional`: only the selector part goes to the core.
    const m = /^([\s\S]*?)(\s*!optional\s*)?$/.exec(params);
    handle(m[1], paramsAt, node.source.start.line);
  });

  return { edits, replacements, unresolved };
}

module.exports = { cssEdits, DETAIL_LOCATE };
