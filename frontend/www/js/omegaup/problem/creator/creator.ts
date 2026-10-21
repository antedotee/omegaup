import problem_creator from '../../components/problem/creator/Creator.vue';
import { OmegaUp } from '../../omegaup';
import Vue, { type CreateElement } from 'vue';
import * as BootstrapVueNext from 'bootstrap-vue-next';
import { createBootstrap } from 'bootstrap-vue-next';
import store from './store';
import {
  downloadInputFile,
  downloadZipFile,
  showUpdateSuccessMessage,
} from './downloadHandlers';

import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

OmegaUp.on('ready', () => {
  // The Creator component tree uses kebab `<b-*>` tags without registering the
  // components locally, so this standalone `new Vue` instance must provide
  // bootstrap-vue-next globally, mirroring test.setup. `createBootstrap()` wires
  // BVN's services (modal/toast orchestrators, directives); it does not register
  // the components, so register every exported `B*` component by name too.
  Vue.use(createBootstrap());
  for (const [exportName, exported] of Object.entries(BootstrapVueNext)) {
    if (
      /^B[A-Z]/.test(exportName) &&
      exported != null &&
      (typeof exported === 'object' || typeof exported === 'function')
    ) {
      Vue.component(
        exportName,
        exported as Parameters<typeof Vue.component>[1],
      );
    }
  }

  new Vue({
    el: '#main-container',
    store,
    components: {
      'creator-main': problem_creator,
    },
    render: function (createElement: CreateElement) {
      return createElement('creator-main', {
        on: {
          'show-update-success-message': showUpdateSuccessMessage,
          'download-input-file': downloadInputFile,
          'download-zip-file': downloadZipFile,
        },
      });
    },
  });
});
