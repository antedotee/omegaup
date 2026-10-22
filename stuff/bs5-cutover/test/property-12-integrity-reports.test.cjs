// Feature: bootstrap5-css-cutover, Property 12: Integrity reports every failing file
//
// For any list of (original, changed) pairs of which k are failing, the
// integrity run lists exactly those k paths and prints the count k. It exits
// non-zero exactly when k > 0. Fixture tests cover original invalid (6.8),
// changed invalid (6.2), zero changed files (6.7), the PR2
// ProblemMarkdown.vue shape, and the integrity.mjs CLI end to end in a
// throwaway git repo.
//
// **Validates: Requirements 6.2, 6.6, 6.7, 6.8**
'use strict';
const fc = require('fast-check');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { processText, LAST_RUN_DIR } = require('../codemod-core.cjs');
const {
  checkPair,
  checkAll,
  formatResult,
  exitCodeFor,
} = require('../integrity-core.cjs');
const { renameKey } = require('./arbitraries.cjs');

const TOOL_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(TOOL_DIR, '../..');
const FIXTURES = path.join(TOOL_DIR, 'fixtures/integrity');
const fixture = (rel) => fs.readFileSync(path.join(FIXTURES, rel), 'utf8');

// ---------------------------------------------------------------------------
// Generators

const label = fc.stringMatching(/^[a-z]{1,8}$/);

// A small valid SFC that uses a BS4 class in every block the codemod edits.
const baseSfc = (key, text) =>
  [
    '<template>',
    `  <div class="${key}">`,
    `    <span>${text}</span>`,
    '  </div>',
    '</template>',
    '',
    '<script lang="ts">',
    `const cls = '${key}';`,
    "const math = [['$', '$']];",
    'export default { cls, math };',
    '</script>',
    '',
    '<style lang="scss">',
    `.${key} {`,
    '  margin: 0;',
    '}',
    '</style>',
    '',
  ].join('\n');

const breakSpan = (x) => x.replace('</span>', '');

// kind -> (original) -> [original, changed]
const MAKERS = {
  pass: (x, p) => [x, processText(p, x).output],
  unchanged: (x) => [x, x],
  'parse-error': (x, p) => [x, breakSpan(processText(p, x).output)],
  'original-invalid': (x) => [breakSpan(x), breakSpan(x)],
  structure: (x) => [
    x,
    x.replace('<style lang="scss">', '<style lang="scss" scoped>'),
  ],
  content: (x) => [x, x.replace("['$', '$']", "['+'")],
};
const PASSING = new Set(['pass', 'unchanged']);

const entry = fc.record({
  kind: fc.constantFrom(...Object.keys(MAKERS)),
  key: renameKey,
  text: label,
});

const pairList = fc.array(entry, { minLength: 0, maxLength: 12 }).map((es) =>
  es.map((e, i) => {
    const p = `frontend/www/js/omegaup/components/f${i}.vue`;
    const [original, changed] = MAKERS[e.kind](baseSfc(e.key, e.text), p);
    return { kind: e.kind, pair: { path: p, original, changed } };
  }),
);

// ---------------------------------------------------------------------------
// Property 12

describe('Property 12: integrity reports every failing file', () => {
  test('checkAll lists exactly the failing paths, once each, with the count', () => {
    fc.assert(
      fc.property(pairList, (items) => {
        const expected = items
          .filter((it) => !PASSING.has(it.kind))
          .map((it) => it.pair.path);
        const result = checkAll(items.map((it) => it.pair));
        expect(result.checked).toBe(items.length);
        expect(result.failingPaths).toEqual(expected);
        expect(new Set(result.failingPaths).size).toBe(
          result.failingPaths.length,
        );
        expect(result.failing).toBe(expected.length);

        const out = formatResult(result);
        expect(out).toContain(
          `integrity: ${items.length} .vue files checked, ${expected.length} failing`,
        );
        for (const p of expected) expect(out).toContain(`  ${p}  `);
        for (const it of items) {
          if (PASSING.has(it.kind))
            expect(out).not.toContain(`  ${it.pair.path}  `);
        }
        expect(exitCodeFor(result) === 0).toBe(expected.length === 0);
      }),
      { numRuns: 150 },
    );
  });
});

// ---------------------------------------------------------------------------
// Fixtures

