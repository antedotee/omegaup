// Jest transformer for Vue single-file components under the Vue 3 migration
// build (@vue/compat).
//
// Why this exists: both @vue/vue3-jest and vue-jest@5 hardcode a TypeScript
// transpile target of ES5 for `<script lang="ts">`, and their babel fallback
// ignores custom presets so it cannot even parse decorators. ES5 down-levels
// native classes to functions, which breaks vue-facing-decorator (a
// down-leveled class cannot `extends Vue` and throws "Class constructors cannot
// be invoked without 'new'"). This transformer compiles the template with
// @vue/compiler-sfc in compat (MODE 2) mode and the script with Babel using a
// class-preserving target (Node current), the same pipeline the .ts tests use.
//
// It supports what this project uses: `<script lang="ts">` Options-API class
// components (vue-facing-decorator) plus a `<template>`.
const crypto = require('crypto');
const { parse, compileTemplate } = require('@vue/compiler-sfc');
const babel = require('@babel/core');

const COMPAT_CONFIG = { MODE: 2 };

const babelOptions = {
  babelrc: false,
  configFile: false,
  presets: [
    [
      '@babel/preset-env',
      { targets: { node: 'current' }, modules: 'commonjs' },
    ],
    ['@babel/preset-typescript', { allowNamespaces: true }],
  ],
  plugins: [
    '@babel/plugin-transform-async-to-generator',
    ['@babel/plugin-proposal-decorators', { version: 'legacy' }],
    ['@babel/plugin-proposal-class-properties', { loose: true }],
  ],
};

function process(sourceText, sourcePath) {
  const { descriptor } = parse(sourceText, { filename: sourcePath });
  const id = crypto
    .createHash('md5')
    .update(sourcePath)
    .digest('hex')
    .slice(0, 8);

  const scriptBlock = descriptor.script || descriptor.scriptSetup;
  const scriptSource = scriptBlock ? scriptBlock.content : 'export default {}';

  // Compile the <template> to a compat-mode render function.
  let templateCode = '';
  if (descriptor.template) {
    const compiled = compileTemplate({
      id,
      source: descriptor.template.content,
      filename: sourcePath,
      compilerOptions: { compatConfig: COMPAT_CONFIG },
    });
    templateCode = compiled.code.replace(
      'export function render',
      'function render',
    );
  }

  // The script exports the component options as its default export. Capture it,
  // attach the render function, and re-export.
  const combined = [
    scriptSource,
    templateCode,
    descriptor.template
      ? 'if (typeof __default__ !== "undefined" && __default__) { __default__.render = render; }'
      : '',
    'export default __default__;',
  ].join('\n');

  // Rename the SFC's `export default X` to a capturable binding before Babel
  // turns ESM into CommonJS, so the template render function can be attached.
  const normalized = combined.replace(
    /export default (?!__default__)/,
    'const __default__ = ',
  );

  const { code } = babel.transform(normalized, {
    ...babelOptions,
    filename: sourcePath + '.ts',
  });

  return { code };
}

module.exports = { process };
