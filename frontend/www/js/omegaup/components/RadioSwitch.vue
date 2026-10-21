<template>
  <div class="form-control container-fluid" :readonly="readonly">
    <div class="form-check form-check-inline">
      <label class="form-check-label">
        <input
          v-model="radioValue"
          :disabled="readonly"
          class="form-check-input"
          type="radio"
          :name="name"
          :value="valueForTrue"
          @change.prevent="onUpdateInput"
        />{{ textForTrue }}
      </label>
    </div>
    <div class="form-check form-check-inline">
      <label class="form-check-label">
        <input
          v-model="radioValue"
          :disabled="readonly"
          class="form-check-input"
          type="radio"
          :name="name"
          :value="valueForFalse"
          @change.prevent="onUpdateInput"
        />{{ textForFalse }}
      </label>
    </div>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch, toNative } from 'vue-facing-decorator';
import T from '../lang';

@Component({ emits: ['update:value'] })
class RadioSwitch extends Vue {
  @Prop() name!: string;
  @Prop({ default: false }) readonly!: boolean;
  @Prop() selectedValue!: any;
  @Prop({ default: true }) valueForTrue!: any;
  @Prop({ default: false }) valueForFalse!: any;
  @Prop({ default: T.wordsYes }) textForTrue!: string;
  @Prop({ default: T.wordsNo }) textForFalse!: string;

  radioValue = this.selectedValue ?? this.valueForFalse;

  @Watch('radioValue')
  onUpdateInput(): void {
    // Both the `radioValue` watcher and the input `@change` handler route here.
    // Emit the model value itself, not the handler argument, so the DOM change
    // event object is never mistaken for the selected value. Emit explicitly
    // rather than stacking an `@Emit` decorator on a `@Watch`, which does not
    // fire the emit under vue-facing-decorator.
    this.$emit('update:value', this.radioValue);
  }
}
export default toNative(RadioSwitch);
</script>
