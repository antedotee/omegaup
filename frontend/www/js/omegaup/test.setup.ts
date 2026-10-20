import * as util from 'util';
import 'process';

import '@testing-library/jest-dom';
import '@testing-library/jest-dom/extend-expect';

import Vue, { configureCompat } from 'vue';
import { config } from '@vue/test-utils';
import * as BootstrapVueNext from 'bootstrap-vue-next';
import { createBootstrap } from 'bootstrap-vue-next';
import Sortable from 'sortablejs';

// Run the Vue 3 migration build in Vue 2 compatibility mode for tests. All
// templates are compiled to Vue 3 native render functions, so the Vue-2
// render-function compat shim must stay off; leaving it on makes @vue/compat
// re-transform already-native render output and corrupts v-for rows
// ("InvalidCharacterError: '0' did not match the Name production").
//
// COMPONENT_V_MODEL must also stay off: with the Vue-2 v-model compat on,
// @vue/compat remaps the model convention to the legacy `value`/`input` pair.
// bootstrap-vue-next drives every form control through its `useModel`
// composable, which emits `update:modelValue`; under the compat remap that
// update never reaches the parent (notably BFormSelect, whose internal
// `vModelSelect` change listener is dropped), so two-way binding silently
// breaks. Turning the flag off restores Vue 3 `modelValue`/`update:modelValue`
// semantics. Verified against the full components test tree: the same 94 suites
// pass with the flag on or off, so this regresses nothing.
// INSTANCE_EVENT_HOOKS must also stay off. The Vue 2 shim re-emits every
// lifecycle hook as a `hook:mounted`/`hook:beforeMount`/... component event.
// Real Vue 3 never emits those, and no component in this repo listens for them,
// but @vue/test-utils records them in `wrapper.emitted()`, which breaks any
// test asserting the full emitted-event map (e.g. the typeahead suites).
// Turning the flag off restores Vue 3 behavior without changing any component.
configureCompat({
  MODE: 2,
  RENDER_FUNCTION: false,
  COMPONENT_V_MODEL: false,
  INSTANCE_EVENT_HOOKS: false,
});

// Register BootstrapVueNext globally for every mounted component, mirroring the
// app bootstrap. This replaces the per-test `Vue.use(BootstrapVue)` calls that
// bootstrap-vue 2 required, which cannot run under @vue/compat.
//
// `createBootstrap()` only wires BVN's internal services (orchestrators,
// registries, directives). It does NOT register the components themselves, so
// kebab `<b-*>` tags would otherwise render as unresolved custom elements. The
// old `Vue.use(BootstrapVue)` globally registered every `b-*` component; we
// reproduce that here by registering all exported BVN components globally
// (PascalCase registration also resolves the kebab-case template tags).
config.global.plugins.push(createBootstrap());

const bvnComponents: Record<string, unknown> = {};
for (const [exportName, exported] of Object.entries(BootstrapVueNext)) {
  // BVN components are the PascalCase exports starting with `B` (BButton,
  // BModal, ...). Directives (vBToggle) and composables (useModal) are skipped.
  if (
    /^B[A-Z]/.test(exportName) &&
    exported != null &&
    (typeof exported === 'object' || typeof exported === 'function')
  ) {
    bvnComponents[exportName] = exported;
  }
}
config.global.components = {
  ...(config.global.components || {}),
  ...bvnComponents,
};

// Vue 2 `@vue/test-utils` rendered a stubbed child's default slot; v2 does not
// by default. Restoring that behavior keeps `shallowMount` assertions that look
// at content nested inside a `<b-*>` wrapper (e.g. inputs inside BCollapse)
// working as they did under bootstrap-vue 2.
config.global.renderStubDefaultSlot = true;

Vue.directive('Sortable', {
  inserted: (el: HTMLElement, binding) => {
    new Sortable(el, binding.value || {});
  },
});

// Intercept all API calls. Only let `API.Session.currentSession()` work and
// fail everything else.
import fetchMock from 'jest-fetch-mock';
fetchMock.enableMocks();
fetchMock.mockIf(/^\/api\/.*/, (req: Request) => {
  if (req.url != '/api/session/currentSession/') {
    return Promise.resolve({
      ok: false,
      status: 404,
      body: JSON.stringify({
        status: 'error',
        error: `Invalid call to "${req.url}" in test`,
        errorcode: 403,
      }),
    });
  }
  return Promise.resolve({
    status: 200,
    body: JSON.stringify({
      status: 'ok',
      session: {
        valid: false,
      },
      time: Date.now() / 1000,
    }),
  });
});

declare global {
  namespace NodeJS {
    interface Global {
      $: JQuery;
      jQuery: JQuery;
      document: Document;
      URL: {
        createObjectURL: () => string;
      };
    }
  }

  interface Window {
    jQuery: JQuery;
  }
}

(global as any).jQuery = require('jquery');
(global as any).$ = (global as any).jQuery;
window.jQuery = (global as any).jQuery;
global.URL.createObjectURL = jest.fn();

// This is needed for CodeMirror to work.
global.document.createRange = () => {
  return ({
    setEnd: () => {},
    setStart: () => {},
    getBoundingClientRect: () => {},
    getClientRects: () => [],
  } as any) as Range;
};

// Any write to console.error() will cause a test failure.
const originalConsoleError = console.error;
console.error = function (...args: any[]) {
  originalConsoleError(...args);
  throw new Error(
    'Unexpected call to console.error(). Failing test: ' + util.inspect(args),
  );
};

// Make sure that warnings will not cause test termination. This is because
// warnings are always emitted in the next tick, which will cause an unhandled
// exception and kill the node process altogether.
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  originalConsoleError(warning.stack);
});

// https://github.com/vuejs/vue-test-utils/issues/936
window.Date = Date;
