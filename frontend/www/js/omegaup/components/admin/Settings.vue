<template>
  <div class="card">
    <div class="text-white bg-primary card-header">
      <div class="card-title h4">
        {{ T.omegaupTitleAdminSettings }}
      </div>
    </div>
    <div class="card-body">
      <div class="row mb-3">
        <div class="col-md-12">
          <h4>{{ T.wordsEphemeralGrader }}</h4>
          <div class="form-check">
            <input v-model="enabled" type="checkbox" class="form-check-input" />
            <label class="form-check-label">
              {{ T.ephemeralGraderEnable }}
            </label>
          </div>
          <small class="form-text text-muted">
            {{ T.ephemeralGraderDescription }}
          </small>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch, toNative } from 'vue-facing-decorator';
import T from '../../lang';

@Component
class Settings extends Vue {
  created() {
    // Props are not bound when class field initializers run under
    // vue-facing-decorator, so prop-derived fields are assigned here.
    this.enabled = this.ephemeralGraderEnabled;
  }
  T = T;

  @Prop({ default: true }) ephemeralGraderEnabled!: boolean;

  enabled = undefined;

  @Watch('enabled')
  onEnabledChanged(newValue: boolean): void {
    this.$emit('update-ephemeral-grader', newValue);
  }
}
export default toNative(Settings);
</script>
