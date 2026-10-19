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
    :disabled="!enabled"
    :readonly="usedFallback"
  />
</template>

<script lang="ts">
import { Vue, Component, Watch, Prop, toNative } from 'vue-facing-decorator';
import T from '../lang';
import * as time from '../time';
import '../../../third_party/js/bootstrap-datepicker.js';

@Component
class DatePicker extends Vue {
  created() {
    // Props are not bound when class field initializers run under
    // vue-facing-decorator, so prop-derived fields are assigned here.
    this.stringValue = time.formatDateLocal(this.value);
  }
  T = T;

  @Prop({ default: '' }) name!: string;
  @Prop() value!: Date;
  @Prop({ default: true }) enabled!: boolean;
  @Prop({ default: T.datePickerFormat }) format!: string;
  @Prop({ default: false }) isInvalid!: boolean;
  @Prop({ default: null }) min!: Date | null;
  @Prop({ default: null }) max!: Date | null;

  private usedFallback: boolean = false;
  private stringValue: string = '';

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

  private mountedFallback() {
    this.usedFallback = true;
    $(this.$el)
      .datepicker({
        weekStart: 1,
        format: this.format,
      })
      .on('changeDate', (ev) => {
        this.$emit('input', ev.date);
      })
      .datepicker('setValue', this.value);
  }

  @Watch('stringValue')
  onStringValueChanged(newStringValue: string) {
    if (this.usedFallback) {
      // If the fallback was used, we don't need to update anything.
      return;
    }
    this.$emit('input', time.parseDateLocal(newStringValue));
  }

  @Watch('value')
  onPropertyChanged(newValue: Date) {
    this.stringValue = time.formatDateLocal(newValue);
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
