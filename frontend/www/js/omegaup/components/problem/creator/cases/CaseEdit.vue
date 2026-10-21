<template>
  <div v-if="getSelectedCase && getSelectedGroup">
    <div class="d-flex justify-content-between">
      <div>
        <h3 class="mb-0 d-md-inline mr-2">{{ getSelectedCase.name }}</h3>
        <h5 class="mb-0 d-none d-md-inline text-muted">
          {{ getSelectedGroup.name }}
        </h5>
      </div>
      <div>
        <b-button
          variant="light"
          class="mr-2"
          @click="editCaseModal = !editCaseModal"
        >
          <div class="container">
            <div class="row">
              <i class="bi bi-pencil-fill text-info mr-1 pt-1" />
              {{ T.problemCreatorEditCase }}
            </div>
          </div>
        </b-button>
        <b-modal
          v-model="editCaseModal"
          :title="T.caseEditTitle"
          :ok-title="T.caseModalSave"
          ok-variant="success"
          :cancel-title="T.caseModalBack"
          cancel-variant="danger"
          teleport-disabled
          lazy
          unmount-lazy
          @ok="updateCaseInfo"
        >
          <omegaup-problem-creator-case-input
            ref="case-input"
            :name="getSelectedCase.name"
            :group="getSelectedGroup.groupID"
            :points="getSelectedCase.points"
            :auto-points="getSelectedCase.autoPoints"
            :edit-mode="true"
          />
        </b-modal>
        <b-button
          data-delete-case
          variant="light"
          class="mr-2"
          @click="
            deleteCase({
              groupID: getSelectedGroup.groupID,
              caseID: getSelectedCase.caseID,
            })
          "
        >
          <div class="container">
            <div class="row">
              <i class="bi bi-trash-fill text-danger mr-1 pt-1" />
              {{ T.problemCreatorDeleteCase }}
            </div>
          </div>
        </b-button>
        <b-dropdown
          ref="dropdown"
          data-menu-dropdown
          variant="light"
          class="h-100"
          right
          no-caret
        >
          <template #button-content>
            <i class="bi bi-three-dots-vertical" />
          </template>
          <b-button
            data-menu-delete-lines
            variant="light"
            class="w-100"
            @click="deleteLines()"
          >
            <div class="d-flex">
              <i class="bi bi-trash text-danger pt-1 mr-3" />
              {{ T.problemCreatorLinesDelete }}
            </div>
          </b-button>
          <b-dropdown-divider></b-dropdown-divider>
          <b-button
            data-menu-download-in
            variant="light"
            class="w-100"
            @click="downloadInputFile('.in')"
          >
            <div class="d-flex">
              <i class="bi bi-box-arrow-down text-info pt-1 mr-3" />
              {{ T.problemCreatorCaseDownloadIn }}
            </div>
          </b-button>
          <b-button
            data-menu-download-txt
            variant="light"
            class="w-100"
            @click="downloadInputFile('.txt')"
          >
            <div class="d-flex">
              <i class="bi bi-text-left text-info pt-1 mr-3" />
              {{ T.problemCreatorCaseDownloadTxt }}
            </div>
          </b-button>
        </b-dropdown>
      </div>
    </div>
    <hr class="border-top my-2" />
    <div>
      <table class="table">
        <draggable
          :value="lines"
          tag="tbody"
          :animation="200"
          handle=".drag-handle"
          @input="lines = $event"
        >
          <tr v-for="line in lines" :key="line.lineID">
            <td>
              <b-container fluid class="bg-light">
                <b-row class="d-flex justify-content-between" align-v="center">
                  <b-col cols="1">
                    <b-button
                      class="btn btn-link drag-handle"
                      type="button"
                      :title="T.problemCreatorLinesReorder"
                      variant="light"
                    >
                      <i class="bi bi-arrow-down-up" />
                    </b-button>
                  </b-col>
                  <b-col cols="2" class="pl-0 pr-2">
                    <b-form-input
                      v-model="line.label"
                      size="sm"
                      :placeholder="T.problemCreatorLabelPlaceHolder"
                    />
                  </b-col>
                  <b-col cols="5" class="pr-0 text-center">
                    <b-form-input
                      v-if="getLineDisplay(line) === LineDisplayOption.LINE"
                      v-model="line.data.value"
                      size="sm"
                      class="mt-3 mb-3"
                      :placeholder="T.problemCreatorContentPlaceHolder"
                    />
                    <b-form-textarea
                      v-if="
                        getLineDisplay(line) === LineDisplayOption.MULTILINE
                      "
                      v-model="line.data.value"
                      class="mt-3 mb-3 text-nowrap overflow-auto w-100"
                      rows="2"
                      max-rows="3"
                      :placeholder="T.problemCreatorContentPlaceHolder"
                    ></b-form-textarea>
                  </b-col>
                  <b-col cols="3" class="pl-2 pr-0 text-center">
                    <b-dropdown
                      :data-array-modal-dropdown="line.lineID"
                      :text="getLineNameFromKind(line.data.kind)"
                      variant="light"
                    >
                      <b-dropdown-item
                        v-for="lineKindOption in lineKindOptions"
                        :key="lineKindOption.kind"
                        :data-array-modal-dropdown-kind="`${line.lineID}-${lineKindOption.kind}`"
                        @click="
                          editLineKind([line.lineID, lineKindOption.kind])
                        "
                      >
                        {{ lineKindOption.type }}
                      </b-dropdown-item>
                    </b-dropdown>
                    <b-button
                      v-if="
                        getEditIconDisplay(line) ===
                        EditIconDisplayOption.EDIT_ICON
                      "
                      :data-line-edit-button="line.lineID"
                      size="sm"
                      type="button"
                      :title="T.problemCreatorLineEdit"
                      variant="light"
                      @click="editModalState(line.data.kind)"
                    >
                      <i class="bi bi-pencil-square text-info" />
                    </b-button>
                    <b-modal
                      v-if="line.data.kind === 'array'"
                      v-model="arrayModalEdit"
                      data-array-modal
                      :title="T.arrayEditTitle"
                      :ok-title="T.arrayModalSave"
                      ok-variant="success"
                      :cancel-title="T.arrayModalBack"
                      cancel-variant="danger"
                      teleport-disabled
                      lazy
                      unmount-lazy
                      @ok="
                        editLineValue([line.lineID, arrayModalEditArray]);
                        arrayModalEditArray = '';
                      "
                    >
                      <b-container>
                        <b-row class="mb-4">
                          <b-col class="text-left">
                            {{ T.arrayModalSize }}
                            <b-form-input
                              v-model="line.data.size"
                              type="number"
                              data-array-modal-size
                            />
                          </b-col>
                          <b-col class="text-left">
                            {{ T.arrayModalMinimum }}
                            <b-form-input
                              v-model="line.data.min"
                              type="number"
                              data-array-modal-min
                            />
                          </b-col>
                          <b-col class="text-left">
                            {{ T.arrayModalMaximum }}
                            <b-form-input
                              v-model="line.data.max"
                              type="number"
                              data-array-modal-max
                            />
                          </b-col>
                        </b-row>
                        <b-row class="mt-2 mb-4">
                          <b-col class="text-left">
                            <b-form-checkbox
                              v-model="line.data.distinct"
                              data-array-modal-checkbox
                            >
                              {{ T.arrayModalDistinctValues }}
                            </b-form-checkbox>
                          </b-col>
                        </b-row>
                        <b-row class="mt-4">
                          <b-col class="text-left">
                            <b-button
                              variant="primary"
                              data-array-modal-generate
                              @click="
                                arrayModalEditArray = getArrayContent(
                                  Number(line.data.size),
                                  Number(line.data.min),
                                  Number(line.data.max),
                                  line.data.distinct,
                                )
                              "
                              >{{ T.arrayModalGenerate }}</b-button
                            >
                          </b-col>
                        </b-row>
                        <hr />
                        <div class="text-left">
                          {{ T.arrayModalGeneratedArray }}
                        </div>
                        <b-form-input
                          v-model="arrayModalEditArray"
                          data-array-modal-generated-array
                          class="w-100"
                        />
                      </b-container>
                    </b-modal>
                    <b-modal
                      v-if="line.data.kind === 'matrix'"
                      v-model="matrixModalEdit"
                      data-matrix-modal
                      :title="T.matrixEditTitle"
                      :ok-title="T.matrixModalSave"
                      ok-variant="success"
                      :cancel-title="T.matrixModalBack"
                      cancel-variant="danger"
                      teleport-disabled
                      lazy
                      unmount-lazy
                      @ok="
                        editLineValue([line.lineID, matrixModalEditArray]);
                        matrixModalEditArray = '';
                      "
                    >
                      <b-container>
                        <b-row class="mb-4">
                          <b-col class="text-left">
                            {{ T.matrixModalRows }}
                            <b-form-input
                              v-model="line.data.rows"
                              type="number"
                              data-matrix-modal-rows
                            />
                          </b-col>
                          <b-col>
                            {{ T.matrixModalColumns }}
                            <b-form-input
                              v-model="line.data.cols"
                              type="number"
                              data-matrix-modal-columns
                            />
                          </b-col>
                          <b-col class="text-left">
                            {{ T.matrixModalMinimum }}
                            <b-form-input
                              v-model="line.data.min"
                              type="number"
                              data-matrix-modal-min
                            />
                          </b-col>
                          <b-col>
                            {{ T.matrixModalMaximum }}
                            <b-form-input
                              v-model="line.data.max"
                              type="number"
                              data-matrix-modal-max
                            />
                          </b-col>
                        </b-row>
                        <b-row class="mt-2 mb-4">
                          <b-col class="text-left">
                            <div class="mb-1 font-weight-bold">
                              {{ T.matrixModalDistinct }}
                            </div>
                            <b-dropdown
                              :text="
                                getDistinctNameFromType(line.data.distinct)
                              "
                              data-matrix-modal-dropdown
                              variant="light"
                            >
                              <b-dropdown-header>
                                {{ T.matrixModalDistinctHeader }}
                              </b-dropdown-header>
                              <b-dropdown-item
                                v-for="matrixDistinctOption in matrixDistinctOptions"
                                :key="matrixDistinctOption.distinctType"
                                :data-matrix-modal-dropdown="
                                  matrixDistinctOption.type
                                "
                                @click="
                                  line.data.distinct =
                                    matrixDistinctOption.distinctType
                                "
                              >
                                {{ matrixDistinctOption.type }}
                              </b-dropdown-item>
                            </b-dropdown>
                          </b-col>
                        </b-row>
                        <b-row class="mt-4">
                          <b-col class="text-left">
                            <b-button
                              variant="primary"
                              data-matrix-modal-generate
                              @click="
                                matrixModalEditArray = getMatrixContent(
                                  Number(line.data.rows),
                                  Number(line.data.cols),
                                  Number(line.data.min),
                                  Number(line.data.max),
                                  line.data.distinct,
                                )
                              "
                              >{{ T.matrixModalGenerate }}</b-button
                            >
                          </b-col>
                        </b-row>
                        <hr />
                        <div class="text-left">
                          {{ T.matrixModalGeneratedArray }}
                        </div>
                        <b-form-textarea
                          v-model="matrixModalEditArray"
                          data-matrix-modal-generated-matrix
                          class="w-100"
                        />
                      </b-container>
                    </b-modal>
                  </b-col>
                  <b-col cols="1">
                    <b-button
                      size="sm"
                      type="button"
                      :title="T.problemCreatorLineDelete"
                      variant="light"
                      @click="deleteLine(line.lineID)"
                    >
                      <i class="bi bi-trash-fill text-danger" />
                    </b-button>
                  </b-col>
                </b-row>
              </b-container>
            </td>
          </tr>
        </draggable>
        <tbody>
          <tr>
            <td>
              <b-container fluid class="bg-light">
                <b-row class="d-flex justify-content-between" align-v="center">
                  <b-col class="pr-1 text-center">
                    <b-form-textarea
                      v-model="getSelectedCase.output"
                      data-output-textarea
                      class="mt-3 mb-3 text-nowrap overflow-auto w-100"
                      rows="2"
                      max-rows="3"
                      :placeholder="T.problemCreatorOutputPlaceHolder"
                    >
                    </b-form-textarea>
                  </b-col>
                  <b-col cols="1.5">
                    <b-button
                      data-erase-output
                      class="btn text-danger btn-lg"
                      type="button"
                      :title="T.problemCreatorEraseOutput"
                      variant="light"
                      @click="getSelectedCase.output = ''"
                    >
                      <i class="bi bi-eraser" />
                    </b-button>
                  </b-col>
                </b-row>
              </b-container>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="text-center">
      <b-button
        data-edit-case-add-line
        variant="light"
        class="mr-2"
        @click="addNewLine"
      >
        <div class="container">
          <div class="row">
            <i class="bi bi-plus-square text-info mr-2 pt-1" />
            {{ T.problemCreatorAddLine }}
          </div>
        </div>
      </b-button>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Ref, toNative } from 'vue-facing-decorator';
