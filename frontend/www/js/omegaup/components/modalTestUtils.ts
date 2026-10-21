import { flushPromises } from '@vue/test-utils';

// A lazy BModal renders its content when its show transition starts, an
// animation frame after it is opened.
export async function waitForModalContent(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await flushPromises();
}
