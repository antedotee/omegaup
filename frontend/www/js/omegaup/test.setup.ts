import * as util from 'util';
import 'process';

import '@testing-library/jest-dom';
import '@testing-library/jest-dom/extend-expect';

import Vue, { configureCompat } from 'vue';
import { config } from '@vue/test-utils';
import { createBootstrap } from 'bootstrap-vue-next';
import Sortable from 'sortablejs';

// Run the Vue 3 migration build in Vue 2 compatibility mode for tests. All
// templates are compiled to Vue 3 native render functions, so the Vue-2
// render-function compat shim must stay off; leaving it on makes @vue/compat
// re-transform already-native render output and corrupts v-for rows
// ("InvalidCharacterError: '0' did not match the Name production").
configureCompat({ MODE: 2, RENDER_FUNCTION: false });

// Register BootstrapVueNext globally for every mounted component, mirroring the
// app bootstrap. This replaces the per-test `Vue.use(BootstrapVue)` calls that
// bootstrap-vue 2 required, which cannot run under @vue/compat.
config.global.plugins.push(createBootstrap());

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
