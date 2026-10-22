// Property 9: Report totals are consistent (design, Correctness Properties).
//
// For any set of in-memory files, the per-entry totals in the report equal
// the sum of the per-file counts. The changed-file list is exactly the set of
// files whose text changed. The exit status is 0 when no read or write fails.
//
// Plus an example for the I/O failure path (Requirement 5.13): a file that
// cannot be read or written stays unchanged, the error names its path, the
// remaining files are still processed, and the exit status is 1.
//
// **Validates: Requirements 5.10, 5.13**
'use strict';
const fc = require('fast-check');
const {
  memoryFs,
  runCodemod,
  processText,
  TMP_SUFFIX,
} = require('../codemod-core.cjs');
const { sfc, scss, tsFile, tplFile } = require('./arbitraries.cjs');

const ROOT = '/repo';
const abs = (p) => `${ROOT}/${p}`;
const NOW = () => new Date('2024-01-01T00:00:00Z');

// A small tree of mixed file types with unique repo-relative paths.
const KINDS = [
  { ext: 'vue', dir: 'frontend/www/js/omegaup/components', arb: sfc },
  { ext: 'scss', dir: 'frontend/www/sass', arb: scss },
  { ext: 'ts', dir: 'frontend/www/js/omegaup', arb: tsFile },
  { ext: 'tpl', dir: 'frontend/templates', arb: tplFile },
];
const tree = fc
  .array(
    fc.oneof(...KINDS.map((k) => k.arb.map((text) => ({ kind: k, text })))),
    { minLength: 1, maxLength: 6 },
  )
  .map((entries) =>
    entries.map(({ kind, text }, i) => ({
      path: `${kind.dir}/f${i}.${kind.ext}`,
      text,
    })),
  );

const sumCounts = (changed) => {
  const sum = {};
  for (const c of changed) {
    for (const [k, n] of Object.entries(c.counts)) sum[k] = (sum[k] || 0) + n;
  }
  return sum;
};
const total = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);

function checkTotals(report, inputCount) {
  expect(report.filesScanned).toBe(inputCount);
  const sum = sumCounts(report.changed);
  expect(report.totals).toEqual(sum);
  expect(report.replacementCount).toBe(total(sum));
  for (const n of Object.values(report.totals)) expect(n).toBeGreaterThan(0);
}

describe('Property 9: report totals are consistent', () => {
  test('write mode: totals, changed list, and exit status', () => {
    fc.assert(
      fc.property(tree, (files) => {
        const initial = Object.fromEntries(
          files.map((f) => [abs(f.path), f.text]),
        );
        const fs = memoryFs(initial);
        const { report, exitCode } = runCodemod({
          root: ROOT,
          files: files.map((f) => f.path),
          fs,
          now: NOW,
          headSha: 'abc',
        });

        checkTotals(report, files.length);

        const differs = files
          .filter((f) => fs.files.get(abs(f.path)) !== f.text)
          .map((f) => f.path)
          .sort();
        expect(report.changed.map((c) => c.path).sort()).toEqual(differs);

        // No read or write fails on the in-memory tree.
        expect(report.errors).toEqual([]);
        expect(exitCode).toBe(0);
      }),
      { numRuns: 150 },
    );
  });

  test('check mode: same totals as write mode, nothing written', () => {
    fc.assert(
      fc.property(tree, (files) => {
        const initial = Object.fromEntries(
          files.map((f) => [abs(f.path), f.text]),
        );
        const paths = files.map((f) => f.path);
        const checkFs = memoryFs(initial);
        const checked = runCodemod({
          root: ROOT,
          files: paths,
          fs: checkFs,
          check: true,
          now: NOW,
        });
        const written = runCodemod({
          root: ROOT,
          files: paths,
          fs: memoryFs(initial),
          now: NOW,
        });

        checkTotals(checked.report, files.length);
        expect(checked.report.totals).toEqual(written.report.totals);
        expect(checked.report.changed).toEqual(written.report.changed);
        expect(Object.fromEntries(checkFs.files)).toEqual(initial);
        expect(checked.exitCode).toBe(
          checked.report.changed.length > 0 ? 1 : 0,
        );
      }),
      { numRuns: 100 },
    );
  });
});

describe('I/O failure leaves the file unchanged (Requirement 5.13)', () => {
  const text = '.panel .ml-2 {\n  color: red;\n}\n';
  const readFail = 'frontend/www/sass/a-read.scss';
  const writeFail = 'frontend/www/sass/b-write.scss';
  const ok = 'frontend/www/sass/c-ok.scss';

  test('read and write failures are reported per path with exit 1', () => {
    // Precondition: the codemod would rewrite this text.
    expect(processText(ok, text).output).not.toBe(text);

    const initial = {
      [abs(readFail)]: text,
      [abs(writeFail)]: text,
      [abs(ok)]: text,
    };
    const fs = memoryFs(initial, {
      readFile: (p) => p === abs(readFail),
      writeFile: (p) => p === abs(writeFail) + TMP_SUFFIX,
    });
    const { report, exitCode, manifest } = runCodemod({
      root: ROOT,
      files: [readFail, writeFail, ok],
      fs,
      now: NOW,
    });

    // Failed files are untouched; no temp file is left behind.
    expect(fs.files.get(abs(readFail))).toBe(text);
    expect(fs.files.get(abs(writeFail))).toBe(text);
    expect(fs.files.has(abs(writeFail) + TMP_SUFFIX)).toBe(false);

    // Each error names its path and the failure.
    expect(report.errors.map((e) => e.path)).toEqual([readFail, writeFail]);
    expect(report.errors[0].message).toMatch(/read failed/);
    expect(report.errors[0].message).toContain(abs(readFail));
    expect(report.errors[1].message).toMatch(/write failed/);

    // The remaining file is still processed.
    expect(fs.files.get(abs(ok))).toBe(processText(ok, text).output);
    expect(report.changed.map((c) => c.path)).toEqual([ok]);
    expect(manifest.files).toEqual([ok]);
    expect(report.filesScanned).toBe(3);
    expect(report.replacementCount).toBe(total(report.totals));

    expect(exitCode).toBe(1);
  });
});
