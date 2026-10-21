<template>
  <BCard
    class="mb-5"
    :header="ui.formatString(T.contestReport, { contest_alias: contestAlias })"
  >
    <BCardText class="text-right">
      <a :href="`/contest/${contestAlias}/report/print/`">
        <i class="bi bi-printer"></i>
      </a>
    </BCardText>
    <BCardText
      v-for="contestantData in contestReport"
      :key="contestantData.username"
      class="pb-2"
    >
      <h1 class="text-center">
        {{
          ui.formatString(T.contestReportUsername, {
            username: contestantData.username,
          })
        }}
      </h1>
      <h3 class="text-center">{{ totalPoints(contestantData) }}</h3>
      <div
        v-for="item in contestantData.problems"
        :key="`${contestantData.username}_${item.alias}`"
        class="pb-2"
      >
        <h3>
          {{
            ui.formatString(T.contestReportProblemWithAlias, {
              alias: item.alias,
            })
          }}
        </h3>
        <h3>
          {{
            ui.formatString(T.contestReportProblemWithPoints, {
              points: item.points,
            })
          }}
        </h3>
        <h3>{{ T.wordsPoints }}: {{ item.points }}</h3>
        <div v-if="item.run_details">
          <BTable
            striped
            hover
            :items="getGroupsByProblemAndUser(item.run_details.details.groups)"
            :fields="groupColumns"
          >
            <template #cell(details)="row">
              <BButton
                :title="T.wordsDetails"
                variant="link"
                @click="row.toggleExpansion"
              >
                <i
                  v-if="row.expansionShowing"
                  class="bi bi-caret-down-square"
                ></i>
                <i v-else class="bi bi-caret-up-square"></i>
              </BButton>
            </template>
            <template #row-expansion="row">
              <BTable
                responsive
                striped
                hover
                :items="row.item.details"
                :fields="casesColumns"
              ></BTable>
            </template>
          </BTable>
        </div>
      </div>
      <hr />
    </BCardText>
  </BCard>
</template>

<script lang="ts">
import { Vue, Component, Prop, toNative } from 'vue-facing-decorator';
import { types } from '../../api_types';
import T from '../../lang';
import * as ui from '../../ui';

// Import Bootstrap Icons
import 'bootstrap-icons/font/bootstrap-icons.css';

import { BCard, BCardText, BTable, BButton } from 'bootstrap-vue-next';

interface GroupDetails {
  name: string;
  time: string;
  wallTime: string;
  memory: string;
  verdict: string;
  score: number;
  diff?: string;
}

@Component({
  components: {
    BCard,
    BCardText,
    BTable,
    BButton,
  },
})
class Report extends Vue {
  @Prop() contestReport!: types.ContestReport[];
  @Prop() contestAlias!: string;

  T = T;
  ui = ui;
  groupColumns = [
    { key: 'group', label: T.wordsGroup, isRowHeader: true },
    { key: 'rank_score', label: T.rankScore },
    { key: 'details', label: T.wordsDetails },
  ];

  casesColumns = [
    { key: 'name', label: T.wordsCase, isRowHeader: true },
    { key: 'time', label: T.wordsTimeInSeconds },
    { key: 'wall_time', label: T.wordsWallTimeInSeconds },
    { key: 'memory', label: T.wordsMemoryInMebibytes },
    { key: 'verdict', label: T.wordsStatus },
    { key: 'score', label: T.rankScore },
    { key: 'diff', label: T.wordsDifference },
  ];

  totalPoints(contestantData: types.ContestReport): string {
    const points = contestantData.total.points ?? 0;
    return ui.formatString(T.contestReportProblemWithPoints, { points });
  }

  getGroupsByProblemAndUser(
    groups: types.RunDetailsGroup[],
  ): { group: string; rankScore: number; details: GroupDetails[] }[] {
    return groups.map((item) => ({
      group: item.group,
      rankScore: item.score,
      details: item.cases.map((row) => ({
        name: row.name,
        time: row.meta.time.toFixed(3),
        wallTime: row.meta.wall_time.toFixed(3),
        memory: row.meta.memory.toFixed(2),
        verdict: row.verdict,
        score: row.score,
        diff: row.out_diff,
      })),
    }));
  }
}
export default toNative(Report);
</script>

<style lang="scss" scoped>
@import '../../../../sass/site';

h1 {
  font-size: 1.5em;
  page-break-after: avoid;
  page-break-inside: avoid;
}
h3 {
  font-size: 1.15em;
  page-break-after: avoid;
  page-break-inside: avoid;
}
</style>
