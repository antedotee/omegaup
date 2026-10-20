// Vue 3 replacement for the `vue-infinite-scroll` package, which is a Vue 2
// directive and calls `vm.$on('hook:mounted', ...)` (both the instance event
// API and `hook:` events were removed in Vue 3, so it throws under @vue/compat).
//
// This keeps the same template API the app already uses:
//   v-infinite-scroll="callback"
//   infinite-scroll-disabled="<boolean>"
//   infinite-scroll-distance="<pixels>"
// The callback runs when the element is scrolled within `distance` pixels of
// the bottom, unless disabled.
import type { Directive, DirectiveBinding } from 'vue';

interface InfiniteScrollEl extends HTMLElement {
  __infiniteScrollHandler__?: () => void;
  __infiniteScrollScroller__?: HTMLElement | Window;
}

function getScrollParent(el: HTMLElement): HTMLElement | Window {
  let parent: HTMLElement | null = el.parentElement;
  while (parent) {
    const overflowY = window.getComputedStyle(parent).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return parent;
    }
    parent = parent.parentElement;
  }
  return window;
}

function readAttr(el: HTMLElement, name: string): string | null {
  return el.getAttribute(name);
}

export const infiniteScroll: Directive = {
  mounted(el: InfiniteScrollEl, binding: DirectiveBinding<() => void>) {
    const callback = binding.value;
    if (typeof callback !== 'function') {
      return;
    }

    const scroller = getScrollParent(el);
    el.__infiniteScrollScroller__ = scroller;

    const handler = () => {
      const disabledAttr = readAttr(el, 'infinite-scroll-disabled');
      if (disabledAttr === 'true' || disabledAttr === '') {
        return;
      }
      const distance = Number(
        readAttr(el, 'infinite-scroll-distance') ?? '0',
      );

      let bottomDelta: number;
      if (scroller === window) {
        const rect = el.getBoundingClientRect();
        bottomDelta = rect.bottom - window.innerHeight;
      } else {
        const container = scroller as HTMLElement;
        bottomDelta =
          container.scrollHeight -
          container.scrollTop -
          container.clientHeight;
      }

      if (bottomDelta <= distance) {
        callback();
      }
    };

    el.__infiniteScrollHandler__ = handler;
    scroller.addEventListener('scroll', handler, { passive: true });
  },

  unmounted(el: InfiniteScrollEl) {
    const handler = el.__infiniteScrollHandler__;
    const scroller = el.__infiniteScrollScroller__;
    if (handler && scroller) {
      scroller.removeEventListener('scroll', handler);
    }
    delete el.__infiniteScrollHandler__;
    delete el.__infiniteScrollScroller__;
  },
};

export default infiniteScroll;
