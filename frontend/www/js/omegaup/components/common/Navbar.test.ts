import { mount, shallowMount } from '@vue/test-utils';
import { BCollapse, BModal } from 'bootstrap-vue-next';

import T from '../../lang';

import common_Navbar from './Navbar.vue';
import UserObjectivesQuestions from '../user/ObjectivesQuestions.vue';
import user_NextRegisteredContest from '../user/NextRegisteredContest.vue';

// BCollapse shows and hides over a few animation frames, then emits
// `shown`/`hidden`.
async function waitForEmit(
  wrapper: { emitted: (event: string) => unknown[] | undefined },
  event: string,
): Promise<void> {
  while (!wrapper.emitted(event)) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

describe('Navbar.vue', () => {
  const propsData = {
    currentUsername: 'user',
    errorMessage: null,
    graderInfo: null,
    graderQueueLength: -1,
    gravatarURL51:
      'https://secure.gravatar.com/avatar/568c0ec2147500d7cd09cc8bbc8e5ec4?s=51',
    inContest: true,
    clarifications: [],
    isAdmin: false,
    isLoggedIn: true,
    isMainUserIdentity: false,
    isReviewer: false,
    lockDownImage: 'data:image/png;base64...',
    navbarSection: '',
    omegaUpLockDown: false,
    associatedIdentities: [{ username: 'user', default: true }],
    notifications: [],
    fromLogin: false,
    userTypes: [],
    nextRegisteredContest: null,
  };

  it('Should handle empty navbar (in contest only)', () => {
    const wrapper = mount(common_Navbar, {
      props: propsData,
    });
    expect(wrapper.find('.nav-contests').exists()).toBe(false);
    expect(wrapper.find('.nav-courses').exists()).toBe(false);
    expect(wrapper.find('.nav-problems').exists()).toBe(false);
    expect(wrapper.find('.nav-rank').exists()).toBe(false);
  });

  it('Should handle common navbar to logged user', () => {
    const wrapper = mount(common_Navbar, {
      props: {
        ...propsData,
        ...{ inContest: false, userTypes: ['student', 'teacher'] },
      },
    });

    expect(wrapper.find('.nav-contests').exists()).toBe(true);
    expect(wrapper.find('.nav-courses').exists()).toBe(true);
    expect(wrapper.find('.nav-problems').exists()).toBe(true);
    expect(wrapper.find('.nav-rank').exists()).toBe(true);
    expect(wrapper.find('[data-login-button]').exists()).toBe(false);
  });

  it('Should handle common navbar to not-logged user', () => {
    const wrapper = mount(common_Navbar, {
      props: { ...propsData, ...{ inContest: false, isLoggedIn: false } },
    });

    expect(wrapper.find('.nav-problems').exists()).toBe(true);
    expect(wrapper.find('[data-nav-course]').exists()).toBe(true);
    expect(wrapper.find('.nav-rank').exists()).toBe(true);
    expect(wrapper.find('[data-login-button]').exists()).toBe(true);
    expect(wrapper.find('.navbar-right').text()).toContain(T.navbarLogin);
    expect(wrapper.find('.navbar-right').text()).toContain(T.navbarRegister);
  });

  it('Should show objectives modal only when a main user identity is logged', async () => {
    const wrapper = shallowMount(common_Navbar, {
      props: { ...propsData, ...{ fromLogin: true } },
    });

    expect(wrapper.findComponent(UserObjectivesQuestions).exists()).toBe(false);

    await wrapper.setProps({ isMainUserIdentity: true });

    expect(wrapper.findComponent(UserObjectivesQuestions).exists()).toBe(true);
  });

  it('Should show the information of the next registered contest when the user is registered to a current or upcoming contest', () => {
    const currentDate = new Date();
    const startTime = new Date();
    const finishTime = new Date();
    startTime.setHours(startTime.getHours() + 1);
    finishTime.setHours(finishTime.getHours() + 2);

    const wrapper = mount(common_Navbar, {
      props: {
        ...propsData,
        ...{
          fromLogin: true,
          nextRegisteredContest: {
            admission_mode: '',
            alias: 'prueba',
            contest_id: 1,
            contestants: 10,
            description: 'Este es un concurso de prueba',
            duration: null,
            finish_time: finishTime,
            last_updated: currentDate,
            organizer: 'omegaup',
            original_finish_time: finishTime,
            participating: true,
            problemset_id: 1,
            recommended: true,
            rerun_id: 1,
            score_mode: null,
            scoreboard_url: null,
            scoreboard_url_admin: null,
            start_time: startTime,
            title: 'Concurso de prueba',
            window_length: null,
          },
        },
      },
    });

    const nextRegisteredContest = wrapper.findComponent(
      user_NextRegisteredContest,
    );
    const startDate =
      startTime.toLocaleDateString() + ' ' + startTime.toLocaleTimeString();
    expect(nextRegisteredContest.exists()).toBeTruthy();
    expect(nextRegisteredContest.text()).toContain('Concurso de prueba');
    expect(nextRegisteredContest.text()).toContain('omegaup');
    expect(nextRegisteredContest.text()).toContain('10');
    expect(nextRegisteredContest.text()).toContain('Inicia: ' + startDate);
    expect(nextRegisteredContest.text()).toContain('01:00:00');
  });

  it('Should log out after confirming in the logout modal', async () => {
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: '' },
    });
    const wrapper = mount(common_Navbar, {
      props: { ...propsData, ...{ inContest: false } },
      attachTo: document.body,
      global: { stubs: { transition: false } },
    });
    expect(wrapper.find('.logout-confirmation-modal').exists()).toBe(false);

    await wrapper.find('a[data-logout-button]').trigger('click');
    // BModal finishes showing over a few animation frames and then emits
    // `shown`.
    const modal = wrapper.findComponent(BModal);
    while (!modal.emitted('shown')) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    const confirmButton = wrapper.find(
      '.logout-confirmation-modal > button.btn-primary',
    );
    expect(confirmButton.exists()).toBe(true);
    expect(confirmButton.isVisible()).toBe(true);

    await confirmButton.trigger('click');
    expect(window.location.href).toBe('/logout/');

    wrapper.unmount();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: original,
    });
  });

  it('Should toggle the navbar collapse and close it on an outside click', async () => {
    const wrapper = mount(common_Navbar, {
      props: { ...propsData, ...{ inContest: false } },
      attachTo: document.body,
    });
    const toggler = wrapper.find('button.navbar-toggler');
    const collapse = wrapper.find('.omegaup-navbar');
    const [collapseComponent] = wrapper
      .findAllComponents(BCollapse)
      .filter((c) => c.props('isNav'));
    expect(collapseComponent.exists()).toBe(true);
    expect(toggler.attributes('data-toggle')).toBeUndefined();
    expect(toggler.attributes('aria-expanded')).toBe('false');
    expect(collapse.classes()).toContain('navbar-collapse');
    expect(collapse.isVisible()).toBe(false);

    await toggler.trigger('click');
    expect(toggler.attributes('aria-expanded')).toBe('true');
    await waitForEmit(collapseComponent, 'shown');
    expect(collapse.classes()).toContain('show');
    expect(collapse.isVisible()).toBe(true);

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(toggler.attributes('aria-expanded')).toBe('false');
    await waitForEmit(collapseComponent, 'hidden');
    expect(collapse.isVisible()).toBe(false);

    wrapper.unmount();
  });

  it('Should toggle the user content links with their own state', async () => {
    const wrapper = mount(common_Navbar, {
      props: { ...propsData, ...{ inContest: false } },
    });
    const toggler = wrapper.find('.collapse-submenu button.dropdown-toggle');
    const links = wrapper.find('.collapse-links');
    const [linksComponent] = wrapper
      .findAllComponents(BCollapse)
      .filter((c) => !c.props('isNav'));
    expect(linksComponent.exists()).toBe(true);
    expect(toggler.attributes('data-target')).toBeUndefined();
    expect(toggler.attributes('aria-expanded')).toBe('false');
    // The links sit inside the closed navbar collapse and the user dropdown,
    // so check the element's own state rather than isVisible().
    expect(links.classes()).not.toContain('show');
    expect(links.attributes('style')).toContain('display: none');

    await toggler.trigger('click');
    expect(toggler.attributes('aria-expanded')).toBe('true');
    await waitForEmit(linksComponent, 'shown');
    expect(links.classes()).toContain('show');
    expect(links.attributes('style') ?? '').not.toContain('display: none');
    expect(
      wrapper.find('button.navbar-toggler').attributes('aria-expanded'),
    ).toBe('false');
  });

  it('Should not show the information of a next registered contest when the user is not registered to a current or upcoming contest', () => {
    const wrapper = shallowMount(common_Navbar, {
      props: { ...propsData, ...{ fromLogin: true } },
    });

    expect(
      wrapper.findComponent(user_NextRegisteredContest).exists(),
    ).toBeFalsy();
  });
});
