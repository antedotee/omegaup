// Jest transformer for Vue single-file components under the Vue 3 migration
// build (@vue/compat).
//
// The hard constraint: @vue/vue3-jest and vue-jest@5 both compile a
// `<script lang="ts">` block with a TypeScript transpile hardcoded to an ES5
// target. ES5 down-levels native classes to functions, which breaks
// vue-facing-decorator (a down-leveled class cannot `extends Vue` and throws
// "Class constructors cannot be invoked without 'new'"). But @vue/vue3-jest
// also does the template + @vue/compat wiring correctly, matching the
// production vue-loader path. We want its template handling without its ES5
// script handling.
//
// Strategy: pre-transpile only the <script> block with TypeScript at a
// class-preserving target (ES2019), rewrite the SFC so the script is now plain
// JavaScript (drop lang="ts"), and delegate the whole SFC to @vue/vue3-jest.
// vue3-jest then compiles the template and wires compat exactly as in
// production, and skips its ES5 TypeScript pass because the script is no longer
// TypeScript.
const typescript = require('typescript');
const babel = require('@babel/core');
const { parse } = require('@vue/compiler-sfc');
const vue3jest = require('@vue/vue3-jest').default || require('@vue/vue3-jest');

function transpileScript(code, filename) {
  return typescript.transpileModule(code, {
    fileName: filename,
    compilerOptions: {
      target: typescript.ScriptTarget.ES2019,
      module: typescript.ModuleKind.ESNext,
      experimentalDecorators: true,
      useDefineForClassFields: false,
      importHelpers: false,
      verbatimModuleSyntax: false,
      isolatedModules: true,
    },
  }).outputText;
}

function process(sourceText, sourcePath, options) {
  const { descriptor } = parse(sourceText, { filename: sourcePath });
  const block = descriptor.script || descriptor.scriptSetup;

  let rewritten = sourceText;
  if (block && /tsx?/.test(block.lang || '')) {
    const js = transpileScript(block.content, sourcePath + '.ts');
    // The descriptor offsets bound the script *content* (between the tags).
    // Swap the content for its transpiled JavaScript, then drop lang="ts" from
    // the enclosing <script> tag so vue3-jest treats the block as JavaScript and
    // skips its ES5 TypeScript pass.
    const before = sourceText.slice(0, block.loc.start.offset);
    const after = sourceText.slice(block.loc.end.offset);
    const beforeNoLang = before.replace(
      /(<script\b[^>]*?)\s+lang=(?:"tsx?"|'tsx?'|tsx?)([^>]*>)(\s*)$/,
      '$1$2$3',
    );
    rewritten = `${beforeNoLang}\n${js}\n${after}`;
  }

  const result = vue3jest.process(rewritten, sourcePath, options);
  const code = typeof result === 'string' ? result : result.code;

  // vue3-jest may leave ES module syntax (import/export) in place. Jest runs on
  // CommonJS, so normalize the combined script + render output to CJS.
  const { code: cjs } = babel.transform(code, {
    babelrc: false,
    configFile: false,
    filename: sourcePath + '.js',
    sourceType: 'module',
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });

  return { code: cjs };
}

module.exports = { process };
