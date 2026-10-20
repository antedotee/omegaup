import { shallowMount } from '@vue/test-utils';

import common_SortControls from './SortControls.vue';

// Minimal view of the component instance for the internals the tests reach
// into. The component is `toNative`'d so its class type is not exported.
interface SortControlsVm {
  selected: boolean;
  toggleSort: string;
  iconDisplayed: string;
}

describe('SortControls.vue', () => {
  it('Should handle the correct sort control', async () => {
    const wrapper = shallowMount(common_SortControls, {
      props: {
        column: 'title',
        columnType: 'number',
        sortOrder: 'desc',
        columnName: 'ratio',
      },
    });

    expect((wrapper.vm as unknown as SortControlsVm).selected).toBe(false);
    expect((wrapper.vm as unknown as SortControlsVm).toggleSort).toBe('asc');
    expect((wrapper.vm as unknown as SortControlsVm).iconDisplayed).toBe('sort-amount-down');
  });

  it('Should handle the correct sort icons', async () => {
    const wrapper = shallowMount(common_SortControls, {
      props: {
        column: 'title',
        columnType: 'string',
        sortOrder: 'desc',
        columnName: 'title',
      },
    });

    await wrapper.find('a').trigger('click');

    expect(wrapper.emitted('apply-filter')).toEqual([['title', 'asc']]);
  });
});
