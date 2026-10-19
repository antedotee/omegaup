<template>
  <div class="mx-auto card mt-0 mt-lg-4">
    <div class="card-body p-3">
      <h3>{{ T.wordsDifficulty }}</h3>
      <div
        v-for="difficulty in difficulties"
        :key="difficulty.id"
        class="form-check"
      >
        <label class="form-check-label">
          <input
            v-model="currentDifficulty"
            class="form-check-input"
            type="radio"
            name="difficulty"
            :value="difficulty.id"
            @click="$emit('change-difficulty', difficulty.id)"
          />{{ difficulty.name }}
        </label>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Emit, Watch, Prop, toNative } from 'vue-facing-decorator';
import T from '../../lang';

@Component
class FilterDifficulty extends Vue {
  created() {
    // Props are not bound when class field initializers run under
    // vue-facing-decorator, so prop-derived fields are assigned here.
    this.currentDifficulty = this.selectedDifficulty;
  }
  @Prop() selectedDifficulty!: string;

  T = T;
  currentDifficulty = undefined;

  difficulties: { [key: string]: { name: string; id: string } } = {
    anyDifficulty: {
      name: T.qualityFormDifficultyAny,
      id: 'all',
    },
    difficultyEasy: {
      name: T.qualityFormDifficultyEasy,
      id: 'easy',
    },
    difficultyMedium: {
      name: T.qualityFormDifficultyMedium,
      id: 'medium',
    },
    difficultyHard: {
      name: T.qualityFormDifficultyHard,
      id: 'hard',
    },
  };

  @Emit('change')
  @Watch('currentDifficulty')
  onCurrentDifficultyChanged(val: string | null) {
    return val;
  }
}
export default toNative(FilterDifficulty);
</script>

<style scoped>
.section-font-size {
  font-size: 1.44rem;
}
</style>
