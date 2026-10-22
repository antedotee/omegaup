#!/usr/bin/env node
// Smoke checks for the PR3 Bootstrap 5 cutover.
//
// Sections:
//   deps  package.json dependency state and module-specifier references
//         (Requirements 1.1, 3.6, 8.1, 8.2, 8.3, 8.4).
//   css   main.scss Bootstrap import and overrides, plus the built
//         css/dist/omegaup_styles.css (Requirements 1.2-1.5, 1.7-1.9).
//         Run the style build first.
//   scope picker files, libinteractive pages, submodules, panel-* and
//         Font Awesome counts versus the PR2 tip (Requirements 10.1,
//         10.3, 10.4, 10.5, 10.6, 10.10).
//
// Usage: node stuff/bs5-cutover/smoke.mjs [--section <name>]...
// With no --section, every section runs. Exits 0 when all checks pass and 1
// when any check fails (each failure is printed with a reason).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
const UNCHANGED_PACKAGES = [
  'jquery',
  'bootstrap-vue-next',
  'vue-typeahead-bootstrap',
];
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
    stripComments(text)
      .split('\n')
      .forEach((line, i) => {
        for (const m of line.matchAll(SPECIFIER_RE)) {
          fail(`${file}:${i + 1} references module ${m[2]}${m[3] ?? ''}`);
        }
      });
  }
  return `scanned ${files.length} source files`;
}

const MAIN_SCSS = 'frontend/www/sass/main.scss';
const SASS_DIR = 'frontend/www/sass';
const STYLES_CSS = 'frontend/www/css/dist/omegaup_styles.css';
// An @import/@use/@forward of Bootstrap's SCSS sources (any subpath, with or
// without the webpack `~` prefix).
const BOOTSTRAP_SCSS_RE =
  /@(?:import|use|forward)\s+(['"])[^'"]*bootstrap\/scss(?:\/[^'"]*)?\1/;
