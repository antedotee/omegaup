#!/usr/bin/env node
// Migrate Vue 2 class components from vue-property-decorator to
// vue-facing-decorator so they register correctly under the Vue 3 migration
// build (@vue/compat). The transform is intentionally narrow: it only touches
// files that import from 'vue-property-decorator' and declare
// `export default class X extends Vue`, which the repository inventory showed is
// the single shape used across all 264 class components.
//
// Per-file transform:
//   1. import source 'vue-property-decorator' -> 'vue-facing-decorator',
//      adding `toNative` to the named import list.
//   2. `export default class X extends Vue` -> `class X extends Vue`.
//   3. append `export default toNative(X);` at the end of the <script> block
//      (or end of file for a plain .ts module).
//
// Usage: node stuff/vue-compat/migrate-class-components.mjs <glob-root>
// Idempotent: a file already importing vue-facing-decorator is skipped.
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const root = process.argv[2] || 'frontend/www/js';
const files = execSync(
  `grep -rl "from 'vue-property-decorator'" --include="*.vue" --include="*.ts" ${root}`,
  { encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean);

let changed = 0;
const skipped = [];

for (const file of files) {
  let src = readFileSync(file, 'utf8');
  if (src.includes("from 'vue-facing-decorator'")) {
    skipped.push(`${file} (already migrated)`);
    continue;
  }

  // 1. Rewrite the import line, ensuring toNative is present.
  const importRe = /import\s*\{([^}]*)\}\s*from\s*'vue-property-decorator';/;
  const m = src.match(importRe);
  if (!m) {
    skipped.push(`${file} (no plain named vpd import)`);
    continue;
  }
  const names = m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!names.includes('toNative')) names.push('toNative');
  src = src.replace(
    importRe,
    `import { ${names.join(', ')} } from 'vue-facing-decorator';`,
  );

  // 2. De-export the class declaration.
  const classRe = /export default class ([A-Za-z0-9_]+) extends Vue/;
  const cm = src.match(classRe);
  if (!cm) {
    skipped.push(`${file} (no 'export default class X extends Vue')`);
    continue;
  }
  const className = cm[1];
  src = src.replace(classRe, `class ${className} extends Vue`);

  // 3. Append the toNative default export at the end of the script.
  const exportLine = `export default toNative(${className});`;
  if (src.includes('</script>')) {
    src = src.replace(/\n?<\/script>/, `\n${exportLine}\n</script>`);
  } else {
    src = `${src.replace(/\s*$/, '')}\n${exportLine}\n`;
  }

  writeFileSync(file, src);
  changed += 1;
}

console.log(`migrated ${changed} files, skipped ${skipped.length}`);
for (const s of skipped) console.log(`  skip: ${s}`);
