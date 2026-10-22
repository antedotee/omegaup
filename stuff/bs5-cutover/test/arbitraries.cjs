// fast-check generators for the bs5-cutover tooling tests.
//
// Generator-only: this module reads maps.cjs data and never imports core.cjs,
// the adapters, or scan-core.cjs, so a generator cannot inherit a bug from the
// code under test.
'use strict';
const fc = require('fast-check');
const {
  RENAME_FAMILIES,
  RENAME_MAP,
  REMOVAL_MAP,
  BS4_KEYS,
  BS4_DATA_ATTRIBUTES,
} = require('../maps.cjs');

// ---------------------------------------------------------------------------
// Tokens

// family name -> keys. Rename families plus one family per Removal_Map kind.
const KEY_FAMILIES = (() => {
  const families = {};
  for (const [name, map] of Object.entries(RENAME_FAMILIES)) {
    families[name] = Object.keys(map);
  }
  for (const [key, entry] of Object.entries(REMOVAL_MAP)) {
    (families[`removal-${entry.kind}`] ||= []).push(key);
  }
  return Object.freeze(families);
})();

const fromFamilies = (names) =>
  fc
    .constantFrom(...names)
    .chain((name) => fc.constantFrom(...KEY_FAMILIES[name]));

// Any BS4_Class, uniform over families so the large spacing family does not
// crowd out the rest.
const bs4Key = fromFamilies(Object.keys(KEY_FAMILIES));
// Rename_Map keys only.
const renameKey = fromFamilies(Object.keys(RENAME_FAMILIES));
// Removal_Map keys, optionally of one kind ('replace' | 'conditional' |
// 'unwrap' | 'manual').
const removalKey = (kind) =>
  kind
    ? fc.constantFrom(
        ...Object.keys(REMOVAL_MAP).filter((k) => REMOVAL_MAP[k].kind === kind),
      )
    : fc.constantFrom(...Object.keys(REMOVAL_MAP));
// Keys the core rewrites in a class list (Rename_Map + Removal_Map replace).
const rewritableKey = fc.oneof(renameKey, removalKey('replace'));

// Measured near misses at the PR2 tip (git grep in frontend/ and cypress/),
// plus the requirement examples (`close-button`, `form-group-title`) and Font
// Awesome tokens. None is a BS4_Class; each contains one or looks like one.
const MEASURED_NEAR_MISSES = Object.freeze([
  'badge-layer',
  'badge-text',
  'badge-img',
  'badge-icon',
  'badge-gray',
  'custom-badge',
  'custom-badge-quality',
  'custom-badge-voted',
  'custom-badge-owner',
  'custom-card',
  'custom-button',
  'font-weight-medium',
  'panel-heading',
  'panel-body',
  'panel-default',
  'panel-title',
  'panel-primary',
  'panel-footer',
  'close-add-window',
  'close-input-port',
  'close-output-port',
  'close-button',
  'icon-eye-close',
  'icon-folder-close',
  'no-header-close',
  'auto-close',
  'form-group-title',
  'fa-close',
  'fa-times',
  'fa-window-close',
  'fa-check',
]);
for (const t of MEASURED_NEAR_MISSES) {
  if (BS4_KEYS.has(t)) throw new Error(`near miss is a BS4 key: ${t}`);
}

const isNotBs4Key = (t) => !BS4_KEYS.has(t);
const randomToken = fc
  .stringMatching(/^[a-z][a-z0-9-]{0,20}$/)
  .filter(isNotBs4Key);
const nearMiss = fc.oneof(
  fc.constantFrom(...MEASURED_NEAR_MISSES),
  randomToken,
);

// ---------------------------------------------------------------------------
// Class lists and selectors

const SPACE_ONLY = [' ', '  '];
const ANY_WS = [' ', '  ', '\t', '\n', '\n  '];

// A shuffle of BS4 keys and near misses with no duplicate tokens, joined by
// random whitespace. `ws: 'space'` keeps it legal inside a JS string literal.
const classList = ({
  minLength = 1,
  maxLength = 6,
  ws = 'any',
  keys = bs4Key,
} = {}) => {
  const seps = ws === 'space' ? SPACE_ONLY : ANY_WS;
  const sep = fc.constantFrom(...seps);
  const edge = fc.oneof(fc.constant(''), sep);
  return fc
    .tuple(
      fc.uniqueArray(fc.oneof(keys, nearMiss), { minLength, maxLength }),
      fc.array(sep, { minLength: maxLength, maxLength }),
      edge,
      edge,
    )
    .map(([tokens, gaps, lead, trail]) =>
      tokens.length === 0
        ? lead
        : lead +
          tokens.reduce((acc, t, i) => (i === 0 ? t : acc + gaps[i] + t), '') +
          trail,
    );
};

