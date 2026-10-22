// Testable core of the bs5-cutover codemod (design 3.4, 3.5).
//
// codemod.mjs is a thin CLI over this module. All file access goes through
// an injectable fs interface, so the property tests can run on an in-memory
// tree:
//
//   interface CodemodFs {
//     readFile(abs: string): string          // utf8
//     writeFile(abs: string, text: string): void
//     rename(from: string, to: string): void
//     mkdirp(abs: string): void
//     rmrf(abs: string): void                // no error when missing
//     unlink(abs: string): void              // no error when missing
//   }
//
// Paths in the report and the manifest are repo-relative with `/`.
'use strict';
const nodeFs = require('fs');
const nodePath = require('path');
const { isInScope, normalizePath } = require('./maps.cjs');
const { vueEdits } = require('./adapters/vue.cjs');
const { tsEdits } = require('./adapters/ts.cjs');
const { cssEdits } = require('./adapters/css.cjs');
const { markupEdits } = require('./adapters/markup.cjs');
const LAST_RUN_DIR = 'stuff/bs5-cutover/.last-run';
const TMP_SUFFIX = '.bs5-cutover.tmp';
// ---------------------------------------------------------------------------
// fs implementations
const realFs = Object.freeze({
  readFile: (p) => nodeFs.readFileSync(p, 'utf8'),
  writeFile: (p, text) => nodeFs.writeFileSync(p, text, 'utf8'),
  rename: (a, b) => nodeFs.renameSync(a, b),
  mkdirp: (p) => nodeFs.mkdirSync(p, { recursive: true }),
  rmrf: (p) => nodeFs.rmSync(p, { recursive: true, force: true }),
  unlink: (p) => nodeFs.rmSync(p, { force: true }),
});
// In-memory fs keyed by absolute path. `files` is a Map(abs → text).
// `fail` optionally maps an operation name to a predicate on the path that
// makes the operation throw (used to test I/O failures).
function memoryFs(initial = {}, fail = {}) {
  const files = new Map(Object.entries(initial));
  const check = (op, p) => {
    if (fail[op] && fail[op](p)) {
      const e = new Error(`${op} failed: ${p}`);
      e.code = 'EIO';
      throw e;
    }
  };
  return {
    files,
    readFile(p) {
      check('readFile', p);
      if (!files.has(p)) {
        const e = new Error(`ENOENT: no such file, open '${p}'`);
        e.code = 'ENOENT';
        throw e;
      }
      return files.get(p);
    },
    writeFile(p, text) {
      check('writeFile', p);
      files.set(p, String(text));
    },
    rename(a, b) {
      check('rename', b);
      if (!files.has(a)) throw new Error(`ENOENT: rename '${a}'`);
      files.set(b, files.get(a));
      files.delete(a);
    },
    mkdirp(p) {
      check('mkdirp', p);
    },
    rmrf(p) {
      const prefix = p.endsWith('/') ? p : `${p}/`;
      for (const k of [...files.keys()]) {
        if (k === p || k.startsWith(prefix)) files.delete(k);
      }
    },
    unlink(p) {
      files.delete(p);
    },
  };
}
// ---------------------------------------------------------------------------
// Discovery
// `tracked` is the output of `git ls-files -- frontend cypress`.
function selectFiles(tracked) {
  return [...new Set(tracked.map(normalizePath))]
    .filter((p) => p !== '' && isInScope(p))
    .sort();
}
// ---------------------------------------------------------------------------
// Edits
function extOf(p) {
  return nodePath.extname(p).toLowerCase();
}
// Adapter dispatch by extension. Returns the adapter result; adapter
// exceptions and `error` results are normalised to { error }.
// `extra` is merged into the adapter options; the scan passes
// `{ allowlist: [] }` so the adapters report every entry and never read
// allowlist.json (scan-core applies the allowlist itself).
function adapterEdits(path, text, extra = {}) {
  const ext = extOf(path);
  switch (ext) {
    case '.vue':
      return vueEdits(text, { ...extra, path });
    case '.ts':
    case '.js':
      return tsEdits(text, { ...extra, path, scriptKind: ext.slice(1) });
    case '.scss':
    case '.css':
      return cssEdits(text, { ...extra, path });
    case '.tpl':
    case '.html':
      return markupEdits(text, { ...extra, path });
    default:
      return { error: `no adapter for extension ${ext || '(none)'}` };
  }
}
// Applies non-overlapping edits back to front. Throws on overlap or an
// out-of-range edit; the caller treats that as an adapter bug.
function applyEdits(text, edits) {
  const sorted = [...edits].sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    if (
      !Number.isInteger(e.start) ||
      !Number.isInteger(e.end) ||
      e.start < 0 ||
      e.end < e.start ||
      e.end > text.length
    ) {
      throw new Error(`edit out of range: ${e.start}-${e.end}`);
    }
    if (i > 0 && e.start < sorted[i - 1].end) {
      throw new Error(
        `overlapping edits at ${sorted[i - 1].start}-${sorted[i - 1].end} and ${
          e.start
        }-${e.end}`,
      );
    }
  }
  let out = text;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const e = sorted[i];
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return out;
}
// Pure per-file step: text in, rewritten text and findings out.
//   { output, replacements, unresolved, error? }
// On error `output` is the original text: the file is never changed.
function processText(path, text) {
  const src = String(text);
  const none = { output: src, replacements: [], unresolved: [] };
  // A 0-byte file has no BS4 content. The Vue parser rejects it ("original
  // already invalid"), but there is nothing to rewrite, so it is not an error.
  if (src.length === 0) return none;
  let res;
  try {
    res = adapterEdits(path, src);
  } catch (e) {
    return { ...none, error: e.message };
  }
  if (res.error) return { ...none, error: res.error };
  let output;
  try {
    output = applyEdits(src, res.edits || []);
  } catch (e) {
    return { ...none, error: `adapter bug: ${e.message}` };
  }
  return {
    output,
    replacements: res.replacements || [],
    unresolved: res.unresolved || [],
  };
}
// ---------------------------------------------------------------------------
// Report
const replacementLabel = (r) =>
  `${r.from}→${r.to.length ? r.to.join(' ') : '∅'}`;
