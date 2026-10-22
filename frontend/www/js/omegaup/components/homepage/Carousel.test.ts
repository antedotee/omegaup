import { mount } from '@vue/test-utils';
import { BCarousel } from 'bootstrap-vue-next';
import T from '../../lang';
import homepage_Carousel from './Carousel.vue';

function carouselItem(n: number) {
  return {
    carousel_item_id: n,
    title: JSON.stringify({ en: `Title ${n}`, es: `Titulo ${n}`, pt: '' }),
    excerpt: JSON.stringify({ en: `Desc ${n}`, es: `Desc ${n}`, pt: '' }),
    button_title: '',
    image_url: `/media/slide-${n}.png`,
    link: '',
    is_active: true,
  };
}

describe('Carousel.vue', () => {
  it('renders one BCarousel slide per valid item with controls and indicators', () => {
    const wrapper = mount(homepage_Carousel, {
      props: { carouselItems: [carouselItem(1), carouselItem(2)] },
    });
    const root = wrapper.find('#carousel-display');
    expect(root.classes()).toContain('carousel');
    expect(root.attributes('data-ride')).toBeUndefined();
    expect(wrapper.findAll('.carousel-item')).toHaveLength(2);
    expect(wrapper.findAll('.carousel-indicators button')).toHaveLength(2);
    expect(wrapper.find('.carousel-control-prev').text()).toBe(T.wordsPrevious);
    expect(wrapper.find('.carousel-control-next').text()).toBe(T.wordsNext);
    expect(wrapper.find('[data-slide]').exists()).toBe(false);
  });

  it('advances to the next slide when the next control is clicked', async () => {
    const wrapper = mount(homepage_Carousel, {
      props: { carouselItems: [carouselItem(1), carouselItem(2)] },
    });
    await wrapper.find('.carousel-control-next').trigger('click');
    expect(
      wrapper.findComponent(BCarousel).emitted('update:modelValue'),
    ).toEqual([[1]]);
  });
});
