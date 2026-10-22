#!/usr/bin/env node
// Style_Build failure check (Requirement 1.10).
//
// Appends a temporary SCSS syntax error to a Sass partial, runs the style
// build, and asserts that:
//   1. the build exits non-zero,
//   2. the output names the broken partial with a line number,
//   3. css/dist/omegaup_styles.css is unchanged (mtime and SHA-256).
// The partial is always restored, including on crash, SIGINT, and SIGTERM.
//
// Usage: node stuff/bs5-cutover/style-build-failure-check.mjs
// Run the style build first so omegaup_styles.css exists.
// Exits 0 when the failure behavior is correct, 1 otherwise.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../..',
);
const PARTIAL_REL = 'frontend/www/sass/components/_datepicker.scss';
const PARTIAL = path.join(ROOT, PARTIAL_REL);
const CSS = path.join(ROOT, 'frontend/www/css/dist/omegaup_styles.css');
const BROKEN_LINE = '.bs5-failure-check { color: red; // missing closing brace';

let original = null;
let child = null;

function restore() {
  if (original === null) return;
  writeFileSync(PARTIAL, original);
  original = null;
}

function snapshot() {
  const content = readFileSync(CSS);
  return {
    mtimeMs: statSync(CSS).mtimeMs,
    sha256: createHash('sha256').update(content).digest('hex'),
  };
}

function runStyleBuild() {
  return new Promise((resolve, reject) => {
    child = spawn(
      'yarn',
      [
        '-s',
        'cross-env',
        'webpack',
        '--config-name=style',
        '--mode=production',
      ],
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    child.on('error', reject);
    child.on('close', (code, signal) => {
      child = null;
      resolve({ code, signal, output });
    });
  });
}

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    if (child) child.kill(sig);
    restore();
    process.exit(130);
  });
}
process.on('exit', restore);

async function main() {
  if (!existsSync(CSS)) {
    console.error(
      `FAIL: ${path.relative(
        ROOT,
        CSS,
      )} is missing; run the style build first.`,
    );
    return 1;
  }
  const before = snapshot();
  const failures = [];

  original = readFileSync(PARTIAL);
  let result;
  try {
    const lines = original.toString('utf8').replace(/\n?$/, '\n');
    const brokenLineNo = lines.split('\n').length; // 1-based line of BROKEN_LINE
    writeFileSync(PARTIAL, `${lines}${BROKEN_LINE}\n`);
    console.log(
      `Injected syntax error at ${PARTIAL_REL}:${brokenLineNo}; running style build...`,
    );
    result = await runStyleBuild();
  } finally {
    restore();
  }

  const restoredOk = readFileSync(PARTIAL, 'utf8').indexOf(BROKEN_LINE) === -1;
  if (!restoredOk) failures.push(`${PARTIAL_REL} was not restored`);

  if (result.code === 0) {
    failures.push('style build exited 0 with a Sass syntax error');
  }
  // Sass reports "<path>/_datepicker.scss <line>:<col>" or "_datepicker.scss:<line>".
  const fileLine = /_datepicker\.scss(?::|\s+)(\d+)(?::\d+)?/;
  const match = result.output.match(fileLine);
  if (!match) {
    failures.push(
      'build output does not name _datepicker.scss with a line number',
    );
  }

  const after = snapshot();
  if (after.mtimeMs !== before.mtimeMs) {
    failures.push(
      `omegaup_styles.css mtime changed (${before.mtimeMs} -> ${after.mtimeMs})`,
    );
  }
  if (after.sha256 !== before.sha256) {
    failures.push('omegaup_styles.css content changed');
  }

  if (failures.length) {
    console.error(result.output);
    for (const f of failures) console.error(`FAIL: ${f}`);
    return 1;
  }
  console.log(
    `PASS: exit ${result.code}; error reported at ${match[0]}; omegaup_styles.css unchanged.`,
  );
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    restore();
    console.error(err);
    process.exitCode = 1;
  },
);
