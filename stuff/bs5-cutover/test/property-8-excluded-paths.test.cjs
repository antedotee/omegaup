// Property 8: Excluded paths are never in scope (design, Correctness
// Properties).
//
// For any path under `node_modules`, `dist` (as a segment anywhere),
// `frontend/www/third_party/`, `frontend/www/karel.js/`,
// `frontend/www/rekarel/`, `frontend/www/preguntas/`,
// `frontend/www/libinteractive/`, `frontend/www/docs/libinteractive/`, or
// `stuff/bs5-cutover/`, isInScope is false, selectFiles drops it, and the
// codemod pipeline (selectFiles -> runCodemod, as in codemod.mjs) never reads,
// writes, or renames it. For any path under `frontend/` or `cypress/` outside
// those, with an in-scope extension, isInScope is true.
//
// gen/index.php (design 3.5): `frontend/www/libinteractive/gen/index.php` is
// the one exception to the Excluded_Paths, so isExcluded is false for it, but
// `.php` is not an in-scope extension, so the codemod still skips it. Every
// other file under `frontend/www/libinteractive/gen/` stays excluded.
//
// The excluded prefixes and segments are restated here rather than read from
// EXCLUDED_PATHS, so a wrong entry in maps.cjs cannot make the test agree
// with itself.
//
// **Validates: Requirements 5.8**
'use strict';
const fc = require('fast-check');
const { isInScope, isExcluded } = require('../maps.cjs');
const { memoryFs, runCodemod, selectFiles } = require('../codemod-core.cjs');

const RUNS = { numRuns: 200 };
const ROOT = '/repo';

const EXCLUDED_PREFIXES = [
  'frontend/www/third_party/',
  'frontend/www/karel.js/',
  'frontend/www/rekarel/',
  'frontend/www/preguntas/',
  'frontend/www/libinteractive/',
  'frontend/www/docs/libinteractive/',
  'stuff/bs5-cutover/',
];
const EXCLUDED_SEGMENTS = ['node_modules', 'dist'];
const GEN_INDEX = 'frontend/www/libinteractive/gen/index.php';
const EXTS = ['.vue', '.ts', '.js', '.tpl', '.scss', '.css', '.html'];

// Independent oracle for "under an Excluded_Path" (after normalization).
function oracleExcluded(p) {
  if (p === GEN_INDEX) return false;
  if (p.split('/').some((s) => EXCLUDED_SEGMENTS.includes(s))) return true;
  return EXCLUDED_PREFIXES.some((pre) => p.startsWith(pre));
}

// ---------------------------------------------------------------------------
// Generators

const segment = fc
  .stringMatching(/^[a-z][a-z0-9_.-]{0,8}$/)
  .filter((s) => !EXCLUDED_SEGMENTS.includes(s));
const dirs = (max) => fc.array(segment, { maxLength: max });
const ext = fc.constantFrom(...EXTS);
const fileName = fc
  .tuple(fc.stringMatching(/^[A-Za-z][A-Za-z0-9_-]{0,8}$/), ext)
  .map(([n, e]) => n + e);
const join = (...parts) => parts.flat().join('/');

// Path under an excluded prefix, any extension (in-scope or not).
const underPrefix = fc
  .tuple(
    fc.constantFrom(...EXCLUDED_PREFIXES),
    dirs(3),
    fc.oneof(fileName, segment),
  )
  .map(([pre, ds, f]) => pre + join(ds, f));

// node_modules / dist as a segment at any depth under an in-scope root.
const underSegment = fc
  .tuple(
    fc.constantFrom('frontend', 'cypress', 'frontend/www', 'frontend/www/js'),
    dirs(3),
    fc.constantFrom(...EXCLUDED_SEGMENTS),
    dirs(3),
    fileName,
  )
  .map(([root, a, seg, b, f]) => join(root, a, seg, b, f));

// Files under libinteractive/gen/ other than the exact index.php exception.
const genSiblings = fc
  .tuple(dirs(2), fileName)
  .map(([ds, f]) => `frontend/www/libinteractive/gen/${join(ds, f)}`)
  .filter((p) => p !== GEN_INDEX);