import T from '../../../../lang';
import problemCreator_Cases_CaseInput from './CaseInput.vue';
import {
  Case,
  Group,
  CaseLineKind,
  CaseLine,
  LineID,
  CaseGroupID,
  MatrixDistinctType,
  CaseRequest,
  GroupID,
} from '@/js/omegaup/problem/creator/types';
import draggable from 'vuedraggable';

// vuedraggable 2.x is a Vue 2 component whose render function reads
// `$slots.default` as an array of vnodes. The global test/runtime compat turns
// the Vue-2 render shim off (RENDER_FUNCTION: false) because it corrupts BVN
// v-for output, but that same shim is what vuedraggable needs. Scope the shim
// back on for this single component so its render keeps working.
(draggable as { compatConfig?: Record<string, unknown> }).compatConfig = {
  MODE: 2,
  RENDER_FUNCTION: true,
  // Keep Vue 3 v-model semantics for the bootstrap-vue-next form controls
  // rendered inside the draggable rows; MODE 2 would otherwise re-enable the
  // legacy value/input convention and break their two-way binding.
  COMPONENT_V_MODEL: false,
};

@Component({
  components: {
    'omegaup-problem-creator-case-input': problemCreator_Cases_CaseInput,
    draggable: draggable,
  },
})
class CaseEdit extends Vue {
  T = T;
  editCaseModal = false;

