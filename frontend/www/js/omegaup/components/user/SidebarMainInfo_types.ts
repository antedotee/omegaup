// Shared data extracted from SidebarMainInfo.vue so plain `.ts` entry points
// and sibling test files can import it (fork-ts-checker only sees the default
// export of a `.vue` through the ambient shim, so named imports from a `.vue`
// fail with TS2614). SidebarMainInfo.vue re-exports it for existing importers;
// no runtime change.

import T from '../../lang';

export const urlMapping: { key: string; title: string; visible: boolean }[] = [
  { key: 'view-profile', title: T.userEditViewProfile, visible: true },
  {
    key: 'edit-basic-information',
    title: T.profileBasicInformation,
    visible: true,
  },
  { key: 'edit-preferences', title: T.userEditPreferences, visible: true },
  { key: 'manage-schools', title: T.userEditManageSchools, visible: true },
  { key: 'manage-identities', title: T.profileManageIdentities, visible: true },
  { key: 'manage-api-tokens', title: T.profileManageApiTokens, visible: true },
  { key: 'change-password', title: T.userEditChangePassword, visible: false },
  { key: 'add-password', title: T.userEditAddPassword, visible: false },
  { key: 'change-email', title: T.userEditChangeEmail, visible: false },
  { key: 'delete-account', title: T.userEditDeleteAccount, visible: true },
];
