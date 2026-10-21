// Shared legacy event bus extracted from Navbar.vue so that plain `.ts` entry
// points (login/signin.ts) can import it. fork-ts-checker resolves `.vue`
// modules only through the ambient `declare module '*.vue'` shim, which exposes
// just the default export, so a named import from the SFC fails type-checking.
//
// The bus needs the Vue 2 `$on`/`$emit`/`$off` surface, which the Vue 3
// migration build keeps on a runtime instance under the INSTANCE_EVENT_EMITTER
// compat flag, so it is built from the actual runtime import. Both Navbar.vue
// and the entry point import this single module, so they share one instance;
// no runtime behavior change.
import VueRuntime from 'vue';

export const EventBus = new VueRuntime();
