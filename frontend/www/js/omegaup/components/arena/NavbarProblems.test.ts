import { shallowMount } from '@vue/test-utils';

import T from '../../lang';
import { omegaup } from '../../omegaup';

import arena_NavbarProblems from './NavbarProblems.vue';

describe('NavbarProblems.vue', () => {
  it('Should handle breadcrumbs in course', () => {
    const wrapper = shallowMount(arena_NavbarProblems, {
      props: {
        activeProblem: null,
        courseAlias: 'curso-prueba',
        courseName: 'Curso de prueba',
        currentAssignment: {
          admin: true,
          alias: 'tarea-prueba',
          assignment_type: 'homework',
          courseAssignments: [],
          description: 'Tarea de prueba',
          director: 'omegaup',
          name: 'Tarea de prueba',
          problems: [],
          problemset_id: 2,
          status: 'ok',
          finish_time: new Date(),
          order: 1,
          start_time: new Date(),
          scoreboard_url: '',
          scoreboard_url_admin: '',
        } as omegaup.Assignment,
        digitsAfterDecimalPoint: 2,
        inAssignment: true,
        problems: [],
      },
    });

    // BootstrapVueNext renders breadcrumb separators as CSS `::before` content
    // (not DOM text), so `wrapper.text()` no longer has characters between the
    // crumbs the way bootstrap-vue 2 did. Assert the crumbs still render in order
    // without requiring literal separator text between them.
    expect(wrapper.text()).toMatch(
      new RegExp(`${T.navCourses}.*?Curso de prueba.*?Tarea de prueba`, 'ms'),
    );
  });

  it('Should handle empty breadcrumbs in contest', async () => {
    const wrapper = shallowMount(arena_NavbarProblems, {
      props: {
        activeProblem: null,
        contestAlias: 'concurso-prueba',
        courseName: 'Concurso de prueba',
        digitsAfterDecimalPoint: 2,
        inAssignment: false,
        problems: [],
      },
      global: {
        stubs: {
          'b-breadcrumb': {
            template: '<div v-bind="$attrs"><slot /></div>',
          },
          'b-breadcrumb-item': {
            template: '<span><slot /></span>',
          },
        },
      },
    });

    expect(wrapper.find('div[data-breadcrumbs]').exists()).toBeFalsy();
  });
});
