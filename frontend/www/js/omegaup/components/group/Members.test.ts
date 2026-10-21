import { mount, shallowMount } from '@vue/test-utils';

import { dao, types } from '../../api_types';
import T from '../../lang';

import group_Members from './Members.vue';

describe('Members.vue', () => {
  it('Should handle an empty list of members and identities', () => {
    const wrapper = shallowMount(group_Members, {
      props: {
        groupAlias: 'omegaUp',
        identities: [] as types.Identity[],
        identitiesCsv: [] as types.Identity[],
        countries: [{ country_id: 'mx', name: 'Mexico' }] as dao.Countries[],
      },
    });

    expect(wrapper.text()).toContain(T.wordsAddMember);
  });

  it('Should handle a list of members and identities', () => {
    const wrapper = mount(group_Members, {
      props: {
        groupAlias: 'omegaUp',
        identities: [
          {
            username: 'hello',
            name: 'hello',
          },
        ] as types.Identity[],
        identitiesCsv: [
          {
            username: 'omegaUp:user',
            name: 'user',
          },
        ] as types.Identity[],
        countries: [{ country_id: 'mx', name: 'Mexico' }] as dao.Countries[],
      },
    });

    expect(wrapper.find('table[data-table-members] tbody').text()).toContain(
      'hello',
    );
    // Username and name live in two separate `<td>` cells. Vue 3's default
    // whitespace:'condense' drops the whitespace-only text node between them, so
    // `.text()` concatenates the cell contents with no separating space. The
    // rendered DOM (two cells) is unchanged.
    expect(wrapper.find('table[data-table-identities] tbody').text()).toContain(
      'omegaUp:useruser',
    );
  });
});
