<template>
  <BNavItemDropdown
    class="d-lg-flex align-items-center"
    no-wrapper
    no-fade
    placement="bottom-end"
    toggle-class="px-2 notification-toggle"
    :toggle-attrs="navToggleAttrs()"
    menu-class="dropdown-menu-end notification-dropdown position-absolute mt-2"
  >
    <template #button-content>
      <font-awesome-icon :icon="['fas', 'bell']" />
      <span
        v-show="!!notifications.length"
        class="badge bg-danger count-badge"
        >{{ notifications.length }}</span
      >
    </template>
    <div v-if="notifications.length === 0" class="text-center">
      {{ T.notificationsNoNewNotifications }}
    </div>
    <a
      v-else
      class="dropdown-item"
      href="#"
      @click="$emit('read', notifications, null)"
    >
      {{ T.notificationsMarkAllAsRead }} ✔️
    </a>
    <transition-group name="list"
      ><omegaup-notification
        v-for="notification in notifications"
        :key="notification.notification_id"
        data-notification-list
        :notification="notification"
        @remove="readSingleNotification"
      ></omegaup-notification
    ></transition-group>
  </BNavItemDropdown>
</template>

<script lang="ts">
import { Vue, Component, Prop, toNative } from 'vue-facing-decorator';
import { types } from '../../api_types';
import T from '../../lang';
import Notification from './Notification.vue';
import { navToggleAttrs } from '../common/navDropdown';

import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { faBell } from '@fortawesome/free-solid-svg-icons';
library.add(faBell);

@Component({
  components: {
    FontAwesomeIcon,
    'omegaup-notification': Notification,
  },
})
class NotificationList extends Vue {
  @Prop() notifications!: types.Notification[];
  T = T;
  navToggleAttrs = navToggleAttrs;

  readSingleNotification(notification: types.Notification, url?: string): void {
    this.$emit('read', [notification], url);
  }
}
export default toNative(NotificationList);
</script>

<style scoped>
/* The toggle and the menu <ul> are rendered by BNavItemDropdown and carry no
   scope id, so their rules go through >>> under the scoped root <li>. */
>>> .notification-toggle {
  font-size: 1.4rem;
  position: relative;
}

.count-badge {
  position: absolute;
  bottom: 0;
  right: 0.9rem;
  font-size: 0.75rem;
  display: block;
}

.navbar-expand-lg .navbar-nav >>> .dropdown-menu {
  min-width: 84vw;

  @media only screen and (min-width: 767px) {
    min-width: 35rem;
  }
}

>>> .notification-dropdown {
  max-width: 100vw;
  max-height: 600px;
  overflow-y: auto;
}

/* Transitions */
.list-enter-active,
.list-leave-active {
  transition: all 0.75s;
}

.list-enter,
.list-leave-to {
  opacity: 0;
}

@media only screen and (max-width: 991px) {
  >>> .notification-dropdown {
    position: fixed !important;
    transform: none !important; /* floating-ui writes an inline translate */
    top: 60px !important;
    right: 10px !important;
    left: 10px !important;
    width: auto !important;
    min-width: unset !important;
    max-width: unset !important;
  }
}
</style>
