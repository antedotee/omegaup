// Single Babel pipeline for the Jest run. It compiles TypeScript (including SFC
// <script lang="ts"> via @vue/vue3-jest) and legacy decorators WITHOUT
// down-leveling native ES classes. Preserving native classes is required by
// vue-facing-decorator under the Vue 3 migration build (@vue/compat): a
// down-leveled class cannot `extends Vue` and throws "Class constructors cannot
// be invoked without 'new'".
//
// Two things make that work: targets.node 'current' (Node 24 has native
// classes, so preset-env does not transform them) and babelrc:false (the
// repo-root .babelrc targets old browsers and would force the down-level).
// @vue/vue3-jest is given babelConfig but NOT tsConfig on purpose; passing
// tsConfig makes it run a second TypeScript pass hardcoded to ES5.
const babelConfig = {
  babelrc: false,
  configFile: false,
  presets: [
    [
      '@babel/preset-env',
      {
        corejs: 3,
        modules: 'commonjs',
        useBuiltIns: 'entry',
        targets: {
          node: 'current',
        },
      },
    ],
    ['@babel/preset-typescript', { allowNamespaces: true }],
  ],
  plugins: [
    '@babel/plugin-transform-async-to-generator',
    ['@babel/plugin-proposal-decorators', { version: 'legacy' }],
    ['@babel/plugin-proposal-class-properties', { loose: true }],
  ],
};

module.exports = {
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['js', 'ts', 'vue'],
  moduleDirectories: ['node_modules'],
  moduleNameMapper: {
    'vue-async-computed-decorator':
      '<rootDir>/node_modules/vue-async-computed-decorator/dist/index.js',
    '^@/(.*)$': '<rootDir>/frontend/www/$1',
    '\\.(css|less)$':
      '<rootDir>/frontend/www/js/omegaup/__mocks__/styleMock.js',
    'monaco-editor':
      '<rootDir>/frontend/www/third_party/js/__mocks__/monacoEditor.js',
    sugar: '<rootDir>/frontend/www/js/omegaup/__mocks__/sugar.js',
    // Route the bare `vue` specifier to the Vue 3 migration build (compat).
    '^vue$': '<rootDir>/node_modules/@vue/compat/dist/vue.cjs.js',
  },
  setupFilesAfterEnv: ['<rootDir>/frontend/www/js/omegaup/test.setup.ts'],
  transform: {
    '.*\\.vue$':
      '<rootDir>/frontend/www/js/omegaup/vue-compat-jest-transformer.js',
    '.*\\.[jt]sx?$': ['babel-jest', babelConfig],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(vue-.*|@voerro/vue-tagsinput|monaco-editor|monaco-editor-core)/)',
  ],
  testEnvironmentOptions: {
    url: 'http://localhost:8001/',
  },
};