function countReplacements(replacements) {
  const counts = {};
  for (const r of replacements) {
    const k = replacementLabel(r);
    counts[k] = (counts[k] || 0) + 1;
  }
  return counts;
}
function emptyReport(mode) {
  return {
    mode,
    filesScanned: 0,
    replacementCount: 0,
    changed: [],
    totals: {},
    manualConversion: [],
    manualReview: [],
    errors: [],
  };
}
// Adds one processed file to the report. `changed` is whether its text
// changed (or would change, in check mode).
function addToReport(report, path, result, changed) {
  report.filesScanned++;
  if (result.error) {
    report.errors.push({ path, message: result.error });
    return;
  }
  for (const u of result.unresolved) {
    if (u.reason === 'manual-conversion') {
      report.manualConversion.push({
        path,
        line: u.line,
        construct: u.token,
        detail: u.detail,
      });
    } else {
      report.manualReview.push({
        path,
        line: u.line,
        token: u.token,
        detail: u.detail,
      });
    }
  }
  if (!changed) return;
  const counts = countReplacements(result.replacements);
  report.changed.push({ path, counts });
  for (const [k, n] of Object.entries(counts)) {
    report.totals[k] = (report.totals[k] || 0) + n;
    report.replacementCount += n;
  }
}
function formatReport(report) {
  const lines = [];
  lines.push(
    `bs5-cutover codemod: ${report.filesScanned} files scanned, ` +
      `${report.changed.length} changed, ${report.replacementCount} replacements` +
      (report.mode === 'check' ? ' (check: nothing written)' : ''),
  );
  const none = '  (none)';
  const counts = (c) =>
    Object.entries(c)
      .map(([k, n]) => `${k} ×${n}`)
      .join(', ');
  lines.push(
    report.mode === 'check' ? 'Files that would change:' : 'Changed files:',
  );
  if (!report.changed.length) lines.push(none);
  for (const c of report.changed) {
    const detail = counts(c.counts);
    lines.push(
      `  ${c.path}${detail ? `  (${detail})` : '  (structural edits only)'}`,
    );
  }
  lines.push('Replacements by map entry:');
  const totals = Object.entries(report.totals).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  if (!totals.length) lines.push(none);
  for (const [k, n] of totals) lines.push(`  ${k}  ${n}`);
  lines.push('Manual conversion (Removal_Map needs layout choice):');
  if (!report.manualConversion.length) lines.push(none);
  for (const m of report.manualConversion) {
    lines.push(`  ${m.path}:${m.line}  ${m.construct}  ${m.detail}`);
  }
  lines.push('Manual review (not statically rewritable):');
  if (!report.manualReview.length) lines.push(none);
  for (const m of report.manualReview) {
    lines.push(`  ${m.path}:${m.line}  ${m.token}  ${m.detail}`);
  }
  lines.push('Errors:');
  if (!report.errors.length) lines.push(none);
  for (const e of report.errors) lines.push(`  ${e.path}  ${e.message}`);
  return `${lines.join('\n')}\n`;
}
// ---------------------------------------------------------------------------
// Run
// opts:
//   root      repo root (absolute)
//   files     repo-relative paths to process (already selected)
//   fs        CodemodFs (default: real fs)
//   check     dry run: nothing written, no snapshot
//   now       () => Date (default: new Date())
//   headSha   recorded in the manifest
// Returns { report, exitCode, manifest? }.
function runCodemod(opts) {
  const fs = opts.fs || realFs;
  const root = opts.root;
  const check = !!opts.check;
  const abs = (p) => nodePath.join(root, p);
  const report = emptyReport(check ? 'check' : 'write');
  const startedAt = (opts.now ? opts.now() : new Date()).toISOString();
  const lastRun = abs(LAST_RUN_DIR);
  const written = [];
  if (!check) {
    try {
      fs.rmrf(lastRun);
      fs.mkdirp(nodePath.join(lastRun, 'originals'));
    } catch (e) {
      report.errors.push({
        path: LAST_RUN_DIR,
        message: `cannot reset snapshot: ${e.message}`,
      });
      return { report, exitCode: 1 };
    }
  }
  const files = [...new Set(opts.files.map(normalizePath))].sort();
  for (const path of files) {
    let text;
    try {
      text = fs.readFile(abs(path));
    } catch (e) {
      addToReport(report, path, { error: `read failed: ${e.message}` }, false);
      continue;
    }
    const result = processText(path, text);
    const changed = !result.error && result.output !== text;
    if (changed && !check) {
      const target = abs(path);
      const tmp = target + TMP_SUFFIX;
      try {
        const original = abs(`${LAST_RUN_DIR}/originals/${path}`);
        fs.mkdirp(nodePath.dirname(original));
        fs.writeFile(original, text);
        fs.writeFile(tmp, result.output);
        fs.rename(tmp, target);
        written.push(path);
      } catch (e) {
        try {
          fs.unlink(tmp);
        } catch (_) {
          // the temp file may not exist
        }
        addToReport(
          report,
          path,
          { error: `write failed: ${e.message}` },
          false,
        );
        continue;
      }
    }
    addToReport(report, path, result, changed);
  }
  let manifest;
  if (!check) {
    manifest = { startedAt, headSha: opts.headSha || null, files: written };
    try {
      fs.writeFile(
        nodePath.join(lastRun, 'manifest.json'),
        `${JSON.stringify(manifest, null, 2)}\n`,
      );
    } catch (e) {
      report.errors.push({
        path: `${LAST_RUN_DIR}/manifest.json`,
        message: `write failed: ${e.message}`,
      });
    }
  }
  const exitCode =
    report.errors.length > 0 || (check && report.changed.length > 0) ? 1 : 0;
  return { report, exitCode, manifest };
}
module.exports = {
  LAST_RUN_DIR,
  TMP_SUFFIX,
  realFs,
  memoryFs,
  selectFiles,
  adapterEdits,
  applyEdits,
  processText,
  replacementLabel,
  countReplacements,
  formatReport,
  runCodemod,
};