  @Ref('case-input') caseInputRef!: problemCreator_Cases_CaseInput;

  arrayModalEdit: boolean = false;
  matrixModalEdit: boolean = false;

  arrayModalEditArray: string = '';
  matrixModalEditArray: string = '';

  // The vuex-class namespaced decorators do not bind under
  // vue-facing-decorator, so the store module is accessed directly through
  // native getters and method wrappers.
  get groups(): Group[] {
    return this.$store.state.casesStore.groups;
  }
  get getSelectedCase(): Case {
    return this.$store.getters['casesStore/getSelectedCase'];
  }
  get getLinesFromSelectedCase(): CaseLine[] {
    return this.$store.getters['casesStore/getLinesFromSelectedCase'];
  }
  get getSelectedGroup(): Group {
    return this.$store.getters['casesStore/getSelectedGroup'];
  }

  editLineKind([lineID, kind]: [LineID, CaseLineKind]): void {
    this.$store.dispatch('casesStore/editLineKind', [lineID, kind]);
  }
  editLineValue([lineID, value]: [LineID, string]): void {
    this.$store.dispatch('casesStore/editLineValue', [lineID, value]);
  }
  deleteCase({ groupID, caseID }: CaseGroupID): void {
    this.$store.commit('casesStore/deleteCase', { groupID, caseID });
  }
  updateCase([oldGroupID, updateCaseRequest]: [GroupID, CaseRequest]): void {
    this.$store.commit('casesStore/updateCase', [
      oldGroupID,
      updateCaseRequest,
    ]);
  }
  getStringifiedLinesFromCaseGroupID(caseGroupID: CaseGroupID): string {
    return this.$store.getters['casesStore/getStringifiedLinesFromCaseGroupID'](
      caseGroupID,
    );
  }

