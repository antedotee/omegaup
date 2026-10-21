// Shared enum/type declarations extracted from Details.vue so that plain `.ts`
// modules (entry points) can import them. fork-ts-checker resolves `.vue`
// modules only through the ambient `declare module '*.vue'` shim, which exposes
// just the default export, so named imports from the SFC fail type-checking.
// Importing these from a real `.ts` module keeps types available everywhere
// without changing runtime behavior; the SFC re-exports them for existing
// importers.

export enum PopupDisplayed {
  None,
  RunSubmit,
  RunDetails,
  Promotion,
  Demotion,
  Reviewer,
}
