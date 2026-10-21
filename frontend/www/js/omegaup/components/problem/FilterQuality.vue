<template>
  <div class="card mx-auto mt-0 mt-lg-4">
    <div class="card-body p-3">
      <h3>{{ T.wordsQuality }}</h3>
      <div
        v-for="quality in qualityValues"
        :key="quality.id"
        class="form-check"
      >
        <label class="form-check-label">
          <input
            v-model="currentQuality"
            class="form-check-input"
            type="radio"
            name="quality"
            :value="quality.id"
            @click="$emit('change-quality', quality.id)"
          />{{ quality.name }}
        </label>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {
  Vue,
  Component,
  Emit,
  Watch,
  Prop,
  toNative,
} from 'vue-facing-decorator';
import T from '../../lang';

@Component
class FilterQuality extends Vue {
  created() {
    // Props are not bound when class field initializers run under
    // vue-facing-decorator, so prop-derived fields are assigned here.
    this.currentQuality = this.quality;
  }
  @Prop({ default: 'onlyQualityProblems' }) quality!: string;

  T = T;
  currentQuality = undefined;

  qualityValues: { [key: string]: { name: string; id: string } } = {
    allProblems: {
      name: T.qualityFormQualityAny,
      id: 'all',
    },
    onlyQualityProblems: {
      name: T.qualityFormQualityOnly,
      id: 'onlyQualityProblems',
    },
  };

  @Emit('change')
  @Watch('currentQuality')
  onCurrentQualityChanged(val: string | null) {
    return val;
  }
}
export default toNative(FilterQuality);
</script>

<style scoped>
.section-font-size {
  font-size: 1.44rem;
}
</style>
