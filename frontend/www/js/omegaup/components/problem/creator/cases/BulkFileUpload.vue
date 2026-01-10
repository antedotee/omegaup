<template>
  <div class="mt-3">
    <b-alert variant="info" class="mb-3">
      <strong>Note:</strong> Bulk import is only available for existing problems. 
      For new problems, please create and save the problem first, then use bulk import. 
      Alternatively, use the "Case" or "Multiple Cases" tabs to add test cases.
    </b-alert>
    <b-form-group
      label="Bulk File Upload"
      description="Upload multiple test case files at once. Files will be automatically matched by name (e.g., case1.in with case1.out)."
    >
      <div
        ref="dropZone"
        class="drop-zone"
        :class="{ 'drag-over': isDragOver }"
        @drop="handleDrop"
        @dragover.prevent="isDragOver = true"
        @dragleave="isDragOver = false"
        @dragenter.prevent
      >
        <div v-if="!hasFiles" class="drop-zone-content">
          <BIconCloudUpload font-scale="3" class="mb-3" />
          <p class="mb-2">
            Drag and drop test case files here
          </p>
          <p class="text-muted small">
            or click the button below to browse
          </p>
          <input
            ref="fileInput"
            type="file"
            multiple
            accept=".in,.out,.txt"
            class="d-none"
            @change="handleFileSelect"
          />
          <b-button
            variant="primary"
            size="sm"
            @click="$refs.fileInput.click()"
          >
            Browse Files
          </b-button>
        </div>
        <div v-else class="file-list">
          <h6>Selected Files</h6>
          <b-list-group>
            <b-list-group-item
              v-for="(file, index) in selectedFiles"
              :key="index"
              class="d-flex justify-content-between align-items-center"
            >
              <span>{{ file.name }}</span>
              <b-button
                variant="danger"
                size="sm"
                @click="removeFile(index)"
              >
                <BIconX />
              </b-button>
            </b-list-group-item>
          </b-list-group>
          <div class="mt-3">
            <b-button variant="secondary" size="sm" @click="clearFiles">
              Clear
            </b-button>
          </div>
        </div>
      </div>
    </b-form-group>

    <b-form-group
      v-if="hasFiles"
      label="Group Name"
      label-for="bulk-upload-group"
    >
      <b-form-select
        v-model="selectedGroup"
        :options="groupOptions"
        name="bulk-upload-group"
      />
    </b-form-group>

    <b-alert v-if="matchedPairs.length > 0" variant="info" class="mt-3">
      <strong>Matched Pairs</strong>
      <ul class="mb-0 mt-2">
        <li v-for="(pair, index) in matchedPairs" :key="index">
          {{ pair.input }} ↔ {{ pair.output }}
        </li>
      </ul>
    </b-alert>

    <b-alert v-if="unmatchedFiles.length > 0" variant="warning" class="mt-3">
      <strong>Unmatched Files</strong>
      <ul class="mb-0 mt-2">
        <li v-for="(file, index) in unmatchedFiles" :key="index">
          {{ file }}
        </li>
      </ul>
    </b-alert>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';
import { namespace } from 'vuex-class';
import { NIL } from 'uuid';
import T from '../../../../lang';
import { BIconCloudUpload, BIconX } from 'bootstrap-vue';

const casesStore = namespace('casesStore');

interface FilePair {
  input: string;
  output: string;
  inputFile: File;
  outputFile: File;
}

@Component({
  components: {
    BIconCloudUpload,
    BIconX,
  },
})
export default class BulkFileUpload extends Vue {
  selectedFiles: File[] = [];
  isDragOver = false;
  selectedGroup: string = NIL;
  matchedPairs: FilePair[] = [];
  unmatchedFiles: string[] = [];

  T = T;

  @casesStore.Getter('getGroupIdsAndNames') storedGroups!: {
    value: string;
    text: string;
  }[];

  get hasFiles(): boolean {
    return this.selectedFiles.length > 0;
  }

  get groupOptions() {
    const noGroup = { value: NIL, text: 'No Group' };
    if (!this.storedGroups || this.storedGroups.length === 0) {
      return [noGroup];
    }
    return [noGroup, ...this.storedGroups];
  }

  @Watch('selectedFiles')
  onFilesChanged() {
    this.matchFilePairs();
  }

  handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files) {
      this.addFiles(Array.from(target.files));
    }
  }

  handleDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
    if (event.dataTransfer?.files) {
      this.addFiles(Array.from(event.dataTransfer.files));
    }
  }

  addFiles(files: File[]) {
    // Filter to only accept .in, .out, .txt files
    const validFiles = files.filter(
      (file) =>
        file.name.endsWith('.in') ||
        file.name.endsWith('.out') ||
        file.name.endsWith('.txt'),
    );
    this.selectedFiles.push(...validFiles);
    this.matchFilePairs();
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
    this.matchFilePairs();
  }

  clearFiles() {
    this.selectedFiles = [];
    this.matchedPairs = [];
    this.unmatchedFiles = [];
  }

  matchFilePairs() {
    this.matchedPairs = [];
    this.unmatchedFiles = [];

    const inputFiles = new Map<string, File>();
    const outputFiles = new Map<string, File>();

    // Separate input and output files
    for (const file of this.selectedFiles) {
      const baseName = this.getBaseName(file.name);
      if (file.name.endsWith('.in') || file.name.endsWith('.txt')) {
        inputFiles.set(baseName, file);
      } else if (file.name.endsWith('.out')) {
        outputFiles.set(baseName, file);
      }
    }

    // Match pairs
    for (const [baseName, inputFile] of inputFiles.entries()) {
      const outputFile = outputFiles.get(baseName);
      if (outputFile) {
        this.matchedPairs.push({
          input: inputFile.name,
          output: outputFile.name,
          inputFile,
          outputFile,
        });
        outputFiles.delete(baseName);
      } else {
        this.unmatchedFiles.push(inputFile.name);
      }
    }

    // Add unmatched output files
    for (const [baseName, outputFile] of outputFiles.entries()) {
      this.unmatchedFiles.push(outputFile.name);
    }
  }

  getBaseName(filename: string): string {
    // Remove .in, .out, .txt extensions
    return filename.replace(/\.(in|out|txt)$/i, '');
  }

  async getFilePairs(): Promise<FilePair[]> {
    return this.matchedPairs;
  }

  getSelectedGroupID(): string {
    return this.selectedGroup;
  }
}
</script>

<style scoped>
.drop-zone {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  transition: all 0.3s ease;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.drop-zone.drag-over {
  border-color: #007bff;
  background-color: #f0f8ff;
}

.drop-zone-content {
  width: 100%;
}

.file-list {
  width: 100%;
  text-align: left;
}
</style>
