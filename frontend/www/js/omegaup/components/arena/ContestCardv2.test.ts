jest.mock('../../../../third_party/js/diff_match_patch.js');

import { mount } from '@vue/test-utils';
import type { types } from '../../api_types';
import T from '../../lang';
import ContestCardv2 from './ContestCardv2.vue';
import { ContestTab } from './ContestList_types';

// `@fortawesome/vue-fontawesome` v2 is the Vue 2 build; its render function uses
// the Vue 2 `{ attrs }` vnode-data shape, which @vue/compat (with
// RENDER_FUNCTION disabled, as required for native SFC templates) cannot patch —
// it throws `InvalidCharacterError: "0" ...`. Stub the icon so the components
// under test can mount. The arena suites assert on behavior, not icon glyphs.
const global = {
  stubs: {
    FontAwesomeIcon: true,
    'font-awesome-icon': true,
  },
};

describe('ContestCardv2.vue', () => {
  const daySeconds = 24 * 60 * 60 * 1000;
  const today = new Date();
  const yesterday = new Date(today.getTime() - daySeconds);
  const tomorrow = new Date(today.getTime() + daySeconds);

  const currentTab: ContestTab = ContestTab.Current;
  const futureTab: ContestTab = ContestTab.Future;
  const pastTab: ContestTab = ContestTab.Past;

  const currentContest: types.ContestListItem = {
    admission_mode: 'public',
    alias: 'Current-Contest-1',
    description: 'hello contest 1',
    contest_id: 1,
    contestants: 12,
    finish_time: tomorrow,
    last_updated: yesterday,
    organizer: 'omegaup',
    original_finish_time: tomorrow,
    score_mode: 'all_or_nothing',
    participating: true,
    problemset_id: 1,
    recommended: false,
    start_time: yesterday,
    title: 'Current Contest 1',
    window_length: 300,
  };

  const futureContest: types.ContestListItem = {
    admission_mode: 'public',
    alias: 'Future-Contest-1',
    description: 'hello contest 1',
    contest_id: 1,
    contestants: 12,
    finish_time: new Date(tomorrow.getTime() + daySeconds),
    last_updated: today,
    organizer: 'omegaup',
    original_finish_time: new Date(tomorrow.getTime() + daySeconds),
    score_mode: 'all_or_nothing',
    participating: true,
    problemset_id: 1,
    recommended: true,
    start_time: tomorrow,
    title: 'Future Contest 1',
    window_length: 300,
  };

  const pastContest: types.ContestListItem = {
    admission_mode: 'public',
    alias: 'Past-Contest-1',
    description: 'hello contest 1',
    contest_id: 1,
    contestants: 12,
    finish_time: yesterday,
    last_updated: new Date(yesterday.getTime() - daySeconds),
    organizer: 'omegaup',
    original_finish_time: yesterday,
    score_mode: 'all_or_nothing',
    participating: true,
    problemset_id: 1,
    recommended: false,
    start_time: new Date(yesterday.getTime() - daySeconds),
    title: 'Past Contest 1',
    window_length: 300,
  };

  it('Should show the current contest card', async () => {
    const wrapper = mount(ContestCardv2, {
      props: {
        contest: currentContest,
        contestTab: currentTab,
      },
      global,
    });

    // `contestEnrollStatus` is a plain <div> ref. @vue/test-utils 2's
    // `findComponent({ ref })` only matches component instances, not DOM
    // elements (it did in v1), so read the ref off the instance instead.
    const contestEnrollStatus = wrapper.vm as unknown as {
      $refs: { contestEnrollStatus?: HTMLElement };
    };

    const contestButtonEnter = wrapper.findComponent({
      ref: 'contestButtonEnter',
    });

    expect(contestEnrollStatus.$refs.contestEnrollStatus).toBeTruthy();
    expect(contestButtonEnter.text()).toBe(T.contestButtonEnter);

    const contestButtonVirtual = wrapper.findComponent({
      ref: 'contestButtonVirtual',
    });
    const contestButtonPractice = wrapper.findComponent({
      ref: 'contestButtonPractice',
    });

    expect(contestButtonVirtual.exists()).toBe(true);
    expect(contestButtonPractice.exists()).toBe(true);
  });

  it('Should show the future contest card', async () => {
    const wrapper = mount(ContestCardv2, {
      props: {
        contest: futureContest,
        contestTab: futureTab,
      },
      global,
    });

    // `contestEnrollStatus` is a plain <div> ref; read it off the instance
    // (see the note in the current-card test above).
    const vm = wrapper.vm as unknown as {
      $refs: { contestEnrollStatus?: HTMLElement };
    };
    const contestButtonEnter = wrapper.findComponent({
      ref: 'contestButtonEnter',
    });
    const contestButtonSeeDetails = wrapper.findComponent({
      ref: 'contestButtonSeeDetails',
    });
    const contestIconRecommended = wrapper.findComponent({
      ref: 'contestIconRecommended',
    });

    expect(vm.$refs.contestEnrollStatus).toBeTruthy();
    expect(contestButtonEnter.exists()).toBe(true);
    expect(contestIconRecommended.exists()).toBe(true);
    expect(contestButtonSeeDetails.exists()).toBe(false);
  });

  it('Should show the past contest card', async () => {
    const wrapper = mount(ContestCardv2, {
      props: {
        contest: pastContest,
        contestTab: pastTab,
      },
      global,
    });

    const contestButtonScoreboard = wrapper.findComponent({
      ref: 'contestButtonScoreboard',
    });

    expect(contestButtonScoreboard.exists()).toBe(true);
  });
});
