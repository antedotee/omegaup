<template>
  <div class="card">
    <div class="card-body">
      <div class="row">
        <div class="col-md-6 d-flex flex-column">
          <div ref="markdownButtonBar" class="wmd-button-bar"></div>
          <textarea
            ref="markdownInput"
            data-problem-creator-editor-markdown
            class="wmd-input"
            v-model.lazy="currentMarkdown"
            @input="onInput"
          ></textarea>
        </div>
        <div class="col-md-6 d-flex flex-column">
          <div ref="previewSpacer" class="preview-spacer"></div>
          <div data-problem-creator-previewer-markdown class="preview-container">
            <omegaup-markdown
              :markdown="previewMarkdown"
              preview="true"
            ></omegaup-markdown>
          </div>
        </div>
      </div>
      <div class="row">
        <div class="col-md-12">
          <button
            data-problem-creator-save-markdown
            class="btn btn-primary"
            type="submit"
            @click="updateMarkdown"
          >
            {{ T.problemCreatorMarkdownSave }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Prop, Ref, Watch } from 'vue-property-decorator';
import * as Markdown from '@/third_party/js/pagedown/Markdown.Editor.js';
import * as markdown from '../../../../markdown';
import T from '../../../../lang';
import * as ui from '../../../../ui';

import omegaup_problemMarkdown from '../../Markdown.vue';

const markdownConverter = new markdown.Converter({
  preview: true,
});

@Component({
  components: {
    'omegaup-markdown': omegaup_problemMarkdown,
  },
})
export default class StatementTab extends Vue {
  @Ref() readonly markdownButtonBar!: HTMLDivElement;
  @Ref() readonly markdownInput!: HTMLTextAreaElement;
  @Ref() readonly previewSpacer!: HTMLDivElement;

  @Prop({ default: T.problemCreatorEmpty }) currentMarkdownProp!: string;

  T = T;
  ui = ui;
  markdownEditor: Markdown.Editor | null = null;

  currentMarkdownInternal: string = T.problemCreatorEmpty;

  get currentMarkdown(): string {
    return this.currentMarkdownInternal;
  }
  set currentMarkdown(newMarkdown: string) {
    this.currentMarkdownInternal = newMarkdown;
  }

  get previewMarkdown(): string {
    const trimmed = this.currentMarkdownInternal.trim();
    return trimmed
      ? trimmed
      : T.problemCreatorMarkdownPreviewInitialRender;
  }

  @Watch('currentMarkdownProp')
  onCurrentMarkdownPropChanged() {
    this.currentMarkdown = this.currentMarkdownProp;
  }

  onInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.currentMarkdownInternal = target.value;
  }

  mounted(): void {
    this.markdownEditor = new Markdown.Editor(markdownConverter.converter, '', {
      panels: {
        buttonBar: this.markdownButtonBar,
        preview: null,
        input: this.markdownInput,
      },
    });
    this.markdownEditor.run();
    
    // Align preview after editor is initialized
    this.$nextTick(() => {
      setTimeout(() => {
        this.alignPreview();
      }, 200);
    });
  }

  alignPreview(): void {
    if (!this.markdownButtonBar || !this.previewSpacer || !this.markdownInput) {
      return;
    }
    
    // Get computed styles to account for borders
    const buttonBarStyle = window.getComputedStyle(this.markdownButtonBar);
    const textareaStyle = window.getComputedStyle(this.markdownInput);
    
    const buttonBarRect = this.markdownButtonBar.getBoundingClientRect();
    const textareaRect = this.markdownInput.getBoundingClientRect();
    
    // Calculate the distance from button bar bottom to textarea top
    const spacing = textareaRect.top - buttonBarRect.bottom;
    
    // Account for any borders
    const buttonBarBorderTop = parseFloat(buttonBarStyle.borderTopWidth) || 0;
    const textareaBorderTop = parseFloat(textareaStyle.borderTopWidth) || 0;
    
    // Set spacer height to match button bar + spacing, accounting for borders
    const totalHeight = buttonBarRect.height + Math.max(0, spacing) + (textareaBorderTop - buttonBarBorderTop);
    
    if (totalHeight > 0) {
      this.previewSpacer.style.height = `${totalHeight}px`;
      console.log('Aligned preview:', { buttonBarHeight: buttonBarRect.height, spacing, totalHeight });
    }
  }

  updateMarkdown() {
    this.$store.commit('updateMarkdown', this.currentMarkdown);
    this.$emit('show-update-success-message');
  }
}
</script>

<style lang="scss" scoped>
@import '../../../../../../sass/main.scss';
@import '../../../../../../third_party/js/pagedown/demo/browser/demo.css';

.wmd-preview,
.wmd-button-bar {
  background-color: var(--wmd-button-bar-background-color);
}

.row {
  align-items: flex-start;

  .wmd-button-bar {
    flex-shrink: 0;
  }

  .wmd-input {
    flex: 1;
    min-height: 400px;
    height: auto !important;
    resize: vertical;
  }

  .preview-spacer {
    flex-shrink: 0;
    min-height: 0;
    width: 100%;
  }

  .col-md-6 {
    display: flex;
    flex-direction: column;
  }

  .preview-container {
    width: 100%;
    height: 400px;
    overflow-y: auto;
    border: 1px solid var(--markdown-preview-border-color);
    padding: 10px;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }

  .preview-container ::v-deep [data-markdown-statement] {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    margin: 0 !important;
    max-width: 100% !important;
    text-align: left !important;
    display: block !important;

    p,
    li {
      text-align: left !important;
    }

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      text-align: left !important;
    }
  }
}
</style>

<style lang="scss">
// Non-scoped styles to override global Markdown component styles
.preview-container [data-markdown-statement] {
  margin: 0 !important;
  max-width: 100% !important;
  text-align: left !important;

  p,
  li {
    text-align: left !important;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    text-align: left !important;
  }
}
</style>
