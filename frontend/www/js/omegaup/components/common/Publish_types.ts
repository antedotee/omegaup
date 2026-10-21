// Shared enum extracted from Publish.vue so plain `.ts` entry points and
// sibling test files can import it (fork-ts-checker only sees the default
// export of a `.vue` through the ambient shim, so named imports from a `.vue`
// fail with TS2614). Publish.vue re-exports it for existing importers; no
// runtime change.

export enum AdmissionMode {
  Private = 'private',
  Registration = 'registration',
  Public = 'public',
}
