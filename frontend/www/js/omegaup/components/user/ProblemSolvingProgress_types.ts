// Shared interface extracted from ProblemSolvingProgress.vue so plain `.ts`
// modules can import it (fork-ts-checker only sees the default export of a
// `.vue` through the ambient shim). The SFC re-exports it for existing
// importers.

export interface DifficultyStats {
  easy: number;
  medium: number;
  hard: number;
  unlabelled: number;
}
