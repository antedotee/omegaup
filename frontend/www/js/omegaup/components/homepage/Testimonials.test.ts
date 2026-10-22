import { mount } from '@vue/test-utils';
import { BCarousel } from 'bootstrap-vue-next';
import T from '../../lang';
import testimonialsConfig from '../../testimonials.config';
import homepage_Testimonials from './Testimonials.vue';

describe('Testimonials.vue', () => {
  it('renders every testimonial as a BCarousel slide', () => {
    const wrapper = mount(homepage_Testimonials);
    const root = wrapper.find('#testimonials-carousel-display');
    expect(root.classes()).toContain('carousel');
    expect(root.attributes('data-ride')).toBeUndefined();
    expect(wrapper.findAll('.carousel-item')).toHaveLength(
      testimonialsConfig.length,
    );
    expect(wrapper.findAll('.carousel-indicators button')).toHaveLength(
      testimonialsConfig.length,
    );
    expect(wrapper.find('.carousel-control-prev').text()).toBe(T.wordsPrevious);
    expect(wrapper.find('blockquote p').text()).toBe(
      testimonialsConfig[0].text[T.locale as 'en' | 'es' | 'pt'],
    );
  });

  it('jumps to a slide when its indicator is clicked', async () => {
    const wrapper = mount(homepage_Testimonials);
    await wrapper.findAll('.carousel-indicators button')[1].trigger('click');
    expect(
      wrapper.findComponent(BCarousel).emitted('update:modelValue'),
    ).toEqual([[1]]);
  });
});