describe('integrity fixtures', () => {
  test('original already invalid is reported as such (6.8)', () => {
    const p = 'original-invalid/X.vue';
    const result = checkAll([
      {
        path: p,
        original: fixture('original-invalid/original.vue'),
        changed: fixture('original-invalid/changed.vue'),
      },
    ]);
    expect(result.failingPaths).toEqual([p]);
    expect(result.failures.map((f) => f.kind)).toContain('original-invalid');
    const out = formatResult(result);
    expect(out).toContain(p);
    expect(out).toMatch(/original already invalid before the codemod run/);
    expect(exitCodeFor(result)).not.toBe(0);
  });

  test('changed file with a parse error prints path and error (6.2)', () => {
    const p = 'changed-invalid/X.vue';
    const result = checkAll([
      {
        path: p,
        original: fixture('changed-invalid/original.vue'),
        changed: fixture('changed-invalid/changed.vue'),
      },
    ]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].kind).toBe('parse-error');
    const out = formatResult(result);
    expect(out).toContain(
      `  ${p}  [file]  parse-error: Element is missing end tag`,
    );
    expect(exitCodeFor(result)).toBe(1);
  });

  test('zero changed files prints 0 .vue files checked and exits 0 (6.7)', () => {
    const result = checkAll([]);
    expect(formatResult(result)).toContain('0 .vue files checked');
    expect(exitCodeFor(result)).toBe(0);
  });

  test('PR2 ProblemMarkdown.vue shape passes integrity after the codemod', () => {
    const p = 'frontend/www/js/omegaup/components/problem/ProblemMarkdown.vue';
    const original = fixture('problem-markdown/original.vue');
    const r = processText(p, original);
    expect(r.error).toBeUndefined();
    expect(r.replacements.length).toBeGreaterThan(0);
    expect(r.output).toContain("['$', '$']");
    expect(r.output.match(/<style/g)).toHaveLength(1);
    expect(checkPair(p, original, r.output)).toEqual([]);
  });

  test('the PR2 corruption itself (mangled $ array, style copied into script) fails', () => {
    const p = 'frontend/www/js/omegaup/components/problem/ProblemMarkdown.vue';
    const original = fixture('problem-markdown/original.vue');
    const style = original.slice(
      original.indexOf('<style'),
      original.indexOf('</style>'),
    );
    const corrupt = processText(p, original)
      .output.replace("['$', '$'],", "['+")
      .replace('</script>', `${style.replace(/^<style[^>]*>/, '')}\n</script>`);
    const result = checkAll([{ path: p, original, changed: corrupt }]);
    expect(result.failingPaths).toEqual([p]);
    expect(result.failures.every((f) => f.block === 'script')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CLI end to end in a temp git repo (never the worktree)

describe('integrity.mjs CLI', () => {
  let repo;
  const VUE = 'frontend/www/js/omegaup/components/Fixture.vue';
  const git = (...a) =>
    execFileSync('git', a, { cwd: repo, encoding: 'utf8', stdio: 'pipe' });
  const cli = (...a) =>
    spawnSync(
      process.execPath,
      [path.join(repo, 'stuff/bs5-cutover/integrity.mjs'), ...a],
      { cwd: repo, encoding: 'utf8' },
    );
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
    fs.writeFileSync(path.join(repo, rel), text);
  };
  const commit = (msg) => {
    git('add', '-A');
    git('commit', '-q', '-m', msg);
    return git('rev-parse', 'HEAD').trim();
  };

  beforeAll(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bs5-integrity-'));
    // Copy the tool sources (not tests, fixtures, or a snapshot).
    const dest = path.join(repo, 'stuff/bs5-cutover');
    fs.cpSync(TOOL_DIR, dest, {
      recursive: true,
      filter: (src) => {
        const rel = path.relative(TOOL_DIR, src);
        return !/^(test|fixtures|\.last-run|node_modules)(\/|$)/.test(rel);
      },
    });
    // Module resolution for @vue/compiler-sfc, typescript, postcss.
    fs.symlinkSync(
      path.join(REPO_ROOT, 'node_modules'),
      path.join(repo, 'node_modules'),
      'dir',
    );
    fs.writeFileSync(path.join(repo, '.gitignore'), 'node_modules\n');
    git('init', '-q');
    git('config', 'user.email', 'test@example.invalid');
    git('config', 'user.name', 'integrity test');
    git('config', 'commit.gpgsign', 'false');
    write(VUE, fixture('problem-markdown/original.vue'));
    commit('base');
  });

  afterAll(() => {
    if (repo) fs.rmSync(repo, { recursive: true, force: true });
  });

  test('--commit HEAD: codemod output passes (exit 0)', () => {
    write(
      VUE,
      processText(VUE, fixture('problem-markdown/original.vue')).output,
    );
    commit('codemod');
    const r = cli('--commit', 'HEAD');
    expect(r.stdout).toContain('integrity: 1 .vue files checked, 0 failing');
    expect(r.status).toBe(0);
  });

  test('--commit HEAD: invalid change fails with path (exit 1)', () => {
    const cur = fs.readFileSync(path.join(repo, VUE), 'utf8');
    write(VUE, cur.replace('></div>', '>'));
    write('notes.txt', 'non-vue change is ignored\n');
    commit('break');
    const r = cli('--commit', 'HEAD');
    expect(r.stdout).toContain('integrity: 1 .vue files checked, 1 failing');
    expect(r.stdout).toContain(`  ${VUE}  [file]  parse-error:`);
    expect(r.status).toBe(1);
  });

  test('--commit with no .vue change prints 0 files checked (exit 0)', () => {
    write('notes.txt', 'only text\n');
    commit('text only');
    const r = cli('--commit', 'HEAD');
    expect(r.stdout).toContain('integrity: 0 .vue files checked, 0 failing');
    expect(r.status).toBe(0);
  });

  test('--commit with a missing sha exits 2 and never passes', () => {
    const r = cli('--commit', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef');
    expect(r.stderr).toMatch(/integrity: commit deadbeef\w* not found/);
    expect(r.stdout).not.toContain('checked');
    expect(r.status).toBe(2);
  });

  describe('.last-run mode', () => {
    const snap = () => path.join(repo, LAST_RUN_DIR);
    const fabricate = (files) => {
      fs.rmSync(snap(), { recursive: true, force: true });
      fs.mkdirSync(snap(), { recursive: true });
      for (const [rel, original] of Object.entries(files)) {
        const dest = path.join(snap(), 'originals', rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, original);
      }
      fs.writeFileSync(
        path.join(snap(), 'manifest.json'),
        JSON.stringify({ files: Object.keys(files) }),
      );
    };
    const A = 'frontend/www/js/omegaup/components/A.vue';
    const B = 'frontend/www/js/omegaup/components/B.vue';
    const original = fixture('problem-markdown/original.vue');

    test('every file passing exits 0', () => {
      write(A, processText(A, original).output);
      fabricate({ [A]: original });
      const r = cli();
      expect(r.stdout).toContain('integrity: 1 .vue files checked, 0 failing');
      expect(r.status).toBe(0);
    });

    test('lists every failing file and keeps checking the rest (exit 1)', () => {
      write(A, processText(A, original).output.replace('></div>', '>'));
      write(B, fixture('original-invalid/changed.vue'));
      const C = 'frontend/www/js/omegaup/components/C.vue';
      write(C, processText(C, original).output);
      fabricate({
        [A]: original,
        [B]: fixture('original-invalid/original.vue'),
        [C]: original,
      });
      const r = cli();
      expect(r.stdout).toContain('integrity: 3 .vue files checked, 2 failing');
      expect(r.stdout).toContain(`  ${A}  [file]  parse-error:`);
      expect(r.stdout).toContain(`  ${B}  [file]  original-invalid:`);
      expect(r.stdout).not.toContain(`  ${C}  `);
      expect(r.status).toBe(1);
    });

    test('empty manifest prints 0 .vue files checked (exit 0)', () => {
      fabricate({});
      const r = cli();
      expect(r.stdout).toContain('integrity: 0 .vue files checked, 0 failing');
      expect(r.status).toBe(0);
    });

    test('missing manifest exits 2 and never passes', () => {
      fs.rmSync(snap(), { recursive: true, force: true });
      const r = cli();
      expect(r.stderr).toContain('integrity: no codemod run snapshot');
      expect(r.stdout).toBe('');
      expect(r.status).toBe(2);
    });
  });
});
