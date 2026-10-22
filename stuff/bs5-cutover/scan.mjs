#!/usr/bin/env node
// bs5-cutover residual scan CLI (design 5, Requirement 7). Logic lives in
// scan-core.cjs.
//
//   node stuff/bs5-cutover/scan.mjs                 scan the repo (git ls-files)
//   ... --root <dir>                                scan a directory tree instead
//                                                   (fixtures mirror the repo
//                                                   layout: <dir>/frontend/...)
//   ... --json <file>                               also write the result as JSON
//   ... --allowlist <file>                          override the allowlist path
//                                                   (default <root>/stuff/bs5-cutover/allowlist.json;
//                                                   a missing file is an empty list)
//
// Files scanned:
//   - in-scope files (maps.isInScope) under frontend/ and cypress/: all categories
//   - frontend/templates/**, frontend/www/** (third_party included, Req 2.7),
//     .storybook/**, webpack.config*.js: vendored-bs4-ref only
//
// Allowlist entries that suppress no match are reported as `stale-allowlist`
// matches, so the gate fails until the allowlist is cleaned.
//
// Exit 0 only when there are 0 matches; 1 when there are matches; 2 when a
// root, a listed file, or the allowlist cannot be read (never a pass).
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { rawMatches, applyAllowlist } = require('./scan-core.cjs');
const { isInScope, normalizePath } = require('./maps.cjs');
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const ALLOWLIST_REL = 'stuff/bs5-cutover/allowlist.json';
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist']);

// Synchronous writes: process.exit() would otherwise drop buffered pipe output.
// Loops because a pipe may accept a partial write or report EAGAIN.
function writeAll(fd, s) {
  const buf = Buffer.from(s, 'utf8');
  for (let off = 0; off < buf.length; ) {
    try {
      off += fs.writeSync(fd, buf, off);
    } catch (e) {
      if (e.code !== 'EAGAIN') throw e;
    }
  }
}
const out = (s) => writeAll(1, s);
const err = (s) => writeAll(2, s);

function usage(message) {
  err(
    `${message}\nusage: scan.mjs [--root <dir>] [--json <file>] [--allowlist <file>]\n`,
  );
  process.exit(2);
}

function cannotRead(p) {
  out(`scan: cannot read ${p}\n`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = { root: null, json: null, allowlist: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root' || a === '--json' || a === '--allowlist') {
      const v = argv[++i];
      if (!v) usage(`${a} needs a value`);
      args[a.slice(2)] = v;
    } else usage(`unknown argument: ${a}`);
  }
  return args;
}

// Files outside isInScope that are still scanned for vendored-bs4-ref.
function isVendoredRefTarget(p) {
  return (
    p.startsWith('frontend/templates/') ||
    p.startsWith('frontend/www/') ||
    p.startsWith('.storybook/') ||
    /^webpack\.config[^/]*\.js$/.test(p)
  );
}

const selectFiles = (paths) =>
  [...new Set(paths.filter(Boolean).map(normalizePath))]
    .filter((p) => isInScope(p) || isVendoredRefTarget(p))
    .sort();

function walk(root) {
  const out = [];
  const visit = (rel) => {
    const abs = path.join(root, rel);
    let entries;
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      cannotRead(rel || root);
    }
    for (const e of entries) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) visit(r);
      } else if (e.isFile()) out.push(r);
    }
  };
  visit('');
  return out;
}

function listFiles(args) {
  if (args.root) {
    const root = path.resolve(args.root);
    let st;
    try {
      st = fs.statSync(root);
    } catch {
      cannotRead(args.root);
    }
    if (!st.isDirectory()) cannotRead(args.root);
    return { root, files: selectFiles(walk(root)) };
  }
  for (const dir of ['frontend', 'cypress']) {
    let ok = false;
    try {
      ok = fs.statSync(path.join(REPO_ROOT, dir)).isDirectory();
    } catch {
      // reported below
    }
    if (!ok) cannotRead(`${dir}/`);
  }
  let listed;
  try {
    // `-s` exposes the mode so submodule gitlinks (160000, e.g.
    // frontend/www/karel.js) are skipped: they are directories, not files.
    listed = execFileSync(
      'git',
      [
        'ls-files',
        '-s',
        '-z',
        '--',
        'frontend',
        'cypress',
        '.storybook',
        'webpack.config*.js',
      ],
      { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 << 20 },
    )
      .split('\0')
      .filter((entry) => entry && !entry.startsWith('160000 '))
      .map((entry) => entry.slice(entry.indexOf('\t') + 1));
  } catch (e) {
    out(`scan: cannot read git ls-files: ${e.message.split('\n')[0]}\n`);
    process.exit(2);
  }
  return { root: REPO_ROOT, files: selectFiles(listed) };
}

function loadAllowlist(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    cannotRead(file);
  }
  let list;
  try {
    list = JSON.parse(text);
  } catch {
    cannotRead(file);
  }
  const valid =
    Array.isArray(list) &&
    list.every(
      (e) =>
        e &&
        typeof e.path === 'string' &&
        Number.isInteger(e.line) &&
        typeof e.token === 'string',
    );
  if (!valid) cannotRead(file);
  return list;
}

const args = parseArgs(process.argv.slice(2));
const { root, files } = listFiles(args);
const allowlist = loadAllowlist(
  args.allowlist
    ? path.resolve(args.allowlist)
    : path.join(root, ALLOWLIST_REL),
);

const all = [];
for (const rel of files) {
  let buf;
  try {
    buf = fs.readFileSync(path.join(root, rel));
  } catch {
    cannotRead(rel);
  }
  // Binary assets (images, fonts) cannot hold a textual reference.
  if (!isInScope(rel) && buf.includes(0)) continue;
  all.push(...rawMatches(rel, buf.toString('utf8')));
}

const { matches, used } = applyAllowlist(all, allowlist);
allowlist.forEach((e, i) => {
  if (!used.has(i)) {
    matches.push({
      path: normalizePath(e.path),
      line: e.line,
      token: e.token,
      category: 'stale-allowlist',
    });
  }
});
matches.sort(
  (a, b) =>
    (a.path < b.path ? -1 : a.path > b.path ? 1 : 0) ||
    a.line - b.line ||
    a.category.localeCompare(b.category) ||
    a.token.localeCompare(b.token),
);

const byCategory = {};
for (const m of matches)
  byCategory[m.category] = (byCategory[m.category] || 0) + 1;

const lines = [
  `scan: ${files.length} files scanned, ${matches.length} matches`,
];
for (const m of matches)
  lines.push(`${m.path}:${m.line}  ${m.token}  ${m.category}`);
out(`${lines.join('\n')}\n`);

let code = matches.length === 0 ? 0 : 1;
if (args.json) {
  const out = {
    filesScanned: files.length,
    matchCount: matches.length,
    byCategory,
    matches,
  };
  try {
    fs.writeFileSync(
      path.resolve(args.json),
      `${JSON.stringify(out, null, 2)}\n`,
    );
  } catch (e) {
    err(`scan: cannot write ${args.json}: ${e.message}\n`);
    code = 2;
  }
}
process.exit(code);