  addNewLine(): void {
    this.$store.dispatch('casesStore/addNewLine');
  }
  setLines(lines: CaseLine[]): void {
    this.$store.dispatch('casesStore/setLines', lines);
  }
  deleteLine(line: LineID): void {
    this.$store.dispatch('casesStore/deleteLine', line);
  }
  deleteLinesForSelectedCase(): void {
    this.$store.dispatch('casesStore/deleteLinesForSelectedCase');
  }

  deleteLines() {
    this.deleteLinesForSelectedCase();
    (this.$refs.dropdown as { hide: (ok?: boolean) => void }).hide(true);
  }

  LineDisplayOption = Object.freeze({
    LINE: 'line',
    MULTILINE: 'multiline',
  });

  EditIconDisplayOption = Object.freeze({
    EDIT_ICON: 'edit_icon',
  });

  get getLineDisplay() {
    return (line: CaseLine) => {
      if (line.data.kind === 'line' || line.data.kind === 'array') {
        return this.LineDisplayOption.LINE;
      }
      return this.LineDisplayOption.MULTILINE;
    };
  }

  get getEditIconDisplay() {
    return (line: CaseLine) => {
      if (line.data.kind === 'array' || line.data.kind === 'matrix') {
        return this.EditIconDisplayOption.EDIT_ICON;
      }
    };
  }

