import { shallowMount } from '@vue/test-utils';

import SolutionTab from './SolutionTab.vue';
import store from '@/js/omegaup/problem/creator/store';
import T from '../../../../lang';
import ProblemMarkdown from '../../ProblemMarkdown.vue';

// Minimal view of the component instance for the internals the tests reach
// into. The component is `toNative`'d so its class type is not exported.
interface SolutionTabVm {
  currentSolutionMarkdown: string;
  $store: typeof store;
}

describe('SolutionTab.vue', () => {
  it('Should contain markdown buttons and contents and update the store accordingly', async () => {
    const wrapper = shallowMount(SolutionTab, {
      global: {
        plugins: [store],
      },
    });

    const markdownButtons = wrapper.find('div.wmd-button-bar');
    expect(markdownButtons.exists()).toBe(true);

    const textArea = wrapper.find('textarea.wmd-input');
    expect(textArea.exists()).toBe(true);
    textArea.setValue('Hello omegaUp');

    expect((wrapper.vm as unknown as SolutionTabVm).currentSolutionMarkdown).toBe('Hello omegaUp');

    const markdownContent = wrapper.findComponent(ProblemMarkdown);
    expect(markdownContent.exists()).toBe(true);

    await wrapper.trigger('click');

    expect((markdownContent.props() as { markdown: string }).markdown).toBe(
      T.problemCreatorMarkdownPreviewInitialRender + 'Hello omegaUp',
    );

    expect((wrapper.vm as unknown as SolutionTabVm).$store.state.problemSolutionMarkdown).toBe('');

    const markdownSaveButton = wrapper.find('button.btn-primary');
    expect(markdownSaveButton.exists()).toBe(true);
    await markdownSaveButton.trigger('click');

    expect((wrapper.vm as unknown as SolutionTabVm).$store.state.problemSolutionMarkdown).toBe(
      'Hello omegaUp',
    );
  });
});