const classToken = fc.oneof(bs4Key, nearMiss);
const tag = fc.constantFrom('div', 'span', 'a', 'button', 'li', 'input');
// No single quotes or backslashes, so a selector fits in a '…' JS literal.
const simplePart = fc.oneof(
  { weight: 4, arbitrary: classToken.map((t) => `.${t}`) },
  { weight: 1, arbitrary: randomToken.map((t) => `#${t}`) },
  {
    weight: 1,
    arbitrary: fc
      .tuple(
        fc.constantFrom('data-tab', 'data-toggle', 'type', 'name'),
        fc.constantFrom('', 'x', 'ml-2', 'close'),
      )
      .map(([n, v]) => (v ? `[${n}="${v}"]` : `[${n}]`)),
  },
  {
    weight: 1,
    arbitrary: fc.constantFrom(
      ':hover',
      ':visible',
      ':first-child',
      ':not(.active)',
    ),
  },
);
const compound = fc
  .tuple(
    fc.option(tag, { nil: '' }),
    fc.array(simplePart, { minLength: 1, maxLength: 3 }),
  )
  .map(([t, parts]) => t + parts.join(''));
const combinator = fc.constantFrom(' ', ' > ', ' + ', ' ~ ');
const complex = fc
  .tuple(compound, fc.array(fc.tuple(combinator, compound), { maxLength: 2 }))
  .map(([head, rest]) => head + rest.map(([c, s]) => c + s).join(''));
// Selector list of 1-3 complex selectors.
const selector = fc
  .array(complex, { minLength: 1, maxLength: 3 })
  .map((xs) => xs.join(', '));

// ---------------------------------------------------------------------------
// :class expressions (strings, arrays, quoted-key objects, conditionals)

const condition = fc.constantFrom(
  'isActive',
  'cond',
  'item.open',
  '!disabled',
  'count > 0',
  "mode === 'close'",
);
const literalList = classList({ maxLength: 3, ws: 'space' });
const classExpr = (maxDepth = 3) =>
  fc.letrec((tie) => ({
    expr: fc.oneof(
      { maxDepth, depthIdentifier: 'classExpr' },
      tie('literal'),
      tie('array'),
      tie('object'),
      tie('cond'),
    ),
    literal: fc.oneof(
      literalList.map((s) => `'${s}'`),
      literalList.map((s) => `\`${s}\``),
    ),
    array: fc
      .array(tie('expr'), { minLength: 1, maxLength: 3 })
      .map((xs) => `[${xs.join(', ')}]`),
    object: fc
      .array(fc.tuple(literalList, condition), { minLength: 1, maxLength: 3 })
      .map((ps) => `{ ${ps.map(([k, c]) => `'${k}': ${c}`).join(', ')} }`),
    cond: fc
      .tuple(condition, tie('expr'), tie('expr'))
      .map(([c, a, b]) => `(${c} ? ${a} : ${b})`),
  })).expr;

// ---------------------------------------------------------------------------
// Whole files

const indent = (s, n) =>
  s
    .split('\n')
    .map((l) => (l ? ' '.repeat(n) + l : l))
    .join('\n');

const DECLARATIONS = Object.freeze([
  'border-left: 1px solid #ccc;',
  'border-right: 0;',
  'text-align: right;',
  'margin-left: 0.5rem;',
  'float: left;',
  'display: block;',
  'color: $omegaup-primary--darker;',
]);
const declarations = fc.array(fc.constantFrom(...DECLARATIONS), {
  minLength: 1,
  maxLength: 3,
});
const scssComment = fc.constantFrom(
  '// close the ml-2 gap',
  '// .form-group spacing',
  '/* .badge-primary legacy */',
);
const scssRule = fc.letrec((tie) => ({
  rule: fc
    .tuple(
      selector,
      declarations,
      fc.array(tie('nested'), { maxLength: 2 }),
      fc.option(classToken, { nil: null }),
    )
    .map(([sel, decls, nested, ext]) => {
      const body = [
        ...(ext ? [`@extend .${ext};`] : []),
        ...decls,
        ...nested,
      ].join('\n');
      return `${sel} {\n${indent(body, 2)}\n}`;
    }),
  nested: fc.oneof(
    { maxDepth: 1, depthIdentifier: 'scssRule' },
    fc
      .tuple(fc.constantFrom('&:hover', '& > .item', '&.active'), declarations)
      .map(([s, d]) => `${s} {\n${indent(d.join('\n'), 2)}\n}`),
    tie('rule'),
  ),
})).rule;
const scssMedia = scssRule.map(
  (r) => `@media (max-width: 576px) {\n${indent(r, 2)}\n}`,
);
const scssBody = fc
  .array(fc.oneof(scssRule, scssRule, scssMedia, scssComment), {
    minLength: 1,
    maxLength: 5,
  })
  .map((xs) => xs.join('\n\n'));