  get lines(): CaseLine[] {
    return this.getLinesFromSelectedCase;
  }

  set lines(newLines: CaseLine[]) {
    this.setLines(newLines);
  }

  lineKindOptions: {
    type: string;
    kind: CaseLineKind;
  }[] = [
    { type: T.problemCreatorLineLine, kind: 'line' },
    { type: T.problemCreatorLineMultiline, kind: 'multiline' },
    { type: T.problemCreatorLineArray, kind: 'array' },
    { type: T.problemCreatorLineMatrix, kind: 'matrix' },
  ];

  matrixDistinctOptions: {
    type: string;
    distinctType: MatrixDistinctType;
  }[] = [
    { type: T.matrixModalDistinctNone, distinctType: MatrixDistinctType.None },
    { type: T.matrixModalDistinctRow, distinctType: MatrixDistinctType.Rows },
    {
      type: T.matrixModalDistinctColumn,
      distinctType: MatrixDistinctType.Cols,
    },
    { type: T.matrixModalDistinctAll, distinctType: MatrixDistinctType.Both },
  ];

  editModalState(kind: CaseLineKind): void {
    if (kind === 'array') {
      this.matrixModalEdit = false;
      this.arrayModalEdit = true;
    } else if (kind === 'matrix') {
      this.arrayModalEdit = false;
      this.matrixModalEdit = true;
    }
  }

  getLineNameFromKind(kind: CaseLineKind): string | undefined {
    return this.lineKindOptions.find((row) => row.kind === kind)?.type;
  }

  getDistinctNameFromType(distinctype: MatrixDistinctType): string | undefined {
    return this.matrixDistinctOptions.find(
      (row) => row.distinctType === distinctype,
    )?.type;
  }

  getDistinctArrayContents(
    size: number,
    low: number = 0,
    high: number = 0,
  ): string {
    const generatedArray = new Set<number>();
    while (generatedArray.size < size) {
      generatedArray.add(low + Math.floor(Math.random() * (high - low + 1)));
    }
    return [...generatedArray].join(' ');
  }

  getNonDistinctArrayContents(
    size: number,
    low: number = 0,
    high: number = 0,
  ): string {
    const generatedArray = [];
    while (generatedArray.length < size) {
      generatedArray.push(low + Math.floor(Math.random() * (high - low + 1)));
    }
    return [...generatedArray].join(' ');
  }

  getArrayContent(
    size: number,
    low: number = 0,
    high: number = 0,
    distinct: boolean = false,
  ): string {
    if (distinct && high - low + 1 < size) {
      return '';
    }
    if (distinct) {
      return this.getDistinctArrayContents(size, low, high);
    } else {
      return this.getNonDistinctArrayContents(size, low, high);
    }
  }

  getNoneDistinctMatrixContents(
    rows: number,
    columns: number,
    low: number = 0,
    high: number = 0,
  ): string {
    const generatedArray: number[] = this.getNonDistinctArrayContents(
      rows * columns,
      low,
      high,
    )
      .split(' ')
      .map(Number);

    let matrix = [];
    let index = 0;

    for (let i = 0; i < rows; i++) {
      let row = [];
      for (let j = 0; j < columns; j++) {
        row.push(generatedArray[index]);
        index++;
      }
      matrix.push(row);
    }

    return matrix.map((row) => row.join(' ')).join('\n');
  }

