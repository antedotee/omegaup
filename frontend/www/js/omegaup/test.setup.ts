import * as util from 'util';
import 'process';

import '@testing-library/jest-dom';
import '@testing-library/jest-dom/extend-expect';

import Vue from 'vue';
import { config } from '@vue/test-utils';
import Sortable from 'sortablejs';
import './vue-setup';
// Vue 2 `@vue/test-utils` rendered a stubbed child's default slot; v2 does not
// by default. Restoring that behavior keeps `shallowMount` assertions that look
// at content nested inside a `<b-*>` wrapper (e.g. inputs inside BCollapse)
// working as they did under bootstrap-vue 2.
config.global.renderStubDefaultSlot = true;

// @vue/compat maps the Vue 2 `inserted` directive hook at runtime; the Vue 3
// Directive type does not list it, so cast the definition.
Vue.directive('Sortable', {
  inserted: (el: HTMLElement, binding: { value?: Sortable.Options }) => {
    new Sortable(el, binding.value || {});
  },
} as unknown as Parameters<typeof Vue.directive>[1]);

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
  return {
    setEnd: () => {},
    setStart: () => {},
    getBoundingClientRect: () => {},
    getClientRects: () => [],
  } as any as Range;
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
