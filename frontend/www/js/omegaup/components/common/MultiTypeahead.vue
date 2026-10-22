<template>
  <tags-input
    :value="selectedOptions"
    :existing-tags="existingOptions"
    :typeahead="true"
    :typeahead-style="'dropdown'"
    :typeahead-max-results="maxResults"
    :typeahead-activation-threshold="activationThreshold"
    :placeholder="T.typeaheadSearchPlaceholder"
    :limit="0"
    :hide-input-on-limit="true"
    :only-existing-tags="true"
    :typeahead-hide-discard="true"
    @input="onInput"
    @change="updateExistingOptions"
    @tag-added="$emit('update:value', selectedOptions)"
    @tag-removed="$emit('update:value', selectedOptions)"
  >
  </tags-input>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch, toNative } from 'vue-facing-decorator';
import VoerroTagsInput from '@voerro/vue-tagsinput';
import '@voerro/vue-tagsinput/dist/style.css';
import T from '../../lang';
import { types } from '../../api_types';

@Component({
  components: {
    'tags-input': VoerroTagsInput,
  },
})
class MultiTypeahead extends Vue {
  @Prop() existingOptions!: types.ListItem[];
  @Prop({ default: 3 }) activationThreshold!: number;
  @Prop({ default: 10 }) maxResults!: number;
  @Prop({ default: () => [] }) value!: types.ListItem[];

  T = T;
  selectedOptions: types.ListItem[] = [];

  onInput(options: types.ListItem[]): void {
    // VoerroTagsInput is a Vue 2 `value`/`input` model component. Under the old
    // Vue 2 build its `input` event flowed back through `v-model`, so the parent
    // observed the selection as soon as a tag was added. With `v-model` remapped
    // to `modelValue` under @vue/compat the library's `input` no longer reaches
    // the parent, so apply the selection and forward it here. Bail out when the
    // payload matches the current selection: the library re-emits `input` after
    // the one-way `:value` prop updates, and re-processing it would both loop
    // and duplicate the forwarded event.
    if (
      options.length === this.selectedOptions.length &&
      options.every((opt, i) => opt.key === this.selectedOptions[i]?.key)
    ) {
      return;
    }
    this.selectedOptions = options;
    // A removal is reported by `tag-removed`, so only forward additions here to
    // avoid duplicating the empty-selection event.
    if (options.length > 0) {
      this.$emit('update:value', this.selectedOptions);
    }
  }

  updateExistingOptions(query: string): void {
    if (query.length < this.activationThreshold) return;
    this.$emit('update-existing-options', query);
  }

  @Watch('value')
  onValueChanged(newValue: types.ListItem[]): void {
    this.selectedOptions = this.existingOptions.filter((option) =>
      newValue?.some((opt) => option.key === opt['key']),
    );
  }
}
export default toNative(MultiTypeahead);
</script>

<style lang="scss">
@import '../../../../sass/site';

.tags-input-remove::before,
.tags-input-remove::after,
.tags-input-typeahead-item-highlighted-default {
  background-color: $omegaup-primary--darker;
}
</style>
