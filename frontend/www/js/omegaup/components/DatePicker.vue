<template>
  <input
    v-model="stringValue"
    :name="name"
    :min="minDateStr"
    :max="maxDateStr"
    class="form-control"
    :class="{ 'is-invalid': isInvalid }"
    required="required"
    size="16"
    type="date"
    :disabled="disabled || !enabled"
    :readonly="usedFallback"
  />
</template>

<script lang="ts">
import { Vue, Component, Watch, Prop, toNative } from 'vue-facing-decorator';
import T from '../lang';
import * as time from '../time';
import '../../../third_party/js/bootstrap-datepicker.js';

@Component({
  emits: ['update:modelValue'],
  options: { compatConfig: { COMPONENT_V_MODEL: false } },
})
class DatePicker extends Vue {
  T = T;

  @Prop({ default: '' }) name!: string;
  @Prop({ default: null }) modelValue!: Date | null;
  @Prop({ default: true }) enabled!: boolean;
  // Declared as a prop so a caller's `disabled` combines with `enabled`
  // instead of replacing the input's own binding as a fallthrough attribute.
  @Prop({ default: false }) disabled!: boolean;
  @Prop({ default: T.datePickerFormat }) format!: string;
  @Prop({ default: false }) isInvalid!: boolean;
  @Prop({ default: null }) min!: Date | null;
  @Prop({ default: null }) max!: Date | null;

  private usedFallback: boolean = false;
  private stringValue: string = this.isValidDate(this.modelValue)
    ? time.formatDateLocal(this.modelValue)
    : '';

  get minDateStr() {
    return this.min?.toISOString()?.split('T')?.[0];
  }

  get maxDateStr() {
    return this.max?.toISOString()?.split('T')?.[0];
  }

  mounted() {
    if ((this.$el as HTMLInputElement).type === 'text') {
      // Even though we declared the input as having date type,
      // browsers that don't support it will silently change the type to text.
      // In that case, use the bootstrap datepicker.
      this.mountedFallback();
    }
  }

  private isValidDate(value: Date | null): value is Date {
    return value instanceof Date && !isNaN(value.getTime());
  }

  private mountedFallback() {
    this.usedFallback = true;
    $(this.$el)
      .datepicker({
        weekStart: 1,
        format: this.format,
      })
      .on('changeDate', (ev) => {
        this.$emit('update:modelValue', ev.date);
      })
      .datepicker('setValue', this.modelValue);
  }

  @Watch('stringValue')
  onStringValueChanged(newStringValue: string) {
    if (this.usedFallback) {
      // If the fallback was used, we don't need to update anything.
      return;
    }
    this.$emit('update:modelValue', time.parseDateLocal(newStringValue));
  }

  @Watch('modelValue')
  onPropertyChanged(newValue: Date | null) {
    this.stringValue = this.isValidDate(newValue)
      ? time.formatDateLocal(newValue)
      : '';
    if (this.usedFallback) {
      $(this.$el).datepicker('setValue', newValue);
    }
  }
}
export default toNative(DatePicker);
</script>

<style>
@import '../../../third_party/css/bootstrap-datepicker.css';
</style>
