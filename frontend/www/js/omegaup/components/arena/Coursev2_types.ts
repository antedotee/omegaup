// Shared enum extracted from Coursev2.vue so plain `.ts` entry points can
// import it (fork-ts-checker only sees the default export of a `.vue` through
// the ambient shim). The SFC re-exports it for existing importers.

export enum Tabs {
  Summary = 'summary',
  Ranking = 'ranking',
}
