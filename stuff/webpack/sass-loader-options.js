// Shared sass-loader options for webpack.config-style.js and
// webpack.config-frontend.js.
//
// Bootstrap 5.3's Sass sources still use `@import`, global built-in
// functions and legacy color functions, all of which Dart Sass 1.8x+ flags
// as deprecated. `quietDeps` hides warnings originating in node_modules;
// `silenceDeprecations` covers the same ids when they surface through our
// own entrypoints. `legacy-js-api` comes from sass-loader 12 using the
// legacy `render()` API.
//
// `mixed-decls` is intentionally omitted: it is obsolete as of Dart Sass
// 1.92.0, and silencing it makes Sass print an "obsolete" warning.
module.exports = {
  sassOptions: {
    quietDeps: true,
    silenceDeprecations: [
      'import',
      'global-builtin',
      'color-functions',
      'legacy-js-api',
    ],
  },
};