const SCSS_VAR_RE = /^\s*\$[\w-]+\s*:/;
const BS5_SELECTORS = [
  '.visually-hidden',
  '.form-select',
  '.offcanvas',
  '.ms-1',
];
const BS4_SELECTORS = ['.sr-only', '.custom-select', '.ml-1', '.form-row'];
// Stable omegaUp rule from frontend/www/sass/components/_buttons.scss.
const SITE_SELECTOR = '.btn-cancel';
const WHITE_TEXT_BUTTONS = ['.btn-success', '.btn-info'];
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(path.join(root, dir), {
    withFileTypes: true,
  })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(rel));
    else out.push(rel);
  }
  return out;
}
function bootstrapImports(text) {
  const lines = [];
  stripComments(text)
    .split('\n')
    .forEach((line, i) => {
      if (BOOTSTRAP_SCSS_RE.test(line)) lines.push(i + 1);
    });
  return lines;
}
// Matches a class selector exactly: `.ml-1` but not `.ml-10` or `.ml-1x`.
function classRe(selector) {
  return new RegExp(`${selector.replace(/[.\\-]/g, '\\$&')}(?![\\w-])`);
}
// Innermost CSS rules as { selectors, body }. At-rule preludes (@media) are
// skipped because their bodies contain braces.
function cssRules(css) {
  const rules = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    rules.push({
      selectors: m[1].split(',').map((s) => s.trim()),
      body: m[2],
    });
  }
  return rules;
}
function cssSection(fail) {
  // main.scss: one Bootstrap import, every override above it, each annotated.
  const mainText = readFileSync(path.join(root, MAIN_SCSS), 'utf8');
  const imports = bootstrapImports(mainText);
  if (imports.length !== 1) {
    fail(
      `${MAIN_SCSS} must import bootstrap/scss exactly once, found ${imports.length}` +
        (imports.length ? ` (lines ${imports.join(', ')})` : ''),
    );
  }
  const importLine = imports[0] ?? Infinity;
  const strippedMain = stripComments(mainText).split('\n');
  let overrides = 0;
  mainText.split('\n').forEach((line, i) => {
    if (!SCSS_VAR_RE.test(strippedMain[i])) return;
    overrides++;
    if (i + 1 > importLine) {
      fail(`${MAIN_SCSS}:${i + 1} sets a variable after the Bootstrap import`);
    }
    if (!line.includes('// BS5 default:')) {
      fail(`${MAIN_SCSS}:${i + 1} override lacks a "// BS5 default:" comment`);
    }
  });
  if (!overrides) fail(`${MAIN_SCSS} has no variable overrides`);

  // No other Style_Build SCSS file or SFC style block imports Bootstrap SCSS.
  const scssFiles = walk(SASS_DIR).filter(
    (f) => /\.s[ac]ss$/.test(f) && f !== MAIN_SCSS,
  );
  for (const file of scssFiles) {
    for (const line of bootstrapImports(
      readFileSync(path.join(root, file), 'utf8'),
    )) {
      fail(`${file}:${line} imports bootstrap/scss (only ${MAIN_SCSS} may)`);
    }
  }
  const vueFiles = execFileSync('git', ['ls-files', '-z', '--', '*.vue'], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\0')
    .filter((f) => f && !isExcluded(f));
  for (const file of vueFiles) {
    let text;
    try {
      text = readFileSync(path.join(root, file), 'utf8');
    } catch {
      continue;
    }
    for (const m of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) {
      const offset = text.slice(0, m.index).split('\n').length - 1;
      for (const line of bootstrapImports(m[1])) {
        fail(`${file}:${offset + line} style block imports bootstrap/scss`);
      }
    }
  }

  // Built CSS.
  if (!existsSync(path.join(root, STYLES_CSS))) {
    fail(
      `${STYLES_CSS} is missing; run the style build first: ` +
        'yarn -s cross-env webpack --config-name=style --mode=production',
    );
    return null;
  }
  const rules = cssRules(readFileSync(path.join(root, STYLES_CSS), 'utf8'));
  const hasSelector = (sel) => {
    const re = classRe(sel);
    return rules.some((r) => r.selectors.some((s) => re.test(s)));
  };
  for (const sel of [...BS5_SELECTORS, SITE_SELECTOR]) {
    if (!hasSelector(sel)) fail(`${STYLES_CSS} lacks selector ${sel}`);
  }
  for (const sel of BS4_SELECTORS) {
    if (hasSelector(sel)) fail(`${STYLES_CSS} contains BS4 selector ${sel}`);
  }
  const fluid = rules.filter((r) =>
    /(?:^|;)\s*font-size\s*:\s*calc\([^;]*vw/.test(r.body),
  );
  for (const r of fluid) {
    fail(`${STYLES_CSS} ${r.selectors.join(',')} has a calc(…vw) font-size`);
  }
  const ownRules = (sel) => rules.filter((r) => r.selectors.includes(sel));
  if (
    !ownRules('.row').some((r) => /--bs-gutter-x\s*:\s*30px\b/.test(r.body))
  ) {
    fail(`${STYLES_CSS} .row does not set --bs-gutter-x: 30px`);
  }
  for (const sel of WHITE_TEXT_BUTTONS) {
    if (
      !ownRules(sel).some((r) =>
        /--bs-btn-color\s*:\s*(?:#fff|#ffffff|white)\s*(?:;|$)/i.test(r.body),
      )
    ) {
      fail(`${STYLES_CSS} ${sel} does not set --bs-btn-color: #fff`);
    }
  }
  return `${overrides} overrides, ${scssFiles.length} sass partials, ${vueFiles.length} SFCs, ${rules.length} CSS rules`;
}

const FROZEN_PATHS = [
  'frontend/www/third_party/js/bootstrap-date*',
  'frontend/www/third_party/js/locales',
  'frontend/www/third_party/css/bootstrap-date*',
  'frontend/www/libinteractive',
  'frontend/www/docs/libinteractive',
  ':!frontend/www/libinteractive/gen/index.php',
];
const TYPEAHEAD_PATHS = [
  'frontend/www/js/omegaup/components/common/Typeahead.vue',
  'frontend/www/js/omegaup/components/common/MultiTypeahead.vue',
];
// A preceding word character means this is a longer identifier, not a panel-* class.
const PANEL_RE = '(^|[^A-Za-z0-9_-])panel-[A-Za-z0-9_-]+';
const FONT_AWESOME_RE =
  '@fortawesome/|font-awesome-icon|fontawesome|font-awesome|fa-[a-z0-9-]+|(^|[^A-Za-z0-9_-])fa([^A-Za-z0-9_-]|$)';
// Fixtures and the decision trail name these tokens on purpose.
const COUNT_EXCLUDES = [':(exclude)stuff/bs5-cutover', ':(exclude).audit'];

function runGit(args) {
  try {
    return {
      status: 0,
      stdout: execFileSync('git', args, { cwd: root, encoding: 'utf8' }),
    };
  } catch (err) {
    return {
      status: err.status ?? 1,
      stdout: typeof err.stdout === 'string' ? err.stdout : '',
      stderr: typeof err.stderr === 'string' ? err.stderr : '',
    };
  }
}

function occurrenceCount(pattern, rev, fail) {
  const args = ['grep', '-o', '-E', '-I', pattern];
  if (rev) args.push(rev);
  args.push('--', '.', ...COUNT_EXCLUDES);
  const result = runGit(args);
  if (result.status !== 0 && result.status !== 1) {
    fail(`git grep exited ${result.status}: ${result.stderr.trim()}`);
    return null;
  }
  return result.stdout.split('\n').filter((line) => line).length;
}

function scopeSection(fail) {
  const diff = runGit([
    'diff',
    '--exit-code',
    '--name-only',
    PR2_TIP,
    '--',
    ...FROZEN_PATHS,
  ]);
  if (diff.status !== 0) {
    const names = diff.stdout.trim();
    fail(
      names
        ? `paths differ from ${PR2_TIP}: ${names.split('\n').join(', ')}`
        : `git diff --exit-code ${PR2_TIP} exited ${diff.status}`,
    );
  }

  // Every SFC style block was repointed off main.scss. These two files have
  // that @import line and no other diff.
  const typeahead = runGit([
    'diff',
    '--exit-code',
    '-I',
    '@import',
    PR2_TIP,
    '--',
    ...TYPEAHEAD_PATHS,
  ]);
  if (typeahead.status !== 0) {
    const names = runGit([
      'diff',
      '--name-only',
      PR2_TIP,
      '--',
      ...TYPEAHEAD_PATHS,
    ]);
    fail(
      `typeahead differs from ${PR2_TIP} beyond the SFC @import repoint: ${names.stdout.trim()}`,
    );
  }

  const expected = new Map();
  const tree = runGit(['ls-tree', '-r', PR2_TIP]);
  if (tree.status !== 0) {
    fail(`git ls-tree ${PR2_TIP} exited ${tree.status}`);
  } else {
    for (const line of tree.stdout.split('\n')) {
      const recorded = line.match(/^160000 commit ([0-9a-f]{40})\t(.+)$/);
      if (recorded) expected.set(recorded[2], recorded[1]);
    }
  }
  const status = runGit(['submodule', 'status']);
  if (status.status !== 0) {
    fail(`git submodule status exited ${status.status}`);
  } else {
    const seen = new Set();
    for (const line of status.stdout.split('\n')) {
      if (!line) continue;
      const recorded = line.match(/^([ +-])([0-9a-f]{40}) ([^ ]+)/);
      if (!recorded) {
        fail(`unparsed submodule status line: ${line}`);
        continue;
      }
      const [, flag, sha, submodulePath] = recorded;
      seen.add(submodulePath);
      const want = expected.get(submodulePath);
      if (!want) {
        fail(`submodule ${submodulePath} is not at ${PR2_TIP}`);
        continue;
      }
      if (sha !== want || flag !== ' ') {
        fail(
          `submodule ${submodulePath} is ${flag}${sha}, expected ${want} at ${PR2_TIP}`,
        );
      }
    }
    for (const submodulePath of expected.keys()) {
      if (!seen.has(submodulePath)) {
        fail(`submodule ${submodulePath} missing from git submodule status`);
      }
    }
  }

  const panelThen = occurrenceCount(PANEL_RE, PR2_TIP, fail);
  const panelNow = occurrenceCount(PANEL_RE, null, fail);
  if (panelThen !== null && panelNow !== null && panelThen !== panelNow) {
    fail(`panel-* count is ${panelNow}, expected ${panelThen} at ${PR2_TIP}`);
  }
  const faThen = occurrenceCount(FONT_AWESOME_RE, PR2_TIP, fail);
  const faNow = occurrenceCount(FONT_AWESOME_RE, null, fail);
  if (faThen !== null && faNow !== null && faThen !== faNow) {
    fail(`Font Awesome count is ${faNow}, expected ${faThen} at ${PR2_TIP}`);
  }
  if (panelNow === null || faNow === null) return null;
  return `panel-* ${panelNow}, Font Awesome ${faNow}, ${expected.size} submodules`;
}

const SECTIONS = { deps: depsSection, css: cssSection, scope: scopeSection };

function parseArgs(argv) {
  const sections = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--section') {
      const value = argv[++i];
      if (!value) throw new Error('--section needs a value');
      if (!Object.hasOwn(SECTIONS, value)) {
        throw new Error(
          `unknown section: ${value} (known: ${Object.keys(SECTIONS).join(
            ', ',
          )})`,
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