// A standalone .scss file.
const scss = scssBody.map((body) => `$panel-gap: 1rem;\n\n${body}\n`);

// Template nodes for the SFC generator.
const textNode = fc.constantFrom(
  'Close',
  'close',
  'Submit',
  'ml-2',
  '{{ T.wordsClose }}',
);
const omegaupDataAttr = fc.constantFrom(
  'data-toggle-layout-sidebar',
  'data-content-tab="runs"',
  'data-run-status-help',
  'data-section-toggle="access"',
);
const bs4DataAttr = fc
  .tuple(
    fc.constantFrom(...BS4_DATA_ATTRIBUTES),
    fc.constantFrom('collapse', '#x', 'true'),
  )
  .map(([n, v]) => `${n}="${v}"`);
const attrName = (a) => a.replace(/^[:@]|^v-bind:/, '').split('=')[0];
const elementAttr = fc.oneof(
  classList({ maxLength: 4 }).map((v) => `class="${v}"`),
  classExpr().map((e) => `:class="${e}"`),
  classList({ maxLength: 3 }).map((v) => `toggle-class="${v}"`),
  omegaupDataAttr,
  bs4DataAttr,
  fc.constant('@click="onClose"'),
);
const inputGroup = fc
  .tuple(
    fc.constantFrom('input-group-append', 'input-group-prepend'),
    classList({ maxLength: 2 }),
  )
  .map(
    ([wrapper, btn]) =>
      `<div class="input-group">\n  <input class="form-control" />\n  <div class="${wrapper}">\n    <button class="${btn}">Go</button>\n  </div>\n</div>`,
  );
const templateNode = fc.letrec((tie) => ({
  node: fc.oneof(
    { maxDepth: 2, depthIdentifier: 'templateNode' },
    textNode,
    tie('element'),
    inputGroup,
  ),
  element: fc
    .tuple(
      fc.constantFrom('div', 'span', 'button', 'a', 'li'),
      fc.uniqueArray(elementAttr, { maxLength: 3, selector: attrName }),
      fc.array(tie('node'), { maxLength: 3 }),
    )
    .map(([t, attrs, children]) => {
      const open = attrs.length ? `<${t} ${attrs.join(' ')}>` : `<${t}>`;
      if (!children.length) return `${open}</${t}>`;
      return `${open}\n${indent(children.join('\n'), 2)}\n</${t}>`;
    }),
})).node;

const quoted = (arb) => arb.map((s) => `'${s}'`);
const scriptStatement = fc.oneof(
  quoted(classList({ maxLength: 3, ws: 'space' })).map(
    (l) => `this.$el.classList.add(${l});`,
  ),
  quoted(selector).map((s) => `document.querySelector(${s});`),
  fc.constantFrom(
    "this.$emit('close');",
    "this.$emit('update:value', 1);",
    '// close the modal after ml-2 spacing',
    'const closeModal = (): void => {};',
  ),
);

// A valid .vue SFC: template with static/bound classes, data-* attributes and
// an input-group wrapper; a TS script; a scoped SCSS style.
const sfc = fc
  .tuple(
    fc.array(templateNode, { minLength: 1, maxLength: 4 }),
    fc.array(scriptStatement, { minLength: 1, maxLength: 4 }),
    scssBody,
  )
  .map(
    ([nodes, statements, style]) =>
      `<template>\n  <div>\n${indent(
        nodes.join('\n'),
        4,
      )}\n  </div>\n</template>\n\n` +
      `<script lang="ts">\nimport { defineComponent } from 'vue';\n\n` +
      `export default defineComponent({\n  methods: {\n    m(): void {\n` +
      `${indent(statements.join('\n'), 6)}\n    },\n  },\n});\n</script>\n\n` +
      `<style lang="scss" scoped>\n@import '../../../../sass/site';\n\n${style}\n</style>\n`,
  );

