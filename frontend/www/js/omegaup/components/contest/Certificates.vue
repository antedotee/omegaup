<template>
  <div class="card">
    <div class="card-header">
      <h4 class="card-title mb-0">{{ T.contestCertificatesGenerate }}</h4>
    </div>
    <div class="card-body px-2 px-sm-4">
      <label>{{ T.contestCertificatesCutoff }}</label>
      <input
        v-model="certificateCutoff"
        :disabled="
          certificatesDetails.certificatesStatus === 'queued' ||
          certificatesDetails.certificatesStatus === 'generated'
        "
        class="form-control"
        type="text"
        required="required"
      />
      <p class="help-block">
        {{ T.contestCertificatesCutoffHelp }}
      </p>
      <button
        :disabled="
          certificatesDetails.certificatesStatus === 'queued' ||
          certificatesDetails.certificatesStatus === 'generated'
        "
        type="button"
        class="btn btn-primary d-block mx-auto"
        data-button-generate
        @click="showModal = true"
      >
        {{ T.contestCertificatesGenerate }}
      </button>
      <BModal v-model="showModal" centered lazy unmount-lazy no-header>
        {{ T.contestCertificatesConfirmGenerate }}
        <template #footer>
          <div class="d-flex justify-content-around w-100">
            <button
              type="button"
              class="btn btn-secondary"
              data-button-close
              data-modal-dismiss
              @click="showModal = false"
            >
              {{ T.wordsClose }}
            </button>
            <button
              type="button"
              class="btn btn-primary"
              data-button-confirm
              @click="
                $emit('generate', certificateCutoff);
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
import { types } from '../../api_types';
import { BModal } from 'bootstrap-vue-next';
import T from '../../lang';

@Component({ components: { BModal }, emits: ['generate'] })
class Certificates extends Vue {
  @Prop() certificatesDetails!: types.ContestCertificatesAdminDetails;

  T = T;
  showModal = false;
  certificateCutoff = this.certificatesDetails.certificateCutoff;
}
export default toNative(Certificates);
</script>
