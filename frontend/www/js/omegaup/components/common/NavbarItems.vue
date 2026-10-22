<template>
  <div class="me-auto mt-2 mt-lg-0">
    <ul
      v-if="!omegaUpLockDown && (!inContest || isAdmin)"
      class="navbar-nav align-items-start px-3"
    >
      <BNavItemDropdown
        v-if="isLoggedIn"
        class="nav-contests nav-item-align"
        :class="{ active: navbarSection === 'contests' }"
        no-wrapper
        no-fade
        toggle-class="px-2"
        :toggle-attrs="navToggleAttrs('data-nav-contests')"
        menu-class="fullwidth-mobile-fit-lg navbar-item-dropdown"
      >
        <template #button-content>{{ T.wordsContests }}</template>
        <slot name="contests-items">
          <omegaup-navbar-item
            v-for="(entry, index) in contestsEntries"
            :key="`contests-item-${index}`"
            :title="entry.title"
            :description="entry.description"
            :icon="entry.icon"
            :href="entry.href"
            v-bind="entry.dataAttr ? { [entry.dataAttr]: '' } : {}"
          />
        </slot>
      </BNavItemDropdown>
      <li v-else :class="{ active: navbarSection === 'contests' }">
        <a class="nav-link px-2" href="/arena/" data-nav-contests-arena>{{
          T.wordsContests
        }}</a>
      </li>

      <BNavItemDropdown
        v-if="isLoggedIn"
        class="nav-courses nav-item-align"
        :class="{ active: navbarSection === 'courses' }"
        no-wrapper
        no-fade
        toggle-class="px-2"
        :toggle-attrs="navToggleAttrs('data-nav-courses')"
        menu-class="fullwidth-mobile-fit-lg navbar-item-dropdown"
      >
        <template #button-content>{{ T.navCourses }}</template>
        <slot name="courses-items">
          <omegaup-navbar-item
            v-for="(entry, index) in coursesEntries"
            :key="`courses-item-${index}`"
            :title="entry.title"
            :description="entry.description"
            :icon="entry.icon"
            :href="entry.href"
            v-bind="entry.dataAttr ? { [entry.dataAttr]: '' } : {}"
          />
        </slot>
      </BNavItemDropdown>
      <li
        v-else
        :class="{ active: navbarSection === 'course' }"
        data-nav-course
      >
        <a class="nav-link px-2" href="/course/home/">{{ T.navCourses }}</a>
      </li>

      <BNavItemDropdown
        class="nav-problems nav-item-align"
        :class="{ active: navbarSection === 'problems' }"
        no-wrapper
        no-fade
        toggle-class="px-2"
        :toggle-attrs="navToggleAttrs('data-nav-problems')"
        menu-class="fullwidth-mobile-fit-lg navbar-item-dropdown"
      >
        <template #button-content>{{ T.wordsProblems }}</template>
        <slot name="problems-items">
          <template v-for="(entry, index) in problemsEntries">
            <hr
              v-if="entry.divider"
              :key="`problems-divider-${index}`"
              class="menu-divider"
            />
            <omegaup-navbar-item
              v-else
              :key="`problems-item-${index}`"
              :title="entry.title"
              :description="entry.description"
              :icon="entry.icon"
              :href="entry.href"
              v-bind="entry.dataAttr ? { [entry.dataAttr]: '' } : {}"
            />
          </template>
        </slot>
      </BNavItemDropdown>

      <BNavItemDropdown
        class="nav-rank nav-item-align"
        :class="{ active: navbarSection === 'rank' }"
        no-wrapper
        no-fade
        toggle-class="px-2"
        :toggle-attrs="navToggleAttrs()"
        menu-class="fullwidth-mobile-fit-lg navbar-item-dropdown"
      >
        <template #button-content>{{ T.navRanking }}</template>
        <omegaup-navbar-item
          v-for="(entry, index) in rankingEntries"
          :key="`ranking-item-${index}`"
          :title="entry.title"
          :description="entry.description"
          :icon="entry.icon"
          :href="entry.href"
          v-bind="entry.dataAttr ? { [entry.dataAttr]: '' } : {}"
        />
      </BNavItemDropdown>

      <BNavItemDropdown
        class="nav-item-align"
        no-wrapper
        no-fade
        toggle-class="px-2"
        :toggle-attrs="navToggleAttrs()"
        menu-class="fullwidth-mobile-fit-lg navbar-item-dropdown"
      >
        <template #button-content>{{ T.navHelp }}</template>
        <template v-for="(entry, index) in helpEntries">
          <hr
            v-if="entry.divider"
            :key="`help-divider-${index}`"
            class="menu-divider"
          />
          <omegaup-navbar-item
            v-else
            :key="`help-item-${index}`"
            :title="entry.title"
            :description="entry.description"
            :icon="entry.icon"
            :href="entry.href"
            :target="entry.target"
            :rel="entry.rel"
          />
        </template>
      </BNavItemDropdown>
    </ul>
    <ul v-else class="navbar-nav me-auto"></ul>
  </div>
