<template>
  <input
    ref="input"
    class="typeahead form-control"
    autocomplete="off"
    :placeholder="placeholder"
    :name="name"
    :value="value"
    @change="onUpdateInput"
  />
</template>

<script lang="ts">
import { Vue, Component, Watch, Prop, Emit, Ref, toNative } from 'vue-facing-decorator';

@Component
class Autocomplete extends Vue {
  @Ref() input!: HTMLInputElement;
  @Prop() value!: string;
  @Prop() placeholder!: string;
  @Prop() name!: string;
  // eslint-disable-next-line no-undef -- This is defined in TypeScript.
  @Prop() init!: (el: JQuery<HTMLElement>) => void;

  mounted() {
    this.init($(this.$refs.input as HTMLElement));
  }

  @Emit('input')
  onUpdateInput(): string {
    const value = this.input.getAttribute('data-value');
    if (value !== null) {
      this.$emit('update:value', value);
    }
    return this.input.value;
  }

  @Watch('value')
  onPropertyChanged(newValue: string) {
    this.input.value = newValue;
  }
}
export default toNative(Autocomplete);
</script>

<style lang="scss">
.tt-dataset {
  background: white;
  padding: 10px;
  border: 1px solid gray;
}
</style>