const TS_HEADER = [
  'declare const $: any;',
  'declare const jQuery: any;',
  'declare const cy: any;',
  'declare const wrapper: any;',
  'declare const el: HTMLElement;',
  'declare const channel: { close(): void };',
].join('\n');
const tsStatement = fc.oneof(
  quoted(classList({ maxLength: 3, ws: 'space' })).map(
    (l) => `el.className = ${l};`,
  ),
  quoted(classList({ maxLength: 3, ws: 'space' })).map(
    (l) => `const opts = { toggleClass: ${l} };`,
  ),
  quoted(classList({ maxLength: 2, ws: 'space' })).map(
    (l) => `el.classList.toggle(${l});`,
  ),
  quoted(classList({ maxLength: 3, ws: 'space' })).map(
    (l) => `$(el).addClass(${l});`,
  ),
  quoted(selector).map((s) => `document.querySelectorAll(${s});`),
  quoted(selector).map((s) => `cy.get(${s}).click();`),
  quoted(selector).map((s) => `wrapper.find(${s});`),
  classList({ maxLength: 3, ws: 'space' }).map(
    (l) => 'const html = `<div class="' + l + '">x</div>`;',
  ),
  fc.constantFrom(
    "wrapper.vm.$emit('close');",
    'channel.close();',
    'const closeModal = (): void => {};',
    '// close ml-2 form-group',
  ),
);
// A .ts file (class-value, selector, HTML-in-string, and decoy statements).
const tsFile = fc
  .array(tsStatement, { minLength: 1, maxLength: 8 })
  .map((xs) => `${TS_HEADER}\n\n${xs.join('\n')}\n`);

const tplAttr = fc.oneof(
  classList({ maxLength: 4 }).map((v) => `class="${v}"`),
  classList({ maxLength: 4, ws: 'space' }).map((v) => `class='${v}'`),
  fc.constant('class="h-100{% if LOCKDOWN %} lockdown{% endif %}"'),
);
const tplElement = fc
  .tuple(
    fc.constantFrom('div', 'span', 'p'),
    tplAttr,
    fc.constantFrom('{{ title }}', 'Close', ''),
  )
  .map(([t, a, body]) => `<${t} ${a}>${body}</${t}>`);
// A Twig .tpl page with class attributes, Twig tags, and a <style> element.
const tplFile = fc
  .tuple(fc.array(tplElement, { minLength: 1, maxLength: 6 }), scssRule)
  .map(
    ([els, rule]) =>
      `<!DOCTYPE html>\n<html>\n  <head>\n    <style>\n${indent(
        rule,
        6,
      )}\n    </style>\n  </head>\n` +
      `  <body>\n    {% if LOGGED_IN %}\n${indent(
        els.join('\n'),
        4,
      )}\n    {% endif %}\n  </body>\n</html>\n`,
  );

// ---------------------------------------------------------------------------
// Residual scan instances and decoys

const SCAN_CATEGORIES = Object.freeze([
  'bs4-class',
  'bs4-data-attribute',
  'component-bs-import',
  'jquery-bs-plugin-call',
  'vendored-bs4-ref',
]);
const JQUERY_PLUGINS = Object.freeze([
  'popover',
  'tooltip',
  'modal',
  'collapse',
  'dropdown',
  'tab',
  'carousel',
  'alert',
  'toast',
  'scrollspy',
]);
const BS_CSS_SPECIFIERS = Object.freeze([
  'bootstrap/dist/css/bootstrap.css',
  'bootstrap/dist/css/bootstrap.min.css',
  'bootstrap/dist/css/bootstrap-grid.css',
]);
const VENDORED_REF = 'bootstrap-4.5.0';

// Hosts: where an instance line sits. `cypress-ts` is a flat .ts spec (every
// line is a top-level statement). `vue` has a flat template and a flat script.
const SCAN_HOSTS = Object.freeze({
  'cypress-ts': { path: 'cypress/e2e/generated.cy.ts', sections: ['script'] },
  vue: {
    path: 'frontend/www/js/omegaup/components/Generated.vue',
    sections: ['template', 'script'],
  },
});