</template>

<script lang="ts">
import { Vue, Component, Prop, toNative } from 'vue-facing-decorator';
import T from '../../lang';
import {
  NavbarAccess,
  NavbarMenuEntry,
  visibleEntries,
  contestsMenuEntries,
  coursesMenuEntries,
  problemsMenuEntries,
  rankingMenuEntries,
  helpMenuEntries,
} from './navbarMenus';
import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faAward,
  faBalanceScale,
  faBook,
  faBookmark,
  faChalkboardTeacher,
  faChartLine,
  faClipboardCheck,
  faCode,
  faComments,
  faDatabase,
  faFileArchive,
  faFlagCheckered,
  faGraduationCap,
  faHistory,
  faLayerGroup,
  faList,
  faListOl,
  faMedal,
  faNewspaper,
  faPen,
  faPenNib,
  faPlusCircle,
  faRobot,
  faSchool,
  faTrophy,
  faVideo,
} from '@fortawesome/free-solid-svg-icons';
import NavbarItem from './NavbarItem.vue';
import { navToggleAttrs } from './navDropdown';

library.add(
  faAward,
  faBalanceScale,
  faBook,
  faBookmark,
  faChalkboardTeacher,
  faChartLine,
  faClipboardCheck,
  faCode,
  faComments,
  faDatabase,
  faFileArchive,
  faFlagCheckered,
  faGraduationCap,
  faHistory,
  faLayerGroup,
  faList,
  faListOl,
  faMedal,
  faNewspaper,
  faPen,
  faPenNib,
  faPlusCircle,
  faRobot,
  faSchool,
  faTrophy,
  faVideo,
);

@Component({
  components: {
    'omegaup-navbar-item': NavbarItem,
  },
})
class NavbarItems extends Vue {
  @Prop() omegaUpLockDown!: boolean;
  @Prop() inContest!: boolean;
  @Prop() isLoggedIn!: boolean;
  @Prop() isReviewer!: boolean;
  @Prop() isAdmin!: boolean;
  @Prop() isMainUserIdentity!: boolean;
  @Prop() navbarSection!: string;
  @Prop() isUnder13User!: boolean;

  T = T;
  navToggleAttrs = navToggleAttrs;

  get access(): NavbarAccess {
    return {
      isLoggedIn: this.isLoggedIn,
      isMainUserIdentity: this.isMainUserIdentity,
      isUnder13User: this.isUnder13User,
      isReviewer: this.isReviewer,
    };
  }

  get contestsEntries(): NavbarMenuEntry[] {
    return visibleEntries(contestsMenuEntries, this.access);
  }

  get coursesEntries(): NavbarMenuEntry[] {
    return visibleEntries(coursesMenuEntries, this.access);
  }

  get problemsEntries(): NavbarMenuEntry[] {
    return visibleEntries(problemsMenuEntries, this.access);
  }

  get rankingEntries(): NavbarMenuEntry[] {
    return visibleEntries(rankingMenuEntries, this.access);
  }

  get helpEntries(): NavbarMenuEntry[] {
    return visibleEntries(helpMenuEntries, this.access);
  }
}
export default toNative(NavbarItems);
</script>

<style lang="scss" scoped>
// The menu <ul> is rendered by BNavItemDropdown, so it carries no scope id.
@media only screen and (max-width: 992px) {
  :deep(.navbar-item-dropdown) {
    min-width: auto !important;
    width: auto !important;
    max-width: 85vw !important;
    left: auto !important;
    right: 0 !important;

    .dropdown-item {
      white-space: normal !important;
      word-wrap: break-word !important;
      overflow-wrap: break-word !important;
      word-break: break-word !important;
      line-height: 1.4 !important;
      padding: 0.5rem 1rem !important;
      max-width: 100% !important;
      display: block !important;
    }
  }
}

.menu-divider {
  margin-top: 0em;
  margin-bottom: 0em;
  border-width: 2px;
}
</style>
