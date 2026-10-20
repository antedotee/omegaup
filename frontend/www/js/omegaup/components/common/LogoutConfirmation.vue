<template>
  <b-modal
    v-model="showModal"
    :title="T.logoutConfirmationTitle"
    :ok-title="T.wordsYes"
    :cancel-title="T.wordsNo"
    ok-variant="primary"
    cancel-variant="secondary"
    footer-class="logout-confirmation-modal"
    body-class="p-0"
    teleport-disabled
    lazy
    @ok="confirmLogout"
  >
  </b-modal>
</template>

<script lang="ts">
import { Vue, Component, Prop, toNative } from 'vue-facing-decorator';
import T from '../../lang';

@Component
class LogoutConfirmation extends Vue {
  @Prop({ default: false }) value!: boolean;

  T = T;

  get showModal(): boolean {
    return this.value;
  }

  set showModal(value: boolean) {
    this.$emit('input', value);
  }

  confirmLogout(): void {
    window.location.href = '/logout/';
  }
}
export default toNative(LogoutConfirmation);
</script>
