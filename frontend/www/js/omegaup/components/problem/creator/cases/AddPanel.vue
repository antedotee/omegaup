<template>
  <b-card :title="T.problemCreatorAdd">
    <form ref="form" @submit.prevent="addItemToStore">
      <div class="h-100">
        <b-tabs small pills lazy>
          <b-tab
            :active="tab === 'case'"
            name="modal-form"
            @click="tab = 'case'"
          >
            <template #title>
              <span name="group" data-problem-creator-add-panel-tab="case">
                {{ T.problemCreatorCase }}</span
              >
            </template>
            <b-alert
              v-model="invalidCaseName"
              variant="danger"
              class="mt-2"
              dismissible
            >
              {{ T.problemCreatorCannotHaveSameName }}</b-alert
            >
            <omegaup-problem-creator-case-input ref="case-input" />
          </b-tab>
          <b-tab
            :active="tab === 'group'"
            name="modal-form"
            @click="tab = 'group'"
          >
            <template #title>
              <span name="group" data-problem-creator-add-panel-tab="group">
                {{ T.problemCreatorGroup }}</span
              >
            </template>
            <b-alert
              v-model="invalidGroupName"
              variant="danger"
              class="mt-2"
              dismissible
            >
              {{ T.problemCreatorCannotHaveSameName }}</b-alert
            >
            <omegaup-problem-creator-group-input ref="group-input" />
          </b-tab>
          <b-tab
            :active="tab === 'multiplecases'"
            name="modal-form"
            @click="tab = 'multiplecases'"
          >
            <template #title>
              <span
                name="multiple-cases"
                data-problem-creator-add-panel-tab="multiple-cases"
              >
                {{ T.problemCreatorMultipleCases }}</span
              >
            </template>
            <b-alert
              v-model="invalidCaseName"
              variant="danger"
              class="mt-2"
              dismissible
            >
              {{ T.problemCreatorCannotHaveSameName }}</b-alert
            >
            <omegaup-problem-creator-multiple-cases-input
              ref="multiple-cases-input"
            />
          </b-tab>
          <b-tab
            :active="tab === 'bulkimport'"
            name="modal-form"
            @click="tab = 'bulkimport'"
          >
            <template #title>
              <span
                name="bulk-import"
                data-problem-creator-add-panel-tab="bulk-import"
              >
                Bulk Import</span
              >
            </template>
            <omegaup-problem-creator-bulk-file-upload
              ref="bulk-file-upload"
            />
          </b-tab>
        </b-tabs>
      </div>
      <b-button
        variant="danger"
        size="sm"
        class="mr-2"
        @click="$emit('close-add-window')"
        >{{ T.wordsCancel }}</b-button
      >
      <b-button
        data-problem-creator-add-panel-submit
        type="submit"
        variant="success"
        size="sm"
        >{{ T.problemCreatorAdd }}</b-button
      >
    </form>
  </b-card>
</template>

<script lang="ts">
import { Component, Ref, Vue, Inject } from 'vue-property-decorator';
import T from '../../../../lang';
import problemCreator_Cases_CaseInput from './CaseInput.vue';
import problemCreator_Cases_MultipleCasesInput from './MultipleCasesInput.vue';
import problemCreator_Cases_GroupInput from './GroupInput.vue';
import problemCreator_Cases_BulkFileUpload from './BulkFileUpload.vue';
import { namespace } from 'vuex-class';
import {
  Group,
  CaseRequest,
  MultipleCaseAddRequest,
  AddTabTypes,
  CaseLine,
} from '@/js/omegaup/problem/creator/types';
import { NIL, v4 as uuid } from 'uuid';
import * as api from '@/js/omegaup/api';
import * as ui from '@/js/omegaup/ui';

const casesStore = namespace('casesStore');

@Component({
  components: {
    'omegaup-problem-creator-case-input': problemCreator_Cases_CaseInput,
    'omegaup-problem-creator-multiple-cases-input': problemCreator_Cases_MultipleCasesInput,
    'omegaup-problem-creator-group-input': problemCreator_Cases_GroupInput,
    'omegaup-problem-creator-bulk-file-upload': problemCreator_Cases_BulkFileUpload,
  },
})
export default class AddPanel extends Vue {
  tab: AddTabTypes = 'case';

  invalidCaseName = false;
  invalidGroupName = false;
  T = T;

  @Inject({ default: null }) readonly problemAlias!: string | null;

  @Ref('multiple-cases-input')
  multipleCasesInputRef!: problemCreator_Cases_MultipleCasesInput;
  @Ref('case-input') caseInputRef!: problemCreator_Cases_CaseInput;
  @Ref('group-input') groupInputRef!: problemCreator_Cases_GroupInput;
  @Ref('bulk-file-upload')
  bulkFileUploadRef!: problemCreator_Cases_BulkFileUpload;

