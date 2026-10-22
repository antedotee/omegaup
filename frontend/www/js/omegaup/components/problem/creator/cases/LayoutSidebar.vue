<template>
  <div class="h-77 overflow-auto">
    <div
      v-for="layout in getAllLayouts"
      :key="layout.layoutID"
      class="d-flex justify-content-center"
    >
      <b-modal
        v-model="showRenameModal[layout.layoutID]"
        size="sm"
        data-layout-dropdown-rename-modal
        :title="T.problemCreatorRenameModalTitle"
        :ok-title="T.problemCreatorRenameModalRename"
        ok-variant="success"
        :cancel-title="T.problemCreatorRenameModalBack"
        cancel-variant="danger"
        teleport-disabled
        lazy
        unmount-lazy
        @ok="
          editLayoutName([
            layout.layoutID,
            editLayoutModalName[layout.layoutID],
          ])
        "
      >
        <b-form-input
          :model-value="editLayoutModalName[layout.layoutID]"
          data-layout-sidebar-rename-layout
          @update:model-value="editLayoutModalName[layout.layoutID] = $event"
        />
      </b-modal>
      <b-card no-body class="w-84 mb-2">
        <b-card-header class="p-0">
          <b-dropdown
            block
            split
            right
            :data-layout-dropdown="layout.layoutID"
            :text="layout.name"
            variant="primary"
            @click="showLayout[layout.layoutID] = !showLayout[layout.layoutID]"
          >
            <b-dropdown-item
              data-layout-dropdown-rename-layout
              @click="
                showRenameModal[layout.layoutID] =
                  !showRenameModal[layout.layoutID]
              "
            >
              <div class="d-flex">
                <i class="bi bi-pencil text-success pt-1 me-3" />
                {{ T.problemCreatorRenameLayout }}
              </div>
            </b-dropdown-item>
            <b-dropdown-item
              data-layout-dropdown-enforce-to-selected
              @click="enforceLayoutToTheSelectedCase(layout.layoutID)"
            >
              <div class="d-flex">
                <i class="bi bi-arrow-left-right text-success pt-1 me-3" />
                {{ T.problemCreatorLayoutLoadToSelected }}
              </div>
            </b-dropdown-item>
            <b-dropdown-item
              data-layout-dropdown-enforce-to-all
              @click="enforceLayoutToAllCases(layout.layoutID)"
            >
              <div class="d-flex">
                <i class="bi bi-arrow-repeat text-success pt-1 me-3" />
                {{ T.problemCreatorLayoutLoadToAll }}
              </div>
            </b-dropdown-item>
            <b-dropdown-item
              data-layout-dropdown-copy
              @click="copyLayout(layout.layoutID)"
            >
              <div class="d-flex">
                <i class="bi bi-box-arrow-in-down text-success pt-1 me-3" />
                {{ T.problemCreatorLayoutCopy }}
              </div>
            </b-dropdown-item>
            <b-dropdown-item
              data-layout-dropdown-delete
              @click="removeLayout(layout.layoutID)"
            >
              <div class="d-flex">
                <i class="bi bi-trash text-danger pt-1 me-3" />
                {{ T.problemCreatorLayoutDelete }}
              </div>
            </b-dropdown-item>
          </b-dropdown>
        </b-card-header>
        <b-collapse v-model="showLayout[layout.layoutID]">
          <div>
            <table class="table">
              <tbody>
                <tr v-for="lineInfo in layout.caseLineInfos">
                  <td class="align-middle border-0">
                    <b-container fluid class="bg-light">
                      <b-row
                        class="d-flex justify-content-between"
                        align-v="center"
                      >
                        <b-col cols="4" class="mt-2 mb-2 ps-2 pe-1">
                          <b-form-input
                            :model-value="lineInfo.label"
                            size="sm"
                            :placeholder="T.problemCreatorLabelPlaceHolder"
                            @update:model-value="lineInfo.label = $event"
                          />
                        </b-col>
                        <b-col cols="6" class="ps-0 pe-0 text-center">
                          <b-dropdown
                            data-line-info-dropdown
                            :text="getLineNameFromKind(lineInfo.data.kind)"
                            variant="light"
                          >
                            <b-dropdown-item
                              v-for="lineKindOption in lineKindOptions"
                              :key="lineKindOption.kind"
                              :data-line-info-dropdown-item="
                                lineKindOption.kind
                              "
                              @click="
                                editLineInfoKind([
                                  layout.layoutID,
                                  lineInfo.lineInfoID,
                                  lineKindOption.kind,
                                ])
                              "
                            >
                              {{ lineKindOption.kind }}
                            </b-dropdown-item>
                          </b-dropdown>
                          <b-button
                            v-if="
                              getEditIconDisplay(lineInfo) ===
                              EditIconDisplayOption.EDIT_ICON
                            "
                            size="sm"
                            type="button"
                            :title="T.problemCreatorLineEdit"
                            variant="light"
                          >
                            <i class="bi bi-pencil-square text-info" />
                          </b-button>
                        </b-col>
                        <b-col cols="2">
                          <b-button
                            size="sm"
                            type="button"
                            :title="T.problemCreatorLineDelete"
                            variant="light"
                            @click="
                              removeLineInfoFromLayout([
                                layout.layoutID,
                                lineInfo.lineInfoID,
                              ])
                            "
                          >
                            <i class="bi bi-trash-fill text-danger" />
                          </b-button>
                        </b-col>
                      </b-row>
                    </b-container>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="text-center mb-2">
            <b-button
              data-layout-add-line-info
              variant="light"
              class="me-2"
              @click="addNewLineInfoToLayout(layout.layoutID)"
            >
              <div class="container">
                <div class="row">
                  <i class="bi bi-plus-square text-info me-2 pt-1" />
                  {{ T.problemCreatorLayoutAddLineInfo }}
                </div>
              </div>
            </b-button>
          </div>
        </b-collapse>
      </b-card>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Watch, toNative } from 'vue-facing-decorator';
