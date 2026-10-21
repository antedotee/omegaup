import { mount, shallowMount } from '@vue/test-utils';
import { BModal } from 'bootstrap-vue-next';
import { types } from '../../api_types';

import T from '../../lang';

import common_Requests from './Requests.vue';

// Minimal view of the component instance for the internals the tests reach
// into. The component is `toNative`'d so its class type is not exported.
interface RequestsVm {
  modalStates: { [key: string]: boolean };
  resolutionText: null | string;
}

describe('Requests.vue', () => {
  const data: types.IdentityRequest[] = [
    {
      accepted: false,
      admin: {
        username: 'test_user_1',
      },
      last_update: new Date(),
      request_time: new Date(),
      username: 'test_user_1',
      classname: 'user-rank-unranked',
    },
    {
      accepted: false,
      admin: {
        username: 'test_user_2',
      },
      last_update: new Date(),
      request_time: new Date(),
      username: 'test_user_2',
      classname: 'user-rank-unranked',
    },
  ];

  const propsData = {
    data,
    textAddParticipant: T.contestAdduserAddContestant,
  };

  it('Should handle initial props', () => {
    const wrapper = shallowMount(common_Requests, { props: propsData });

    expect(wrapper.text()).toContain(T.contestAdduserAddContestant);
  });

  it('Should handle deny request event', async () => {
    const wrapper = shallowMount(common_Requests, { props: propsData });

    const buttons = wrapper.findAll('button.text-danger');
    const feedbackModals = wrapper.findAllComponents(BModal);

    expect(
      'test_user_1' in (wrapper.vm as unknown as RequestsVm).modalStates,
    ).toBe(false);
    await buttons[0].trigger('click');
    expect(
      (wrapper.vm as unknown as RequestsVm).modalStates['test_user_1'],
    ).toBe(true);

    expect(
      'test_user_2' in (wrapper.vm as unknown as RequestsVm).modalStates,
    ).toBe(false);
    await buttons[1].trigger('click');
    expect(
      (wrapper.vm as unknown as RequestsVm).modalStates['test_user_2'],
    ).toBe(true);

    (wrapper.vm as unknown as RequestsVm).resolutionText = 'Hello';
    feedbackModals[0].vm.$emit('ok');

    (wrapper.vm as unknown as RequestsVm).resolutionText = 'There';
    feedbackModals[1].vm.$emit('ok');

    expect(wrapper.emitted('deny-request')).toBeDefined();
    expect(wrapper.emitted('deny-request')).toEqual([
      [{ username: 'test_user_1', resolutionText: 'Hello' }],
      [{ username: 'test_user_2', resolutionText: 'There' }],
    ]);
  });

  it('Should handle accept request event', async () => {
    const wrapper = shallowMount(common_Requests, { props: propsData });

    await wrapper.find('button.text-success').trigger('click');
    expect(wrapper.emitted('accept-request')).toBeDefined();
    expect(wrapper.emitted('accept-request')).toEqual([
      [{ username: 'test_user_1' }],
    ]);
  });

  it('Should handle the whole list of requests', async () => {
    const wrapper = mount(common_Requests, {
      props: {
        data: [
          {
            accepted: false,
            admin: {
              username: 'test_user',
            },
            last_update: new Date(),
            request_time: new Date(),
            username: 'test_user_1',
            classname: 'user-rank-unranked',
          },
          {
            accepted: true,
            admin: {
              username: 'test_user',
            },
            last_update: new Date(),
            request_time: new Date(),
            username: 'test_user_2',
            classname: 'user-rank-unranked',
          },
        ],
        textAddParticipant: T.wordsAddStudent,
      },
    });

    expect(wrapper.find('table tbody').text()).toContain('test_user_1');
    expect(wrapper.find('table tbody').text()).not.toContain('test_user_2');

    await wrapper.find('div[data-requests] input').setValue(true);
    expect(wrapper.find('table tbody').text()).toContain('test_user_2');
  });
});
