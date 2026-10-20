import { OmegaUp } from '../omegaup';
import { types } from '../api_types';
import Vue, { type CreateElement } from 'vue';
import libinteractive_Gen from '../components/libinteractive/Gen.vue';

OmegaUp.on('ready', () => {
  const payload = types.payloadParsers.LibinteractiveGenPayload();
  new Vue({
    el: '#main-container',
    components: {
      'omegaup-libinteractive-gen': libinteractive_Gen,
    },
    render: function (createElement: CreateElement) {
      return createElement('omegaup-libinteractive-gen', {
        props: {
          error: payload.error,
          language: payload.language,
          os: payload.os,
          name: payload.name,
          idl: payload.idl,
        },
      });
    },
  });
});
