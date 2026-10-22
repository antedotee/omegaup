import { shallowMount, VueWrapper } from '@vue/test-utils';
import { BCollapse } from 'bootstrap-vue-next';

import T from '../../lang';

import contest_Form from './Form.vue';

import Multiselect from 'vue-multiselect/src/Multiselect.vue';

import { types } from '../../api_types';

// Minimal view of the component instance for the internals the tests reach
// into. The component is `toNative`'d so its class type is not exported.
interface ContestFormVm {
  currentScoreMode: string;
}

describe('Form.vue', () => {
  beforeAll(() => {
    const div = document.createElement('div');
    div.id = 'root';
    document.body.appendChild(div);
  });

  afterAll(() => {
    const rootDiv = document.getElementById('root');
    if (rootDiv) {
      document.body.removeChild(rootDiv);
    }
  });

  it('Should handle add contest form', async () => {
    const startTime = new Date();
    const finishTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    const wrapper = shallowMount(contest_Form, {
      props: {
        update: false,
        allLanguages: [{ py2: 'Python 2' }, { py3: 'Python 3' }],
        initialLanguages: [],
        initialFinishTime: finishTime,
        initialStartTime: startTime,
        initialSubmissionsGap: 1,
      },
    });

    expect(wrapper.find('div.card .card-header').text()).toContain(
      T.contestNew,
    );

    const contest = {
      alias: 'contestAlias',
      title: 'Contest Title',
      description: 'Contest description.',
    };
    await wrapper.setData(contest);

    expect(wrapper.find('form button[type="submit"]').text()).toBe(
      T.contestNewFormScheduleContest,
    );
  });

  it('Should handle edit contest form', async () => {
    const startTime = new Date();
    const finishTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    const wrapper = shallowMount(contest_Form, {
      attachTo: '#root',
      props: {
        update: true,
        allLanguages: [{ py2: 'Python 2' }, { py3: 'Python 3' }],
        initialLanguages: ['py2'],
        initialFinishTime: finishTime,
        initialStartTime: startTime,
        initialSubmissionsGap: 1,
        initialAlias: 'contestAlias',
        initialTitle: 'Contest Title',
        initialDescription: 'Contest description.',
      },
    });

    expect(wrapper.find('form button[type="submit"]').text()).toBe(
      T.contestNewFormUpdateContest,
    );
    await wrapper.find('form button[type="submit"]').trigger('click');
    expect(wrapper.emitted('update-contest')).toBeDefined();
    wrapper.unmount();
  });

  const problems: types.ProblemsetProblemWithVersions[] = [
    {
      accepted: 0,
      accepts_submissions: true,
      alias: 'problemaSoloSalida',
      commit: 'commit',
      difficulty: 0,
      has_submissions: false,
      input_limit: 1024,
      languages: 'cat',
      order: 1,
      points: 100,
      quality_seal: false,
      submissions: 0,
      title: 'Problema solo salida',
      version: 'version',
      versions: { log: [], published: '' },
      visibility: 2,
      visits: 0,
    },
  ];

  it('Should block language removal', async () => {
    const startTime = new Date();
    const finishTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    const wrapper = shallowMount(contest_Form, {
      props: {
        update: true,
        allLanguages: [
          { py2: 'Python 2' },
          { py3: 'Python 3' },
          { cat: 'cat' },
        ],
        initialLanguages: ['py2', 'cat'],
        initialFinishTime: finishTime,
        initialStartTime: startTime,
        initialSubmissionsGap: 1,
        initialAlias: 'contestAlias',
        initialTitle: 'Contest Title',
        initialDescription: 'Contest description.',
        problems,
      },
    });
    await wrapper.findComponent(Multiselect).vm.$emit('remove', 'cat');
    expect(wrapper.emitted('language-remove-blocked')).toBeDefined();
    wrapper.unmount();
  });
  it('Should update score mode when', async () => {
    const startTime = new Date();
    const finishTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    const wrapper = shallowMount(contest_Form, {
      props: {
        update: true,
        allLanguages: [
          { py2: 'Python 2' },
          { py3: 'Python 3' },
          { cat: 'cat' },
        ],
        initialLanguages: ['py2', 'cat'],
        initialStartTime: startTime,
        initialFinishTime: finishTime,
        initialSubmissionsGap: 1,
        initialAlias: 'contestAlias',
        initialTitle: 'Contest Title',
        initialDescription: 'Contest description.',
        problems,
      },
    });

    expect((wrapper.vm as unknown as ContestFormVm).currentScoreMode).toBe(
      'partial',
    );
    await wrapper.find('[data-contest-icpc]').trigger('click');
    expect((wrapper.vm as unknown as ContestFormVm).currentScoreMode).toBe(
      'all_or_nothing',
    );
    await wrapper.find('[data-contest-preioi]').trigger('click');
    expect((wrapper.vm as unknown as ContestFormVm).currentScoreMode).toBe(
      'partial',
    );
    await wrapper.find('[data-contest-omi]').trigger('click');
    expect((wrapper.vm as unknown as ContestFormVm).currentScoreMode).toBe(
      'partial',
    );
    await wrapper.find('[data-contest-conacup]').trigger('click');
    expect((wrapper.vm as unknown as ContestFormVm).currentScoreMode).toBe(
      'partial',
    );
  });

  it('Should toggle a section from its data-section-toggle header', async () => {
    const startTime = new Date();
    const wrapper = shallowMount(contest_Form, {
      props: {
        update: false,
        allLanguages: [{ py2: 'Python 2' }, { py3: 'Python 3' }],
        initialLanguages: [],
        initialFinishTime: new Date(startTime.getTime() + 60 * 60 * 1000),
        initialStartTime: startTime,
        initialSubmissionsGap: 1,
      },
      global: { stubs: { BCollapse: false } },
      attachTo: document.body,
    });
    const sections = ['basic-info', 'logistics', 'scoring-rules', 'privacy'];
    for (const section of sections) {
      const toggle = wrapper.find(`[data-section-toggle="${section}"]`);
      expect(toggle.exists()).toBe(true);
      expect(toggle.attributes('data-toggle')).toBeUndefined();
      expect(toggle.attributes('data-target')).toBeUndefined();
      expect(wrapper.find(`.collapse.${section}`).exists()).toBe(true);
    }
    const basicInfo = wrapper.find('[data-section-toggle="basic-info"]');
    const logistics = wrapper.find('[data-section-toggle="logistics"]');
    const logisticsBody = wrapper.find('.collapse.logistics');
    expect(basicInfo.attributes('aria-expanded')).toBe('true');
    expect(logistics.attributes('aria-expanded')).toBe('false');
    expect(logisticsBody.isVisible()).toBe(false);

    await logistics.trigger('click');
    expect(logistics.attributes('aria-expanded')).toBe('true');
    expect(logistics.classes()).not.toContain('collapsed');
    await waitForEmit(logisticsComponent(wrapper), 'shown');
    expect(logisticsBody.isVisible()).toBe(true);

    await logistics.trigger('click');
    expect(logistics.attributes('aria-expanded')).toBe('false');
    expect(logistics.classes()).toContain('collapsed');
    await waitForEmit(logisticsComponent(wrapper), 'hidden');
    expect(logisticsBody.isVisible()).toBe(false);
    wrapper.unmount();
  });
});

function logisticsComponent(wrapper: VueWrapper) {
  // BCollapse renders a fragment, so match on the class it was given.
  const component = wrapper
    .findAllComponents(BCollapse)
    .find((c) => String(c.vm.$attrs.class).split(' ').includes('logistics'));
  if (!component) throw new Error('logistics BCollapse not found');
  return component;
}

// BCollapse shows and hides over a few animation frames, then emits
// `shown`/`hidden`.
async function waitForEmit(
  wrapper: { emitted: (event: string) => unknown[] | undefined },
  event: string,
): Promise<void> {
  while (!wrapper.emitted(event)) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}