// The spellings a caller may pass in: plain, `./`-prefixed, backslashes.
const spelled = (arb) =>
  fc
    .tuple(arb, fc.constantFrom('plain', 'dot', 'backslash'))
    .map(([p, how]) => ({
      canonical: p,
      raw:
        how === 'dot'
          ? `./${p}`
          : how === 'backslash'
          ? p.replace(/\//g, '\\')
          : p,
    }));

const excludedPath = spelled(fc.oneof(underPrefix, underSegment, genSiblings));

// In-scope path: under frontend/ or cypress/, in-scope extension, not under
// any Excluded_Path. Sibling names of excluded dirs (`third_party_x`,
// `karel.jsx`, `distx`) are mixed in as near misses.
const nearMissDir = fc.constantFrom(
  'www/third_party_x',
  'www/karel.jsx',
  'www/rekarel2',
  'www/preguntas-old',
  'www/libinteractive2',
  'www/docs/libinteractivex',
  'www/js/distx',
  'www/js/node_modules_x',
  'www/docs',
  'www/js/omegaup',
);
const inScopePath = fc
  .tuple(
    fc.constantFrom('frontend', 'cypress'),
    fc.option(nearMissDir, { nil: undefined }),
    dirs(3),
    fileName,
  )
  .map(([root, nm, ds, f]) => join(root, nm ? [nm] : [], ds, f))
  .filter((p) => !oracleExcluded(p));

// BS4 content so an excluded file would change if the codemod touched it.
const BS4_TEXT = {
  '.vue': '<template><div class="ml-2 float-left"></div></template>\n',
  '.ts': "const c = 'ml-2 float-left';\n",
  '.js': "const c = 'ml-2 float-left';\n",
  '.tpl': '<div class="ml-2 float-left"></div>\n',
  '.scss': '.x { @extend .ml-2; }\n.ml-2 { color: red; }\n',
  '.css': '.ml-2 { color: red; }\n',
  '.html': '<div class="ml-2 float-left"></div>\n',
};
const textFor = (p) =>
  BS4_TEXT[EXTS.find((e) => p.endsWith(e))] || '<div class="ml-2"></div>\n';

function spyFs(initial) {
  const fs = memoryFs(initial);
  const touched = { read: [], write: [], rename: [] };
  return {
    fs: {
      ...fs,
      readFile(p) {
        touched.read.push(p);
        return fs.readFile(p);
      },
      writeFile(p, t) {
        touched.write.push(p);
        return fs.writeFile(p, t);
      },
      rename(a, b) {
        touched.rename.push(a, b);
        return fs.rename(a, b);
      },
    },
    files: fs.files,
    touched,
  };
}

const abs = (p) => `${ROOT}/${p}`;

// ---------------------------------------------------------------------------

describe('Property 8: Excluded paths are never in scope', () => {
  test('excluded paths are not in scope and selectFiles drops them', () => {
    fc.assert(
      fc.property(excludedPath, ({ canonical, raw }) => {
        expect(isExcluded(raw)).toBe(true);
        expect(isInScope(raw)).toBe(false);
        expect(selectFiles([raw])).toEqual([]);
        expect(selectFiles([canonical])).toEqual([]);
      }),
      RUNS,
    );
  });

  test('frontend/cypress paths outside Excluded_Paths with in-scope ext are in scope', () => {
    fc.assert(
      fc.property(inScopePath, (p) => {
        expect(isExcluded(p)).toBe(false);
        expect(isInScope(p)).toBe(true);
        expect(selectFiles([p])).toEqual([p]);
      }),
      RUNS,
    );
  });

  test('selectFiles -> runCodemod never reads, writes, or renames an excluded file', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(excludedPath, {
          minLength: 1,
          maxLength: 6,
          selector: (x) => x.canonical,
        }),
        fc.uniqueArray(inScopePath, { minLength: 1, maxLength: 4 }),
        fc.boolean(),
        (excluded, inScope, check) => {
          const initial = {};
          for (const { canonical } of excluded) {
            initial[abs(canonical)] = textFor(canonical);
          }
          for (const p of inScope) initial[abs(p)] = textFor(p);
          initial[abs(GEN_INDEX)] = '<div class="ml-2"></div>\n';
          const before = new Map(Object.entries(initial));

          const tracked = [
            ...excluded.map((e) => e.raw),
            ...inScope,
            GEN_INDEX,
          ];
          const files = selectFiles(tracked);
          expect([...files].sort()).toEqual([...inScope].sort());

          const { fs, files: store, touched } = spyFs(initial);
          runCodemod({ root: ROOT, files, fs, check, now: () => new Date(0) });

          const forbidden = new Set([
            ...excluded.map((e) => abs(e.canonical)),
            abs(GEN_INDEX),
          ]);
          const hit = (list) =>
            list.filter(
              (p) =>
                forbidden.has(p) ||
                [...forbidden].some((f) => p.startsWith(`${f}.`)),
            );
          expect(hit(touched.read)).toEqual([]);
          expect(hit(touched.write)).toEqual([]);
          expect(hit(touched.rename)).toEqual([]);
          for (const f of forbidden) expect(store.get(f)).toBe(before.get(f));

          // The spy is live: every selected in-scope file was read.
          for (const p of inScope) expect(touched.read).toContain(abs(p));
        },
      ),
      { numRuns: 100 },
    );
  });

  test('gen/index.php is the exception: not excluded, but .php keeps it out of scope', () => {
    expect(isExcluded(GEN_INDEX)).toBe(false);
    expect(isInScope(GEN_INDEX)).toBe(false);
    expect(selectFiles([GEN_INDEX])).toEqual([]);
    expect(isExcluded('frontend/www/libinteractive/gen/index.html')).toBe(true);
    expect(isExcluded('frontend/www/libinteractive/index.php')).toBe(true);
  });
});
