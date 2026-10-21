<template>
  <div class="card">
    <h1 class="card-header">{{ T.omegaupTitleParentalVerificationToken }}</h1>
    <div class="card-body">
      <i
        v-if="hasParentalVerificationToken"
        class="bi bi-check-circle-fill text-success"
        style="font-size: 2em"
      ></i>
      <i
        v-else
        class="bi bi-x-circle-fill text-danger"
        style="font-size: 2em"
      ></i>
      <omegaup-markdown :markdown="message"></omegaup-markdown>

      <a href="/dependents/">{{
        T.verificationParentalTokenGoToMyDependents
      }}</a>
    </div>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Prop, toNative } from 'vue-facing-decorator';
import T from '../../lang';

import omegaup_Markdown from '../Markdown.vue';

import 'bootstrap-icons/font/bootstrap-icons.css';

@Component({
  components: {
    'omegaup-markdown': omegaup_Markdown,
  },
})
class UserVerificationParentalToken extends Vue {
  @Prop() message!: string;
  @Prop() hasParentalVerificationToken!: boolean;

  T = T;
}
export default toNative(UserVerificationParentalToken);
</script>
