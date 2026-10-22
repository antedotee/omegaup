// Example-based tests for adapters/markup.cjs (design 3.3, Requirements 5.2, 5.12).
'use strict';
const { markupEdits, MARKUP_DETAIL } = require('../adapters/markup.cjs');

function apply(text, edits) {
  let out = text;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  return out;
}
const run = (text, opts = { path: 'x.html' }) => {
  const r = markupEdits(text, opts);
  return { ...r, out: apply(text, r.edits) };
};

describe('markupEdits', () => {
  test('issues/index.html real shape: badge badge-primary', () => {
    const text = [
      '<table class="table table-striped" id="issues">',
      '\t<thead class="thead-inverse">',
      '\t\t<td><a class="badge badge-primary" v-bind:href="labelUrl(label)"',
      '\t\t  v-bind:style="labelStyle(label)" target="_blank">{{ label.name }}</a>&ensp;</td>',
      '</table>',
      '',
    ].join('\n');
    const { out, replacements, unresolved } = run(text, {
      path: 'frontend/www/issues/index.html',
    });
    expect(out).toBe(text.replace('badge badge-primary', 'badge bg-primary'));
    expect(replacements.map((r) => r.entry)).toEqual(['badge-primary']);
    expect(unresolved).toEqual([]);
  });

  test('single quotes, whitespace around =, mixed tokens', () => {
    const { out } = run("<div\n  class = 'form-group mr-2 text-right'></div>");
    expect(out).toBe("<div\n  class = 'mb-3 me-2 text-end'></div>");
  });

  test('template.tpl Twig class without BS4 token: no edit, no report', () => {
    const text =
      '<html lang="{{ LOCALE }}" class="h-100">\n' +
      '  <body class="d-flex flex-column h-100{% if OMEGAUP_LOCKDOWN %} lockdown{% endif %}">\n' +
      '    <main role="main" class="flex-grow-1{% if not fullWidth %} container-lg py-5 px-3 px-md-5{% endif %}">\n';
    const r = run(text, { path: 'frontend/templates/template.tpl' });
    expect(r.edits).toEqual([]);
    expect(r.unresolved).toEqual([]);
  });

  test('template value with BS4 token goes to manual-review, not edited', () => {
    const text =
      '<p></p>\n<div class="row{% if x %} mr-2{% endif %} ${y} ml-1"></div>\n';
    const r = run(text, { path: 'a.tpl' });
    expect(r.edits).toEqual([]);
    expect(r.unresolved).toEqual([
      {
        token: 'mr-2',
        reason: 'manual-review',
        detail: MARKUP_DETAIL.template,
        line: 2,
      },
      {
        token: 'ml-1',
        reason: 'manual-review',
        detail: MARKUP_DETAIL.template,
        line: 2,
      },
    ]);
  });

  test('bound Vue class with BS4 token goes to manual-review', () => {
    const r = run('<a\n v-bind:class="{ \'badge-primary\': on }">x</a>');
    expect(r.edits).toEqual([]);
    expect(r.unresolved).toEqual([
      {
        token: 'badge-primary',
        reason: 'manual-review',
        detail: MARKUP_DETAIL.bound,
        line: 2,
      },
    ]);
  });

  test('<style> body goes through the CSS adapter with file offsets and lines', () => {
    const text =
      '<html>\n<head>\n<style type="text/css">\n.x .ml-2 { color: red; }\n' +
      '.form-group { a: b; }\n</style>\n</head>\n<body class="ml-2"></body>\n';
    const r = run(text);
    expect(r.out).toBe(
      text
        .replace('.ml-2 {', '.ms-2 {')
        .replace('class="ml-2"', 'class="ms-2"'),
    );
    expect(r.unresolved).toEqual([
      expect.objectContaining({
        token: 'form-group',
        reason: 'manual-review',
        line: 5,
      }),
    ]);
    // class= inside the style body text is never treated as an attribute.
    expect(r.edits.every((e) => e.start < e.end)).toBe(true);
  });

  test('skips <script> bodies, HTML comments, and Twig comments', () => {
    const text = [
      '<!-- <div class="mr-2"></div> -->',
      '{# <div class="ml-2"></div> #}',
      '<script type="text/x-template">',
      '  const t = \'<div class="text-right"></div>\';',
      '</script>',
      '<!-- <script> -->',
      '<span class="sr-only">x</span>',
      '',
    ].join('\n');
    const r = run(text);
    expect(r.out).toBe(
      text.replace('class="sr-only"', 'class="visually-hidden"'),
    );
    expect(r.unresolved).toEqual([]);
  });

  test('Removal_Map manual tokens are reported with their line', () => {
    const r = run('<div>\n<form class="form-inline mr-1"></form>\n</div>');
    expect(r.out).toBe('<div>\n<form class="form-inline me-1"></form>\n</div>');
    expect(r.unresolved).toEqual([
      expect.objectContaining({
        token: 'form-inline',
        reason: 'manual-conversion',
        line: 2,
      }),
    ]);
  });

  test('near misses and non-class attributes are untouched', () => {
    const text =
      '<div data-class="mr-2" class="badge-layer close-button">mr-2</div>';
    const r = run(text);
    expect(r.edits).toEqual([]);
    expect(r.unresolved).toEqual([]);
  });
});