import T from '../../../../lang';
import {
  Layout,
  LayoutID,
  CaseLineKind,
  LineInfoID,
  Group,
  CaseLineInfo,
} from '@/js/omegaup/problem/creator/types';

@Component
class Sidebar extends Vue {
  T = T;

  // The vuex-class namespaced decorators do not bind under
  // vue-facing-decorator, so the store module is accessed directly through
  // native getters and method wrappers.
  get groups(): Group[] {
    return this.$store.state.casesStore.groups;
  }
  get getAllLayouts(): Layout[] {
    return this.$store.getters['casesStore/getAllLayouts'];
  }
  enforceLayoutToTheSelectedCase(layoutID: LayoutID): void {
    this.$store.commit('casesStore/enforceLayoutToTheSelectedCase', layoutID);
  }
  addNewLineInfoToLayout(layoutID: LayoutID): void {
    this.$store.commit('casesStore/addNewLineInfoToLayout', layoutID);
  }
  editLineInfoKind([layoutID, lineInfoID, kind]: [
    LayoutID,
    LineInfoID,
    CaseLineKind,
  ]): void {
    this.$store.commit('casesStore/editLineInfoKind', [
      layoutID,
      lineInfoID,
      kind,
    ]);
  }
  enforceLayoutToAllCases(layoutID: LayoutID): void {
    this.$store.commit('casesStore/enforceLayoutToAllCases', layoutID);
  }
  copyLayout(layoutID: LayoutID): void {
    this.$store.commit('casesStore/copyLayout', layoutID);
  }
  removeLayout(layoutID: LayoutID): void {
    this.$store.commit('casesStore/removeLayout', layoutID);
  }
  removeLineInfoFromLayout([layoutID, lineInfoID]: [
    LayoutID,
    LineInfoID,
  ]): void {
    this.$store.commit('casesStore/removeLineInfoFromLayout', [
      layoutID,
      lineInfoID,
    ]);
  }
  editLayoutName([layoutID, newValue]: [LayoutID, string]): void {
    this.$store.commit('casesStore/editLayoutName', [layoutID, newValue]);
  }

  showLayout: { [key: LayoutID]: boolean } = {};
  showRenameModal: { [key: LayoutID]: boolean } = {};
  editLayoutModalName: { [key: LayoutID]: string } = {};

  @Watch('getAllLayouts')
  onGroupsChanged() {
    this.showLayout = this.getAllLayouts.reduce((acc, layout) => {
      acc[layout.layoutID] = false;
      return acc;
    }, {} as { [key: string]: boolean });
    this.showRenameModal = this.getAllLayouts.reduce((acc, layout) => {
      acc[layout.layoutID] = false;
      return acc;
    }, {} as { [key: string]: boolean });
    this.editLayoutModalName = this.getAllLayouts.reduce((acc, layout) => {
      acc[layout.layoutID] = layout.name;
      return acc;
    }, {} as { [key: string]: string });
  }

  EditIconDisplayOption = Object.freeze({
    EDIT_ICON: 'edit_icon',
  });

  get getEditIconDisplay() {
    return (lineInfo: CaseLineInfo) => {
      if (lineInfo.data.kind === 'array' || lineInfo.data.kind === 'matrix') {
        return this.EditIconDisplayOption.EDIT_ICON;
      }
    };
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

  getLineNameFromKind(kind: CaseLineKind) {
    return this.lineKindOptions.find((line) => line.kind === kind)?.type;
  }
}
export default toNative(Sidebar);
</script>

<style lang="scss" scoped>
.h-77 {
  height: 77%;
}

.w-84 {
  width: 84%;
}
</style>
