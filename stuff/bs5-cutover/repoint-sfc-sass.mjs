#!/usr/bin/env node
// Repoints SFC <style> imports from sass/main.scss to sass/site (the
// variables/mixins-only partial), so each component stops re-emitting the
// whole site stylesheet. Edits only the matching @import line; every other
// byte of the file is left untouched. Idempotent: a second run changes 0.
//
// Usage: node stuff/bs5-cutover/repoint-sfc-sass.mjs  (from repo root)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

// Matches a whole @import line whose path ends in .../sass/main(.scss).
// Group 1: everything up to and including "sass/"; group 2: the quote.
const IMPORT_LINE =
  /^(\s*@import\s+(['"])(?:\.\.\/)+sass\/)main(?:\.scss)?(\2\s*;\s*)$/;

const files = execFileSync('git', ['ls-files', '-z', '--', '*.vue'], {
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean);

let changed = 0;
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  if (!src.includes('sass/main')) continue;
  // Split on \n only; \r (if any) stays in the line and is matched by \s*.
  const lines = src.split('\n');
  let edits = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = IMPORT_LINE.exec(lines[i]);
    if (!m) continue;
    lines[i] = lines[i].replace(IMPORT_LINE, '$1site$3');
    edits++;
  }
  if (edits === 0) continue;
  writeFileSync(file, lines.join('\n'));
  changed++;
}

console.log(`repoint-sfc-sass: ${changed} file(s) changed`);
