// Example tests for scan-core.cjs (design 5, Requirement 7).
'use strict';
const { scanText, rawMatches, applyAllowlist } = require('../scan-core.cjs');

const VUE = 'frontend/www/js/omegaup/components/Sample.vue';
const CY = 'cypress/e2e/sample.cy.ts';
const TS = 'frontend/www/js/omegaup/sample.ts';

const brief = (ms) =>
  ms.map(({ line, token, category }) => ({ line, token, category }));

describe('scanText: one instance per category', () => {
  test('bs4-class in a .vue template, with its line', () => {
    const text =
      '<template>\n  <div>\n    <span class="ml-2 badge-layer">x</span>\n  </div>\n</template>\n';
    expect(brief(scanText(VUE, text))).toEqual([
      { line: 3, token: 'ml-2', category: 'bs4-class' },
    ]);
  });

  test('bs4-class from an unresolved entry (Removal_Map manual)', () => {
    const text = '<template>\n  <div class="jumbotron">x</div>\n</template>\n';
    expect(brief(scanText(VUE, text))).toEqual([
      { line: 2, token: 'jumbotron', category: 'bs4-class' },
    ]);
  });

  test('bs4-class in a multi-line rewritten span uses the token line', () => {
    const scss = '.a,\n.b .ml-2,\n.c .float-left {\n  color: red;\n}\n';
    expect(brief(scanText('frontend/www/sass/_x.scss', scss))).toEqual([
      { line: 2, token: 'ml-2', category: 'bs4-class' },
      { line: 3, token: 'float-left', category: 'bs4-class' },
    ]);
  });

  test('bs4-class in a selector string and an SCSS selector', () => {
    expect(brief(scanText(CY, "cy.get('.float-right').click();\n"))).toEqual([
      { line: 1, token: 'float-right', category: 'bs4-class' },
    ]);
    const scss =
      '.x {\n  border-left: 1px solid;\n}\n.a .text-left {\n  color: red;\n}\n';
    expect(brief(scanText('frontend/www/sass/_x.scss', scss))).toEqual([
      { line: 4, token: 'text-left', category: 'bs4-class' },
    ]);
  });

  test('bs4-data-attribute: static, : and v-bind: in .vue; data-bs-* too', () => {
    const text = [
      '<template>',
      '  <div>',
      '    <button data-toggle="collapse">a</button>',
      '    <button :data-target="t">b</button>',
      '    <button v-bind:data-dismiss="d">c</button>',
      '    <button data-bs-toggle="modal">d</button>',
      '  </div>',
      '</template>',
      '',
    ].join('\n');
    expect(brief(scanText(VUE, text))).toEqual([
      { line: 3, token: 'data-toggle', category: 'bs4-data-attribute' },
      { line: 4, token: 'data-target', category: 'bs4-data-attribute' },
      { line: 5, token: 'data-dismiss', category: 'bs4-data-attribute' },
      { line: 6, token: 'data-bs-toggle', category: 'bs4-data-attribute' },
    ]);
  });

  test('bs4-data-attribute: Cypress attribute selector in a string literal', () => {
    const text =
      'declare const cy: any;\ncy.get(\'[data-target=".access"]\').click();\n';
    expect(brief(scanText('cypress/support/commands.ts', text))).toEqual([
      { line: 2, token: 'data-target', category: 'bs4-data-attribute' },
    ]);
  });

  test('component-bs-import in .ts and .vue', () => {
    expect(
      brief(scanText(TS, "import 'bootstrap/dist/css/bootstrap.min.css';\n")),
    ).toEqual([
      {
        line: 1,
        token: 'bootstrap/dist/css/bootstrap.min.css',
        category: 'component-bs-import',
      },
    ]);
    const vue =
      '<template><div></div></template>\n<script lang="ts">\nimport \'bootstrap/dist/css/bootstrap.css\';\nexport default {};\n</script>\n';
    expect(brief(scanText(VUE, vue))).toEqual([
      {
        line: 3,
        token: 'bootstrap/dist/css/bootstrap.css',
        category: 'component-bs-import',
      },
    ]);
  });

  test('jquery-bs-plugin-call through parens and as casts', () => {
    const text = [
      'declare const $: any;',
      "$(ev.target as HTMLElement).popover('show');",
      "($(navbarCollapse) as any).collapse('hide');",
      "jQuery('#m').find('.x').modal('hide');",
      '',
    ].join('\n');
    expect(brief(scanText(TS, text))).toEqual([
      { line: 2, token: 'popover', category: 'jquery-bs-plugin-call' },
      { line: 3, token: 'collapse', category: 'jquery-bs-plugin-call' },
      { line: 4, token: 'modal', category: 'jquery-bs-plugin-call' },
    ]);
  });

  test('vendored-bs4-ref anywhere, including out-of-scope files', () => {
    expect(
      brief(
        scanText(
          'webpack.config-frontend.js',
          "const a = 'third_party/bootstrap-4.5.0/css';\n",
        ),
      ),
    ).toEqual([
      { line: 1, token: 'bootstrap-4.5.0', category: 'vendored-bs4-ref' },
    ]);
    expect(
      brief(
        scanText(
          'frontend/templates/template.tpl',
          '<p></p>\n<link href="/third_party/bootstrap-4.5.0/x.css">\n',
        ),
      ),
    ).toEqual([
      { line: 2, token: 'bootstrap-4.5.0', category: 'vendored-bs4-ref' },
    ]);
  });

  test('sfc-sass-entry-import guard', () => {
    const text =
      '<template><div></div></template>\n<style lang="scss" scoped>\n@import \'../../../../sass/main.scss\';\n</style>\n';
    expect(brief(scanText(VUE, text))).toEqual([
      {
        line: 3,
        token: '../../../../sass/main.scss',
        category: 'sfc-sass-entry-import',
      },
    ]);
    const site = text.replace('sass/main.scss', 'sass/site');
    expect(scanText(VUE, site)).toEqual([]);
  });

  test('an unparseable .vue file is a parse-error match, never a pass', () => {
    const ms = scanText(VUE, '<template><div></template>\n');
    expect(ms.map((m) => m.category)).toEqual(['parse-error']);
  });
});

