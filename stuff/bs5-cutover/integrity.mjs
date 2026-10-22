#!/usr/bin/env node
// bs5-cutover integrity check CLI (design 4, Requirement 6). Logic lives in
// integrity-core.cjs.
//
//   node stuff/bs5-cutover/integrity.mjs                 last codemod run: .last-run snapshot vs working tree
//   node stuff/bs5-cutover/integrity.mjs --commit <sha>  every .vue changed in <sha>: <sha>^ vs <sha>
//
// Prints `integrity: N .vue files checked, F failing` and every failure.
// Exit 0 when F = 0, 1 when F > 0, 2 when the snapshot or the SHA is missing
// (or on a usage error). A missing input is never a pass.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { checkAll, formatResult, exitCodeFor } = require('./integrity-core.cjs');
const { LAST_RUN_DIR } = require('./codemod-core.cjs');

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

function die(message) {
  process.stderr.write(`integrity: ${message}\n`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = { commit: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--commit') {
      const v = argv[++i];
      if (!v)
        die('--commit needs a value\nusage: integrity.mjs [--commit <sha>]');
      args.commit = v;
    } else {
      die(`unknown argument: ${a}\nusage: integrity.mjs [--commit <sha>]`);
    }
  }
  return args;
}

const git = (...a) =>
  execFileSync('git', a, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 256 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

const gitError = (e) =>
  (e.stderr && String(e.stderr).trim()) || 'unknown revision';

function lastRunPairs() {
  const manifestPath = path.join(ROOT, LAST_RUN_DIR, 'manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    die('no codemod run snapshot; run codemod or use --commit');
  }
  if (!manifest || !Array.isArray(manifest.files)) {
    die(`invalid snapshot manifest ${path.relative(ROOT, manifestPath)}`);
  }
  return manifest.files
    .filter((p) => p.endsWith('.vue'))
    .map((p) => {
      try {
        const original = fs.readFileSync(
          path.join(ROOT, LAST_RUN_DIR, 'originals', p),
          'utf8',
        );
        try {
          return {
            path: p,
            original,
            changed: fs.readFileSync(path.join(ROOT, p), 'utf8'),
          };
        } catch (e) {
          return {
            path: p,
            error: `changed file cannot be read: ${e.message}`,
          };
        }
      } catch (e) {
        return {
          path: p,
          error: `snapshot original cannot be read: ${e.message}`,
        };
      }
    });
}

function commitPairs(sha) {
  let resolved;
  try {
    resolved = git(
      'rev-parse',
      '--verify',
      '--quiet',
      `${sha}^{commit}`,
    ).trim();
    git('rev-parse', '--verify', '--quiet', `${resolved}^`);
  } catch (e) {
    die(
      `commit ${sha} not found or has no parent: ${
        gitError(e) || 'unknown revision'
      }`,
    );
  }
  const status = git(
    'diff',
    '--name-status',
    '--no-renames',
    '-z',
    `${resolved}^`,
    resolved,
  )
    .split('\0')
    .filter((s) => s !== '');
  const pairs = [];
  for (let i = 0; i + 1 < status.length; i += 2) {
    const [st, p] = [status[i], status[i + 1]];
    if (!p.endsWith('.vue')) continue;
    if (st === 'A') pairs.push({ path: p, error: 'file added in the commit' });
    else if (st === 'D')
      pairs.push({ path: p, error: 'file deleted in the commit' });
    else {
      try {
        pairs.push({
          path: p,
          original: git('show', `${resolved}^:${p}`),
          changed: git('show', `${resolved}:${p}`),
        });
      } catch (e) {
        pairs.push({ path: p, error: `git show failed: ${gitError(e)}` });
      }
    }
  }
  return pairs;
}

const args = parseArgs(process.argv.slice(2));
const pairs = args.commit ? commitPairs(args.commit) : lastRunPairs();
const result = checkAll(pairs);
process.stdout.write(formatResult(result));
process.exit(exitCodeFor(result));
