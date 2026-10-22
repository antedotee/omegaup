<template>
  <!-- id-lint off -->
  <BCarousel
    id="carousel-display"
    class="text-center py-5 py-md-0"
    controls
    indicators
    ride="carousel"
    :interval="5000"
    :controls-prev-text="T.wordsPrevious"
    :controls-next-text="T.wordsNext"
  >
    <!-- id-lint on -->
    <BCarouselSlide v-for="(slide, index) in slides" :key="index">
      <template #img>
        <omegaup-homepage-slide
          :title="slide.title[T.locale] || slide.title['es']"
          :description="slide.description[T.locale] || slide.description['es']"
          :image-src="slide.image"
          :button="slide.button"
        ></omegaup-homepage-slide>
      </template>
    </BCarouselSlide>
  </BCarousel>
</template>

<script lang="ts">
import { Vue, Component, Prop, toNative } from 'vue-facing-decorator';
import T from '../../lang';
import homepageSlide from './Slide.vue';
import { types } from '../../api_types';
import { BCarousel, BCarouselSlide } from 'bootstrap-vue-next';

interface SlideData {
  image: string;
  title: {
    en: string;
    es: string;
    pt: string;
  };
  description: {
    en: string;
    es: string;
    pt: string;
  };
  button?: {
    text: {
      en: string;
      es: string;
      pt: string;
    };
    href: string;
    target: string;
  };
}

@Component({
  components: {
    BCarousel,
    BCarouselSlide,
    'omegaup-homepage-slide': homepageSlide,
  },
})
class Carousel extends Vue {
  @Prop({ default: () => [] }) carouselItems!: types.CarouselItem[];

  T = T;

  get slides(): SlideData[] {
    return this.carouselItems
      .map((item) => this.transformCarouselItem(item))
      .filter((slide): slide is SlideData => slide !== null);
  }

  parseJsonField(field: string): { [key: string]: string } {
    if (!field) {
      return { en: '', es: '', pt: '' };
    }
    try {
      const parsed = typeof field === 'string' ? JSON.parse(field) : field;
      return {
        en: parsed.en || '',
        es: parsed.es || '',
        pt: parsed.pt || '',
      };
    } catch (e) {
      // If it's not valid JSON, treat it as a plain string for English
      return {
        en: typeof field === 'string' ? field : '',
        es: '',
        pt: '',
      };
    }
  }

  isExternalUrl(url: string): boolean {
    try {
      const urlObj = new URL(url, window.location.origin);
      return urlObj.origin !== window.location.origin;
    } catch (e) {
      // If URL parsing fails, assume it's relative (internal)
      return false;
    }
  }

  transformCarouselItem(item: types.CarouselItem): SlideData | null {
    const title = this.parseJsonField(item.title);
    const description = this.parseJsonField(item.excerpt);
    const buttonTitle = this.parseJsonField(item.button_title);

    // Check if we have at least one language with content
    const hasContent =
      (title.en || title.es || title.pt) &&
      (description.en || description.es || description.pt);

    if (!hasContent || !item.image_url) {
      return null;
    }

    const slide: SlideData = {
      image: item.image_url,
      title: {
        en: title.en || title.es || title.pt || '',
        es: title.es || title.en || title.pt || '',
        pt: title.pt || title.en || title.es || '',
      },
      description: {
        en: description.en || description.es || description.pt || '',
        es: description.es || description.en || description.pt || '',
        pt: description.pt || description.en || description.es || '',
      },
    };

    // Add button if we have a link and button title
    if (item.link && (buttonTitle.en || buttonTitle.es || buttonTitle.pt)) {
      const isExternal = this.isExternalUrl(item.link);
      slide.button = {
        text: {
          en: buttonTitle.en || buttonTitle.es || buttonTitle.pt || '',
          es: buttonTitle.es || buttonTitle.en || buttonTitle.pt || '',
          pt: buttonTitle.pt || buttonTitle.en || buttonTitle.es || '',
        },
        href: item.link,
        target: isExternal ? '_blank' : '_self',
      };
    }

    return slide;
  }
}
export default toNative(Carousel);
</script>

<style lang="scss" scoped>
@import '../../../../sass/site';

.carousel {
  background: var(--homepage-carousel-background-color) !important;
  color: var(--homepage-carousel-font-color);

  /* BCarousel renders the controls, so they are outside this scope. */
  /* stylelint-disable-next-line selector-pseudo-element-no-unknown */
  ::v-deep {
    .carousel-control-prev,
    .carousel-control-next {
      top: auto;
      bottom: 20px;
      height: 40px;
      width: 40px;
      border-radius: 50%;
      background-color: rgba(0, 0, 0, 0.25);
      opacity: 0.9;
    }

    .carousel-control-prev {
      left: 10px;
    }

    .carousel-control-next {
      right: 10px;
    }

    .carousel-control-prev-icon,
    .carousel-control-next-icon {
      width: 20px;
      height: 20px;
    }
  }
}
</style>
