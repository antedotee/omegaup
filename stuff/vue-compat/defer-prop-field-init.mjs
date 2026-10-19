#!/usr/bin/env node
// Defer prop-dependent class-field initializers into a created() hook.
//
// Under vue-facing-decorator the props declared with @Prop/@Ref/@Inject are not
// bound when class field initializers run, so a field like
//   isPublic = this.clarification.public;
// throws "Cannot read properties of undefined". The fix is to give the field a
// type-safe default and assign the real value in created(), which runs after
// props are bound.
//
// This codemod uses the TypeScript compiler API (already a dependency) to find,
// in each SFC <script lang="ts">, class property initializers whose expression
// references `this.<declaredProp>`, replace the initializer with a safe default
// derived from the declared type, and append the real assignment to a created()
// hook. Files that already declare created() are reported and skipped for manual
// merge, since blindly inserting a second hook would be wrong.
//
// Usage: node stuff/vue-compat/defer-prop-field-init.mjs <root>
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import ts from 'typescript';

const root = process.argv[2] || 'frontend/www/js';
const files = execSync(
  `grep -rl "from 'vue-facing-decorator'" --include="*.vue" ${root}`,
  { encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean);

const SCRIPT_RE = /(<script lang="ts">\n)([\s\S]*?)(\n<\/script>)/;

function defaultForType(typeNode) {
  if (!typeNode) return 'undefined';
  const t = typeNode.getText();
  if (/\bboolean\b/.test(t)) return 'false';
  if (/\bnumber\b/.test(t)) return '0';
  if (/\bstring\b/.test(t)) return "''";
  if (/\[\]$/.test(t) || /^Array</.test(t)) return '[]';
  if (/\bnull\b/.test(t)) return 'null';
  return 'undefined';
}

const skipped = [];
let changed = 0;

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  const m = original.match(SCRIPT_RE);
  if (!m) continue;
  const scriptBody = m[2];

  const sf = ts.createSourceFile(
    'c.ts',
    scriptBody,
    ts.ScriptTarget.ES2019,
    true,
  );

  // Find the component class and its declared @Prop/@Ref/@Inject names.
  let cls = null;
  sf.forEachChild((n) => {
    if (ts.isClassDeclaration(n)) cls = n;
  });
  if (!cls) continue;

  const specialProps = new Set();
  for (const member of cls.members) {
    const decs = ts.canHaveDecorators(member)
      ? ts.getDecorators(member) || []
      : [];
    const isSpecial = decs.some((d) => {
      const e = d.expression;
      const name = ts.isCallExpression(e)
        ? e.expression.getText(sf)
        : e.getText(sf);
      return name === 'Prop' || name === 'Ref' || name === 'Inject';
    });
    if (isSpecial && member.name) specialProps.add(member.name.getText(sf));
  }
  if (specialProps.size === 0) continue;

  // Collect prop-referencing field initializers (edits by text slice).
  const edits = []; // { start, end, replacement, assignment }
  for (const member of cls.members) {
    if (!ts.isPropertyDeclaration(member) || !member.initializer) continue;
    const decs = ts.canHaveDecorators(member)
      ? ts.getDecorators(member) || []
      : [];
    if (decs.length) continue; // skip decorated (prop) declarations themselves
    const initText = member.initializer.getText(sf);
    const refsProp = [...specialProps].some((p) =>
      new RegExp('this\\.' + p + '\\b').test(initText),
    );
    if (!refsProp) continue;
    const fieldName = member.name.getText(sf);
    edits.push({
      start: member.initializer.getStart(sf),
      end: member.initializer.getEnd(),
      replacement: defaultForType(member.type),
      assignment: `    this.${fieldName} = ${initText};`,
    });
  }
  if (edits.length === 0) continue;

  const hasCreated = cls.members.some(
    (mm) => ts.isMethodDeclaration(mm) && mm.name.getText(sf) === 'created',
  );
  if (hasCreated) {
    skipped.push(`${file} (existing created(), merge ${edits.length} by hand)`);
    continue;
  }

  // Apply initializer replacements back-to-front to keep offsets valid.
  let body = scriptBody;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) {
    body = body.slice(0, e.start) + e.replacement + body.slice(e.end);
  }

  // Insert a created() hook right after the class opening brace.
  const assignments = edits.map((e) => e.assignment).join('\n');
  const createdHook = [
    '',
    '  created() {',
    '    // Props are not bound when class field initializers run under',
    '    // vue-facing-decorator, so prop-derived fields are assigned here.',
    assignments,
    '  }',
  ].join('\n');

  const classOpenRe = new RegExp(
    `(class\\s+${cls.name.getText(sf)}\\s+extends\\s+Vue\\s*\\{)`,
  );
  body = body.replace(classOpenRe, `$1${createdHook}`);

  const next = original.replace(SCRIPT_RE, `$1${body}$3`);
  writeFileSync(file, next);
  changed += 1;
}

console.log(`deferred prop field init in ${changed} files`);
for (const s of skipped) console.log(`  skip: ${s}`);
