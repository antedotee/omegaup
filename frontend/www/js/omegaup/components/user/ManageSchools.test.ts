import { mount } from '@vue/test-utils';
import { types } from '../../api_types';
import userManageSchools from './ManageSchools.vue';
import omegaupRadioSwitch from '../RadioSwitch.vue';
import datePicker from '../DatePicker.vue';

const profile: types.UserProfileInfo = {
  classname: 'user-rank-unranked',
  verified: true,
  hide_problem_tags: false,
  is_private: false,
  programming_languages: {
    py2: 'python2',
    rb: 'ruby',
  },
  rankinfo: {
    name: 'Test',
    problems_solved: 2,
    rank: 1,
  },
  is_own_profile: true,
  school: 'escuela',
  school_id: 1,
  scholar_degree: '',
};

describe('ManageSchools.vue', () => {
  it('Should enable graduation date', async () => {
    const wrapper = mount(userManageSchools, {
      props: {
        profile,
        searchResultSchools: [{ key: 'teams-group', value: 'teams group' }],
      },
    });

    expect(wrapper.findComponent(datePicker).element).toBeDisabled();
    await wrapper
      .findComponent(omegaupRadioSwitch)
      .find('input[value="false"]')
      .setValue(true);
    expect(wrapper.findComponent(datePicker).element).toBeEnabled();
  });

  it('Should emit user update schools', async () => {
    const wrapper = mount(userManageSchools, {
      props: {
        profile,
        searchResultSchools: [{ key: 1, value: 'escuela' }],
      },
    });

    await wrapper.find('select').setValue('bachelors');
    await wrapper
      .findComponent(omegaupRadioSwitch)
      .find('input[value="false"]')
      .setValue(true);
    // Set the value through the inner native date input so the component's own
    // string-to-Date conversion runs and emits a Date, matching how the picker
    // behaves for a user. Calling setValue on the component wrapper would push
    // the raw string straight into the model and skip that conversion.
    await wrapper
      .findComponent(datePicker)
      .find('input')
      .setValue('2010-10-10');

    await wrapper.find('button[type="submit"]').trigger('submit');
    expect(wrapper.emitted('update-user-schools')).toBeDefined();
    expect(wrapper.emitted('update-user-schools')).toEqual([
      [
        {
          graduation_date: new Date('2010-10-10'),
          school_id: 1,
          school_name: 'escuela',
          scholar_degree: 'bachelors',
        },
      ],
    ]);
  });
});
