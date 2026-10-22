import { mount } from '@vue/test-utils';

import T from '../../lang';
import notification_Notification from './Notification.vue';

describe('Notification.vue', () => {
  it('Should handle empty url in contents body', () => {
    const courseName = 'Curso de prueba';
    const wrapper = mount(notification_Notification, {
      props: {
        notification: {
          contents: {
            type: 'course-registration-rejected',
            body: {
              localizationString: 'notificationCourseRegistrationRejected',
              localizationParams: {
                courseName,
              },
              url: '',
              iconUrl: '/media/info.png',
            },
          },
          timestamp: new Date(),
        },
      },
    });

    const closeButton = wrapper.find('button.btn-close');
    expect(closeButton.text()).toBe('');
    expect(closeButton.attributes('aria-label')).toBe(T.wordsClose);
    expect(wrapper.text()).toEqual(expect.stringContaining(courseName));
  });
});
