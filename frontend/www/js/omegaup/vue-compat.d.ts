// Type definitions for the Vue 3 migration build (@vue/compat) exposed under
// the bare `vue` specifier.
//
// @vue/compat ships types at dist/vue-compat.d.ts but has no `types` field in
// its package.json, so TypeScript treats `vue` as untyped. The repo's code
// imports Vue both as a default (`import Vue from 'vue'`) and as named helpers.
// This module re-exports the compat runtime types and adds the default export
// that Vue 2 code relies on. It is wired in via tsconfig `paths` ("vue" -> this
// file).
import { CompatVue, h } from '@vue/runtime-dom';

declare const Vue: CompatVue;
export default Vue;
export * from '@vue/runtime-dom';
export const configureCompat: CompatVue['configureCompat'];

// Vue 2's render functions received a `createElement` helper (often aliased
// `h`). Under the Vue 3 migration build the equivalent is the global `h`. The
// legacy entry points still declare `render(createElement: CreateElement)`, so
// expose that name as the type of `h` for a drop-in annotation.
export type CreateElement = typeof h;
