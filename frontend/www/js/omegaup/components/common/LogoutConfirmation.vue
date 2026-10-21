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

@Component({
  emits: ['update:modelValue'],
  options: { compatConfig: { COMPONENT_V_MODEL: false } },
})
class LogoutConfirmation extends Vue {
  @Prop({ default: false }) modelValue!: boolean;

  T = T;

  get showModal(): boolean {
    return this.modelValue;
  }

  set showModal(value: boolean) {
    this.$emit('update:modelValue', value);
  }

  confirmLogout(): void {
    window.location.href = '/logout/';
  }
}
export default toNative(LogoutConfirmation);
</script>