const inst = (section, category) => (arb) =>
  arb.map(([text, token]) => ({ section, text, token, category }));

const SCAN_INSTANCE_GENERATORS = {
  'cypress-ts': {
    'bs4-class': inst(
      'script',
      'bs4-class',
    )(
      fc.oneof(
        bs4Key.map((k) => [`cy.get('.${k}').click();`, k]),
        bs4Key.map((k) => [`el.classList.add('${k}');`, k]),
      ),
    ),
    'bs4-data-attribute': inst(
      'script',
      'bs4-data-attribute',
    )(
      fc
        .tuple(
          fc.constantFrom(...BS4_DATA_ATTRIBUTES),
          fc.constantFrom('collapse', 'modal', '#x'),
        )
        .map(([n, v]) => [`cy.get('[${n}="${v}"]').click();`, n]),
    ),
    'component-bs-import': inst(
      'script',
      'component-bs-import',
    )(
      fc
        .tuple(
          fc.constantFrom(...BS_CSS_SPECIFIERS),
          fc.constantFrom('import', 'require'),
        )
        .map(([s, form]) => [
          form === 'import' ? `import '${s}';` : `require('${s}');`,
          s,
        ]),
    ),
    'jquery-bs-plugin-call': inst(
      'script',
      'jquery-bs-plugin-call',
    )(
      fc
        .tuple(
          fc.constantFrom(...JQUERY_PLUGINS),
          fc.constantFrom(
            "$('#x')",
            "jQuery('.navbar-collapse')",
            '($(el) as any)',
            '(jQuery(el))',
          ),
          fc.constantFrom('show', 'hide', 'toggle'),
        )
        .map(([m, recv, arg]) => [`${recv}.${m}('${arg}');`, m]),
    ),
    'vendored-bs4-ref': inst(
      'script',
      'vendored-bs4-ref',
    )(
      fc.constantFrom(
        [
          `const href = '/third_party/${VENDORED_REF}/css/bootstrap.min.css';`,
          VENDORED_REF,
        ],
        [`// loaded from ${VENDORED_REF}`, VENDORED_REF],
      ),
    ),
  },
  vue: {
    // aria-label keeps a `close` instance to one report entry (no
    // accessible-name review).
    'bs4-class': fc.oneof(
      inst(
        'template',
        'bs4-class',
      )(bs4Key.map((k) => [`<span class="${k}" aria-label="x"></span>`, k])),
      inst(
        'script',
        'bs4-class',
      )(bs4Key.map((k) => [`document.body.classList.add('${k}');`, k])),
    ),
    'bs4-data-attribute': inst(
      'template',
      'bs4-data-attribute',
    )(
      fc
        .tuple(
          fc.constantFrom(...BS4_DATA_ATTRIBUTES),
          fc.constantFrom('static', ':', 'v-bind:'),
        )
        .map(([n, form]) => [
          form === 'static'
            ? `<button ${n}="x"></button>`
            : `<button ${form}${n}="target"></button>`,
          n,
        ]),
    ),
    'component-bs-import': inst(
      'script',
      'component-bs-import',
    )(fc.constantFrom(...BS_CSS_SPECIFIERS).map((s) => [`import '${s}';`, s])),
    'jquery-bs-plugin-call': inst(
      'script',
      'jquery-bs-plugin-call',
    )(
      fc
        .tuple(
          fc.constantFrom(...JQUERY_PLUGINS),
          fc.constantFrom("$('#x')", '($(el) as any)'),
        )
        .map(([m, recv]) => [`${recv}.${m}('hide');`, m]),
    ),
    'vendored-bs4-ref': inst(
      'template',
      'vendored-bs4-ref',
    )(
      fc.constant([
        `<a href="/third_party/${VENDORED_REF}/css/bootstrap.min.css">css</a>`,
        VENDORED_REF,
      ]),
    ),
  },
};

// One scan instance: { section, text (one line), token, category }.
// `category` undefined -> any of the 5 categories.
const scanInstance = (category, host = 'cypress-ts') => {
  const gens = SCAN_INSTANCE_GENERATORS[host];
  if (!gens) throw new Error(`unknown scan host: ${host}`);
  if (category) {
    if (!gens[category]) throw new Error(`unknown scan category: ${category}`);
    return gens[category];
  }
  return fc.oneof(...SCAN_CATEGORIES.map((c) => gens[c]));
};

