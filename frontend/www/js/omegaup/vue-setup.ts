// Runtime setup shared by every entry point (through omegaup.ts) and by
// test.setup.ts, so production and jest run the same Vue configuration.
import Vue, {
  type Component,
  type ComponentPublicInstance,
  type Plugin,
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
  // The Vue 2 deep merge of `data` follows every nested plain object. Class
  // components built on vue-class-component (vue-slider-component) collect
  // the internal instance `_` into their data, whose vnode/component graph is
  // cyclic, so the deep merge never ends. Use Vue 3's shallow merge; no app
  // component merges `data` from mixins or `extends`.
  OPTIONS_DATA_MERGE: false,
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
// `new Vue` root gets its own app. Install it on every root's app before its
// children are created.
//
// Vuex 4 no longer reads the Vue 2 `store` component option, which the app
// sets on a root (problem/creator/creator.ts) and on an embedded component
// (CreatorWrapper.vue). Install that store on the component's app, which is
// how Vuex 4 provides `$store`, before the component's children are created.
Vue.mixin({
  beforeCreate(this: ComponentPublicInstance) {
    const app = this.$.appContext.app;
    if (this.$.parent === null) {
      app.use(createBootstrap());
    }
    const store = (this.$.type as { store?: Plugin }).store;
    if (store && app.config.globalProperties.$store !== store) {
      app.use(store);
    }
  },
});
