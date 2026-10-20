import Vue from 'vue';
import Vuex from 'vuex';

// vuex 4's default export is installed as a plugin under @vue/compat; its type
// is not the Vue 3 Plugin shape, so cast for the compat Vue.use signature.
Vue.use(Vuex as unknown as Parameters<typeof Vue.use>[0]);

export interface MainStoreState {
  username: string | null;
}

export const mainStoreConfig = {
  state: {
    username: null,
  },
  mutations: {
    updateUsername(state: MainStoreState, username: string | null) {
      Vue.set(state, 'username', username);
    },
  },
};

export default new Vuex.Store<MainStoreState>(mainStoreConfig);
