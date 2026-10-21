#!/usr/bin/env node
// After migrating class components to vue-facing-decorator, the `Vue` symbol
// imported from 'vue-facing-decorator' is the class base and has no global
// methods (`Vue.use`, `Vue.set`, `Vue.extend`, `Vue.nextTick`). Those global
// calls must go through the Vue 3 migration build's default export instead.
//
// This codemod, for each file that imports `Vue` from 'vue-facing-decorator'
// and also calls a Vue global method, adds `import VueGlobal from 'vue';` and
// rewrites the global calls to `VueGlobal.<method>`. The class base `Vue` stays
// untouched.
//
// Usage: node stuff/vue-compat/fix-vue-global-calls.mjs <root>
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const root = process.argv[2] || 'frontend/www/js';
const GLOBALS = ['use', 'set', 'delete', 'extend', 'nextTick', 'observable'];
const globalRe = new RegExp(`\\bVue\\.(${GLOBALS.join('|')})\\b`, 'g');

const files = execSync(
  `grep -rl "from 'vue-facing-decorator'" --include="*.vue" --include="*.ts" ${root}`,
  { encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean);

let changed = 0;
for (const file of files) {
  let src = readFileSync(file, 'utf8');
  if (!globalRe.test(src)) continue;
  globalRe.lastIndex = 0;

  if (src.includes("import VueGlobal from 'vue'")) {
    src = src.replace(globalRe, 'VueGlobal.$1');
  } else {
    // Insert the global import right after the vue-facing-decorator import.
    src = src.replace(
      /(import \{[^}]*\} from 'vue-facing-decorator';)/,
      "$1\nimport VueGlobal from 'vue';",
    );
    src = src.replace(globalRe, 'VueGlobal.$1');
  }
  writeFileSync(file, src);
  changed += 1;
}
console.log(`fixed Vue global calls in ${changed} files`);
