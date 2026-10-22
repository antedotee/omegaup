#!/usr/bin/env node
// Validates the Decision_Trail (.audit/bootstrap5-migration.tsv) for PR3.
//
// Checks (Requirements 14.1, 14.2, 14.3):
//   1. The header row is unchanged.
//   2. The first SYNCED_LINES lines are byte-identical to the synced copy at
//      the sync commit (`git show <base>:.audit/bootstrap5-migration.tsv`).
//   3. Every row appended after the synced lines is a PR3 row: 6 non-empty
//      tab-separated columns, a YYYY-MM-DD ts, and a phase starting with PR3.
//
// The synced lines are compared byte-for-byte and are not parsed, so the
// pre-existing physical lines that hold two concatenated rows are left alone.
//
// Usage: node stuff/bs5-cutover/check-trail.mjs [--base <commit>] [--file <path>]
// Exits 0 on success, 1 on a validation failure (printing the offending line).

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_BASE = '42e1111fd';
const TRAIL_PATH = '.audit/bootstrap5-migration.tsv';
const SYNCED_LINES = 191;
const HEADER = 'ts\tphase\tdecision\twhy\tevidence\tresult';
const COLUMNS = HEADER.split('\t');

function parseArgs(argv) {
  const args = { base: DEFAULT_BASE, file: null };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--base' || flag === '--file') {
      const value = argv[++i];
      if (!value) throw new Error(`${flag} needs a value`);
      args[flag.slice(2)] = value;
    } else {
      throw new Error(`unknown argument: ${flag}`);
    }
  }
  return args;
}

// Splits a buffer into lines that keep their trailing "\n", so a byte
// comparison of the first N lines also covers line endings.
function splitLines(buf) {
  const lines = [];
  let start = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x0a) {
      lines.push(buf.subarray(start, i + 1));
      start = i + 1;
    }
  }
  if (start < buf.length) lines.push(buf.subarray(start));
  return lines;
}

function isValidDate(ts) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ts);
  if (!m) return false;
  const [y, mo, d] = m.slice(1).map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d
  );
}

// Returns an error message for an appended row, or null if it is valid.
function checkPr3Row(text) {
  const cols = text.split('\t');
  if (cols.length !== COLUMNS.length) {
    return `expected ${COLUMNS.length} tab-separated columns, found ${cols.length}`;
  }
  const empty = cols.findIndex((c) => c.trim() === '');
  if (empty !== -1) return `column "${COLUMNS[empty]}" is empty`;
  if (!cols[1].startsWith('PR3')) {
    return `phase "${cols[1]}" does not identify PR3 (rows after line ${SYNCED_LINES} must be PR3 rows)`;
  }
  if (!isValidDate(cols[0])) return `ts "${cols[0]}" is not a YYYY-MM-DD date`;
  return null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  }).trim();
  const file = args.file ?? path.join(repoRoot, TRAIL_PATH);

  const current = readFileSync(file);
  const synced = execFileSync('git', ['show', `${args.base}:${TRAIL_PATH}`], {
    cwd: repoRoot,
    maxBuffer: 64 * 1024 * 1024,
  });

  const curLines = splitLines(current);
  const baseLines = splitLines(synced);
  const errors = [];
  const fail = (lineNo, msg, text) =>
    errors.push(`${file}:${lineNo}: ${msg}\n  > ${text}`);

  // 1. Header.
  const header = (curLines[0] ?? Buffer.alloc(0)).toString('utf8').replace(/\r?\n$/, '');
  if (header !== HEADER) fail(1, 'header changed', header);

  // 2. Synced prefix is byte-identical.
  if (baseLines.length < SYNCED_LINES) {
    errors.push(
      `synced copy at ${args.base} has ${baseLines.length} lines, expected at least ${SYNCED_LINES}`,
    );
  }
  for (let i = 0; i < Math.min(SYNCED_LINES, baseLines.length); i++) {
    const cur = curLines[i];
    if (!cur) {
      fail(i + 1, `missing line; synced copy has ${SYNCED_LINES} lines`, '');
      break;
    }
    if (!cur.equals(baseLines[i])) {
      fail(
        i + 1,
        `differs from ${args.base}:${TRAIL_PATH}`,
        cur.toString('utf8').replace(/\r?\n$/, ''),
      );
    }
  }

  // 3. Appended rows are well-formed PR3 rows.
  for (let i = SYNCED_LINES; i < curLines.length; i++) {
    const raw = curLines[i].toString('utf8');
    if (!raw.endsWith('\n')) {
      fail(i + 1, 'missing trailing newline', raw);
    }
    const text = raw.replace(/\r?\n$/, '');
    if (text.includes('\r')) {
      fail(i + 1, 'contains a carriage return', text);
      continue;
    }
    const err = checkPr3Row(text);
    if (err) fail(i + 1, err, text);
  }

  if (errors.length) {
    console.error(`Decision_Trail check failed (${errors.length} problem(s)):`);
    for (const e of errors) console.error(e);
    process.exit(1);
  }
  const appended = Math.max(0, curLines.length - SYNCED_LINES);
  console.log(
    `Decision_Trail OK: header unchanged, ${SYNCED_LINES} synced lines match ${args.base}, ${appended} PR3 row(s) valid.`,
  );
}

try {
  main();
} catch (e) {
  console.error(`check-trail: ${e.message}`);
  process.exit(2);
}