  getRowsDistinctMatrixContents(
    rows: number,
    columns: number,
    low: number = 0,
    high: number = 0,
  ): string {
    const generatedRows: Set<number>[] = Array.from(
      { length: rows },
      () => new Set<number>(),
    );
    for (let i = 0; i < rows; i++) {
      while (generatedRows[i].size < columns) {
        generatedRows[i].add(
          low + Math.floor(Math.random() * (high - low + 1)),
        );
      }
    }
    return generatedRows.map((row) => [...row].join(' ')).join('\n');
  }

  getColsDistinctMatrixContents(
    rows: number,
    columns: number,
    low: number = 0,
    high: number = 0,
  ): string {
    const generatedColumns: Set<number>[] = Array.from(
      { length: columns },
      () => new Set<number>(),
    );
    for (let i = 0; i < columns; i++) {
      while (generatedColumns[i].size < rows) {
        generatedColumns[i].add(
          low + Math.floor(Math.random() * (high - low + 1)),
        );
      }
    }
    const generatedColumnsList: number[][] = generatedColumns.map((column) =>
      Array.from(column),
    );
    const transposedColumnsList: number[][] = generatedColumnsList[0].map(
      (_, rowIndex) => generatedColumnsList.map((column) => column[rowIndex]),
    );
    return transposedColumnsList.map((row) => row.join(' ')).join('\n');
  }

  getAllDistinctMatrixContents(
    rows: number,
    columns: number,
    low: number = 0,
    high: number = 0,
  ): string {
    const generatedArray: number[] = this.getDistinctArrayContents(
      rows * columns,
      low,
      high,
    )
      .split(' ')
      .map(Number);

    let matrix = [];
    let index = 0;

    for (let i = 0; i < rows; i++) {
      let row = [];
      for (let j = 0; j < columns; j++) {
        row.push(generatedArray[index]);
        index++;
      }
      matrix.push(row);
    }

    return matrix.map((row) => row.join(' ')).join('\n');
  }

  getMatrixContent(
    rows: number,
    columns: number,
    low: number = 0,
    high: number = 100,
    distinct: MatrixDistinctType = MatrixDistinctType.None,
  ): string {
    if (distinct === 'both' && high - low + 1 < rows * columns) {
      return '';
    }
    if (distinct === 'rows' && high - low + 1 < columns) {
      return '';
    }
    if (distinct === 'cols' && high - low + 1 < rows) {
      return '';
    }
    if (distinct === 'none') {
      return this.getNoneDistinctMatrixContents(rows, columns, low, high);
    }
    if (distinct === 'both') {
      return this.getAllDistinctMatrixContents(rows, columns, low, high);
    }
    if (distinct === 'rows') {
      return this.getRowsDistinctMatrixContents(rows, columns, low, high);
    }
    if (distinct === 'cols') {
      return this.getColsDistinctMatrixContents(rows, columns, low, high);
    }
    return '';
  }

  updateCaseInfo() {
    const updateCaseRequest: CaseRequest = {
      groupID: this.caseInputRef.caseGroup,
      caseID: this.getSelectedCase.caseID,
      name: this.caseInputRef.caseName,
      points: this.caseInputRef.casePoints,
      autoPoints: this.caseInputRef.caseAutoPoints,
    };
    const oldGroupID: GroupID = this.getSelectedGroup.groupID;
    this.updateCase([oldGroupID, updateCaseRequest]);
  }

  downloadInputFile(ext: '.txt' | '.in') {
    const caseGroupID: CaseGroupID = {
      groupID: this.getSelectedGroup.groupID,
      caseID: this.getSelectedCase.caseID,
    };
    const input = this.getStringifiedLinesFromCaseGroupID(caseGroupID);
    this.$emit('download-input-file', {
      fileName: `${this.getSelectedCase.name}${ext}`,
      fileContent: input,
    });
  }
}
export default toNative(CaseEdit);
</script>

<style lang="scss" scoped>
.table td {
  vertical-align: middle;
  border: none;
}
</style>
