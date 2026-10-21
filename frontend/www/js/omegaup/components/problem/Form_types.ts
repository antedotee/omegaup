// Shared enum extracted from Form.vue so plain `.ts` entry points can import it
// (fork-ts-checker only sees the default export of a `.vue` through the ambient
// shim). The SFC re-exports it for existing importers; no runtime change.

export enum CreationMethods {
  Creator = 'creator',
  Zip = 'zip',
}
