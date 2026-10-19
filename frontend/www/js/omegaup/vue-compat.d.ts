// Vue 3 migration build (@vue/compat) type augmentation.
//
// Vue 3 removed the default export that Vue 2 code relies on (`import Vue from
// 'vue'`). The migration build still provides it at runtime, so re-expose it to
// TypeScript along with `configureCompat`. This module declaration must sit in a
// `.d.ts` that has at least one other top-level import/export so it augments the
// `vue` module instead of overwriting it.
export {};

declare module 'vue' {
  import { CompatVue } from '@vue/runtime-dom';
  const Vue: CompatVue;
  export default Vue;
  export * from '@vue/runtime-dom';
  const { configureCompat } = Vue;
  export { configureCompat };
}
