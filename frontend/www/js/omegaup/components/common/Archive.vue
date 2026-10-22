<template>
  <div class="card">
    <h4 class="card-header">{{ archiveHeaderTitle }}</h4>
    <div class="card-body">
      <p class="card-text">
        {{ archiveHelpText }}
      </p>
      <button
        type="button"
        class="btn btn-primary d-block mx-auto"
        @click="showModal = true"
      >
        {{ archiveButtonDescription }}
      </button>
      <BModal v-model="showModal" centered lazy unmount-lazy no-header>
        {{ archiveConfirmText }}
        <template #footer>
          <div class="d-flex justify-content-around w-100">
            <button
              type="button"
              class="btn btn-secondary"
              data-modal-dismiss
              @click="showModal = false"
            >
              {{ T.wordsClose }}
            </button>
            <button
              type="button"
              class="btn btn-primary"
              @click="
                onArchive();
                showModal = false;
              "
            >
              {{ T.wordsConfirm }}
            </button>
          </div>
        </template>
      </BModal>
    </div>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Prop, toNative } from 'vue-facing-decorator';
import { BModal } from 'bootstrap-vue-next';
import T from '../../lang';

@Component({ components: { BModal }, emits: ['archive'] })
class Archive extends Vue {
  @Prop() alreadyArchived!: boolean;
  @Prop() archiveHelpText!: string;
  @Prop() archiveHeaderTitle!: string;
  @Prop() archiveButtonDescription!: string;
  @Prop() archiveConfirmText!: string;

  T = T;
  showModal = false;

  onArchive(): void {
    this.$emit('archive', !this.alreadyArchived);
  }
}
export default toNative(Archive);
</script>
