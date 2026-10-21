<template>
  <div
    ref="root"
    data-markdown-statement
    class="float-right ml-2"
    :class="{ 'full-width': fullWidth, 'text-left': alignLeft }"
  ></div>
</template>

<script lang="ts">
import { Vue, Component, Prop, Ref, toNative } from 'vue-facing-decorator';

declare global {
  interface Window {
    MathJax?: { tex: any; startup?: any };
  }
}

@Component
class ProblemMarkdown extends Vue {
  @Prop({ default: false }) fullWidth!: boolean;
  @Prop({ default: false }) alignLeft!: boolean;
  @Ref() readonly root!: HTMLElement;

  private renderMathJax(): void {
    this.root
      .querySelectorAll(
        '[data-markdown-statement] > pre, .sample_io > tbody > tr > td:first-of-type > pre',
      )
      .forEach((preElement) => {
        const clipboardButton = document.createElement('button');
        clipboardButton.className = 'clipboard btn btn-light float-right';
        preElement.parentElement?.insertBefore(clipboardButton, preElement);
      });
    window.MathJax = {
      tex: {
        inlineMath: [
          ['$', '$'],
          ['\\(', '\\)'],
        ],
        processEscapes: true,
        packages: { '[+]': ['noerrors'] },
      },
    };
    const html = `<span class="badge badge-secondary">${'$x$'}</span>`;
    this.root.insertAdjacentHTML('beforeend', html);
  }
}
export default toNative(ProblemMarkdown);
</script>

<style lang="scss">
// Not scoped: rules are injected under [data-markdown-statement] at runtime.
@import '../../../../sass/site';
[data-markdown-statement] {
  display: block;
  max-width: 50em;
  border-left: 1px solid #ccc;
  &.full-width {
    max-width: 100%;
  }
  .float-right {
    margin-left: 1em;
  }
  pre {
    padding: 0.5em;
  }
}
</style>
