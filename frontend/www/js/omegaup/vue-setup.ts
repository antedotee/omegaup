// Runtime setup shared by every entry point (through omegaup.ts) and by
// test.setup.ts, so production and jest run the same Vue configuration.
import Vue, {
  type Component,
  type ComponentPublicInstance,
  configureCompat,
} from 'vue';
import * as BootstrapVueNext from 'bootstrap-vue-next';
import { createBootstrap } from 'bootstrap-vue-next';

configureCompat({
  // bootstrap-vue-next and its reka-ui primitives are Vue 3 libraries. In Vue 2
  // mode the legacy v-model shim rewrites `modelValue`/`update:modelValue` to
  // `value`/`input`, which breaks every BVN two-way binding (BModal,
  // BFormSelect and its internal BFormSelectBase, BTabs, ...). They are
  // compiled `<script setup>` components, which carry `__name`; no app SFC or
  // Vue 2 library uses `<script setup>`, so run exactly those in Vue 3 mode.
  MODE: (comp: Component | null) => (comp && '__name' in comp ? 3 : 2),
  // The Vue 2 shim re-emits every lifecycle hook as a `hook:*` event. Nothing
  // in the app or its Vue 2 libraries listens for them.
  INSTANCE_EVENT_HOOKS: false,
  // Element attributes are checked against the component whose subtree
  // renders them, so markup slotted into a Vue 3 mode BVN component reports
  // enumerated-attribute coercion as disabled. Every enumerated attribute in
  // the app and its libraries is a static "true"/"false" string, which renders
  // the same with or without coercion, so keep it on everywhere, unwarned.
  ATTR_ENUMERATED_COERCION: 'suppress-warning',
});

// Register every BVN component globally so kebab `<b-*>` tags resolve the way
// `Vue.use(BootstrapVue)` did.
for (const [name, exported] of Object.entries(BootstrapVueNext)) {
  if (
    !/^B[A-Z]/.test(name) ||
    exported == null ||
    (typeof exported !== 'object' && typeof exported !== 'function')
  ) {
    continue;
  }
  Vue.component(name, exported as Component);
}

// `createBootstrap()` installs through `app.provide`, which the compat
// `Vue.use` cannot reach: it hands plugins the global constructor, and each
// `new Vue` root gets its own app whose provides are not inherited. Install it
// on every root's app before its children are created instead.
Vue.mixin({
  beforeCreate(this: ComponentPublicInstance) {
    if (this.$.parent === null) {
      this.$.appContext.app.use(createBootstrap());
    }
  },
});
