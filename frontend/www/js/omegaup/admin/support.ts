import admin_Support from '../components/admin/Support.vue';
import { OmegaUp } from '../omegaup';
import * as api from '../api';
import * as ui from '../ui';
import T from '../lang';
import Vue, { type CreateElement } from 'vue';
import { types } from '../api_types';

interface UpdateEmailRequest {
  email: string;
  newEmail: string;
}

interface AdminSupportInstance {
  username: null | string;
  link: null | string;
  verified: boolean;
  lastLogin: null | Date;
  birthDate: null | Date;
  roles: string[];
  email: null | string;
  contestAlias: null | string;
  contestTitle: null | string;
  contestFound: boolean;
  isContestRecommended: boolean;
}

OmegaUp.on('ready', () => {
  const payload = types.payloadParsers.SupportDetailsPayload();
  const commonPayload = types.payloadParsers.CommonPayload();

  const adminSupport = new Vue({
    el: '#main-container',
    components: {
      'omegaup-admin-support': admin_Support,
    },
    data: () => {
      return {
        username: null as null | string,
        link: null as null | string,
        verified: false,
        lastLogin: null as null | Date,
        birthDate: null as null | Date,
        roles: [] as Array<string>,
        email: null as null | string,
        contestAlias: null as null | string,
        contestTitle: null as null | string,
        contestFound: false,
        isContestRecommended: false,
      };
    },
    render: function (createElement: CreateElement) {
      const self = this as unknown as AdminSupportInstance;
      return createElement('omegaup-admin-support', {
        props: {
          username: self.username,
          link: self.link,
          verified: self.verified,
          lastLogin: self.lastLogin,
          birthDate: self.birthDate,
          roleNamesWithDescription: payload.roleNamesWithDescription,
          roles: self.roles,
          email: self.email,
          contestAlias: self.contestAlias,
          contestTitle: self.contestTitle,
          contestFound: self.contestFound,
          isContestRecommended: self.isContestRecommended,
          maintenanceEnabled: payload.maintenanceMode.enabled,
          maintenanceMessageEs: payload.maintenanceMode.message_es || '',
          maintenanceMessageEn: payload.maintenanceMode.message_en || '',
          maintenanceMessagePt: payload.maintenanceMode.message_pt || '',
          maintenanceType: payload.maintenanceMode.type || 'info',
          preferredLanguage: commonPayload.preferredLanguage,
          maintenancePredefinedTemplates:
            payload.maintenancePredefinedTemplates,
        },
        on: {
          'search-username-or-email': (usernameOrEmail: string): void => {
            (adminSupport as unknown as AdminSupportInstance).username = null;
            (adminSupport as unknown as AdminSupportInstance).link = null;
            (adminSupport as unknown as AdminSupportInstance).lastLogin = null;
            (adminSupport as unknown as AdminSupportInstance).birthDate = null;
            (adminSupport as unknown as AdminSupportInstance).verified = false;
            (adminSupport as unknown as AdminSupportInstance).roles = [];
            (adminSupport as unknown as AdminSupportInstance).email = null;
            api.User.extraInformation({ usernameOrEmail })
              .then((data) => {
                (adminSupport as unknown as AdminSupportInstance).username = data.username;
                (adminSupport as unknown as AdminSupportInstance).verified = data.verified;
                (adminSupport as unknown as AdminSupportInstance).lastLogin = data.last_login ?? null;
                (adminSupport as unknown as AdminSupportInstance).birthDate = data.birth_date ?? null;
                (adminSupport as unknown as AdminSupportInstance).roles = data.roles ?? [];
                (adminSupport as unknown as AdminSupportInstance).email = data.email ?? null;
              })
              .catch(ui.apiError);
          },
          'update-email': (request: UpdateEmailRequest) => {
            api.User.updateMainEmail({
              originalEmail: request.email,
              email: request.newEmail,
            })
              .then(() => {
                ui.success(T.adminSupportEmailUpdatedSuccessfully);
              })
              .catch(ui.apiError);
          },
          'verify-user': (usernameOrEmail: string): void => {
            api.User.verifyEmail({ usernameOrEmail })
              .then(() => {
                (adminSupport as unknown as AdminSupportInstance).verified = true;
                ui.success(T.userVerified);
              })
              .catch(ui.apiError);
          },
          'generate-token': (email: string): void => {
            api.Reset.generateToken({ email })
              .then((data) => {
                ui.success(T.passwordResetTokenWasGeneratedSuccessfully);
                (adminSupport as unknown as AdminSupportInstance).link = data.link;
              })
              .catch(ui.apiError);
          },
          reset: () => {
            (adminSupport as unknown as AdminSupportInstance).username = null;
            (adminSupport as unknown as AdminSupportInstance).link = null;
            (adminSupport as unknown as AdminSupportInstance).verified = false;
            (adminSupport as unknown as AdminSupportInstance).lastLogin = null;
            (adminSupport as unknown as AdminSupportInstance).birthDate = null;
            (adminSupport as unknown as AdminSupportInstance).roles = [];
            (adminSupport as unknown as AdminSupportInstance).email = null;
          },
          'change-role': (role: {
            selected: boolean;
            value: types.UserRole;
          }): void => {
            if (role.selected) {
              api.User.addRole({
                username: (adminSupport as unknown as AdminSupportInstance).username,
                role: role.value.name,
              })
                .then(() => {
                  ui.success(T.userEditSuccess);
                })
                .catch(ui.apiError);
            } else {
              api.User.removeRole({
                username: (adminSupport as unknown as AdminSupportInstance).username,
                role: role.value.name,
              })
                .then(() => {
                  ui.success(T.userEditSuccess);
                })
                .catch(ui.apiError);
            }
          },
          'search-contest': (contestAlias: string): void => {
            (adminSupport as unknown as AdminSupportInstance).contestFound = false;
            (adminSupport as unknown as AdminSupportInstance).contestTitle = null;
            (adminSupport as unknown as AdminSupportInstance).isContestRecommended = false;

            api.Contest.details({ contest_alias: contestAlias })
              .then((data) => {
                (adminSupport as unknown as AdminSupportInstance).contestAlias = contestAlias;
                (adminSupport as unknown as AdminSupportInstance).contestTitle = data.title;
                (adminSupport as unknown as AdminSupportInstance).contestFound = true;
                (adminSupport as unknown as AdminSupportInstance).isContestRecommended = data.recommended;
              })
              .catch(ui.apiError);
          },
          'toggle-recommended': (isNowRecommended: boolean): void => {
            api.Contest.setRecommended({
              contest_alias: (adminSupport as unknown as AdminSupportInstance).contestAlias,
              value: isNowRecommended,
            })
              .then(() => {
                ui.success(
                  isNowRecommended
                    ? T.supportContestSetAsRecommended
                    : T.supportContestRemovedFromRecommended,
                );
              })
              .catch(ui.apiError);
          },
          'reset-contest': () => {
            (adminSupport as unknown as AdminSupportInstance).contestAlias = null;
            (adminSupport as unknown as AdminSupportInstance).contestTitle = null;
            (adminSupport as unknown as AdminSupportInstance).contestFound = false;
            (adminSupport as unknown as AdminSupportInstance).isContestRecommended = false;
          },
          'toggle-maintenance': (enabled: boolean): void => {
            if (!enabled) {
              // If disabling, save immediately
              api.Admin.setMaintenanceMode({
                enabled: false,
                message_es: '',
                message_en: '',
                message_pt: '',
                type: 'info',
              })
                .then(() => {
                  ui.success(T.maintenanceModeInactive);
                })
                .catch(ui.apiError);
            }
          },
          'save-maintenance': (data: {
            enabled: boolean;
            message_es: string;
            message_en: string;
            message_pt: string;
            type: string;
          }): void => {
            api.Admin.setMaintenanceMode({
              enabled: data.enabled,
              message_es: data.message_es,
              message_en: data.message_en,
              message_pt: data.message_pt,
              type: data.type,
            })
              .then(() => {
                ui.success(T.maintenanceModeActive);
              })
              .catch(ui.apiError);
          },
        },
      });
    },
  });
});
