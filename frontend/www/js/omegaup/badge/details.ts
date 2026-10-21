import Vue, { type CreateElement } from 'vue';
import badge_Details from '../components/badge/Details.vue';
import { OmegaUp } from '../omegaup';
import { types } from '../api_types';

OmegaUp.on('ready', () => {
  const payload = types.payloadParsers.BadgeDetailsPayload();
  new Vue({
    el: '#main-container',
    components: {
      'omegaup-badge-details': badge_Details,
    },
    render: function (createElement: CreateElement) {
      return createElement('omegaup-badge-details', {
        props: {
          badge: payload.badge,
        },
      });
    },
  });
});
