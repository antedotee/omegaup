// Bootstrap 4 -> 5 data for the bs5-cutover codemod and residual scan.
//
// Every BS4 -> BS5 decision lives here as data. core.cjs, the adapters, the
// integrity check, and scan-core.cjs all read these tables, so the codemod and
// the scan cannot disagree on what a BS4_Class is.
//
// The maps are closed: only the exact keys below are BS4_Classes. Matching is
// whole-token only (core.cjs), so `close-button`, `badge-layer`, or
// `font-weight-medium` never match.
//
// `close` is a BS4 class token but also a common English word and event name
// (`$emit('close')`, `channel.close()`). The map holds it; the adapters decide
// whether a string sits in a class or selector context.
'use strict';

// '' plus the BS4 responsive infixes. BS4 has no xxl breakpoint.
const BREAKPOINTS = Object.freeze(['', 'sm-', 'md-', 'lg-', 'xl-']);

const freezeMap = (obj) => {
  for (const v of Object.values(obj)) Object.freeze(v);
  return Object.freeze(obj);
};

// family name -> { bs4Key: bs5Tokens }. An empty token list drops the token.
function buildRenameFamilies() {
  const families = {};
  const add = (family, from, to) => {
    (families[family] ||= {})[from] = to;
  };

  // Margin/padding sides: {m,p}{l,r}-{bp}{0..5,auto,n1..n5}.
  // `auto` and negative steps exist for margin only.
  const steps = ['0', '1', '2', '3', '4', '5'];
  const marginOnly = ['auto', 'n1', 'n2', 'n3', 'n4', 'n5'];
  const sides = { l: 's', r: 'e' };
  for (const prop of ['m', 'p']) {
    for (const [bs4Side, bs5Side] of Object.entries(sides)) {
      for (const bp of BREAKPOINTS) {
        for (const step of prop === 'm' ? [...steps, ...marginOnly] : steps) {
          add('spacing-side', `${prop}${bs4Side}-${bp}${step}`, [
            `${prop}${bs5Side}-${bp}${step}`,
          ]);
        }
      }
    }
  }

  const leftRight = { left: 'start', right: 'end' };
  for (const bp of BREAKPOINTS) {
    for (const [from, to] of Object.entries(leftRight)) {
      add('float', `float-${bp}${from}`, [`float-${bp}${to}`]);
      add('text-align', `text-${bp}${from}`, [`text-${bp}${to}`]);
      add('dropdown-align', `dropdown-menu-${bp}${from}`, [
        `dropdown-menu-${bp}${to}`,
      ]);
    }
  }

  for (const v of [
    'primary',
    'secondary',
    'success',
    'danger',
    'info',
    'dark',
  ]) {
    add('badge-variant', `badge-${v}`, [`bg-${v}`]);
  }
  // BS4 drew dark text on these two; BS5 bg-* does not (extension).
  add('badge-variant-dark-text', 'badge-warning', ['bg-warning', 'text-dark']);
  add('badge-variant-dark-text', 'badge-light', ['bg-light', 'text-dark']);
  add('badge-pill', 'badge-pill', ['rounded-pill']);

  add('custom-select', 'custom-select', ['form-select']);
  add('custom-select', 'custom-select-sm', ['form-select-sm']);
  add('custom-select', 'custom-select-lg', ['form-select-lg']);

  add('custom-check', 'custom-control', ['form-check']);
  add('custom-check', 'custom-checkbox', ['form-check']);
  add('custom-check', 'custom-radio', ['form-check']);
  add('custom-check', 'custom-switch', ['form-check', 'form-switch']);
  add('custom-check', 'custom-control-input', ['form-check-input']);
  add('custom-check', 'custom-control-label', ['form-check-label']);
  add('custom-check', 'custom-control-inline', ['form-check-inline']);

  add('custom-file-range', 'custom-file', ['form-control']);
  add('custom-file-range', 'custom-range', ['form-range']);

  add('visually-hidden', 'sr-only', ['visually-hidden']);
  add('visually-hidden', 'sr-only-focusable', ['visually-hidden-focusable']);

  add('gutters', 'no-gutters', ['g-0']);

  for (const w of ['bold', 'bolder', 'normal', 'light', 'lighter']) {
    add('font', `font-weight-${w}`, [`fw-${w}`]);
  }
  add('font', 'font-italic', ['fst-italic']);
  add('font', 'text-monospace', ['font-monospace']);

  for (const [from, to] of Object.entries(leftRight)) {
    add('border-side', `border-${from}`, [`border-${to}`]);
    add('border-side', `border-${from}-0`, [`border-${to}-0`]);
  }

  add('close', 'close', ['btn-close']);

  add('embed', 'embed-responsive', ['ratio']);
  for (const [from, to] of [
    ['21by9', '21x9'],
    ['16by9', '16x9'],
    ['4by3', '4x3'],
    ['1by1', '1x1'],
  ]) {
    add('embed', `embed-responsive-${from}`, [`ratio-${to}`]);
  }
  add('embed', 'embed-responsive-item', []);

  for (const f of Object.values(families)) freezeMap(f);
  return Object.freeze(families);
}

const RENAME_FAMILIES = buildRenameFamilies();
const RENAME_MAP = freezeMap(
  Object.assign({}, ...Object.values(RENAME_FAMILIES)),
);

