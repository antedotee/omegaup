<template>
  <div v-if="isOverlayShown" data-overlay @click="onOverlayClicked">
    <slot name="popup" :isOverlayShown="isOverlayShown"></slot>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Prop, Watch, toNative } from 'vue-facing-decorator';

@Component
class Overlay extends Vue {
  created() {
    // Props are not bound when class field initializers run under
    // vue-facing-decorator, so prop-derived fields are assigned here.
    this.isOverlayShown = this.showOverlay;
  }
  @Prop({ default: false }) showOverlay!: boolean;

  isOverlayShown = undefined;

  onOverlayClicked(evt: Event) {
    if (typeof $(evt.composedPath()[0]).attr('data-overlay') !== 'undefined') {
      this.isOverlayShown = false;
      this.$emit('hide-overlay');
    }
  }

  @Watch('showOverlay')
  overlayVisibilityChanged(newValue: boolean): void {
    this.isOverlayShown = newValue;
  }
}
export default toNative(Overlay);
</script>

<style lang="scss" scoped>
@import '../../../sass/main.scss';

[data-overlay] {
  display: block !important;
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(var(--overlay-background-color), 0.5);
  z-index: 9999998 !important;
}
</style>
