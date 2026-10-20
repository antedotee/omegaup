<template>
  <tags-input
    :value="selectedOptions"
    :existing-tags="existingOptions"
    :typeahead="true"
    :typeahead-style="'dropdown'"
    :typeahead-max-results="maxResults"
    :typeahead-activation-threshold="activationThreshold"
    :placeholder="placeholder"
    :limit="1"
    :disabled="readonly"
    :hide-input-on-limit="true"
    :only-existing-tags="onlyExistingTags"
    :typeahead-hide-discard="typeaheadHideDiscard"
    :class="{ 'is-invalid': isInvalid }"
    @input="selectedOptions = $event"
    @change="updateExistingOptions"
    @tag-added="onTagAdded"
    @tag-removed="onTagRemoved"
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
class Typeahead extends Vue {
  created() {
    // Props are not bound when class field initializers run under
    // vue-facing-decorator, so prop-derived fields are assigned here.
    this.selectedOptions = this.options;
  }
  @Prop({ default: () => [] }) existingOptions!: types.ListItem[];
  @Prop({ default: () => [] }) options!: types.ListItem[];
  @Prop({ default: 3 }) activationThreshold!: number;
  @Prop({ default: 5 }) maxResults!: number;
  @Prop({ default: null }) value!: null | types.ListItem;
  @Prop({ default: true }) onlyExistingTags!: boolean;
  @Prop({ default: false }) readonly!: boolean;
  @Prop({ default: true }) typeaheadHideDiscard!: boolean;
  @Prop({ default: T.typeaheadSearchPlaceholder }) placeholder!: string;
  @Prop({ default: 300 }) debounceDelay!: number;
  @Prop({ default: false }) isInvalid!: boolean;

  T = T;
  selectedOptions = undefined;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  updateExistingOptions(query: string): void {
    if (query.length < this.activationThreshold) return;

    // Clear any existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new debounce timer
    this.debounceTimer = setTimeout(() => {
      this.$emit('update-existing-options', query);
    }, this.debounceDelay);
  }

  beforeDestroy(): void {
    // Clean up timer on component destruction
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }

  onTagAdded(): void {
    if (this.selectedOptions.length < 1) return;
    const selected = this.selectedOptions[0];
    // The underlying tags-input emits `tag-added` asynchronously (on its own
    // `$nextTick`), so a `tag-added` queued for an option that is already the
    // current `value` can arrive after the parent has reset or changed the
    // model. Re-emitting it then would clobber the parent's update. Skip the
    // notification when the selected option already matches `value`; a genuine
    // new selection still differs and is propagated.
    if (this.value && this.value.key === selected.key) return;
    this.$emit('update:value', selected);
  }

  onTagRemoved(): void {
    this.$emit('update:value', null);
  }

  @Watch('value')
  onValueChanged(newValue: null | types.ListItem): void {
    if (!newValue) {
      this.selectedOptions = [];
      return;
    }
    this.existingOptions.push(newValue);
    this.selectedOptions = this.existingOptions.filter(
      (option) => option.key === newValue.key,
    );
  }
}
export default toNative(Typeahead);
</script>

<style lang="scss">
@import '../../../../sass/main.scss';

.tags-input-remove::before,
.tags-input-remove::after,
.tags-input-typeahead-item-highlighted-default {
  background-color: $omegaup-primary--darker;
}

.tags-input-wrapper-default {
  min-height: 38px;
  padding: 0.375rem 0.75rem !important;
}

.tags-input.disabled {
  background-color: var(--typeahead-disabled);
  opacity: 1;
}

.tags-input.is-invalid .tags-input-wrapper-default {
  border-color: var(--form-input-error-color);
}
</style>