// Removal_Map. A Removal_Map class inside a selector is never rewritten: it
// goes to manual-review ("selector on generic utility"), because rewriting
// `.form-group` to `.mb-3` would widen the selector to every mb-3 element.
const REMOVAL_MAP = freezeMap({
  'form-group': { kind: 'replace', tokens: ['mb-3'] },
  'form-row': { kind: 'replace', tokens: ['row', 'g-2'] },
  'btn-block': {
    kind: 'conditional',
    tokens: ['w-100'],
    manualWhen: 'stackedBlock',
  },
  'input-group-append': { kind: 'unwrap' },
  'input-group-prepend': { kind: 'unwrap' },
  'form-inline': { kind: 'manual' },
  jumbotron: { kind: 'manual' },
  media: { kind: 'manual' },
  'media-body': { kind: 'manual' },
  'card-deck': { kind: 'manual' },
  'card-columns': { kind: 'manual' },
});
for (const e of Object.values(REMOVAL_MAP)) {
  if (e.tokens) Object.freeze(e.tokens);
}

// Every BS4_Class (Rename_Map and Removal_Map keys). Treat as read-only.
const BS4_KEYS = new Set([
  ...Object.keys(RENAME_MAP),
  ...Object.keys(REMOVAL_MAP),
]);

// BS4 data-API attribute names. Their BS5 `data-bs-*` forms are listed too:
// PR3 drives these behaviors through BVN, so neither form may remain.
const BS4_DATA_ATTRIBUTE_BASES = Object.freeze([
  'toggle',
  'target',
  'dismiss',
  'placement',
  'content',
  'parent',
  'trigger',
  'html',
  'offset',
  'backdrop',
  'keyboard',
  'ride',
  'slide',
  'slide-to',
  'spy',
]);
const BS4_DATA_ATTRIBUTES = Object.freeze([
  ...BS4_DATA_ATTRIBUTE_BASES.map((b) => `data-${b}`),
  ...BS4_DATA_ATTRIBUTE_BASES.map((b) => `data-bs-${b}`),
]);
const BS4_DATA_ATTRIBUTE_SET = new Set(BS4_DATA_ATTRIBUTES);

// Exact-name match, so omegaUp hooks such as `data-toggle-layout-sidebar` or
// `data-content-tab` are not BS4 data attributes.
function isBs4DataAttribute(name) {
  return BS4_DATA_ATTRIBUTE_SET.has(name);
}

const IN_SCOPE_ROOTS = Object.freeze(['frontend/', 'cypress/']);
const IN_SCOPE_EXT = Object.freeze([
  '.vue',
  '.ts',
  '.js',
  '.tpl',
  '.scss',
  '.css',
  '.html',
]);

// Codemod and bs4-class scan scope. The scan's vendored-bs4-ref category
// still reads third_party (and .storybook, webpack configs) for the literal
// `bootstrap-4.5.0`; that category does not use isInScope.
const EXCLUDED_PATHS = Object.freeze({
  // Matched against every path segment.
  segments: Object.freeze(['node_modules', 'dist']),
  prefixes: Object.freeze([
    'frontend/www/third_party/',
    'frontend/www/karel.js/',
    'frontend/www/rekarel/',
    'frontend/www/preguntas/', // submodule
    'frontend/www/libinteractive/',
    'frontend/www/docs/libinteractive/',
    // The tooling itself: fixtures hold BS4 tokens on purpose.
    'stuff/bs5-cutover/',
  ]),
  // Exact paths under an excluded prefix that are not excluded. gen/index.php
  // is `.php`, so it is still outside IN_SCOPE_EXT.
  exceptions: Object.freeze(['frontend/www/libinteractive/gen/index.php']),
});

function normalizePath(p) {
  return String(p)
    .replace(/\\/g, '/')
    .replace(/^(\.\/)+/, '');
}

function isExcluded(p) {
  const path = normalizePath(p);
  if (EXCLUDED_PATHS.exceptions.includes(path)) return false;
  if (path.split('/').some((s) => EXCLUDED_PATHS.segments.includes(s))) {
    return true;
  }
  return EXCLUDED_PATHS.prefixes.some(
    (prefix) => path === prefix.slice(0, -1) || path.startsWith(prefix),
  );
}

function hasInScopeExt(p) {
  const path = normalizePath(p);
  return IN_SCOPE_EXT.some((ext) => path.endsWith(ext));
}

// True when the codemod may read and modify `p` (repo-relative path).
function isInScope(p) {
  const path = normalizePath(p);
  return (
    IN_SCOPE_ROOTS.some((root) => path.startsWith(root)) &&
    hasInScopeExt(path) &&
    !isExcluded(path)
  );
}

module.exports = {
  BREAKPOINTS,
  RENAME_FAMILIES,
  RENAME_MAP,
  REMOVAL_MAP,
  BS4_KEYS,
  BS4_DATA_ATTRIBUTE_BASES,
  BS4_DATA_ATTRIBUTES,
  isBs4DataAttribute,
  IN_SCOPE_ROOTS,
  IN_SCOPE_EXT,
  EXCLUDED_PATHS,
  normalizePath,
  isExcluded,
  isInScope,
};