  @casesStore.Mutation('addCase') addCase!: (caseRequest: CaseRequest) => void;
  @casesStore.Mutation('addGroup') addGroup!: (groupRequest: Group) => void;
  @casesStore.Action('addMultipleCases') addMultipleCases!: (
    multipleCaseRequest: MultipleCaseAddRequest,
  ) => void;
  @casesStore.State('groups') groups!: Group[];

  addItemToStore() {
    this.invalidCaseName = false;
    this.invalidGroupName = false;

    if (this.tab === 'case') {
      // Case Input
      const caseName = this.caseInputRef.caseName;
      const caseGroup = this.caseInputRef.caseGroup;
      const casePoints = this.caseInputRef.casePoints;
      const caseAutoPoints = this.caseInputRef.caseAutoPoints;

      // Check if there is a group/case with the same name already
      if (caseGroup === NIL) {
        // In this case we just need to check if there is a group with the same name. Since everytime a new ungrouped case is created, a coressponding group is created too
        const nameAlreadyExists = this.groups.find((g) => g.name === caseName);
        if (nameAlreadyExists) {
          this.invalidCaseName = true;
          return;
        }
      } else {
        const group = this.groups.find((g) => g.groupID === caseGroup);
        if (!group) return;
        const nameAlreadyExists = group.cases.find((c) => c.name === caseName);
        if (nameAlreadyExists) {
          this.invalidCaseName = true;
          return;
        }
      }

      this.addCase({
        caseID: uuid(),
        groupID: caseGroup,
        name: caseName,
        points: casePoints,
        autoPoints: caseAutoPoints,
      });
    } else if (this.tab === 'group') {
      const groupName = this.groupInputRef.groupName;
      const groupPoints = this.groupInputRef.groupPoints;
      const groupAutoPoints = this.groupInputRef.groupAutoPoints;

      // Check if there is a group with the same name already
      const nameAlreadyExists = this.groups.find((g) => g.name === groupName);
      if (nameAlreadyExists) {
        this.invalidGroupName = true;
        return;
      }

      this.addGroup({
        groupID: uuid(),
        name: groupName,
        points: groupPoints,
        autoPoints: groupAutoPoints,
        ungroupedCase: false,
        cases: [],
      });
    } else if (this.tab === 'multiplecases') {
      const multipleCasesPrefix = this.multipleCasesInputRef
        .multipleCasesPrefix;
      const multipleCasesSuffix = this.multipleCasesInputRef
        .multipleCasesSuffix;
      const multipleCasesCount = this.multipleCasesInputRef.multipleCasesCount;
      const multipleCasesGroup = this.multipleCasesInputRef.multipleCasesGroup;

      const multipleCaseNameArray = Array.from(
        { length: multipleCasesCount },
        (_, i) => multipleCasesPrefix + `${i + 1}` + multipleCasesSuffix,
      );

      const multipleCaseRequest: MultipleCaseAddRequest = {
        groupID: multipleCasesGroup,
        numberOfCases: multipleCasesCount,
        prefix: multipleCasesPrefix,
        suffix: multipleCasesSuffix,
      };

      if (multipleCasesGroup === NIL) {
        // In this case we just need to check if there is a group with the same name. Since everytime a new ungrouped case is created, a corresponding group is created too
        const nameAlreadyExists = this.groups.find((g) =>
          multipleCaseNameArray.includes(g.name),
        );
        if (nameAlreadyExists) {
          this.invalidCaseName = true;
          return;
        }
        this.addMultipleCases(multipleCaseRequest);
        this.$emit('close-add-window');
        return;
      }
      const group = this.groups.find((g) => g.groupID === multipleCasesGroup);
      if (!group) return;
      const nameAlreadyExists = group.cases.find((c) =>
        multipleCaseNameArray.includes(c.name),
      );
      if (nameAlreadyExists) {
        this.invalidCaseName = true;
        return;
      }
      this.addMultipleCases(multipleCaseRequest);
      this.$emit('close-add-window');
      return;
    } else if (this.tab === 'bulkimport') {
      this.handleBulkImport();
      return;
    }
    this.$emit('close-add-window');
  }

