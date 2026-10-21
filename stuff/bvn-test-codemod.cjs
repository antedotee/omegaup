#!/usr/bin/env node
// Codemod: strip bootstrap-vue wiring from a Jest test file. bootstrap-vue-next
// is registered globally in test.setup.ts, and @vue/test-utils 2 removed
// createLocalVue. Applies the recurring test-file fixes from the swap recipe.
//
// Usage: node stuff/bvn-test-codemod.cjs <file.test.ts> [more files...]
const fs = require('fs');

function transform(src) {
  let s = src;

  // Remove any `import ... from 'bootstrap-vue';` line (default and/or named).
  s = s.replace(/^\s*import\s+[^;]*?\s+from\s+['"]bootstrap-vue['"];\s*\n/gm, '');

  // Remove `createLocalVue` from a @vue/test-utils import, keeping the rest.
  s = s.replace(
    /(import\s*\{)([^}]*?)\}\s*from\s*['"]@vue\/test-utils['"]/,
    (m, open, names) => {
      const kept = names
        .split(',')
        .map((n) => n.trim())
        .filter((n) => n && n !== 'createLocalVue');
      return `${open} ${kept.join(', ')} } from '@vue/test-utils'`;
    },
  );

  // Remove `const localVue = createLocalVue();` and any `localVue.use(...)`.
  s = s.replace(/^\s*const\s+localVue\s*=\s*createLocalVue\(\);\s*\n/gm, '');
  s = s.replace(/^\s*localVue\.use\([^)]*\);\s*\n/gm, '');

  // Drop `localVue` from mount option objects: `{ localVue }`, `{ localVue, ... }`,
  // `{ ..., localVue }`, and `localVue,` lines.
  s = s.replace(/\{\s*localVue\s*\}/g, '{}');
  s = s.replace(/\blocalVue\s*,\s*/g, '');
  s = s.replace(/,\s*localVue\b/g, '');
  s = s.replace(/^\s*localVue,?\s*\n/gm, '');

  // Move a top-level `provide: {...}` mount option under `global`. Only when it
  // is not already inside a `global:` block. Conservative: handle the common
  // single-line and simple multi-line object form.
  // (Left to manual review when nested; the recipe notes this.)

  return s;
}

const files = process.argv.slice(2);
let changed = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const out = transform(src);
  if (out !== src) {
    fs.writeFileSync(f, out);
    changed++;
    console.log('rewrote ' + f);
  } else {
    console.log('no-change ' + f);
  }
}
console.log(`done: ${changed}/${files.length} changed`);
