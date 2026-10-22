// Example-based tests for core.cjs (design 3.2).
'use strict';

const {
  DETAIL,
  isBs4Class,
  rewriteClassList,
  rewriteSelector,
} = require('../core.cjs');
const { RENAME_MAP, REMOVAL_MAP, BS4_KEYS } = require('../maps.cjs');

const cl = (v, ctx) => rewriteClassList(v, ctx).value;
const sel = (v) => rewriteSelector(v).value;

describe('isBs4Class', () => {
  test('matches map keys only, as whole tokens', () => {
    expect(isBs4Class('ml-2')).toBe(true);
    expect(isBs4Class('form-group')).toBe(true);
    expect(isBs4Class('close')).toBe(true);
    expect(isBs4Class('close-button')).toBe(false);
    expect(isBs4Class('form-group-title')).toBe(false);
    expect(isBs4Class('ms-2')).toBe(false);
  });

  test('no BS5 output token is itself a BS4 key', () => {
    const produced = [
      ...Object.values(RENAME_MAP).flat(),
      ...Object.values(REMOVAL_MAP).flatMap((e) => e.tokens || []),
    ];
    expect(produced.filter((t) => BS4_KEYS.has(t))).toEqual([]);
  });
});

describe('rewriteClassList', () => {
  test('renames tokens and keeps separators', () => {
    expect(cl('btn ml-2\n  text-right')).toBe('btn ms-2\n  text-end');
    expect(cl('  mr-md-auto  ')).toBe('  me-md-auto  ');
  });

  test('custom-control custom-switch -> form-check form-switch once', () => {
    const r = rewriteClassList('custom-control custom-switch');
    expect(r.value).toBe('form-check form-switch');
    expect(r.replacements).toEqual([
      { from: 'custom-control', to: ['form-check'], entry: 'custom-control' },
      { from: 'custom-switch', to: ['form-switch'], entry: 'custom-switch' },
    ]);
  });

  test('row form-row -> row g-2', () => {
    expect(cl('row form-row')).toBe('row g-2');
    expect(cl('form-row row')).toBe('g-2 row');
    expect(cl('form-row')).toBe('row g-2');
  });

  test('fully deduped token is removed with one adjacent separator', () => {
    expect(cl('mb-3 form-group')).toBe('mb-3');
    expect(cl('form-group mb-3 x')).toBe('mb-3 x');
    expect(cl('a\n  embed-responsive-item\n  b')).toBe('a\n  b');
    expect(cl('embed-responsive embed-responsive-item')).toBe('ratio');
  });

  test('input duplicates are left alone', () => {
    expect(cl('btn btn ml-1')).toBe('btn btn ms-1');
  });

  test('substring tokens are untouched', () => {
    const r = rewriteClassList('close-button form-group-title badge-layer');
    expect(r.value).toBe('close-button form-group-title badge-layer');
    expect(r.replacements).toEqual([]);
    expect(r.unresolved).toEqual([]);
  });

  test('btn-block depends on stackedBlock', () => {
    expect(cl('btn btn-block')).toBe('btn w-100');
    const r = rewriteClassList('btn btn-block', { stackedBlock: true });
    expect(r.value).toBe('btn btn-block');
    expect(r.unresolved).toEqual([
      {
        token: 'btn-block',
        reason: 'manual-conversion',
        detail: DETAIL.stackedBlock,
      },
    ]);
  });

  test('unwrap and manual keys stay in place and are reported', () => {
    const r = rewriteClassList('input-group-append form-inline mr-2');
    expect(r.value).toBe('input-group-append form-inline me-2');
    expect(r.unresolved).toEqual([
      {
        token: 'input-group-append',
        reason: 'manual-conversion',
        detail: DETAIL.unwrap,
      },
      {
        token: 'form-inline',
        reason: 'manual-conversion',
        detail: DETAIL.manual,
      },
    ]);
  });

  test('dark-text badges', () => {
    expect(cl('badge badge-warning')).toBe('badge bg-warning text-dark');
    expect(cl('text-dark badge-light')).toBe('text-dark bg-light');
  });

  test.each([
    'custom-control custom-switch',
    'row form-row',
    'btn btn-block ml-2',
    ' form-group  mb-3\n',
    'badge badge-warning badge-pill',
    'media input-group-prepend sr-only',
  ])('idempotent: %j', (x) => {
    const once = rewriteClassList(x).value;
    const twice = rewriteClassList(once);
    expect(twice.value).toBe(once);
    expect(twice.replacements).toEqual([]);
  });
});

describe('rewriteSelector', () => {
  test('.ml-2.text-right -> .ms-2.text-end', () => {
    const r = rewriteSelector('.ml-2.text-right');
    expect(r.value).toBe('.ms-2.text-end');
    expect(r.replacements.map((x) => x.entry)).toEqual(['ml-2', 'text-right']);
  });

  test('.form-group > label is unresolved and unchanged', () => {
    const r = rewriteSelector('.form-group > label');
    expect(r.value).toBe('.form-group > label');
    expect(r.replacements).toEqual([]);
    expect(r.unresolved).toEqual([
      {
        token: 'form-group',
        reason: 'manual-review',
        detail: DETAIL.selectorRemoval,
      },
    ]);
  });

  test('preserves whitespace and comments byte for byte', () => {
    const input =
      '.ml-2 /* keep  me */ >   .text-right ,\n\t  .x:not(.mr-1)  ~ a';
    expect(sel(input)).toBe(
      '.ms-2 /* keep  me */ >   .text-end ,\n\t  .x:not(.me-1)  ~ a',
    );
  });

  test('whole-token only and nesting selector', () => {
    expect(sel('.close-button, .close')).toBe('.close-button, .btn-close');
    expect(sel('&.float-left:hover')).toBe('&.float-start:hover');
  });

  test('dedupes within a compound only', () => {
    expect(sel('.form-check.custom-switch')).toBe('.form-check.form-switch');
    expect(sel('.form-check .custom-switch')).toBe(
      '.form-check .form-check.form-switch',
    );
  });

  test('dropped-class and interpolation cases are reported, not changed', () => {
    const a = rewriteSelector('.embed-responsive-item');
    expect(a.value).toBe('.embed-responsive-item');
    expect(a.unresolved[0].detail).toBe(DETAIL.selectorDropped);
    const b = rewriteSelector('.ml-2#{$x}');
    expect(b.value).toBe('.ml-2#{$x}');
    expect(b.unresolved[0]).toMatchObject({
      token: 'ml-2',
      reason: 'manual-review',
    });
  });

  test.each([
    '.ml-2.text-right',
    '.form-check.custom-control.custom-switch',
    '.a /* c */ > .badge-warning',
    '.form-group > label',
  ])('idempotent: %j', (x) => {
    const once = sel(x);
    const twice = rewriteSelector(once);
    expect(twice.value).toBe(once);
    expect(twice.replacements).toEqual([]);
  });
});
