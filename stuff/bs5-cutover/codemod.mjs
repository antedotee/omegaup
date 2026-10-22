#!/usr/bin/env node
// bs5-cutover codemod CLI (design 3.4, 3.5). Logic lives in codemod-core.cjs.
//
//   node stuff/bs5-cutover/codemod.mjs              rewrite in place, print report
//   node stuff/bs5-cutover/codemod.mjs --check      dry run; exit 1 if any file would change
//   ... --report <file.json>                        also write the report as JSON
//   ... --path <file> [--path <file> ...]           only these repo-relative files
//
// Exit 0 when there are no read, write, or parse errors (and, with --check,
// nothing would change); otherwise 1. Usage errors exit 2.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { formatReport, runCodemod, selectFiles } = require('./codemod-core.cjs');
const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

function usage(message) {
  process.stderr.write(
    `${message}\nusage: codemod.mjs [--check] [--report <file.json>] [--path <file>]...\n`,
  );
  process.exit(2);
}

function parseArgs(argv) {
  const args = { check: false, report: null, paths: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') args.check = true;
    else if (a === '--report' || a === '--path') {
      const v = argv[++i];
      if (!v) usage(`${a} needs a value`);
      if (a === '--report') args.report = v;
      else args.paths.push(v);
    } else usage(`unknown argument: ${a}`);
  }
  return args;
}

const git = (...a) =>
  execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });

const args = parseArgs(process.argv.slice(2));
let files;
const outOfScope = [];
if (args.paths.length) {
  const given = args.paths.map((p) =>
    path
      .relative(ROOT, path.resolve(process.cwd(), p))
      .split(path.sep)
      .join('/'),
  );
  files = selectFiles(given);
  outOfScope.push(...given.filter((p) => !files.includes(p)));
} else {
  files = selectFiles(
    git('ls-files', '-z', '--', 'frontend', 'cypress').split('\0'),
  );
}
let headSha = null;
try {
  headSha = git('rev-parse', 'HEAD').trim();
} catch {
  // not fatal: the manifest records null
}

const { report, exitCode } = runCodemod({
  root: ROOT,
  files,
  check: args.check,
  headSha,
});
for (const p of outOfScope) {
  report.errors.push({
    path: p,
    message: 'not in scope (extension or Excluded_Paths)',
  });
}
let code = outOfScope.length ? 1 : exitCode;
process.stdout.write(formatReport(report));
if (args.report) {
  try {
    fs.writeFileSync(
      path.resolve(args.report),
      `${JSON.stringify(report, null, 2)}\n`,
    );
  } catch (e) {
    process.stderr.write(`cannot write report ${args.report}: ${e.message}\n`);
    code = 1;
  }
}
process.exit(code);
