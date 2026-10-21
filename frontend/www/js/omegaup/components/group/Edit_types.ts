// Shared enum extracted from Edit.vue so plain `.ts` entry points and sibling
// test files can import it (fork-ts-checker only sees the default export of a
// `.vue` through the ambient shim, so named imports from a `.vue` fail with
// TS2614). Edit.vue re-exports it for existing importers; no runtime change.

export enum AvailableTabs {
  Edit = 'edit',
  Members = 'members',
  Scoreboards = 'scoreboards',
  Identities = 'identities',
}
