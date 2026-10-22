<template>
  <!-- id-lint off -->
  <BCarousel
    id="testimonials-carousel-display"
    class="text-center py-5 py-md-0"
    controls
    indicators
    ride="carousel"
    :interval="8000"
    :controls-prev-text="T.wordsPrevious"
    :controls-next-text="T.wordsNext"
  >
    <!-- id-lint on -->
    <BCarouselSlide v-for="(testimonial, index) in testimonials" :key="index">
      <template #img>
        <div class="container-lg py-4 px-5">
          <blockquote class="blockquote text-center">
            <p class="mb-0">{{ testimonial.text[T.locale] }}</p>
            <footer class="blockquote-footer mt-3">
              {{ testimonial.author.name }},
              <cite :title="testimonial.author.title[T.locale]">{{
                testimonial.author.title[T.locale]
              }}</cite>
            </footer>
          </blockquote>
        </div>
      </template>
    </BCarouselSlide>
  </BCarousel>
</template>

<script lang="ts">
import { Vue, Component, toNative } from 'vue-facing-decorator';
import { BCarousel, BCarouselSlide } from 'bootstrap-vue-next';
import T from '../../lang';
import testimonialsConfig from '../../testimonials.config';

@Component({
  components: {
    BCarousel,
    BCarouselSlide,
  },
})
class Testimonials extends Vue {
  T = T;
  testimonials = testimonialsConfig;
}
export default toNative(Testimonials);
</script>

<style lang="scss" scoped>
@import '../../../../sass/site';

.carousel {
  background: var(--homepage-carousel-background-color) !important;
  color: var(--homepage-carousel-font-color);

  /* BCarousel renders .carousel-inner, so it is outside this scope. */
  /* stylelint-disable-next-line selector-pseudo-element-no-unknown */
  ::v-deep .carousel-inner {
    display: flex;
    align-items: center;
    min-height: 31rem;

    .carousel-item {
      blockquote.blockquote {
        font-size: 1.15rem;
        line-height: 1.15;

        footer {
          color: wheat;
        }
      }
    }

    @media only screen and (min-width: 767px) {
      min-height: 12rem;
    }
  }
}
</style>