const SCRIPT_DECOYS = Object.freeze([
  'const closeModal = (): void => {};',
  'channel.close();',
  "wrapper.vm.$emit('close');",
  "$('#x').on('close', closeModal);",
  "cy.get('[data-toggle-layout-sidebar]').click();",
  'cy.get(\'[data-content-tab="runs"]\').click();',
  "cy.get('.panel-heading').should('be.visible');",
  "el.style.borderLeft = '1px solid';",
  '// TODO: close the form-group after ml-2',
  "const url = '/third_party/js/jquery-3.5.1.min.js';",
]);
const TEMPLATE_DECOYS = Object.freeze([
  '<div class="panel-heading">Close</div>',
  '<button data-toggle-layout-sidebar @click="closeModal">x</button>',
  '<div data-content-tab="runs"></div>',
  '<p>close the form-group</p>',
]);
const scriptDecoy = fc.oneof(
  fc.constantFrom(...SCRIPT_DECOYS),
  nearMiss.map((t) => `el.classList.add('${t}');`),
  nearMiss.map((t) => `cy.get('.${t}');`),
);
const templateDecoy = fc.oneof(
  fc.constantFrom(...TEMPLATE_DECOYS),
  nearMiss.map((t) => `<span class="${t}"></span>`),
);

// { template: string[], script: string[] } of decoy lines for a host.
const decoyLines = (host = 'cypress-ts') =>
  fc.record({
    template:
      host === 'vue'
        ? fc.array(templateDecoy, { maxLength: 8 })
        : fc.constant([]),
    script: fc.array(scriptDecoy, { maxLength: 8 }),
  });

const VUE_SCRIPT_HEADER = [
  'declare const $: any;',
  'declare const el: HTMLElement;',
];

// Renders sections (strings are decoys, objects are instances) into a file.
// Returns { text, lineOf(instance) -> 1-based line }.
function renderScanFile(host, sections) {
  const out = [];
  const lineOf = new Map();
  const push = (entry) => {
    if (typeof entry === 'string') {
      out.push(entry);
    } else {
      out.push(entry.text);
      lineOf.set(entry, out.length);
    }
  };
  if (host === 'vue') {
    out.push('<template>', '  <div>');
    for (const e of sections.template) push(e);
    out.push('  </div>', '</template>', '', '<script lang="ts">');
    out.push(...VUE_SCRIPT_HEADER);
    for (const e of sections.script) push(e);
    out.push('</script>');
  } else {
    out.push(...TS_HEADER.split('\n'), '');
    for (const e of sections.script) push(e);
  }
  return { text: out.join('\n') + '\n', lineOf: (entry) => lineOf.get(entry) };
}

// Decoy-only text for a host (Property 14).
const decoyText = (host = 'cypress-ts') =>
  decoyLines(host).map((sections) => renderScanFile(host, sections).text);

// A decoy file with `instances` inserted at random lines (Property 13).
// Yields { path, text, expected: [{ line, token, category }] } sorted by line.
const scanCase = (host = 'cypress-ts', { maxInstances = 6, category } = {}) =>
  fc
    .tuple(
      decoyLines(host),
      fc.array(fc.tuple(scanInstance(category, host), fc.nat()), {
        maxLength: maxInstances,
      }),
    )
    .map(([decoys, placed]) => {
      const sections = {
        template: [...decoys.template],
        script: [...decoys.script],
      };
      const entries = [];
      for (const [instance, pos] of placed) {
        const entry = { ...instance };
        const list = sections[instance.section];
        list.splice(pos % (list.length + 1), 0, entry);
        entries.push(entry);
      }
      const { text, lineOf } = renderScanFile(host, sections);
      const expected = entries
        .map((e) => ({ line: lineOf(e), token: e.token, category: e.category }))
        .sort((a, b) => a.line - b.line);
      return { path: SCAN_HOSTS[host].path, text, expected };
    });

module.exports = {
  KEY_FAMILIES,
  MEASURED_NEAR_MISSES,
  bs4Key,
  renameKey,
  removalKey,
  rewritableKey,
  nearMiss,
  classList,
  selector,
  classExpr,
  sfc,
  scss,
  tsFile,
  tplFile,
  SCAN_CATEGORIES,
  SCAN_HOSTS,
  scanInstance,
  decoyLines,
  decoyText,
  scanCase,
  RENAME_MAP,
  REMOVAL_MAP,
};
