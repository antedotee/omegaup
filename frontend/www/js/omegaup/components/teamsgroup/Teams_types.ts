// Shared enum extracted from Teams.vue so plain `.ts` entry points and sibling
// test files can import it (fork-ts-checker only sees the default export of a
// `.vue` through the ambient shim, so named imports from a `.vue` fail with
// TS2614). Teams.vue re-exports it for existing importers; no runtime change.

export enum AvailableForms {
  None,
  Edit,
  ChangePassword,
  AddMembers,
}
