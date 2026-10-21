#!/usr/bin/env node
// Smoke checks for the PR3 Bootstrap 5 cutover.
//
// Sections:
//   deps  package.json dependency state and module-specifier references
//         (Requirements 1.1, 3.6, 8.1, 8.2, 8.3, 8.4).
// Later tasks add more sections to SECTIONS below.
//
// Usage: node stuff/bs5-cutover/smoke.mjs [--section <name>]...
// With no --section, every section runs. Exits 0 when all checks pass and 1
// when any check fails (each failure is printed with a reason).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const PR2_TIP = 'eb27ddf48';
const DEP_SECTIONS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
  'resolutions',
];
const REMOVED_PACKAGES = ['bootstrap-vue', 'popper.js'];
const UNCHANGED_PACKAGES = ['jquery', 'bootstrap-vue-next'];
const SOURCE_EXT = /\.(vue|ts|tsx|js|jsx|mjs|cjs)$/;
// Excluded_Paths: any node_modules or dist segment, plus these prefixes.
const EXCLUDED_PREFIXES = [
  'frontend/www/third_party/',
  'frontend/www/karel.js/',
  'frontend/www/rekarel/',
  'frontend/www/libinteractive/',
  'frontend/www/docs/libinteractive/',
];
const SELF = 'stuff/bs5-cutover/smoke.mjs';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

function isExcluded(file) {
  if (file.split('/').some((seg) => seg === 'node_modules' || seg === 'dist')) {
    return true;
  }
  return EXCLUDED_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function readJson(relPath) {
  return JSON.parse(readFileSync(path.join(root, relPath), 'utf8'));
}

function findSpecifier(pkg, name) {
  for (const section of DEP_SECTIONS) {
    if (pkg[section] && Object.hasOwn(pkg[section], name)) {
      return { section, specifier: pkg[section][name] };
    }
  }
  return null;
}

// A quoted string literal whose value is the module specifier or a subpath of
// it. `bootstrap-vue-next` and `@popperjs/core` do not match.
const SPECIFIER_RE = /(['"`])(bootstrap-vue|popper\.js)(\/[^'"`\s]*)?\1/g;

// Blanks out `/* */` and `//` comments, keeping line breaks so line numbers
// stay correct. Comments that mention a package are not module references.
// `//` preceded by `:` (URLs) is kept.
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1');
}

function depsSection(fail) {
  const pkg = readJson('package.json');
  const base = JSON.parse(
    execFileSync('git', ['show', `${PR2_TIP}:package.json`], {
      cwd: root,
      encoding: 'utf8',
    }),
  );

  const bootstrap = findSpecifier(pkg, 'bootstrap');
  if (!bootstrap || !/^5\.3\.\d+$/.test(bootstrap.specifier)) {
    fail(
      `package.json bootstrap must match /^5\\.3\\.\\d+$/, got ${
        bootstrap ? JSON.stringify(bootstrap.specifier) : 'missing'
      }`,
    );
  }

  for (const name of REMOVED_PACKAGES) {
    for (const section of DEP_SECTIONS) {
      if (pkg[section] && Object.hasOwn(pkg[section], name)) {
        fail(`package.json ${section} still lists ${name}`);
      }
    }
  }

  if (!findSpecifier(pkg, '@popperjs/core')) {
    fail('package.json does not declare @popperjs/core');
  }
  try {
    const popper = readJson('node_modules/@popperjs/core/package.json');
    if (!/^2\.\d+\.\d+$/.test(popper.version)) {
      fail(`@popperjs/core resolves to ${popper.version}, expected 2.x`);
    }
  } catch (err) {
    fail(`@popperjs/core is not installed: ${err.message}`);
  }

  for (const name of UNCHANGED_PACKAGES) {
    const now = findSpecifier(pkg, name);
    const then = findSpecifier(base, name);
    if (JSON.stringify(now) !== JSON.stringify(then)) {
      fail(
        `package.json ${name} is ${JSON.stringify(now)}, ` +
          `expected ${JSON.stringify(then)} as at ${PR2_TIP}`,
      );
    }
  }

  const files = execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\0')
    .filter((f) => f && SOURCE_EXT.test(f) && f !== SELF && !isExcluded(f));
  for (const file of files) {
    let text;
    try {
      text = readFileSync(path.join(root, file), 'utf8');
    } catch {
      continue; // deleted in the working tree
    }
    stripComments(text).split('\n').forEach((line, i) => {
      for (const m of line.matchAll(SPECIFIER_RE)) {
        fail(`${file}:${i + 1} references module ${m[2]}${m[3] ?? ''}`);
      }
    });
  }
  return `scanned ${files.length} source files`;
}

const SECTIONS = { deps: depsSection };

function parseArgs(argv) {
  const sections = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--section') {
      const value = argv[++i];
      if (!value) throw new Error('--section needs a value');
      if (!Object.hasOwn(SECTIONS, value)) {
        throw new Error(
          `unknown section: ${value} (known: ${Object.keys(SECTIONS).join(', ')})`,
        );
      }
      sections.push(value);
    } else {
      throw new Error(`unknown argument: ${argv[i]}`);
    }
  }
  return sections.length ? sections : Object.keys(SECTIONS);
}

function main() {
  let sections;
  try {
    sections = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`smoke: ${err.message}`);
    process.exit(2);
  }
  let failures = 0;
  for (const name of sections) {
    const errors = [];
    const note = SECTIONS[name]((msg) => errors.push(msg));
    if (errors.length) {
      failures += errors.length;
      console.error(`FAIL ${name}`);
      for (const msg of errors) console.error(`  - ${msg}`);
    } else {
      console.log(`ok   ${name}${note ? ` (${note})` : ''}`);
    }
  }
  if (failures) {
    console.error(`smoke: ${failures} failure(s)`);
    process.exit(1);
  }
}

main();
