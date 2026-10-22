// Property 1: Codemod idempotence (design, Correctness Properties).
//
// For any in-scope source text x, applying the codemod twice gives the same
// text as applying it once, and the second application reports zero
// replacements: rw(rw(x)).text == rw(x).text, rw(rw(x)).replacements == [].
// At the run level: a second runCodemod over the rewritten tree changes no
// file, and a `check` run over it exits 0 (gate 12.6).
//
// **Validates: Requirements 5.9, 12.6**
'use strict';
const fc = require('fast-check');
const nodeFs = require('fs');
const nodePath = require('path');
const { execFileSync } = require('child_process');
const {
  processText,
  runCodemod,
  memoryFs,
  selectFiles,
} = require('../codemod-core.cjs');
const { sfc, scss, tsFile, tplFile } = require('./arbitraries.cjs');

const RUNS = { numRuns: 200 };
const REPO = nodePath.resolve(__dirname, '../../..');

// Asserts idempotence of processText on one text. Returns the first result.
function expectIdempotent(path, text) {
  const once = processText(path, text);
  expect(once.error).toBeUndefined();
  const twice = processText(path, once.output);
  expect(twice.error).toBeUndefined();
  expect(twice.output).toBe(once.output);
  expect(twice.replacements).toEqual([]);
  return once;
}

describe('Property 1: codemod idempotence (processText)', () => {
  const cases = [
    ['.vue', 'frontend/www/js/omegaup/components/X.vue', sfc],
    ['.scss', 'frontend/www/sass/x.scss', scss],
    ['.ts', 'frontend/www/js/omegaup/x.ts', tsFile],
    ['.tpl', 'frontend/templates/x.tpl', tplFile],
  ];
  for (const [ext, path, arb] of cases) {
    test(`${ext}: rw(rw(x)) == rw(x) with zero second-pass replacements`, () => {
      fc.assert(
        fc.property(arb, (text) => {
          expectIdempotent(path, text);
        }),
        RUNS,
      );
    });
  }
});

describe('Property 1: codemod idempotence (runCodemod)', () => {
  test('second run over a rewritten in-memory tree changes nothing; check exits 0', () => {
    const tree = fc.record({
      vue: sfc,
      scss: scss,
      ts: tsFile,
      tpl: tplFile,
    });
    fc.assert(
      fc.property(tree, (t) => {
        const root = '/repo';
        const rel = {
          'frontend/www/js/omegaup/components/A.vue': t.vue,
          'frontend/www/sass/a.scss': t.scss,
          'frontend/www/js/omegaup/a.ts': t.ts,
          'frontend/templates/a.tpl': t.tpl,
        };
        const initial = {};
        for (const [p, text] of Object.entries(rel))
          initial[nodePath.join(root, p)] = text;
        const fs = memoryFs(initial);
        const files = Object.keys(rel);
        const now = () => new Date(0);

        const first = runCodemod({ root, files, fs, now });
        expect(first.report.errors).toEqual([]);
        expect(first.exitCode).toBe(0);
        const afterFirst = new Map(
          files.map((p) => [p, fs.readFile(nodePath.join(root, p))]),
        );

        const second = runCodemod({ root, files, fs, now });
        expect(second.exitCode).toBe(0);
        expect(second.report.changed).toEqual([]);
        expect(second.report.replacementCount).toBe(0);
        expect(second.manifest.files).toEqual([]);
        for (const p of files) {
          expect(fs.readFile(nodePath.join(root, p))).toBe(afterFirst.get(p));
        }

        const check = runCodemod({ root, files, fs, now, check: true });
        expect(check.exitCode).toBe(0);
        expect(check.report.changed).toEqual([]);
        expect(check.report.replacementCount).toBe(0);
      }),
      { numRuns: 50 },
    );
  });
});

describe('Property 1: codemod idempotence (real repo files, read-only)', () => {
  test('second pass over every in-scope tracked file is a no-op', () => {
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

    const failures = [];
    for (const p of files) {
      const abs = nodePath.join(REPO, p);
      if (!nodeFs.existsSync(abs)) continue;
      const text = nodeFs.readFileSync(abs, 'utf8');
      const once = processText(p, text);
      // Files the codemod refuses (error) are left unchanged; idempotence is
      // about what it does write, and errors are gated elsewhere.
      if (once.error) continue;
      const twice = processText(p, once.output);
      if (twice.error) {
        failures.push(`${p}: second pass error: ${twice.error}`);
      } else if (twice.output !== once.output || twice.replacements.length) {
        const labels = twice.replacements.map(
          (r) => `${r.from}→${r.to.join(' ')}`,
        );
        failures.push(
          `${p}: second pass changed text (${
            labels.join(', ') || 'structural'
          })`,
        );
      }
    }
    expect(failures).toEqual([]);
  }, 120000);
});
