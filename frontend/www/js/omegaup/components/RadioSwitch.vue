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
import { Vue, Component, Prop, Emit, Watch, toNative } from 'vue-facing-decorator';
import T from '../lang';

@Component
class RadioSwitch extends Vue {
  created() {
    // Props are not bound when class field initializers run under
    // vue-facing-decorator, so prop-derived fields are assigned here.
    this.radioValue = this.selectedValue ?? this.valueForFalse;
  }
  @Prop() name!: string;
  @Prop({ default: false }) readonly!: boolean;
  @Prop() selectedValue!: any;
  @Prop({ default: true }) valueForTrue!: any;
  @Prop({ default: false }) valueForFalse!: any;
  @Prop({ default: T.wordsYes }) textForTrue!: string;
  @Prop({ default: T.wordsNo }) textForFalse!: string;

  radioValue = undefined;

  @Watch('radioValue')
  @Emit('update:value')
  onUpdateInput(newValue: any): any {
    return newValue;
  }
}
export default toNative(RadioSwitch);
</script>
