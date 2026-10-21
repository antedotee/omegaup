import { mount, shallowMount } from '@vue/test-utils';

import { dao, types } from '../../api_types';
import T from '../../lang';

import teamsgroup_Teams from './Teams.vue';
import { AvailableForms } from './Teams_types';
import identity_Edit from '../identity/Edit.vue';

// Minimal view of the component instance for the internals the tests reach
// into. The component is `toNative`'d so its class type is not exported.
interface TeamsVm {
  identity: null | types.Identity;
  formToShow: AvailableForms;
  username: null | string;
}

describe('Teams.vue', () => {
  beforeEach(() => {
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

  const propsData: {
    teams: types.Identity[];
    countries: dao.Countries[];
    searchResultUsers: types.ListItem[];
    searchResultSchools: types.SchoolListItem[];
  } = {
    teams: [
      {
        username: 'omegaUp:user',
        name: 'user',
      },
    ],
    countries: [{ country_id: 'mx', name: 'Mexico' }],
    searchResultUsers: [{ key: 'user', value: 'username' }],
    searchResultSchools: [{ key: 1, value: 'school name' }],
  };

  it('Should handle an empty list of members and identities', () => {
    const wrapper = shallowMount(teamsgroup_Teams, {
      props: {
        teams: [] as types.Identity[],
        countries: [{ country_id: 'mx', name: 'Mexico' }] as dao.Countries[],
      },
    });

    expect(wrapper.find('.empty-table-message').text()).toBe(
      T.teamsGroupTeamsEmptyList,
    );
  });

  it('Should handle a list of teams as identities', () => {
    const wrapper = mount(teamsgroup_Teams, {
      props: propsData,
    });

    const identitiesTable = wrapper.find('table[data-table-identities]');
    // Vue 3 condenses the inter-element whitespace that Vue 2 preserved, so the
    // concatenated table text no longer has a space between the username and
    // the team name cell. Assert each cell renders its own value instead.
    expect(identitiesTable.text()).toContain('omegaUp:user');
    expect(identitiesTable.find('[data-group-team-name]').text()).toBe('user');
  });

  it('Should handle edit identity form', async () => {
    const wrapper = mount(teamsgroup_Teams, {
      attachTo: '#root',
      props: propsData,
    });

    await wrapper
      .find('button[data-edit-identity="omegaUp:user"]')
      .trigger('click');

    expect((wrapper.vm as unknown as TeamsVm).identity).toEqual({
      username: 'omegaUp:user',
      name: 'user',
    });
    expect((wrapper.vm as unknown as TeamsVm).formToShow).toBe(
      AvailableForms.Edit,
    );
    expect((wrapper.vm as unknown as TeamsVm).username).toBe('omegaUp:user');

    await wrapper.find('button[type="reset"]').trigger('click');

    expect((wrapper.vm as unknown as TeamsVm).identity).toBe(null);
    expect((wrapper.vm as unknown as TeamsVm).formToShow).toBe(
      AvailableForms.None,
    );
    expect((wrapper.vm as unknown as TeamsVm).username).toBe(null);

    await wrapper
      .find('button[data-edit-identity="omegaUp:user"]')
      .trigger('click');

    const identityEditWrapper = wrapper.findComponent(identity_Edit);

    await identityEditWrapper.setData({
      selectedIdentity: {
        name: 'updated user',
      },
    });

    await identityEditWrapper
      .find('button[data-update-identity]')
      .trigger('click');
    expect(wrapper.emitted('edit-identity-team')).toEqual([
      [
        {
          identity: {
            classname: '',
            country_id: 'MX',
            gender: '',
            name: 'updated user',
            school: 'school name',
            state_id: '',
            username: 'omegaUp:user',
          },
          originalUsername: 'omegaUp:user',
        },
      ],
    ]);
  });
});
