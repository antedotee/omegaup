<template>
  <div class="mt-3">
    <b-row>
      <b-col>
        <b-form-group
          data-prefix
          :label="T.problemCreatorPrefix"
          label-for="prefix"
          :invalid-feedback="T.problemCreatorOnlyNumbers"
          class="mb-4"
        >
          <b-form-input
            :model-value="multipleCasesPrefix"
            data-problem-creator-multiple-cases-input="prefix"
            lazy-formatter
            :formatter="formatter"
            name="multiple-cases-prefix"
            autocomplete="off"
            @update:model-value="multipleCasesPrefix = $event"
          />
        </b-form-group>
      </b-col>
      <b-col>
        <b-form-group
          :label="T.problemCreatorSuffix"
          label-for="suffix"
          class="mb-4"
        >
          <b-form-input
            :model-value="multipleCasesSuffix"
            data-problem-creator-multiple-cases-input="suffix"
            lazy-formatter
            :formatter="formatter"
            name="multiple-cases-suffix"
            autocomplete="off"
            @update:model-value="multipleCasesSuffix = $event"
          />
        </b-form-group>
      </b-col>
    </b-row>
    <b-form-group
      :label="T.problemCreatorNumberOfCases"
      :description="`${T.problemCreatorNumberOfCasesHelper} ${caseNamePreview}`"
      label-for="case-points"
    >
      <b-form-input
        :model-value="multipleCasesCount"
        data-problem-creator-multiple-cases-input="count"
        lazy-formatter
        :formatter="numberFormatter"
        name="multiple-cases-count"
        type="number"
        number
        @update:model-value="multipleCasesCount = $event"
      />
    </b-form-group>
    <b-form-group :label="T.problemCreatorGroupName" label-for="case-group">
      <b-form-select
        class="w-auto"
        :model-value="multipleCasesGroup"
        :options="options"
        name="multiple-cases-group"
        @update:model-value="multipleCasesGroup = $event"
      />
    </b-form-group>
  </div>
</template>

<script lang="ts">
import { GroupID } from '../../../../problem/creator/types';
import { NIL } from 'uuid';
import { Component, Vue, toNative } from 'vue-facing-decorator';
import T from '../../../../lang';

@Component
class MultipleCasesInput extends Vue {
  multipleCasesPrefix = '';
  multipleCasesSuffix = '';
  multipleCasesCount = 1;
  multipleCasesGroup: GroupID = NIL;

  T = T;

  // The vuex-class namespaced getter decorator does not bind under
  // vue-facing-decorator, so the store getter is read directly.
  get storedGroups(): {
    value: string;
    text: string;
  }[] {
    return this.$store.getters['casesStore/getGroupIdsAndNames'];
  }

  get options() {
    const noGroup = { value: NIL, text: T.problemCreatorNoGroup };
    if (!this.storedGroups) {
      return [noGroup];
    }
    return [noGroup, ...this.storedGroups];
  }

  get caseNamePreview() {
    return `${this.formatter(this.multipleCasesPrefix)}1${this.formatter(
      this.multipleCasesSuffix,
    )}, ${this.formatter(this.multipleCasesPrefix)}2${this.formatter(
      this.multipleCasesSuffix,
    )}...`;
  }

  // Ensure that the prefix and suffix always contain alphanumeric characters in addition to _ and -
  formatter(text: string) {
    return text.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '');
  }

  // Ensures the number is always above 1
  numberFormatter(number: number) {
    return Math.max(number, 1);
  }
}
export default toNative(MultipleCasesInput);
</script>
