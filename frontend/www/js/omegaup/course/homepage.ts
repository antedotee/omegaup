import course_Homepage from '../components/course/Homepage.vue';
import { OmegaUp } from '../omegaup';
import Vue, { type CreateElement } from 'vue';

OmegaUp.on('ready', () => {
  new Vue({
    el: '#main-container',
    components: {
      'omegaup-course-homepage': course_Homepage,
    },
    render: (createElement: CreateElement) => {
      return createElement('omegaup-course-homepage');
    },
  });
});
