#!/usr/bin/env node
// Codemod: type the Vue 2-style `render: function (createElement) {...}` entry
// points so they pass fork-ts-checker under the Vue 3 migration build.
//
// Two changes per matching file:
//  1. Ensure `CreateElement` is imported from 'vue' (as a type).
//  2. Annotate the render callback parameter: `(createElement)` ->
//     `(createElement: CreateElement)` and `(h)` -> `(h: CreateElement)`.
//
// Usage: node stuff/bvn-entrypoint-type-codemod.cjs <file.ts> [more...]
const fs = require('fs');

function transform(src) {
  let s = src;
  let changed = false;

  // Only touch files that have the Vue render-callback pattern.
  const renderParam = /render:\s*function\s*\(\s*(createElement|h)\s*\)/;
  const renderArrow = /render:\s*\(\s*(createElement|h)\s*\)\s*=>/;
  if (!renderParam.test(s) && !renderArrow.test(s)) {
    return { s, changed };
  }

  // 1. Annotate the parameter.
  s = s.replace(
    /(render:\s*function\s*\(\s*)(createElement|h)(\s*\))/g,
    (m, a, name, c) => {
      changed = true;
      return `${a}${name}: CreateElement${c}`;
    },
  );
  s = s.replace(
    /(render:\s*\(\s*)(createElement|h)(\s*\)\s*=>)/g,
    (m, a, name, c) => {
      changed = true;
      return `${a}${name}: CreateElement${c}`;
    },
  );

  if (!changed) return { s, changed };

  // 2. Ensure CreateElement is imported from 'vue'.
  if (/\bCreateElement\b/.test(s) && !/import[^;]*\bCreateElement\b[^;]*from\s*['"]vue['"]/.test(s)) {
    if (/^import\s+Vue\s*,\s*\{([^}]*)\}\s*from\s*['"]vue['"];/m.test(s)) {
      // import Vue, { X } from 'vue';  ->  add CreateElement
      s = s.replace(
        /^(import\s+Vue\s*,\s*\{)([^}]*)(\}\s*from\s*['"]vue['"];)/m,
        (m, a, names, c) => `${a}${names.trimEnd()}${names.trim() ? ',' : ''} type CreateElement ${c}`,
      );
    } else if (/^import\s+Vue\s+from\s*['"]vue['"];/m.test(s)) {
      // import Vue from 'vue';  ->  import Vue, { type CreateElement } from 'vue';
      s = s.replace(
        /^import\s+Vue\s+from\s*['"]vue['"];/m,
        `import Vue, { type CreateElement } from 'vue';`,
      );
    } else if (/^import\s*\{([^}]*)\}\s*from\s*['"]vue['"];/m.test(s)) {
      // import { X } from 'vue';  ->  add CreateElement
      s = s.replace(
        /^(import\s*\{)([^}]*)(\}\s*from\s*['"]vue['"];)/m,
        (m, a, names, c) => `${a}${names.trimEnd()}${names.trim() ? ',' : ''} type CreateElement ${c}`,
      );
    } else {
      // No existing 'vue' import; add one at the top.
      s = `import { type CreateElement } from 'vue';\n${s}`;
    }
  }

  return { s, changed };
}

const files = process.argv.slice(2);
let n = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const { s, changed } = transform(src);
  if (changed && s !== src) {
    fs.writeFileSync(f, s);
    n++;
    console.log('typed ' + f);
  }
}
console.log(`done: ${n}/${files.length} changed`);
