// Example tests for codemod-core.cjs (design 3.4, 3.5) on an in-memory fs.
'use strict';
const {
  LAST_RUN_DIR,
  memoryFs,
  selectFiles,
  applyEdits,
  processText,
  formatReport,
  runCodemod,
} = require('../codemod-core.cjs');
const ROOT = '/repo';
const abs = (p) => `${ROOT}/${p}`;
const VUE = 'frontend/www/js/omegaup/components/A.vue';
const SCSS = 'frontend/www/sass/a.scss';
const CLEAN = 'frontend/www/js/omegaup/clean.ts';
const EMPTY = 'frontend/www/js/omegaup/components/Empty.vue';
const tree = () => ({
  [abs(VUE)]:
    '<template>\n  <div class="form-group mr-2">\n    <span class="form-inline">x</span>\n  </div>\n</template>\n',
  [abs(SCSS)]: '.sr-only { color: red; }\n',
  [abs(CLEAN)]: "export const x = 'hello';\n",
  [abs(EMPTY)]: '',
});
const FILES = [VUE, SCSS, CLEAN, EMPTY];
const now = () => new Date('2024-01-01T00:00:00Z');
describe('selectFiles', () => {
  test('keeps in-scope extensions and drops Excluded_Paths', () => {
    expect(
      selectFiles([
        'frontend/www/js/a.vue',
        'frontend/www/third_party/x.js',
        'frontend/www/js/a.php',
        'cypress/e2e/x.cy.ts',
        'frontend/node_modules/y.js',
        '',
      ]),
    ).toEqual(['cypress/e2e/x.cy.ts', 'frontend/www/js/a.vue']);
  });
});
describe('applyEdits', () => {
  test('applies back to front against original offsets', () => {
    expect(
      applyEdits('abcdef', [
        { start: 0, end: 1, text: 'XX' },
        { start: 4, end: 6, text: '' },
      ]),
    ).toBe('XXbcd');
  });
  test('rejects overlapping edits', () => {
    expect(() =>
      applyEdits('abcdef', [
        { start: 0, end: 3, text: '' },
        { start: 2, end: 4, text: '' },
      ]),
    ).toThrow(/overlapping/);
  });
});
describe('processText', () => {
  test('0-byte file is nothing to do, not an error', () => {
    expect(processText(EMPTY, '')).toEqual({
      output: '',
      replacements: [],
      unresolved: [],
    });
  });
  test('unparsable original is an error and left unchanged', () => {
    const src = '<template><div class="mr-2"></template>';
    const r = processText(VUE, src);
    expect(r.error).toMatch(/original already invalid/);
    expect(r.output).toBe(src);
  });
});
describe('runCodemod', () => {
  test('write mode rewrites, snapshots originals, writes manifest', () => {
    const fs = memoryFs(tree());
    fs.files.set(abs(`${LAST_RUN_DIR}/originals/stale.vue`), 'old');
    const { report, exitCode, manifest } = runCodemod({
      root: ROOT,
      files: FILES,
      fs,
      now,
      headSha: 'abc123',
    });
    expect(exitCode).toBe(0);
    expect(fs.files.get(abs(VUE))).toContain('class="mb-3 me-2"');
    expect(fs.files.get(abs(VUE))).toContain('class="form-inline"');
    expect(fs.files.get(abs(SCSS))).toBe('.visually-hidden { color: red; }\n');
    expect(fs.files.get(abs(CLEAN))).toBe(tree()[abs(CLEAN)]);
    // Snapshot: stale entries cleared, originals of changed files stored.
    expect(fs.files.has(abs(`${LAST_RUN_DIR}/originals/stale.vue`))).toBe(
      false,
    );
    expect(fs.files.get(abs(`${LAST_RUN_DIR}/originals/${VUE}`))).toBe(
      tree()[abs(VUE)],
    );
    expect(manifest).toEqual({
      startedAt: '2024-01-01T00:00:00.000Z',
      headSha: 'abc123',
      files: [VUE, SCSS],
    });
    expect(
      JSON.parse(fs.files.get(abs(`${LAST_RUN_DIR}/manifest.json`))),
    ).toEqual(manifest);
    // No temp files left behind.
    expect([...fs.files.keys()].some((k) => k.endsWith('.tmp'))).toBe(false);
    // Report.
    expect(report.filesScanned).toBe(4);
    expect(report.changed.map((c) => c.path)).toEqual([VUE, SCSS]);
    expect(report.totals).toEqual({
      'form-group→mb-3': 1,
      'mr-2→me-2': 1,
      'sr-only→visually-hidden': 1,
    });
    expect(report.replacementCount).toBe(3);
    expect(report.manualConversion).toEqual([
      expect.objectContaining({ path: VUE, line: 3, construct: 'form-inline' }),
    ]);
    expect(report.errors).toEqual([]);
    const text = formatReport(report);
    expect(text.split('\n')[0]).toBe(
      'bs5-cutover codemod: 4 files scanned, 2 changed, 3 replacements',
    );
    expect(text).toContain(`  ${VUE}:3  form-inline  `);
  });
  test('second run is a no-op (check exits 0)', () => {
    const fs = memoryFs(tree());
    runCodemod({ root: ROOT, files: FILES, fs, now });
    const again = runCodemod({
      root: ROOT,
      files: FILES,
      fs,
      now,
      check: true,
    });
    expect(again.exitCode).toBe(0);
    expect(again.report.changed).toEqual([]);
  });
  test('check mode writes nothing and exits 1 when edits would apply', () => {
    const fs = memoryFs(tree());
    const before = new Map(fs.files);
    const { report, exitCode } = runCodemod({
      root: ROOT,
      files: FILES,
      fs,
      now,
      check: true,
    });
    expect(exitCode).toBe(1);
    expect(report.changed.map((c) => c.path)).toEqual([VUE, SCSS]);
    expect(fs.files).toEqual(before);
  });
  test('I/O and parse errors: file untouched, others processed, exit 1', () => {
    const BAD = 'frontend/www/js/omegaup/components/Bad.vue';
    const MISSING = 'frontend/www/js/omegaup/missing.ts';
    const fs = memoryFs(
      { ...tree(), [abs(BAD)]: '<template><div class="mr-2"></template>' },
      { rename: (p) => p === abs(SCSS) },
    );
    const { report, exitCode } = runCodemod({
      root: ROOT,
      files: [...FILES, BAD, MISSING],
      fs,
      now,
    });
    expect(exitCode).toBe(1);
    expect(report.errors.map((e) => e.path).sort()).toEqual(
      [BAD, MISSING, SCSS].sort(),
    );
    expect(fs.files.get(abs(SCSS))).toBe(tree()[abs(SCSS)]);
    expect(fs.files.get(abs(VUE))).toContain('mb-3 me-2');
    expect(report.changed.map((c) => c.path)).toEqual([VUE]);
    expect([...fs.files.keys()].some((k) => k.endsWith('.tmp'))).toBe(false);
    expect(formatReport(report)).toMatch(/Errors:\n.*read failed/s);
  });
});
