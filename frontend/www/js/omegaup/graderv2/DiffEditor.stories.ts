import { StoryObj, Meta } from '@storybook/vue';
import DiffEditorV2 from './DiffEditorV2.vue';

const meta: Meta<typeof DiffEditorV2> = {
  title: 'Grader/DiffEditor',
  component: DiffEditorV2,
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  // The @storybook/vue types resolve Story args to a Vue meta shape and do not
  // infer the component's own props, so the args object is cast.
  args: {
    storeMapping: {
      originalContents: 'original',
      modifiedContents: 'modified',
    },
    readOnly: false,
  } as unknown as Story['args'],
  render: (args, { argTypes }) => ({
    components: { DiffEditorV2 },
    props: Object.keys(argTypes),
    template: '<DiffEditorV2 v-bind="$props" />',
  }),
};

export const ReadOnly: Story = {
  args: {
    storeMapping: {
      originalContents: 'original',
      modifiedContents: 'modified',
    },
    readOnly: true,
  } as unknown as Story['args'],
  render: (args, { argTypes }) => ({
    components: { DiffEditorV2 },
    props: Object.keys(argTypes),
    template: '<DiffEditorV2 v-bind="$props" />',
  }),
};
