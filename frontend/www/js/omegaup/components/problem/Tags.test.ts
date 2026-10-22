import { mount } from '@vue/test-utils';

import T from '../../lang';

import problem_Tags from './Tags.vue';

const baseProblemTagsPropsData = {
  alias: '',
  canAddNewTags: true,
  initialAllowTags: true,
  isCreate: true,
  levelTags: [
    'problemLevelAdvancedCompetitiveProgramming',
    'problemLevelAdvancedSpecializedTopics',
    'problemLevelBasicIntroductionToProgramming',
    'problemLevelBasicKarel',
    'problemLevelIntermediateAnalysisAndDesignOfAlgorithms',
    'problemLevelIntermediateDataStructuresAndAlgorithms',
    'problemLevelIntermediateMathsInProgramming',
  ],
  publicTags: ['some', 'public', 'tags'],
  selectedPrivateTags: [] as string[],
  selectedPublicTags: [] as string[],
  title: '',
};

describe('Tags.vue', () => {
  it('Should handle problem tags form when problem is created', () => {
    const wrapper = mount(problem_Tags, {
      props: baseProblemTagsPropsData,
    });

    expect(wrapper.text()).not.toContain(T.updateProblemLevel);
  });

  it('Should handle problem tags form when problem is edited', () => {
    const wrapper = mount(problem_Tags, {
      props: Object.assign({}, baseProblemTagsPropsData, {
        isCreate: false,
      }),
    });

    expect(wrapper.text()).toContain(T.updateProblemLevel);
  });
  it('Should mount the public-tag help as a v-b-tooltip', () => {
    const wrapper = mount(problem_Tags, {
      props: baseProblemTagsPropsData,
    });
    // vBTooltip moves the native title into data-original-title on mount.
    const help = wrapper.find(
      `a[data-original-title="${T.problemEditTagPublicRequired}"]`,
    );
    expect(help.exists()).toBe(true);
    expect(help.attributes('title')).toBeUndefined();
    expect(help.attributes('data-toggle')).toBeUndefined();
    expect(help.attributes('rel')).toBeUndefined();
  });
});
