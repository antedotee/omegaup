// Feature: bootstrap5-css-cutover, Property 15: Codemod and scan agree
//
// For any generated in-scope file x with y = processText(x).output, the
// `bs4-class` matches of scanText(y) correspond one-to-one, by line and
// token, with the unresolved entries (manual-conversion and manual-review)
// the codemod reported for x. So once every reported entry is converted by
// hand, the scan reports zero.
//
// How lines are compared. Unresolved entries carry lines of x; scan matches
// carry lines of y. Structural edits (removed wrappers, inserted attributes,
// collapsed lists) can add or remove newlines, so the same token may sit on
// a different line in y. We do not accept an arbitrary shift: each x line is
// mapped through the codemod's own edit list to the exact interval of y
// lines its text can occupy. Text outside every edit maps to one exact
// offset; text inside an edit span maps to the span's replacement. A scan
// match pairs with an entry only if the token is equal and its y line lies
// in that interval. Pairing is per token, in line order on both sides, which
// is valid because edits are non-overlapping and order-preserving, so the
// x->y offset map is monotone. With no newline-changing edits the interval
// is a single line, so the check reduces to exact line equality.
//
// **Validates: Requirements 5.15, 7.3, 12.8**
'use strict';
const fc = require('fast-check');
const nodeFs = require('fs');
const nodePath = require('path');
const { execFileSync } = require('child_process');
const {
  processText,
  adapterEdits,
  selectFiles,
} = require('../codemod-core.cjs');
const { scanText } = require('../scan-core.cjs');
const { sfc, scss, tsFile, tplFile } = require('./arbitraries.cjs');

const RUNS = { numRuns: 200 };
const REPO = nodePath.resolve(__dirname, '../../..');

// ---------------------------------------------------------------------------
// Offset/line helpers

function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++)
    if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return starts;
}

function lineOfOffset(starts, pos) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= pos) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

// Maps an x offset to the y offset range it can end up in, given the
// (non-overlapping) edits the codemod applied.
function mapOffset(sortedEdits, pos) {
  let delta = 0;
  for (const e of sortedEdits) {
    if (pos < e.start) break;
    if (pos < e.end || (pos === e.start && e.start === e.end)) {
      // Inside (or at an insertion point of) the edit: anywhere in the
      // replacement text.
      const yStart = e.start + delta;
      return [yStart, yStart + e.text.length];
    }
    delta += e.text.length - (e.end - e.start);
  }
  return [pos + delta, pos + delta];
}

// For x line L, the interval of y lines the line's text can occupy.
function lineMapper(x, y, edits) {
  const xs = lineStarts(x);
  const ys = lineStarts(y);
  const sorted = [...edits].sort((a, b) => a.start - b.start || a.end - b.end);
  return (L) => {
    const start = xs[L - 1];
    const end = L < xs.length ? xs[L] - 1 : x.length; // offset of '\n' or EOF
    const [lo] = mapOffset(sorted, start);
    const [, hi] = mapOffset(sorted, Math.max(start, end));
    return [lineOfOffset(ys, lo), lineOfOffset(ys, hi)];
  };
}

// Pairs unresolved entries of x with bs4-class matches of y. Returns a list
// of human-readable mismatches (empty when they agree).
function compare(path, x) {
  const res = processText(path, x);
  if (res.error) return { skipped: res.error, problems: [] };
  const y = res.output;
  const { edits = [] } = adapterEdits(path, x);
  const mapLine = lineMapper(x, y, edits);

  const matches = scanText(path, y).filter((m) => m.category === 'bs4-class');
  const problems = [];
  const byToken = new Map();
  const bucket = (t) => {
    if (!byToken.has(t)) byToken.set(t, { entries: [], matches: [] });
    return byToken.get(t);
  };
  for (const u of res.unresolved) bucket(u.token).entries.push(u);
  for (const m of matches) bucket(m.token).matches.push(m);

  for (const [token, { entries, matches: ms }] of byToken) {
    entries.sort((a, b) => a.line - b.line);
    ms.sort((a, b) => a.line - b.line);
    if (entries.length !== ms.length) {
      problems.push(
        `${token}: codemod unresolved ${
          entries.length
        } at x lines [${entries.map((e) => e.line)}], ` +
          `scan bs4-class ${ms.length} at y lines [${ms.map((m) => m.line)}]`,
      );
      continue;
    }
    entries.forEach((e, i) => {
      const [lo, hi] = mapLine(e.line);
      if (ms[i].line < lo || ms[i].line > hi) {
        problems.push(
          `${token}: x line ${e.line} maps to y lines ${lo}-${hi}, scan reports y line ${ms[i].line}`,
        );
      }
    });
  }
  return { res, matches, problems };
}

// ---------------------------------------------------------------------------
// Generated files

const CASES = [
  ['.vue', 'frontend/www/js/omegaup/components/X.vue', sfc],
  ['.scss', 'frontend/www/sass/x.scss', scss],
  ['.ts', 'frontend/www/js/omegaup/x.ts', tsFile],
  ['.tpl', 'frontend/templates/x.tpl', tplFile],
];

describe('Property 15: codemod and scan agree (generated files)', () => {
  for (const [ext, path, arb] of CASES) {
    test(`${ext}: scan bs4-class matches on rw(x) == codemod unresolved for x`, () => {
      let withUnresolved = 0;
      fc.assert(
        fc.property(arb, (x) => {
          const { skipped, res, matches, problems } = compare(path, x);
          expect(skipped).toBeUndefined();
          expect(problems).toEqual([]);
          if (res.unresolved.length === 0) {
            // Nothing left to convert by hand -> the scan passes.
            expect(matches).toEqual([]);
          } else {
            withUnresolved++;
          }
        }),
        RUNS,
      );
      // Guard against a generator that never exercises the non-trivial case.
      if (ext !== '.scss') expect(withUnresolved).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Real repo (read-only)

describe('Property 15: codemod and scan agree (real repo files, read-only)', () => {
  test('per file: scan bs4-class matches on rw(file) == codemod unresolved', () => {
    const tracked = execFileSync(
      'git',
      ['ls-files', '--', 'frontend', 'cypress'],
      {
        cwd: REPO,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      },
    )
      .split('\n')
      .filter(Boolean);
    const files = selectFiles(tracked);
    expect(files.length).toBeGreaterThan(0);

    const totals = {
      files: 0,
      skipped: 0,
      withUnresolved: 0,
      unresolved: 0,
      scanMatches: 0,
    };
    const failures = [];
    for (const p of files) {
      const abs = nodePath.join(REPO, p);
      if (!nodeFs.existsSync(abs)) continue;
      const x = nodeFs.readFileSync(abs, 'utf8');
      totals.files++;
      const { skipped, res, matches, problems } = compare(p, x);
      if (skipped) {
        // Files the codemod refuses are unchanged and gated by its Errors list.
        totals.skipped++;
        continue;
      }
      totals.unresolved += res.unresolved.length;
      totals.scanMatches += matches.length;
      if (res.unresolved.length) totals.withUnresolved++;
      if (matches.length !== res.unresolved.length || problems.length) {
        failures.push(
          `${p}: unresolved ${res.unresolved.length}, scan ${
            matches.length
          }; ${problems.join('; ')}`,
        );
      }
    }
    // eslint-disable-next-line no-console
    console.log(`Property 15 real-repo totals: ${JSON.stringify(totals)}`);
    expect(failures).toEqual([]);
    expect(totals.scanMatches).toBe(totals.unresolved);
  }, 180000);
});
