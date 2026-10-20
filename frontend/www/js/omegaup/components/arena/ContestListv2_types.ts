// Shared enums/types extracted from ContestListv2.vue so plain `.ts` entry
// points can import them (fork-ts-checker only sees the default export of a
// `.vue` through the ambient shim). The SFC re-exports them for existing
// importers; no runtime change.

export enum ContestTab {
  Current = 'current',
  Future = 'future',
  Past = 'past',
}
export enum ContestOrder {
  None = 'none',
  Title = 'title',
  Ends = 'ends',
  Duration = 'duration',
  Organizer = 'organizer',
  Contestants = 'contestants',
  SignedUp = 'signedup',
}
export enum ContestFilter {
  SignedUp = 'signedup',
  OnlyRecommended = 'recommended',
  All = 'all',
}
export interface UrlParams {
  page: number;
  tab_name: ContestTab;
  query: string;
  sort_order: ContestOrder;
  filter: ContestFilter;
  replaceState?: boolean; // When true, use replaceState instead of pushState (for browser navigation)
}
