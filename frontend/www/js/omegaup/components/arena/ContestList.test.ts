jest.mock('../../../../third_party/js/diff_match_patch.js');

import T from '../../lang';
import { mount } from '@vue/test-utils';
import type { types } from '../../api_types';

import arena_ContestList from './ContestList.vue';
import { ContestOrder, ContestTab, ContestFilter } from './ContestList_types';
import each from 'jest-each';

// Minimal view of the component instance for the internals the tests reach
// into. The component is `toNative`'d so its class type is not exported.
interface ContestListVm {
  currentFilter: ContestFilter;
  currentOrder: ContestOrder;
}

// `@fortawesome/vue-fontawesome` v2 is the Vue 2 build; its render function uses
// the Vue 2 `{ attrs }` vnode-data shape, which @vue/compat (with
// RENDER_FUNCTION disabled, as required for native SFC templates) cannot patch —
// it throws `InvalidCharacterError: "0" ...`. Stub the icon so the component
// under test can mount. These suites assert on behavior, not icon glyphs.
const global = {
  stubs: {
    FontAwesomeIcon: true,
    'font-awesome-icon': true,
  },
};

describe('ContestList.vue', () => {
  const daySeconds = 24 * 60 * 60 * 1000;
  const today = new Date();
  const yesterday = new Date(today.getTime() - daySeconds);
  const tomorrow = new Date(today.getTime() + daySeconds);

  const contests: types.ContestList = {
    current: [
      {
        admission_mode: 'public',
        alias: 'Contest-1',
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
        recommended: true,
        start_time: yesterday,
        title: 'Current Contest 1',
        window_length: 300,
      },
      {
        admission_mode: 'public',
        alias: 'Contest-3',
        description: 'hello contest 3',
        contest_id: 3,
        contestants: 15,
        finish_time: new Date(tomorrow.getTime() + daySeconds * 2),
        last_updated: yesterday,
        organizer: 'alfadown',
        original_finish_time: tomorrow,
        score_mode: 'all_or_nothing',
        participating: false,
        problemset_id: 1,
        recommended: false,
        start_time: yesterday,
        title: 'Current Contest 3',
        window_length: 300,
      },
      {
        admission_mode: 'public',
        alias: 'Contest-2',
        description: 'hello contest 2',
        contest_id: 2,
        contestants: 5,
        finish_time: new Date(tomorrow.getTime() + daySeconds),
        last_updated: yesterday,
        organizer: 'lamdaleft',
        original_finish_time: tomorrow,
        score_mode: 'all_or_nothing',
        participating: true,
        problemset_id: 1,
        recommended: true,
        start_time: yesterday,
        title: 'Current Contest 2',
        window_length: 300,
      },
    ],
    future: [
      {
        admission_mode: 'public',
        alias: 'Contest-1',
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
      },
      {
        admission_mode: 'public',
        alias: 'Contest-3',
        description: 'hello contest 3',
        contest_id: 3,
        contestants: 15,
        finish_time: new Date(tomorrow.getTime() + daySeconds * 3),
        last_updated: today,
        organizer: 'alfadown',
        original_finish_time: new Date(tomorrow.getTime() + daySeconds),
        score_mode: 'all_or_nothing',
        participating: false,
        problemset_id: 1,
        recommended: false,
        start_time: tomorrow,
        title: 'Future Contest 3',
        window_length: 300,
      },
      {
        admission_mode: 'public',
        alias: 'Contest-2',
        description: 'hello contest 2',
        contest_id: 2,
        contestants: 5,
        finish_time: new Date(tomorrow.getTime() + daySeconds * 2),
        last_updated: today,
        organizer: 'lamdaleft',
        original_finish_time: new Date(tomorrow.getTime() + daySeconds),
        score_mode: 'all_or_nothing',
        participating: true,
        problemset_id: 1,
        recommended: true,
        start_time: tomorrow,
        title: 'Future Contest 2',
        window_length: 300,
      },
    ],
    past: [
      {
        admission_mode: 'public',
        alias: 'Contest-1',
        description: 'hello contest 1',
        contest_id: 1,
        contestants: 12,
        finish_time: new Date(yesterday.getTime() - daySeconds * 2),
        last_updated: new Date(yesterday.getTime() - daySeconds),
        organizer: 'omegaup',
        original_finish_time: yesterday,
        score_mode: 'all_or_nothing',
        participating: true,
        problemset_id: 1,
        recommended: true,
        start_time: new Date(yesterday.getTime() - daySeconds),
        title: 'Past Contest 1',
        window_length: 300,
      },
      {
        admission_mode: 'public',
        alias: 'Contest-3',
        description: 'hello contest 3',
        contest_id: 3,
        contestants: 15,
        finish_time: yesterday /*new Date(yesterday.getTime() - daySeconds * 2)*/,
        last_updated: new Date(yesterday.getTime() - daySeconds),
        organizer: 'alfadown',
        original_finish_time: yesterday,
        score_mode: 'all_or_nothing',
        participating: false,
        problemset_id: 1,
        recommended: false,
        start_time: new Date(yesterday.getTime() - daySeconds * 3),
        title: 'Past Contest 3',
        window_length: 300,
      },
      {
        admission_mode: 'public',
        alias: 'Contest-2',
        description: 'hello contest 2',
        contest_id: 2,
        contestants: 5,
        finish_time: new Date(yesterday.getTime() - daySeconds),
        last_updated: new Date(yesterday.getTime() - daySeconds),
        organizer: 'lambdaleft',
        original_finish_time: yesterday,
        score_mode: 'all_or_nothing',
        participating: true,
        problemset_id: 1,
        recommended: true,
        start_time: new Date(yesterday.getTime() - daySeconds * 3),
        title: 'Past Contest 2',
        window_length: 300,
      },
    ],
  };

  it('Should show the current contest list', async () => {
    const wrapper = mount(arena_ContestList, {
      props: {
        contests,
        tab: ContestTab.Current,
      },
      global,
    });

    const currentContestTab = wrapper.findAll('.section-container')[0];

    expect(currentContestTab.exists()).toBe(true);
    expect(currentContestTab.text()).toContain('Current Contest 1');
  });

  it('Should show the future contest list', async () => {
    const wrapper = mount(arena_ContestList, {
      props: {
        contests,
        tab: ContestTab.Future,
      },
      global,
    });

    const futureContestTab = wrapper.findAll('.section-container')[1];

    expect(futureContestTab.exists()).toBe(true);
    expect(futureContestTab.text()).toContain('Future Contest 1');
  });

  it('Should show the past contest list', async () => {
    const wrapper = mount(arena_ContestList, {
      props: {
        contests,
        tab: ContestTab.Past,
      },
      global,
    });

    const pastContestTab = wrapper.findAll('.section-container')[2];

    expect(pastContestTab.exists()).toBe(true);
    expect(pastContestTab.text()).toContain('Past Contest 1');
  });

  it('Should hide empty summary sections in ArenaV2 view', async () => {
    const contestsWithOnlyPast: types.ContestList = {
      current: [],
      future: [],
      past: contests.past,
    };
    const wrapper = mount(arena_ContestList, {
      props: {
        contests: contestsWithOnlyPast,
        tab: ContestTab.Current,
      },
      global,
    });

    const sections = wrapper.findAll('.section-container');
    expect(sections.length).toBe(1);
    expect(wrapper.text()).toContain('Past Contest 1');
    expect(wrapper.text()).not.toContain('Current Contest 1');
    expect(wrapper.text()).not.toContain('Future Contest 1');
  });

  it('Should show empty message when all summary sections are empty', async () => {
    const emptyContests: types.ContestList = {
      current: [],
      future: [],
      past: [],
    };
    const wrapper = mount(arena_ContestList, {
      props: {
        contests: emptyContests,
        tab: ContestTab.Current,
      },
      global,
    });

    expect(wrapper.findAll('.section-container').length).toBe(0);
    expect(wrapper.text()).toContain(T.contestListEmpty);
  });

  it('Should not throw when recalculating scroll for a hidden/empty tab', () => {
    const contestsWithOnlyPast: types.ContestList = {
      current: [],
      future: [],
      past: contests.past,
    };
    const wrapper = mount(arena_ContestList, {
      props: {
        contests: contestsWithOnlyPast,
        tab: ContestTab.Current,
      },
      global,
    });

    // Hidden tabs have no scrollContainer ref. onScroll previously did
    // (this.$refs[key] as HTMLElement[])[0] and threw
    // "Cannot read properties of undefined (reading '0')" on the missing ref.
    expect(() => {
      (wrapper.vm as any).onScroll(ContestTab.Current);
      (wrapper.vm as any).onScroll(ContestTab.Future);
    }).not.toThrow();
  });

  it('Should not render Virtual/Practice in Current contests', () => {
    const wrapper = mount(arena_ContestList, {
      props: {
        contests,
        tab: ContestTab.Current,
      },
      global,
    });

    const currentContestTab = wrapper.findAll('.section-container')[0];
    expect(currentContestTab.text()).not.toContain(T.contestVirtualMode);
    expect(currentContestTab.text()).not.toContain(T.contestPracticeMode);
  });

  it('Should not render Virtual/Practice in Future contests', () => {
    const wrapper = mount(arena_ContestList, {
      props: {
        contests,
        tab: ContestTab.Future,
      },
      global,
    });

    const futureContestTab = wrapper.findAll('.section-container')[1];
    expect(futureContestTab.text()).not.toContain(T.contestVirtualMode);
    expect(futureContestTab.text()).not.toContain(T.contestPracticeMode);
  });

  it('Should handle filter buttons', async () => {
    const wrapper = mount(arena_ContestList, {
      props: {
        contests,
        tab: ContestTab.Current,
      },
      global,
    });
    const dropdownFilterBy = wrapper.findComponent({
      ref: 'dropdownFilterBy',
    });
    // Current filter "By All" is turned on by default
    expect((wrapper.vm as unknown as ContestListVm).currentFilter).toBe(ContestFilter.All);
    await dropdownFilterBy.find('[data-filter-by-signed-up]').trigger('click');
    expect((wrapper.vm as unknown as ContestListVm).currentFilter).toBe(ContestFilter.SignedUp);
    await dropdownFilterBy
      .find('[data-filter-by-recommended]')
      .trigger('click');
    expect((wrapper.vm as unknown as ContestListVm).currentFilter).toBe(ContestFilter.OnlyRecommended);
  });

  const dropdownMapping = [
    [{ value: T.contestOrderByTitle }],
    [{ value: T.contestOrderByEnds }],
    [{ value: T.contestOrderByDuration }],
    [{ value: T.contestOrderByOrganizer }],
    [{ value: T.contestOrderByContestants }],
    [{ value: T.contestOrderBySignedUp }],
  ];

  each(dropdownMapping).it(
    'Should show dropdown when "%s" field is selected',
    async (value) => {
      const wrapper = mount(arena_ContestList, {
        props: {
          contests,
        },
      global,
      });

      const dropdownOrderBy = wrapper.findComponent({
        ref: 'dropdownOrderBy',
      }).element as HTMLInputElement;

      dropdownOrderBy.value = value;
      await dropdownOrderBy.dispatchEvent(new Event('change'));
      expect(dropdownOrderBy.value).toBe(value);
    },
  );

  const tabMapping = [
    [{ tab: ContestTab.Current }],
    [{ tab: ContestTab.Future }],
    [{ tab: ContestTab.Past }],
  ];

  const orderMapping = [
    [
      {
        field: ContestOrder.Title,
        name: 'title',
      },
    ],
    [
      {
        field: ContestOrder.Ends,
        name: 'ends',
      },
    ],
    [
      {
        field: ContestOrder.Duration,
        name: 'duration',
      },
    ],
    [
      {
        field: ContestOrder.Organizer,
        name: 'organizer',
      },
    ],
    [
      {
        field: ContestOrder.Contestants,
        name: 'contestants',
      },
    ],
    [
      {
        field: ContestOrder.SignedUp,
        name: 'signed-up',
      },
    ],
  ];

  each(orderMapping).describe(
    'Should order correctly current contest list when "%s" field is selected',
    ({ field, name }) => {
      each(tabMapping).it('When selected tab equal to %s', async ({ tab }) => {
        const wrapper = mount(arena_ContestList, {
          props: {
            contests,
            tab,
          },
      global,
        });

        const dropdown = wrapper.findComponent({ ref: 'dropdownOrderBy' });
        expect(dropdown.exists()).toBeTruthy();
        expect((wrapper.vm as unknown as ContestListVm).currentOrder).toBe(ContestOrder.None);

        // Find and click the dropdown item
        await dropdown.find(`[data-order-by-${name}]`).trigger('click');
        await wrapper.vm.$nextTick();
        expect((wrapper.vm as unknown as ContestListVm).currentOrder).toBe(field);

        const emittedEvents = wrapper.emitted('fetch-page');

        // Instead of checking for specific page numbers, check that the event was emitted
        // with the correct sorting order and that the page was reset to 1
        const lastEmmitedEvent = emittedEvents?.slice(-1)[0] as [
          { params: { sort_order: ContestOrder; page: number } },
        ];
        expect(lastEmmitedEvent[0].params.sort_order).toBe(field);
        expect(lastEmmitedEvent[0].params.page).toBe(1);
      });
    },
  );
});