  async handleBulkImport() {
    if (!this.bulkFileUploadRef) {
      return;
    }

    const filePairs = await this.bulkFileUploadRef.getFilePairs();
    const groupID = this.bulkFileUploadRef.getSelectedGroupID();

    if (filePairs.length === 0) {
      ui.error('No matched file pairs found. Please ensure each input file has a corresponding output file.');
      return;
    }

    // Get problem alias from URL or store
    const problemAlias = this.getProblemAlias();

    // For new problems (no alias), add cases directly to the store
    if (!problemAlias) {
      await this.handleBulkImportToStore(filePairs, groupID);
      return;
    }

    // For existing problems, use API endpoint
    // Create FormData for file upload
    const formData = new FormData();
    formData.append('problem_alias', problemAlias);
    formData.append('message', 'Bulk import test cases');
    if (groupID && groupID !== NIL) {
      formData.append('group_id', groupID);
    }

    // Add all files - PHP expects test_case_files[] for arrays
    for (const pair of filePairs) {
      formData.append('test_case_files[]', pair.inputFile);
      formData.append('test_case_files[]', pair.outputFile);
    }

    try {
      // Use the standard API call pattern with FormData
      const response = await fetch('/api/problem/bulkImportTestCases/', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
      });

      const result = await response.json();

      if (result.status === 'ok') {
        ui.success(
          `Successfully imported ${result.imported_count} test case(s)`,
        );
        if (result.errors && result.errors.length > 0) {
          ui.warning(
            `Some errors occurred: ${result.errors.join(', ')}`,
          );
        }
        // Close the panel and refresh
        this.$emit('close-add-window');
        // Trigger refresh event
        this.$emit('refresh-cases');
        // Reload page to show new test cases
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        ui.error(result.error || 'Bulk import failed');
      }
    } catch (error) {
      ui.error('Bulk import failed');
      console.error('Bulk import error:', error);
    }
  }

  async handleBulkImportToStore(
    filePairs: Array<{ input: string; output: string; inputFile: File; outputFile: File }>,
    groupID: string
  ) {
    const targetGroupID = groupID && groupID !== NIL ? groupID : NIL;
    let importedCount = 0;
    const errors: string[] = [];

    for (const pair of filePairs) {
      try {
        // Read file contents
        const inputContent = await this.readFileContent(pair.inputFile);
        const outputContent = await this.readFileContent(pair.outputFile);

        // Extract base name from filename
        const baseName = this.getBaseNameFromFile(pair.inputFile.name);

        // Check for duplicate names
        const targetGroup = targetGroupID === NIL 
          ? null 
          : this.groups.find((g) => g.groupID === targetGroupID);
        
        if (targetGroupID === NIL) {
          // Check ungrouped case names
          const nameExists = this.groups.find((g) => g.name === baseName);
          if (nameExists) {
            errors.push(`Case name "${baseName}" already exists`);
            continue;
          }
        } else {
          if (!targetGroup) {
            errors.push(`Group not found for case "${baseName}"`);
            continue;
          }
          const nameExists = targetGroup.cases.find((c) => c.name === baseName);
          if (nameExists) {
            errors.push(`Case name "${baseName}" already exists in group`);
            continue;
          }
        }

        // Create case with file contents
        const caseID = uuid();
        const lineID = uuid();
        
        const caseRequest: CaseRequest = {
          caseID: caseID,
          groupID: targetGroupID,
          name: baseName,
          points: 0,
          autoPoints: true,
          lines: [{
            lineID: lineID,
            caseID: caseID,
            label: '',
            data: {
              kind: 'multiline',
              value: inputContent,
            },
          }],
        };

        // Add case to store
        this.addCase(caseRequest);

        // Update case with lines and output after adding
        // The addCase mutation doesn't use lines from caseRequest, so we update manually
        await this.$nextTick();
        
        const addedGroup = targetGroupID === NIL
          ? this.groups.find((g) => g.name === baseName && g.ungroupedCase)
          : this.groups.find((g) => g.groupID === targetGroupID);
        
        if (addedGroup) {
          const addedCase = addedGroup.cases.find((c) => c.caseID === caseID);
          if (addedCase) {
            // Set lines and output using Vue.set for reactivity
            this.$set(addedCase, 'lines', caseRequest.lines);
            this.$set(addedCase, 'output', outputContent);
          }
        }

        importedCount++;
      } catch (error) {
        errors.push(`Error importing ${pair.inputFile.name}: ${error}`);
      }
    }

    if (importedCount > 0) {
      ui.success(`Successfully imported ${importedCount} test case(s) to store`);
      if (errors.length > 0) {
        ui.warning(`Some errors occurred: ${errors.join(', ')}`);
      }
      this.$emit('close-add-window');
    } else {
      ui.error(`Failed to import test cases. Errors: ${errors.join(', ')}`);
    }
  }

  async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string || '');
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  getBaseNameFromFile(filename: string): string {
    return filename.replace(/\.(in|out|txt)$/i, '');
  }

  getProblemAlias(): string | null {
    // First try injected alias (for problem edit page)
    if (this.problemAlias) {
      return this.problemAlias;
    }
    // Try to get from URL (for editing existing problems)
    const urlMatch = window.location.pathname.match(/\/problem\/([^\/]+)\/edit/);
    if (urlMatch) {
      return urlMatch[1];
    }
    // Try alternative URL pattern for problem edit
    const urlMatch2 = window.location.pathname.match(/\/problem\/([^\/]+)/);
    if (urlMatch2 && !window.location.pathname.includes('/creator')) {
      return urlMatch2[1];
    }
    // For new problems in creator, check URL params
    const urlParams = new URLSearchParams(window.location.search);
    const alias = urlParams.get('problem_alias');
    if (alias) {
      return alias;
    }
    return null;
  }
}
</script>