describe('scanText: decoys', () => {
  test('template decoys produce no matches', () => {
    const text = [
      '<template>',
      '  <div>',
      '    <span class="badge-layer panel-heading">x</span>',
      '    <button data-toggle-layout-sidebar @click="closeModal">x</button>',
      '    <div data-content-tab="runs"></div>',
      '  </div>',
      '</template>',
      '<script lang="ts">',
      'declare const $: any;',
      'const closeModal = (): void => {};',
      "$('#x').hide();",
      "this.$emit('close');",
      '</script>',
      '<style lang="scss" scoped>',
      '.panel-heading {',
      '  border-left: 1px solid #ccc;',
      '}',
      '</style>',
      '',
    ].join('\n');
    expect(scanText(VUE, text)).toEqual([]);
  });

  test('Cypress and TS decoys produce no matches', () => {
    const text = [
      'declare const cy: any;',
      'declare const $: any;',
      "cy.get('[data-toggle-layout-sidebar]').click();",
      'cy.get(\'[data-content-tab="runs"]\').click();',
      "cy.get('.panel-heading').should('be.visible');",
      "$('#x').hide();",
      "$('#x').on('close', closeModal);",
      'channel.close();',
      "el.style.borderLeft = '1px solid';",
      '',
    ].join('\n');
    expect(scanText(CY, text)).toEqual([]);
  });

  test('plugin names on non-jQuery receivers are not matches', () => {
    const text =
      "this.$refs.modal.show();\nwrapper.vm.tooltip('x');\nconst m = modal('a');\n";
    expect(scanText(TS, text)).toEqual([]);
  });

  test('out-of-scope paths get only the vendored-bs4-ref check', () => {
    const text = '<div class="ml-2"></div>\n';
    expect(scanText('frontend/www/third_party/x/a.html', text)).toEqual([]);
  });
});

describe('allowlist', () => {
  const text = "declare const el: any;\nconst s = 'close';\n";
  test('the codemod fallback reports the literal; an entry suppresses it', () => {
    expect(brief(scanText(TS, text))).toEqual([
      { line: 2, token: 'close', category: 'bs4-class' },
    ]);
    const allowlist = [{ path: TS, line: 2, token: 'close', reason: 'x' }];
    expect(scanText(TS, text, { allowlist })).toEqual([]);
  });

  test('applyAllowlist reports which entries were used', () => {
    const allowlist = [
      { path: TS, line: 2, token: 'close' },
      { path: TS, line: 9, token: 'close' },
    ];
    const { matches, used } = applyAllowlist(rawMatches(TS, text), allowlist);
    expect(matches).toEqual([]);
    expect([...used]).toEqual([0]);
  });
});
