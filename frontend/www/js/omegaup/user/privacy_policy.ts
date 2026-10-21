import Vue, { type CreateElement } from 'vue';
import user_PrivacyPolicy from '../components/user/PrivacyPolicy.vue';
import { OmegaUp } from '../omegaup';
import T from '../lang';
import * as api from '../api';
import * as ui from '../ui';
import { types } from '../api_types';

OmegaUp.on('ready', () => {
  const payload = types.payloadParsers.PrivacyPolicyDetailsPayload();
  interface PrivacyPolicyInstance {
    saved: boolean;
  }

  const privacyPolicy = new Vue({
    el: '#main-container',
    components: {
      'omegaup-privacy-policy': user_PrivacyPolicy,
    },
    data: () => {
      return {
        saved: payload.has_accepted,
      };
    },
    render: function (createElement: CreateElement) {
      return createElement('omegaup-privacy-policy', {
        props: {
          policyMarkdown: payload.policy_markdown,
          saved: (this as unknown as PrivacyPolicyInstance).saved,
        },
        on: {
          submit: () => {
            api.User.acceptPrivacyPolicy({
              privacy_git_object_id: payload.git_object_id,
              statement_type: payload.statement_type,
            })
              .then(() => {
                ui.info(T.wordsPrivacyPolicyAccepted);
                (privacyPolicy as unknown as PrivacyPolicyInstance).saved =
                  true;
              })
              .catch(ui.apiError);
          },
        },
      });
    },
  });
});
