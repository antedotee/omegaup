// Shared enum extracted from ViewProfile.vue so plain `.ts` entry points can
// import it (fork-ts-checker only sees the default export of a `.vue` through
// the ambient shim). The SFC re-exports it for existing importers.

export enum ViewProfileTabs {
  Badges = 'badges',
  Problems = 'problems',
  Contests = 'contests',
  CreatedContent = 'created-content',
  Data = 'data',
  Charts = 'charts',
}
