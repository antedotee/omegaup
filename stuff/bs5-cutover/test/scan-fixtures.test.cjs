// Fixture tests for the scan CLI (task 9.3, Requirements 7.5, 7.6).
//
// Spawns `node stuff/bs5-cutover/scan.mjs --root <fixture> --json <tmp>` on
// the trees under fixtures/scan/ (they mirror the repo layout) and checks the
// exit code, the stdout summary and the JSON report.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { isInScope } = require('../maps.cjs');

const REPO = path.resolve(__dirname, '../../..');
const SCAN = path.join(REPO, 'stuff/bs5-cutover/scan.mjs');
const FIXTURES = path.join(REPO, 'stuff/bs5-cutover/fixtures/scan');

let tmp;
beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bs5-scan-fixtures-'));
});
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function runScan(args, jsonName) {
  const json = jsonName ? path.join(tmp, jsonName) : null;
  const r = spawnSync(
    process.execPath,
    [SCAN, ...args, ...(json ? ['--json', json] : [])],
    {
      cwd: REPO,
      encoding: 'utf8',
      timeout: 120000,
    },
  );
  const report =
    json && fs.existsSync(json)
      ? JSON.parse(fs.readFileSync(json, 'utf8'))
      : null;
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, report };
}

function listFiles(root, rel = '') {
  return fs
    .readdirSync(path.join(root, rel), { withFileTypes: true })
    .flatMap((e) => {
      const r = rel ? `${rel}/${e.name}` : e.name;
      return e.isDirectory() ? listFiles(root, r) : [r];
    });
}

describe('scan.mjs on fixtures/scan/all-categories', () => {
  test('reports exactly one match per category with path and line, exit 1', () => {
    const { status, stdout, report } = runScan(
      ['--root', path.join(FIXTURES, 'all-categories')],
      'all.json',
    );
    expect(status).toBe(1);
    expect(stdout).toMatch(/^scan: 5 files scanned, 5 matches\n/);
    expect(report.matchCount).toBe(5);
    expect(report.matches).toEqual([
      {
        path: 'cypress/e2e/sample.cy.ts',
        line: 3,
        token: 'data-toggle',
        category: 'bs4-data-attribute',
      },
      {
        path: 'frontend/templates/head.tpl',
        line: 1,
        token: 'bootstrap-4.5.0',
        category: 'vendored-bs4-ref',
      },
      {
        path: 'frontend/www/js/omegaup/components/Sample.vue',
        line: 3,
        token: 'ml-2',
        category: 'bs4-class',
      },
      {
        path: 'frontend/www/js/omegaup/sample.ts',
        line: 1,
        token: 'bootstrap/dist/css/bootstrap.css',
        category: 'component-bs-import',
      },
      {
        path: 'frontend/www/js/omegaup/sample.ts',
        line: 4,
        token: 'modal',
        category: 'jquery-bs-plugin-call',
      },
    ]);
    expect(report.byCategory).toEqual({
      'bs4-class': 1,
      'bs4-data-attribute': 1,
      'component-bs-import': 1,
      'jquery-bs-plugin-call': 1,
      'vendored-bs4-ref': 1,
    });
  });
});

describe('scan.mjs on fixtures/scan/decoys-only', () => {
  test('decoys (badge-layer, border-left:, closeModal, panel-heading, data-toggle-layout-sidebar) give 0 matches, exit 0', () => {
    const root = path.join(FIXTURES, 'decoys-only');
    const text = listFiles(root)
      .map((f) => fs.readFileSync(path.join(root, f), 'utf8'))
      .join('\n');
    for (const decoy of [
      'badge-layer',
      'border-left:',
      'closeModal',
      'panel-heading',
      'data-toggle-layout-sidebar',
    ]) {
      expect(text).toContain(decoy);
    }
    const { status, stdout, report } = runScan(['--root', root], 'decoys.json');
    expect(status).toBe(0);
    expect(stdout).toBe('scan: 4 files scanned, 0 matches\n');
    expect(report).toEqual({
      filesScanned: 4,
      matchCount: 0,
      byCategory: {},
      matches: [],
    });
  });
});

describe('scan.mjs with a missing root', () => {
  test('exits 2 and never reports a pass', () => {
    const missing = path.join(tmp, 'does-not-exist');
    const { status, stdout, stderr, report } = runScan(
      ['--root', missing],
      'missing.json',
    );
    expect(status).toBe(2);
    expect(stdout).toContain(`cannot read ${missing}`);
    expect(stdout + stderr).not.toMatch(/0 matches/);
    expect(report).toBeNull();
  });
});

describe('real-tree scan', () => {
  test('fixture files are excluded paths', () => {
    for (const f of listFiles(FIXTURES)) {
      expect(isInScope(`stuff/bs5-cutover/fixtures/scan/${f}`)).toBe(false);
    }
  });
  test('does not report any fixtures/scan path', () => {
    const { status, report } = runScan([], 'real.json');
    expect([0, 1]).toContain(status);
    expect(
      report.matches.filter((m) => m.path.includes('fixtures/scan')),
    ).toEqual([]);
    expect(report.matches.filter((m) => m.path.startsWith('stuff/'))).toEqual(
      [],
    );
  });
});
