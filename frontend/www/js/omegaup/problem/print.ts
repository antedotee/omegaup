import { OmegaUp } from '../omegaup';
import { types } from '../api_types';
import Vue, { type CreateElement } from 'vue';
import omegaup_ProblemPrint from '../components/problem/Print.vue';

OmegaUp.on('ready', () => {
  const payload = types.payloadParsers.ProblemPrintDetailsPayload();

  new Vue({
    el: '#main-container',
    components: {
      'omegaup-problem-print': omegaup_ProblemPrint,
    },
    render: function (createElement: CreateElement) {
      return createElement('omegaup-problem-print', {
        props: {
          problem: payload.details,
        },
        on: {
          'print-page': () => {
            window.print();
          },
        },
      });
    },
  });
});
