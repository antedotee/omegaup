// Shared enum extracted from ToggleSwitch.vue so plain `.ts` entry points and
// sibling test files can import it (fork-ts-checker only sees the default
// export of a `.vue` through the ambient shim, so named imports from a `.vue`
// fail with TS2614). ToggleSwitch.vue re-exports it for existing importers; no
// runtime change.

export enum ToggleSwitchSize {
  Small = 'small',
  Large = 'large',
}
